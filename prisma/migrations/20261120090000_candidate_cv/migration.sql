-- Linha do tempo da carreira (D3/D4): texto do CV com consentimento e resumos por IA guardados.
CREATE TABLE "CandidateCv" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "resumos" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateCv_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CandidateCv_profileId_key" ON "CandidateCv"("profileId");

ALTER TABLE "CandidateCv" ADD CONSTRAINT "CandidateCv_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
