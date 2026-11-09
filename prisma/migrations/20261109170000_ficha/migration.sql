-- 1.5.10 + 1.5.11: ficha mínima e Ficha W2.
ALTER TABLE "CandidateProfile" ALTER COLUMN "celular" DROP NOT NULL;
ALTER TABLE "CandidateProfile" ALTER COLUMN "objetivoCrescimento" DROP NOT NULL;
ALTER TABLE "CandidateProfile" ADD COLUMN "senioridade" TEXT;
ALTER TABLE "CandidateProfile" ADD COLUMN "mudanca" BOOLEAN;
ALTER TABLE "CandidateProfile" ADD COLUMN "fichaW2" JSONB;

-- Limite diário de leituras de CV e Fichas W2 por IP (hash), para a tela sem login.
CREATE TABLE "UsoDiario" (
    "chave" TEXT NOT NULL,
    "dia" TEXT NOT NULL,
    "total" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "UsoDiario_pkey" PRIMARY KEY ("chave","dia")
);
