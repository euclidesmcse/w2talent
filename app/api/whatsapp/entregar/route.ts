/**
 * 3.5a: entrega de um aviso de WhatsApp, chamada pelo consumidor da fila (custom-worker.ts → lib/fila.ts)
 * com o CRON_SECRET no cabeçalho, como a entrega do webhook (3.4a). Roda aqui para usar o Prisma do app.
 * Responde 200 com { resultado: "ok" | "repetir" | "desistir" }; erro desta rota faz a fila tentar de novo.
 */
import { NextRequest, NextResponse } from "next/server";
import { requestHasSecret } from "@/lib/secret";
import { ehWhatsapp } from "@/lib/fila";
import { NO_STORE } from "@/lib/sessao";

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "cron_secret_not_configured" }, { status: 503, headers: NO_STORE });
  if (!requestHasSecret(req, secret, { headerOnly: true })) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  const body = (await req.json().catch(() => null)) as unknown;
  if (!body || !ehWhatsapp(body)) return NextResponse.json({ resultado: "desistir", erro: "mensagem" }, { headers: NO_STORE });
  const t = (body as { tentativa?: unknown }).tentativa;
  const tentativa = typeof t === "number" && t >= 1 ? Math.floor(t) : 1;
  try {
    const [{ prisma }, { entregarAviso }] = await Promise.all([import("@/lib/prisma"), import("@/lib/whatsapp-db")]);
    const r = await entregarAviso(prisma, { tipo: "whatsapp", avisoId: body.avisoId, aviso: body.aviso }, tentativa);
    return NextResponse.json(r, { headers: NO_STORE });
  } catch (e) {
    console.error("[whatsapp] entrega falhou:", e instanceof Error ? e.name : e);
    return NextResponse.json({ error: "erro" }, { status: 500, headers: NO_STORE });
  }
}

export const dynamic = "force-dynamic";
