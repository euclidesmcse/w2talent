/**
 * Busca no banco (1.5.9): texto (tsvector) + significado (pgvector) numa consulta SQL só,
 * sobre a base inteira, com filtros, total e páginas.
 *
 * Nota = 0,6 × texto + 0,4 × significado (HYBRID_WEIGHTS). Entra no resultado só o que bate no
 * texto (com as equivalências PT/EN/ES de search-synonyms.ts); o significado reordena.
 * Decisão do Euclides em 2026-11-09, depois de medir: com textos curtos o bge-m3 não separa
 * "nuvem" de "cozinheiro" (0,3 a 0,4 nos dois). Medir de novo quando houver vagas reais.
 *
 * O vetor do texto buscado fica guardado 7 dias (tabela QueryEmbedding, só o hash do texto).
 * Se o modelo demorar mais que QUERY_VECTOR_TIMEOUT_MS, a busca sai só por texto e o vetor
 * termina em segundo plano: a próxima busca igual já vem completa.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { EMBEDDING_DIM, EMBEDDING_MODEL, embeddingHash, generateEmbedding, toVectorLiteral, type Embedder } from "./embeddings";
import { runInBackground } from "./background";
import { expandQuery } from "./search-synonyms";

type Db = Pick<PrismaClient, "$queryRaw" | "$executeRaw">;

export const HYBRID_WEIGHTS = { tsvector: 0.6, vector: 0.4 } as const;
export const QUERY_VECTOR_TIMEOUT_MS = 1200;
export const QUERY_CACHE_DAYS = 7;

export type DbSearchParams = {
  q?: string;
  page: number;
  pageSize: number;
  regime?: string;
  modo?: string;
  localidade?: string;
  nivel?: string;
  faixaDe?: number | null;
  faixaAte?: number | null;
  /** Texto para a busca por texto, quando difere de `q` (q segue inteiro para o vetor). */
  textQ?: string;
  /** Basta um destes termos aparecer (as competências da busca, 1.5.12). */
  anyTerms?: string[];
};

export type DbSearchOptions = { db: Db; embed?: Embedder; timeoutMs?: number };

