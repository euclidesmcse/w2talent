-- 2.1a Empresa do recrutador (plano 2.1 aprovado em 2026-11-18): liga a conta à empresa.
CREATE TABLE "CompanyMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "papel" TEXT NOT NULL DEFAULT 'dono',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanyMember_userId_key" ON "CompanyMember"("userId");
CREATE INDEX "CompanyMember_companyId_idx" ON "CompanyMember"("companyId");

ALTER TABLE "CompanyMember" ADD CONSTRAINT "CompanyMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyMember" ADD CONSTRAINT "CompanyMember_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
