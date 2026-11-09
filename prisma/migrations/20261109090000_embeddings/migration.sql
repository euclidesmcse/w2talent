-- AlterTable
ALTER TABLE "CandidateProfile" ADD COLUMN     "embeddedAt" TIMESTAMP(3),
ADD COLUMN     "embeddingHash" TEXT,
ADD COLUMN     "embeddingModel" TEXT;

-- AlterTable
ALTER TABLE "Vacancy" ADD COLUMN     "embeddedAt" TIMESTAMP(3),
ADD COLUMN     "embeddingHash" TEXT,
ADD COLUMN     "embeddingModel" TEXT;

-- CreateTable
CREATE TABLE "QueryEmbedding" (
    "hash" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "embedding" vector(1024) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QueryEmbedding_pkey" PRIMARY KEY ("hash")
);

-- CreateIndex
CREATE INDEX "QueryEmbedding_createdAt_idx" ON "QueryEmbedding"("createdAt");


-- 1.5.9: índices da busca (o Prisma não descreve estes tipos de índice no schema).
-- HNSW por cosseno para o vetor (bge-m3, 1024) e GIN para o texto (tsvector).
CREATE INDEX IF NOT EXISTS "Vacancy_embedding_hnsw_idx" ON "Vacancy" USING hnsw ("embedding" vector_cosine_ops);
CREATE INDEX IF NOT EXISTS "CandidateProfile_embedding_hnsw_idx" ON "CandidateProfile" USING hnsw ("embedding" vector_cosine_ops);
CREATE INDEX IF NOT EXISTS "Vacancy_searchVector_gin_idx" ON "Vacancy" USING gin ("searchVector");
CREATE INDEX IF NOT EXISTS "CandidateProfile_searchVector_gin_idx" ON "CandidateProfile" USING gin ("searchVector");

-- Os vetores antigos eram de zeros (stub da Fase 1): apaga para a reindexação refazer.
UPDATE "Vacancy" SET "embedding" = NULL;
UPDATE "CandidateProfile" SET "embedding" = NULL;
