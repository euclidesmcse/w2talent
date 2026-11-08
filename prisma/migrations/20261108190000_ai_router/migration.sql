-- CreateEnum
CREATE TYPE "AiProviderKind" AS ENUM ('WORKERS_AI', 'OPENAI_COMPATIBLE', 'ANTHROPIC', 'GOOGLE');

-- CreateTable
CREATE TABLE "AiProvider" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "AiProviderKind" NOT NULL,
    "gatewayPath" TEXT,
    "baseUrl" TEXT,
    "chaveCifrada" TEXT,
    "chaveFinal" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT false,
    "aceitaDadosPessoais" BOOLEAN NOT NULL DEFAULT false,
    "notaPrivacidade" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiModel" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "contexto" INTEGER,
    "precoEntradaUsdMilhao" DOUBLE PRECISION,
    "precoSaidaUsdMilhao" DOUBLE PRECISION,
    "embeddingDim" INTEGER,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskRoute" (
    "tarefa" TEXT NOT NULL,
    "modo" TEXT NOT NULL DEFAULT 'automatico',
    "modelos" TEXT[],
    "orcamentoDiarioUsd" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskRoute_pkey" PRIMARY KEY ("tarefa")
);

-- CreateTable
CREATE TABLE "AiInteraction" (
    "id" TEXT NOT NULL,
    "tarefa" TEXT NOT NULL,
    "fornecedor" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "erro" TEXT,
    "tokensEntrada" INTEGER,
    "tokensSaida" INTEGER,
    "custoUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "latenciaMs" INTEGER NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiProvider_nome_key" ON "AiProvider"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "AiModel_providerId_modelo_key" ON "AiModel"("providerId", "modelo");

-- CreateIndex
CREATE INDEX "AiInteraction_createdAt_idx" ON "AiInteraction"("createdAt");

-- CreateIndex
CREATE INDEX "AiInteraction_tarefa_createdAt_idx" ON "AiInteraction"("tarefa", "createdAt");

-- AddForeignKey
ALTER TABLE "AiModel" ADD CONSTRAINT "AiModel_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "AiProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

