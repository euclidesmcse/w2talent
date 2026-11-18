-- 2.6a Assistente de dúvidas (plano aprovado pelo Euclides em 2026-11-18).
CREATE TABLE "AjudaTrecho" (
    "id" TEXT NOT NULL,
    "idioma" TEXT NOT NULL,
    "versao" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "secao" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "embedding" vector(1024),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AjudaTrecho_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AjudaTrecho_idioma_slug_ordem_key" ON "AjudaTrecho"("idioma", "slug", "ordem");
CREATE INDEX "AjudaTrecho_idioma_versao_idx" ON "AjudaTrecho"("idioma", "versao");

CREATE TABLE "PerguntaSemResposta" (
    "id" TEXT NOT NULL,
    "idioma" TEXT NOT NULL,
    "tela" TEXT,
    "texto" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "similaridade" DOUBLE PRECISION,
    "enviadaEquipe" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PerguntaSemResposta_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PerguntaSemResposta_createdAt_idx" ON "PerguntaSemResposta"("createdAt");
