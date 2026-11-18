/**
 * 3.4a: entrega de um webhook, chamada pelo consumidor da fila (custom-worker.ts → lib/fila.ts) com o
 * CRON_SECRET no cabeçalho. Roda aqui (e não no consumidor) para usar o Prisma do app com o Hyperdrive.
 * Responde 200 com { resultado: "ok" | "repetir" | "desistir" }; erro desta rota faz a fila tentar de novo.
 */
import { NextRequest, NextResponse } from "next/server";
import { requestHasSecret } from "@/lib/secret";
import { ehWebhook } from "@/lib/fila";
import { entregarWebhook } from "@/lib/webhook";
import { NO_STORE } from "@/lib/sessao";

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "cron_secret_not_configured" }, { status: 503, headers: NO_STORE });
  if (!requestHasSecret(req, secret, { headerOnly: true })) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  const body = (await req.json().catch(() => null)) as unknown;
  if (!body || !ehWebhook(body)) return NextResponse.json({ resultado: "desistir", erro: "mensagem" }, { headers: NO_STORE });
  const t = (body as { tentativa?: unknown }).tentativa;
  const tentativa = typeof t === "number" && t >= 1 ? Math.floor(t) : 1;
  const { tipo, evento, id, companyId, applicationId, occurredAt } = body;
  try {
    const { prisma } = await import("@/lib/prisma");
    const r = await entregarWebhook(prisma, { tipo, evento, id, companyId, applicationId, occurredAt }, tentativa);
    return NextResponse.json(r, { headers: NO_STORE });
  } catch (e) {
    console.error("[webhook] entrega falhou:", e instanceof Error ? e.name : e);
    return NextResponse.json({ error: "erro" }, { status: 500, headers: NO_STORE });
  }
}

export const dynamic = "force-dynamic";
