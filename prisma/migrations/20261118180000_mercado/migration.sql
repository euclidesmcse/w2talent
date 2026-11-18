-- 3.2a Inteligência de mercado: agregados anônimos (MarketStat).
CREATE TABLE "MarketStat" (
    "id" TEXT NOT NULL,
    "semana" TIMESTAMP(3) NOT NULL,
    "metrica" TEXT NOT NULL,
    "skillId" TEXT NOT NULL DEFAULT '',
    "nivel" TEXT NOT NULL DEFAULT '',
    "regime" TEXT NOT NULL DEFAULT '',
    "modo" TEXT NOT NULL DEFAULT '',
    "moeda" TEXT NOT NULL DEFAULT '',
    "n" INTEGER NOT NULL,
    "nEmpresas" INTEGER,
    "nRecentes" INTEGER,
    "nAnteriores" INTEGER,
    "p25" DOUBLE PRECISION,
    "p50" DOUBLE PRECISION,
    "p75" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketStat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketStat_semana_metrica_skillId_nivel_regime_modo_moeda_key" ON "MarketStat"("semana", "metrica", "skillId", "nivel", "regime", "modo", "moeda");
CREATE INDEX "MarketStat_metrica_skillId_idx" ON "MarketStat"("metrica", "skillId");
