-- 1.5.13 (aprovar antes de enviar): contato da empresa para receber candidaturas
-- e a aprovação de cada vaga pelo candidato, presa ao conteúdo da vaga (hash).
ALTER TABLE "CompanyProfile" ADD COLUMN "emailContato" TEXT;

CREATE TABLE "ApplicationApproval" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "vacancyId" TEXT NOT NULL,
    "vacancyHash" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "aprovadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationApproval_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ApplicationApproval_candidateId_vacancyId_key" ON "ApplicationApproval"("candidateId", "vacancyId");
CREATE INDEX "ApplicationApproval_vacancyId_idx" ON "ApplicationApproval"("vacancyId");

ALTER TABLE "ApplicationApproval" ADD CONSTRAINT "ApplicationApproval_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApplicationApproval" ADD CONSTRAINT "ApplicationApproval_vacancyId_fkey" FOREIGN KEY ("vacancyId") REFERENCES "Vacancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- E-mail da candidatura montado no envio e ainda fora da fila: o Cron diário tenta de novo com o mesmo conteúdo.
ALTER TABLE "Application" ADD COLUMN "emailPendente" JSONB;

-- Conta as candidaturas de um candidato nas últimas 24 h (limite de 30).
CREATE INDEX "Application_candidateId_createdAt_idx" ON "Application"("candidateId", "createdAt");
