-- 2.4 Painel RH (plano aprovado em 2026-11-18): etapas da candidatura vistas pelo recrutador.
-- Só acrescenta; as candidaturas que já existem começam em "nova".
CREATE TYPE "EtapaCandidatura" AS ENUM ('nova', 'em_analise', 'entrevista', 'proposta', 'contratada', 'nao_seguiu');

ALTER TABLE "Application" ADD COLUMN "etapa" "EtapaCandidatura" NOT NULL DEFAULT 'nova',
ADD COLUMN "etapaEm" TIMESTAMP(3),
ADD COLUMN "respondidaEm" TIMESTAMP(3),
ADD COLUMN "contatoLiberadoEm" TIMESTAMP(3);

CREATE INDEX "Application_vacancyId_etapa_idx" ON "Application"("vacancyId", "etapa");
