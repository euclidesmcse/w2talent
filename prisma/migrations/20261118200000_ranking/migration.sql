-- 3.1 Ranking adaptativo
CREATE TABLE "RankingWeights" (
    "id" TEXT NOT NULL,
    "escopo" TEXT NOT NULL,
    "escopoId" TEXT NOT NULL DEFAULT '',
    "pesos" JSONB NOT NULL,
    "n" INTEGER NOT NULL,
    "nPositivos" INTEGER NOT NULL,
    "nNegativos" INTEGER NOT NULL,
    "desligado" BOOLEAN NOT NULL DEFAULT false,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RankingWeights_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RankingWeights_escopo_escopoId_key" ON "RankingWeights"("escopo", "escopoId");
