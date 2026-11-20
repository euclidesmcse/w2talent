-- Coach IA por vaga (plano 2026-11-20, D6): versão da Ficha W2 e carta para cada vaga.
ALTER TABLE "ApplicationApproval" ADD COLUMN "adaptacao" JSONB;
ALTER TABLE "Application" ADD COLUMN "adaptacao" JSONB;
