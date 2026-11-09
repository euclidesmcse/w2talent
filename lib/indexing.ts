/**
 * Indexação da busca (1.5.9): grava o vetor (bge-m3) e o tsvector de vagas e perfis.
 *
 * - O texto do vetor nunca tem nome, e-mail ou telefone (lib/embeddings.ts).
 * - Guarda modelo + hash do texto: só pede vetor novo quando o texto ou o modelo mudou.
 * - Chamado em segundo plano ao salvar, e pela rota /api/ai/reindex para o que ficou pendente.
 */
import type { PrismaClient } from "@prisma/client";
import {
  EMBEDDING_MODEL,
  candidateEmbeddingText,
  embeddingHash,
  generateEmbeddings,
  toVectorLiteral,
  vacancyEmbeddingText,
  type Embedder,
} from "./embeddings";
import { buildTsvectorTextCandidate, buildTsvectorTextVacancy } from "./search";

type Db = Pick<PrismaClient, "$queryRaw" | "$executeRaw">;
export type IndexKind = "vacancy" | "candidate";
export type IndexOptions = { db?: Db; embed?: Embedder; force?: boolean };
export type IndexResult = "indexado" | "igual" | "nao_encontrado";

/** Quantos textos vão juntos numa chamada ao modelo. */
export const EMBED_BATCH = 10;

async function defaultDb(): Promise<Db> {
  const { getPrisma } = await import("./prisma");
  return getPrisma();
}

type Row = Record<string, any> & { key: string; embeddingHash: string | null; semVetor: boolean };

const KINDS = {
  vacancy: {
    embedText: vacancyEmbeddingText,
    tsText: buildTsvectorTextVacancy,
    one: (db: Db, key: string) => db.$queryRaw<Row[]>`
      SELECT id AS key, titulo, nivel, regime, localidade, "tipoContrato", stack, "descricaoBullets",
             "embeddingHash", "embeddingModel", (embedding IS NULL) AS "semVetor"
      FROM "Vacancy" WHERE id = ${key}`,
    pending: (db: Db, limit: number) => db.$queryRaw<Row[]>`
      SELECT id AS key, titulo, nivel, regime, localidade, "tipoContrato", stack, "descricaoBullets",
             "embeddingHash", "embeddingModel", (embedding IS NULL) AS "semVetor"
      FROM "Vacancy"
      WHERE status = 'ativa' AND (embedding IS NULL OR "embeddingHash" IS NULL OR "embeddingModel" IS DISTINCT FROM ${EMBEDDING_MODEL})
      ORDER BY "updatedAt" DESC LIMIT ${limit}`,
    countPending: (db: Db) => db.$queryRaw<{ n: bigint | number }[]>`
      SELECT count(*) AS n FROM "Vacancy"
      WHERE status = 'ativa' AND (embedding IS NULL OR "embeddingHash" IS NULL OR "embeddingModel" IS DISTINCT FROM ${EMBEDDING_MODEL})`,
    save: (db: Db, key: string, vec: string, ts: string, hash: string) => db.$executeRaw`
      UPDATE "Vacancy" SET embedding = ${vec}::vector, "searchVector" = to_tsvector('portuguese', ${ts}),
             "embeddingModel" = ${EMBEDDING_MODEL}, "embeddingHash" = ${hash}, "embeddedAt" = now()
      WHERE id = ${key}`,
  },
  candidate: {
    embedText: candidateEmbeddingText,
    tsText: buildTsvectorTextCandidate,
    one: (db: Db, key: string) => db.$queryRaw<Row[]>`
      SELECT "userId" AS key, titulo, "resumo3linhas", "objetivoCrescimento", localidade, modo, stack,
             "embeddingHash", "embeddingModel", (embedding IS NULL) AS "semVetor"
      FROM "CandidateProfile" WHERE "userId" = ${key}`,
    pending: (db: Db, limit: number) => db.$queryRaw<Row[]>`
      SELECT "userId" AS key, titulo, "resumo3linhas", "objetivoCrescimento", localidade, modo, stack,
             "embeddingHash", "embeddingModel", (embedding IS NULL) AS "semVetor"
      FROM "CandidateProfile"
      WHERE status = 'ativo' AND (embedding IS NULL OR "embeddingHash" IS NULL OR "embeddingModel" IS DISTINCT FROM ${EMBEDDING_MODEL})
      ORDER BY "updatedAt" DESC LIMIT ${limit}`,
    countPending: (db: Db) => db.$queryRaw<{ n: bigint | number }[]>`
      SELECT count(*) AS n FROM "CandidateProfile"
      WHERE status = 'ativo' AND (embedding IS NULL OR "embeddingHash" IS NULL OR "embeddingModel" IS DISTINCT FROM ${EMBEDDING_MODEL})`,
    save: (db: Db, key: string, vec: string, ts: string, hash: string) => db.$executeRaw`
      UPDATE "CandidateProfile" SET embedding = ${vec}::vector, "searchVector" = to_tsvector('portuguese', ${ts}),
             "embeddingModel" = ${EMBEDDING_MODEL}, "embeddingHash" = ${hash}, "embeddedAt" = now()
      WHERE "userId" = ${key}`,
  },
} as const;

