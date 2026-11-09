-- 1.5.15: data do arquivamento do perfil. A exclusão definitiva (LGPD) conta 30 dias a partir dela.
ALTER TABLE "CandidateProfile" ADD COLUMN "arquivadoEm" TIMESTAMP(3);

-- Perfis já arquivados não tinham a data: contam a partir de agora (nunca apaga antes da hora).
UPDATE "CandidateProfile" SET "arquivadoEm" = NOW() WHERE "status" = 'arquivado' AND "arquivadoEm" IS NULL;

CREATE INDEX "CandidateProfile_arquivadoEm_idx" ON "CandidateProfile"("arquivadoEm");
