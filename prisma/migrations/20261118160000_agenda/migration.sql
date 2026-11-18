-- 2.5a Agenda: horários de entrevista oferecidos pelo recrutador e escolhidos pelo candidato.
CREATE TYPE "StatusEntrevista" AS ENUM ('aberta', 'marcada', 'cancelada');

CREATE TABLE "Entrevista" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "recrutadorId" TEXT NOT NULL,
    "duracaoMin" INTEGER NOT NULL,
    "horarios" TIMESTAMP(3)[],
    "linkReuniao" TEXT,
    "tokenHash" TEXT NOT NULL,
    "status" "StatusEntrevista" NOT NULL DEFAULT 'aberta',
    "inicio" TIMESTAMP(3),
    "marcadaEm" TIMESTAMP(3),
    "canceladaEm" TIMESTAMP(3),
    "canceladaPor" TEXT,
    "sequencia" INTEGER NOT NULL DEFAULT 0,
    "fusoRecrutador" TEXT,
    "idiomaRecrutador" TEXT,
    "fusoCandidato" TEXT,
    "emailsPendentes" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Entrevista_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Entrevista_tokenHash_key" ON "Entrevista"("tokenHash");
CREATE INDEX "Entrevista_applicationId_createdAt_idx" ON "Entrevista"("applicationId", "createdAt");
CREATE INDEX "Entrevista_recrutadorId_status_inicio_idx" ON "Entrevista"("recrutadorId", "status", "inicio");
CREATE INDEX "Entrevista_companyId_idx" ON "Entrevista"("companyId");

ALTER TABLE "Entrevista" ADD CONSTRAINT "Entrevista_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
