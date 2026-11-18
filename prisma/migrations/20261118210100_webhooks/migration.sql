-- 3.4a Integração com ATS (webhook)
CREATE TABLE "Webhook" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "segredoCifrado" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "falhasSeguidas" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Webhook_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebhookEntrega" (
    "id" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "evento" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "status" INTEGER,
    "erro" TEXT,
    "tentativa" INTEGER NOT NULL,
    "duracaoMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEntrega_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Webhook_companyId_key" ON "Webhook"("companyId");

CREATE INDEX "WebhookEntrega_webhookId_createdAt_idx" ON "WebhookEntrega"("webhookId", "createdAt");

ALTER TABLE "Webhook" ADD CONSTRAINT "Webhook_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WebhookEntrega" ADD CONSTRAINT "WebhookEntrega_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "Webhook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
