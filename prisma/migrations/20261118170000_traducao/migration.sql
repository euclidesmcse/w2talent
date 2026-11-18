-- 2.7 Tradução automática (aditiva).
-- CreateTable
CREATE TABLE "Traducao" (
    "id" TEXT NOT NULL,
    "vacancyId" TEXT,
    "candidateId" TEXT,
    "idioma" TEXT NOT NULL,
    "idiomaOrigem" TEXT NOT NULL,
    "hashOrigem" TEXT NOT NULL,
    "conteudo" JSONB,
    "modelo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Traducao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Traducao_vacancyId_idioma_key" ON "Traducao"("vacancyId", "idioma");

-- CreateIndex
CREATE UNIQUE INDEX "Traducao_candidateId_idioma_key" ON "Traducao"("candidateId", "idioma");

-- AddForeignKey
ALTER TABLE "Traducao" ADD CONSTRAINT "Traducao_vacancyId_fkey" FOREIGN KEY ("vacancyId") REFERENCES "Vacancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Traducao" ADD CONSTRAINT "Traducao_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

