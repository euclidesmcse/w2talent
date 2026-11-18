-- 2.8 Sinais de aprendizado (antecipado pelo plano "IA para RH (SAP)", 2026-11-18).
CREATE TABLE "FeedbackSignal" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "ator" TEXT NOT NULL,
    "candidateId" TEXT,
    "vacancyId" TEXT,
    "applicationId" TEXT,
    "matchPct" INTEGER,
    "dados" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackSignal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FeedbackSignal_tipo_createdAt_idx" ON "FeedbackSignal"("tipo", "createdAt");
CREATE INDEX "FeedbackSignal_candidateId_createdAt_idx" ON "FeedbackSignal"("candidateId", "createdAt");
CREATE INDEX "FeedbackSignal_vacancyId_idx" ON "FeedbackSignal"("vacancyId");

ALTER TABLE "FeedbackSignal" ADD CONSTRAINT "FeedbackSignal_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeedbackSignal" ADD CONSTRAINT "FeedbackSignal_vacancyId_fkey" FOREIGN KEY ("vacancyId") REFERENCES "Vacancy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