/** Texto buscado normalizado (a chave do cache não muda por maiúscula ou espaço extra). */
export function normalizeQuery(q: string | undefined): string {
  return (q ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function parseVector(text: string): number[] | null {
  try {
    const v = JSON.parse(text);
    return Array.isArray(v) && v.length === EMBEDDING_DIM ? v : null;
  } catch {
    return null;
  }
}

/**
 * Vetor do texto buscado: do cache (7 dias) ou do modelo, esperando no máximo `timeoutMs`.
 * Devolve null quando não há texto, quando o modelo falha ou quando passou do tempo.
 */
export async function queryVector(q: string | undefined, opts: DbSearchOptions): Promise<number[] | null> {
  const norm = normalizeQuery(q);
  if (!norm) return null;
  const { db } = opts;
  const hash = await embeddingHash(`busca\n${norm}`);
  try {
    const hit = await db.$queryRaw<{ v: string }[]>`
      SELECT embedding::text AS v FROM "QueryEmbedding"
      WHERE hash = ${hash} AND "createdAt" > now() - make_interval(days => ${QUERY_CACHE_DAYS})`;
    const cached = hit[0] ? parseVector(hit[0].v) : null;
    if (cached) return cached;
  } catch {
    // cache indisponível: segue para o modelo
  }

  const job = generateEmbedding(norm, { embed: opts.embed }).then(async (v) => {
    const lit = toVectorLiteral(v);
    await db.$executeRaw`
      INSERT INTO "QueryEmbedding" (hash, model, embedding, "createdAt")
      VALUES (${hash}, ${EMBEDDING_MODEL}, ${lit}::vector, now())
      ON CONFLICT (hash) DO UPDATE SET embedding = EXCLUDED.embedding, "createdAt" = now()`.catch(() => 0);
    return v;
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"tempo">((resolve) => {
    timer = setTimeout(() => resolve("tempo"), opts.timeoutMs ?? QUERY_VECTOR_TIMEOUT_MS);
  });
  const winner = await Promise.race([job.then((v) => v, () => null), timeout]);
  if (timer) clearTimeout(timer);
  if (winner === "tempo") {
    // Termina e guarda em segundo plano para a próxima busca igual.
    runInBackground("vetor da busca", () => job);
    return null;
  }
  return winner;
}

// ── SQL ──────────────────────────────────────────────────────────────────

const VACANCY_COLS = Prisma.sql`v.id, v."companyId", v.titulo, v.stack, v.nivel, v.regime, v.localidade,
  v."faixaDe", v."faixaAte", v."faixaMoeda", v."descricaoBullets", v.beneficios, v."tipoContrato",
  v."expiresAt", v.views, v."candidaturasCount", v.status, v."createdAt", v."updatedAt"`;

const CANDIDATE_COLS = Prisma.sql`v.id, v."userId", v.nome, v."fotoUrl", v.titulo, v."resumo3linhas", v.localidade,
  v.modo, v."regimePreferido", v."pretensaoDe", v."pretensaoAte", v."pretensaoMoeda", v.disponibilidade,
  v."objetivoCrescimento", v.stack, v.idiomas, v.email, v.celular, v.status, v."createdAt", v."updatedAt"`;

/** tsvector do registro; quem ainda não foi indexado usa um texto montado na hora. */
const VACANCY_TSV = Prisma.sql`coalesce(v."searchVector", to_tsvector('portuguese',
  concat_ws(' ', v.titulo, v.nivel, v.regime, v.localidade, v.stack::text, v."descricaoBullets"::text)))`;
const CANDIDATE_TSV = Prisma.sql`coalesce(v."searchVector", to_tsvector('portuguese',
  concat_ws(' ', v.titulo, v."resumo3linhas", v."objetivoCrescimento", v.localidade, v.modo, v.stack::text)))`;

function like(s: string): string {
  return `%${s.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

function vacancyFilters(p: DbSearchParams): Prisma.Sql[] {
  const f: Prisma.Sql[] = [Prisma.sql`v.status = 'ativa'`, Prisma.sql`v."expiresAt" > now()`];
  if (p.regime) f.push(Prisma.sql`v.regime ILIKE ${like(p.regime)}`);
  if (p.localidade) f.push(Prisma.sql`v.localidade ILIKE ${like(p.localidade)}`);
  if (p.modo) f.push(Prisma.sql`v.localidade ILIKE ${like(p.modo)}`);
  if (p.nivel) f.push(Prisma.sql`v.nivel ILIKE ${like(p.nivel)}`);
  // Faixa: vaga sem faixa continua aparecendo (fica escondida, não some).
  if (p.faixaDe != null) f.push(Prisma.sql`(v."faixaAte" IS NULL OR v."faixaAte" >= ${p.faixaDe})`);
  if (p.faixaAte != null) f.push(Prisma.sql`(v."faixaDe" IS NULL OR v."faixaDe" <= ${p.faixaAte})`);
  return f;
}

function candidateFilters(p: DbSearchParams): Prisma.Sql[] {
  const f: Prisma.Sql[] = [Prisma.sql`v.status = 'ativo'`, Prisma.sql`v."expiresAt" > now()`];
  if (p.modo) f.push(Prisma.sql`(v.modo ILIKE ${like(p.modo)} OR v.localidade ILIKE ${like(p.modo)})`);
  if (p.localidade) f.push(Prisma.sql`v.localidade ILIKE ${like(p.localidade)}`);
  if (p.regime) f.push(Prisma.sql`EXISTS (SELECT 1 FROM unnest(v."regimePreferido") r WHERE lower(r) = lower(${p.regime}))`);
  if (p.faixaDe != null) f.push(Prisma.sql`(v."pretensaoAte" IS NULL OR v."pretensaoAte" >= ${p.faixaDe})`);
  if (p.faixaAte != null) f.push(Prisma.sql`(v."pretensaoDe" IS NULL OR v."pretensaoDe" <= ${p.faixaAte})`);
  return f;
}

function buildSql(
  table: "Vacancy" | "CandidateProfile",
  cols: Prisma.Sql,
  tsv: Prisma.Sql,
  filters: Prisma.Sql[],
  p: DbSearchParams,
  vec: number[] | null,
): Prisma.Sql {
  const q = normalizeQuery(p.textQ ?? p.q);
  const anyTerms = (p.anyTerms ?? []).map((t) => normalizeQuery(t)).filter(Boolean);
  const offset = (p.page - 1) * p.pageSize;
  const where = Prisma.join(filters, " AND ");
  const from = Prisma.sql`FROM ${Prisma.raw(`"${table}"`)} v WHERE ${where}`;

  if (!q && !anyTerms.length) {
    return Prisma.sql`
      SELECT ${cols}, 0::float8 AS "_rank", 0::float8 AS "_tsRank", 0::float8 AS "_vecRank", count(*) OVER() AS "_total"
      ${from}
      ORDER BY v."updatedAt" DESC
      LIMIT ${p.pageSize} OFFSET ${offset}`;
  }

  // Termos da lista de equivalências viram "qualquer um destes" (nuvem | cloud | nube), em E
  // com o resto do texto; um termo excluído ("-cloud") exclui também os equivalentes.
  const ex = expandQuery(q);
  const parts: Prisma.Sql[] = [];
  if (ex.rest) parts.push(Prisma.sql`websearch_to_tsquery('portuguese', ${ex.rest})`);
  if (anyTerms.length) {
    parts.push(Prisma.sql`(${Prisma.join(anyTerms.map((t) => Prisma.sql`phraseto_tsquery('portuguese', ${t})`), " || ")})`);
  }
  for (const group of ex.anyOf) {
    parts.push(Prisma.sql`(${Prisma.join(group.map((t) => Prisma.sql`phraseto_tsquery('portuguese', ${t})`), " || ")})`);
  }
  for (const t of ex.noneOf) parts.push(Prisma.sql`!!phraseto_tsquery('portuguese', ${t})`);
  const tsq = Prisma.sql`(${Prisma.join(parts, " && ")})`;
  const vecExpr = vec
    ? Prisma.sql`CASE WHEN v.embedding IS NULL THEN 0 ELSE 1 - (v.embedding <=> ${toVectorLiteral(vec)}::vector) END`
    : Prisma.sql`0::float8`;
  return Prisma.sql`
    SELECT s.*, (${HYBRID_WEIGHTS.tsvector} * s."_tsRank" + ${HYBRID_WEIGHTS.vector} * s."_vecRank") AS "_rank",
           count(*) OVER() AS "_total"
    FROM (
      SELECT ${cols},
             ts_rank_cd(${tsv}, ${tsq}, 32)::float8 AS "_tsRank",
             (${vecExpr})::float8 AS "_vecRank",
             (${tsv} @@ ${tsq}) AS "_textMatch"
      ${from}
    ) s
    WHERE s."_textMatch"
    ORDER BY "_rank" DESC, s."updatedAt" DESC
    LIMIT ${p.pageSize} OFFSET ${offset}`;
}

export function buildVacancySearchSql(p: DbSearchParams, vec: number[] | null): Prisma.Sql {
  return buildSql("Vacancy", VACANCY_COLS, VACANCY_TSV, vacancyFilters(p), p, vec);
}

export function buildCandidateSearchSql(p: DbSearchParams, vec: number[] | null): Prisma.Sql {
  return buildSql("CandidateProfile", CANDIDATE_COLS, CANDIDATE_TSV, candidateFilters(p), p, vec);
}

export type DbSearchPage = {
  items: Record<string, any>[];
  total: number;
  /** false quando não existe nenhum registro ativo (o chamador pode mostrar a demonstração). */
  hasAny: boolean;
  /** true quando a nota usou o significado (o vetor da busca chegou a tempo). */
  usedVector: boolean;
};

async function run(kind: "vacancy" | "candidate", p: DbSearchParams, opts: DbSearchOptions): Promise<DbSearchPage> {
  // Sem texto para buscar (só critérios, como "remoto PJ"), a lista sai por data: o vetor não seria usado.
  const hasText = !!normalizeQuery(p.textQ ?? p.q) || !!p.anyTerms?.length;
  const vec = hasText ? await queryVector(p.q, opts) : null;
  const sql = kind === "vacancy" ? buildVacancySearchSql(p, vec) : buildCandidateSearchSql(p, vec);
  const rows = await opts.db.$queryRaw<Record<string, any>[]>(sql);
  let total = rows.length ? Number(rows[0]._total) : 0;
  if (!rows.length && p.page > 1) {
    // Página além do fim (ex.: itens expiraram): o total vem da primeira página.
    const first = kind === "vacancy" ? buildVacancySearchSql({ ...p, page: 1, pageSize: 1 }, vec) : buildCandidateSearchSql({ ...p, page: 1, pageSize: 1 }, vec);
    const head = await opts.db.$queryRaw<{ _total: bigint | number }[]>(first);
    total = head.length ? Number(head[0]._total) : 0;
  }
  let hasAny = total > 0;
  if (!hasAny) {
    const any =
      kind === "vacancy"
        ? await opts.db.$queryRaw<{ e: boolean }[]>`SELECT EXISTS (SELECT 1 FROM "Vacancy" WHERE status = 'ativa') AS e`
        : await opts.db.$queryRaw<{ e: boolean }[]>`SELECT EXISTS (SELECT 1 FROM "CandidateProfile" WHERE status = 'ativo') AS e`;
    hasAny = Boolean(any[0]?.e);
  }
  const items = rows.map(({ _total, _textMatch, ...r }) => ({
    ...r,
    _rank: Number(r._rank),
    _tsRank: Number(r._tsRank),
    _vecRank: Number(r._vecRank),
  }));
  return { items, total, hasAny, usedVector: Boolean(vec) };
}

export function searchVacanciesDb(p: DbSearchParams, opts: DbSearchOptions): Promise<DbSearchPage> {
  return run("vacancy", p, opts);
}

export function searchCandidatesDb(p: DbSearchParams, opts: DbSearchOptions): Promise<DbSearchPage> {
  return run("candidate", p, opts);
}