async function indexRows(kind: IndexKind, rows: Row[], db: Db, embed: Embedder | undefined, force: boolean): Promise<number> {
  const k = KINDS[kind];
  const prepared = await Promise.all(
    rows.map(async (row) => {
      const text = k.embedText(row as any);
      return { row, text, hash: await embeddingHash(text), ts: k.tsText(row as any) };
    }),
  );
  const todo = prepared.filter(
    (p) => force || p.row.semVetor || p.row.embeddingHash !== p.hash || p.row.embeddingModel !== EMBEDDING_MODEL,
  );
  for (let i = 0; i < todo.length; i += EMBED_BATCH) {
    const chunk = todo.slice(i, i + EMBED_BATCH);
    const vectors = await generateEmbeddings(
      chunk.map((p) => p.text),
      { embed },
    );
    for (let j = 0; j < chunk.length; j++) {
      await k.save(db, chunk[j].row.key, toVectorLiteral(vectors[j]), chunk[j].ts, chunk[j].hash);
    }
  }
  return todo.length;
}

async function indexOne(kind: IndexKind, key: string, opts: IndexOptions): Promise<IndexResult> {
  const db = opts.db ?? (await defaultDb());
  const rows = await KINDS[kind].one(db, key);
  if (!rows[0]) return "nao_encontrado";
  const n = await indexRows(kind, rows, db, opts.embed, opts.force ?? false);
  return n > 0 ? "indexado" : "igual";
}

/**
 * Marca o registro como pendente ao salvar, antes da indexação em segundo plano.
 * Se o vetor novo falhar (ex.: orçamento esgotado), o reindex o encontra depois.
 * Na vaga também apaga o tsvector antigo: até reindexar, a busca usa o texto atual.
 */
export async function markForReindex(kind: IndexKind, key: string, opts: { db?: Db } = {}): Promise<void> {
  const db = opts.db ?? (await defaultDb());
  if (kind === "vacancy") {
    await db.$executeRaw`UPDATE "Vacancy" SET "embeddingHash" = NULL, "searchVector" = NULL WHERE id = ${key}`;
  } else {
    await db.$executeRaw`UPDATE "CandidateProfile" SET "embeddingHash" = NULL WHERE "userId" = ${key}`;
  }
}

/** Indexa uma vaga pelo id. Não pede vetor se o texto não mudou. */
export function indexVacancy(id: string, opts: IndexOptions = {}): Promise<IndexResult> {
  return indexOne("vacancy", id, opts);
}

/** Indexa um perfil pelo userId. Não pede vetor se o texto não mudou. */
export function indexCandidate(userId: string, opts: IndexOptions = {}): Promise<IndexResult> {
  return indexOne("candidate", userId, opts);
}

/**
 * Indexa até `limit` registros ativos sem vetor (ou com vetor de outro modelo).
 * Devolve quantos indexou e quantos ainda faltam.
 */
export async function indexPending(
  kind: IndexKind,
  limit: number,
  opts: Omit<IndexOptions, "force"> = {},
): Promise<{ indexados: number; pendentes: number }> {
  const db = opts.db ?? (await defaultDb());
  const k = KINDS[kind];
  const rows = await k.pending(db, limit);
  const indexados = rows.length ? await indexRows(kind, rows, db, opts.embed, true) : 0;
  const [{ n }] = await k.countPending(db);
  return { indexados, pendentes: Number(n) };
}
