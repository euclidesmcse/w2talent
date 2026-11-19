-- 3.5a Canal WhatsApp: número confirmado por código e avisos ao candidato
ALTER TABLE "CandidateProfile" ADD COLUMN "whatsappNumero" TEXT,
ADD COLUMN "whatsappVerificadoEm" TIMESTAMP(3),
ADD COLUMN "whatsappCodigoHash" TEXT,
ADD COLUMN "whatsappCodigoNumero" TEXT,
ADD COLUMN "whatsappCodigoExpira" TIMESTAMP(3),
ADD COLUMN "whatsappCodigoTentativas" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "CandidateProfile_whatsappNumero_idx" ON "CandidateProfile"("whatsappNumero");

CREATE TABLE "WhatsappAviso" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "dia" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'fila',
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "erro" TEXT,
    "enviadoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappAviso_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WhatsappAviso_candidateId_tipo_dia_key" ON "WhatsappAviso"("candidateId", "tipo", "dia");

CREATE INDEX "WhatsappAviso_candidateId_dia_idx" ON "WhatsappAviso"("candidateId", "dia");

CREATE INDEX "WhatsappAviso_createdAt_idx" ON "WhatsappAviso"("createdAt");

ALTER TABLE "WhatsappAviso" ADD CONSTRAINT "WhatsappAviso_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
