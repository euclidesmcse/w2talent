-- 2.6b-1 Atendimento: "Falar com uma pessoa" na Ajuda e Admin > Atendimento.
CREATE TYPE "StatusConversa" AS ENUM ('aberta', 'encerrada');
CREATE TYPE "AutorMensagem" AS ENUM ('pessoa', 'equipe');

CREATE TABLE "Conversa" (
    "id" TEXT NOT NULL,
    "status" "StatusConversa" NOT NULL DEFAULT 'aberta',
    "email" TEXT NOT NULL,
    "userId" TEXT,
    "perfil" TEXT,
    "idioma" TEXT NOT NULL,
    "tela" TEXT,
    "ultimaDe" "AutorMensagem" NOT NULL DEFAULT 'pessoa',
    "ultimaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "encerradaEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversa_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConversaMensagem" (
    "id" TEXT NOT NULL,
    "conversaId" TEXT NOT NULL,
    "autor" "AutorMensagem" NOT NULL,
    "texto" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversaMensagem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConversaCodigo" (
    "tokenHash" TEXT NOT NULL,
    "conversaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversaCodigo_pkey" PRIMARY KEY ("tokenHash")
);

CREATE INDEX "Conversa_status_ultimaEm_idx" ON "Conversa"("status", "ultimaEm");
CREATE INDEX "Conversa_userId_idx" ON "Conversa"("userId");
CREATE INDEX "ConversaMensagem_conversaId_createdAt_idx" ON "ConversaMensagem"("conversaId", "createdAt");
CREATE INDEX "ConversaCodigo_conversaId_idx" ON "ConversaCodigo"("conversaId");

ALTER TABLE "Conversa" ADD CONSTRAINT "Conversa_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversaMensagem" ADD CONSTRAINT "ConversaMensagem_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "Conversa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversaCodigo" ADD CONSTRAINT "ConversaCodigo_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "Conversa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
