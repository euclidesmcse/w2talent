-- 3.6a Ajuste fino: exemplos de treino anonimizados (sem id da conta) e registro das exportações (3.6b)
-- CreateEnum
CREATE TYPE "StatusExemploTreino" AS ENUM ('pendente', 'aprovado', 'descartado');

-- CreateTable
CREATE TABLE "ExemploTreino" (
    "id" TEXT NOT NULL,
    "tarefa" TEXT NOT NULL,
    "donoHash" TEXT NOT NULL,
    "conteudoHash" TEXT NOT NULL,
    "idioma" TEXT,
    "sistema" TEXT NOT NULL,
    "entrada" TEXT NOT NULL,
    "saidaIa" TEXT NOT NULL,
    "saidaFinal" TEXT NOT NULL,
    "corrigido" BOOLEAN NOT NULL DEFAULT false,
    "status" "StatusExemploTreino" NOT NULL DEFAULT 'pendente',
    "prova" BOOLEAN NOT NULL DEFAULT false,
    "revisadoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExemploTreino_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportacaoTreino" (
    "id" TEXT NOT NULL,
    "tarefa" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "quem" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExportacaoTreino_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExemploTreino_tarefa_status_idx" ON "ExemploTreino"("tarefa", "status");

-- CreateIndex
CREATE INDEX "ExemploTreino_donoHash_idx" ON "ExemploTreino"("donoHash");

-- CreateIndex
CREATE UNIQUE INDEX "ExemploTreino_tarefa_conteudoHash_key" ON "ExemploTreino"("tarefa", "conteudoHash");

-- CreateIndex
CREATE INDEX "ExportacaoTreino_createdAt_idx" ON "ExportacaoTreino"("createdAt");

