/**
 * Conferência antes de publicar (2.1b, plano 2.1, D4 e D6):
 * - Duplicada (D4): a mesma empresa já tem vaga ativa muito parecida (título ou vetor). Só avisa;
 *   a tela oferece "Atualizar a existente".
 * - Faixa sugerida (D6): mediana das faixas das vagas ativas parecidas (mesmo nível, regime e moeda),
 *   só quando há 5 ou mais vagas de base. Sem base suficiente, não sugere nada.
 * O vetor do rascunho vem do bge-m3; se ele demorar ou falhar, as regras (título e competências) seguem.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { generateEmbedding, toVectorLiteral, vacancyEmbeddingText, type Embedder } from "./embeddings";
import { fold } from "./query-intent";
import { localidadeDaVaga, type RascunhoVaga } from "./vaga-ai";

type Db = PrismaClient;

export const MIN_BASE_FAIXA = 5;
const MAX_BASE_FAIXA = 20;
const VETOR_TIMEOUT_MS = 3000;
/** Semelhança de cosseno a partir da qual duas vagas da mesma empresa são "a mesma vaga". */
export const SIM_DUPLICADA = 0.92;
/** Vaga de outra empresa entra na base da faixa a partir desta semelhança. */
export const SIM_BASE_FAIXA = 0.72;

export type Duplicada = { id: string; titulo: string; updatedAt: string };
export type FaixaSugerida = { de: number; ate: number; base: number; moeda: string };
export type Conferencia = { duplicadas: Duplicada[]; faixa: FaixaSugerida | null };

const VAZIAS = new Set(["de", "da", "do", "das", "dos", "e", "em", "para", "a", "o", "the", "of", "and", "for", "y", "en", "la", "el", "vaga", "job"]);

