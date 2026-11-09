-- 1.5.8 Admin de IA: resultados dos testes de compatibilidade e bloqueio da senha de admin.

-- CreateTable
CREATE TABLE "AiModelTest" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "teste" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "detalhe" TEXT,
    "latenciaMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiModelTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminLoginLock" (
    "chave" TEXT NOT NULL,
    "falhas" INTEGER NOT NULL DEFAULT 0,
    "bloqueadoAte" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminLoginLock_pkey" PRIMARY KEY ("chave")
);

-- CreateIndex
CREATE INDEX "AiModelTest_modelId_teste_createdAt_idx" ON "AiModelTest"("modelId", "teste", "createdAt");

-- AddForeignKey
ALTER TABLE "AiModelTest" ADD CONSTRAINT "AiModelTest_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "AiModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