function palavras(s: string): Set<string> {
  return new Set(
    fold(s)
      .split(/[^a-z0-9+#]+/)
      .filter((w) => w && !VAZIAS.has(w)),
  );
}

function jaccard<T>(a: Set<T>, b: Set<T>): number {
  if (!a.size || !b.size) return 0;
  let comum = 0;
  for (const x of a) if (b.has(x)) comum++;
  return comum / (a.size + b.size - comum);
}

/** 0 a 1: quanto dois títulos dividem as mesmas palavras (sem acento, sem "de", "e"...). */
export function semelhancaTitulo(a: string, b: string): number {
  return jaccard(palavras(a), palavras(b));
}

export function semelhancaSkills(a: string[], b: string[]): number {
  return jaccard(new Set(a), new Set(b));
}

function skillsDe(stack: unknown): string[] {
  return (Array.isArray(stack) ? stack : []).map((s: any) => (typeof s === "string" ? s : s?.skillId)).filter((s): s is string => typeof s === "string");
}

/** Mesmo título, ou título parecido com as mesmas competências. */
export function pareceDuplicada(r: Pick<RascunhoVaga, "titulo" | "stack">, v: { titulo: string; stack: unknown }, sim: number | null): boolean {
  const t = semelhancaTitulo(r.titulo, v.titulo);
  if (t >= 0.75) return true;
  if (sim !== null && sim >= SIM_DUPLICADA) return true;
  return t >= 0.5 && semelhancaSkills(r.stack, skillsDe(v.stack)) >= 0.6;
}

export function mediana(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Mediana do "de" e do "até" das vagas de base, arredondada a 100. Null com menos de 5 vagas. */
export function faixaDaBase(base: { faixaDe: number | null; faixaAte: number | null }[], moeda: string): FaixaSugerida | null {
  const ok = base.filter((b) => typeof b.faixaDe === "number" && typeof b.faixaAte === "number" && b.faixaDe > 0 && b.faixaAte >= b.faixaDe);
  if (ok.length < MIN_BASE_FAIXA) return null;
  const r = (n: number) => Math.round(n / 100) * 100;
  const de = r(mediana(ok.map((b) => b.faixaDe as number)));
  const ate = Math.max(de, r(mediana(ok.map((b) => b.faixaAte as number))));
  return { de, ate, base: ok.length, moeda };
}

async function vetorComTempo(textoVetor: string, embed: Embedder | undefined, timeoutMs: number): Promise<number[] | null> {
  if (!textoVetor.trim()) return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tempo = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });
  try {
    return await Promise.race([generateEmbedding(textoVetor, { embed }).catch(() => null), tempo]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export type OpcoesConferir = { embed?: Embedder; timeoutMs?: number; agora?: Date };

/**
 * Confere o rascunho. `companyId` null (admin sem empresa escolhida) pula a busca de duplicadas.
 * `ignorarId`: a vaga que está sendo editada não conta como duplicada nem como base.
 */
export async function conferirVaga(
  db: Db,
  args: { companyId: string | null; rascunho: RascunhoVaga; ignorarId?: string | null },
  opts: OpcoesConferir = {},
): Promise<Conferencia> {
  const { companyId, rascunho: r } = args;
  const ignorar = args.ignorarId ?? "";
  const agora = opts.agora ?? new Date();
  const temConteudo = !!r.titulo.trim() || r.stack.length > 0;
  if (!temConteudo) return { duplicadas: [], faixa: null };

  const textoVetor = vacancyEmbeddingText({
    titulo: r.titulo,
    nivel: r.nivel || null,
    regime: r.regime || null,
    localidade: localidadeDaVaga(r.cidade, r.modo),
    stack: r.stack.map((skillId) => ({ skillId })),
    descricaoBullets: r.descricaoBullets,
  });
  const vec = await vetorComTempo(textoVetor, opts.embed, opts.timeoutMs ?? VETOR_TIMEOUT_MS);
  const lit = vec ? toVectorLiteral(vec) : null;

  // ── Duplicadas da mesma empresa ──
  const duplicadas: Duplicada[] = [];
  if (companyId) {
    const daEmpresa = await db.vacancy.findMany({
      where: { companyId, status: "ativa", expiresAt: { gt: agora }, NOT: { id: ignorar } },
      select: { id: true, titulo: true, stack: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });
    const sims = new Map<string, number>();
    if (lit && daEmpresa.length) {
      const rows = await db
        .$queryRaw<{ id: string; sim: number }[]>(Prisma.sql`
          SELECT id, 1 - (embedding <=> ${lit}::vector) AS sim FROM "Vacancy"
          WHERE "companyId" = ${companyId} AND status = 'ativa' AND "expiresAt" > ${agora} AND embedding IS NOT NULL AND id <> ${ignorar}`)
        .catch(() => [] as { id: string; sim: number }[]);
      for (const row of rows) sims.set(row.id, Number(row.sim));
    }
    for (const v of daEmpresa) {
      if (pareceDuplicada(r, v, sims.get(v.id) ?? null)) duplicadas.push({ id: v.id, titulo: v.titulo, updatedAt: v.updatedAt.toISOString() });
      if (duplicadas.length >= 3) break;
    }
  }

  // ── Faixa sugerida: mesmo nível, regime e moeda; parecidas pelo vetor ou pelas competências ──
  const filtros = [
    Prisma.sql`status = 'ativa'`,
    Prisma.sql`"expiresAt" > ${agora}`,
    Prisma.sql`"faixaDe" IS NOT NULL`,
    Prisma.sql`"faixaAte" IS NOT NULL`,
    Prisma.sql`COALESCE("faixaMoeda", 'BRL') = ${r.faixaMoeda}`,
    Prisma.sql`id <> ${ignorar}`,
  ];
  if (r.nivel) filtros.push(Prisma.sql`nivel = ${r.nivel}`);
  if (r.regime) filtros.push(Prisma.sql`regime = ${r.regime}`);
  const onde = Prisma.join(filtros, " AND ");
  let base: { faixaDe: number | null; faixaAte: number | null }[] = [];
  if (lit) {
    base = await db
      .$queryRaw<{ faixaDe: number; faixaAte: number }[]>(Prisma.sql`
        SELECT "faixaDe", "faixaAte" FROM "Vacancy"
        WHERE ${onde} AND embedding IS NOT NULL AND 1 - (embedding <=> ${lit}::vector) >= ${SIM_BASE_FAIXA}
        ORDER BY embedding <=> ${lit}::vector
        LIMIT ${MAX_BASE_FAIXA}`)
      .catch(() => []);
  }
  if (base.length < MIN_BASE_FAIXA && r.stack.length) {
    const linhas = await db
      .$queryRaw<{ faixaDe: number; faixaAte: number; stack: unknown }[]>(Prisma.sql`
        SELECT "faixaDe", "faixaAte", stack FROM "Vacancy" WHERE ${onde} ORDER BY "updatedAt" DESC LIMIT 300`)
      .catch(() => []);
    base = linhas
      .map((l) => ({ l, s: semelhancaSkills(r.stack, skillsDe(l.stack)) }))
      .filter((x) => x.s >= 0.34)
      .sort((a, b) => b.s - a.s)
      .slice(0, MAX_BASE_FAIXA)
      .map((x) => x.l);
  }
  return { duplicadas, faixa: faixaDaBase(base, r.faixaMoeda) };
}
