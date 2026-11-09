import { NextRequest, NextResponse } from "next/server";
import { requestHasSecret } from "@/lib/secret";
import { runHygiene } from "@/lib/hygiene";
import { prisma } from "@/lib/prisma";
import { enqueueEmail } from "@/lib/notifications";

/**
 * Higiene diária (1.5.15). Chamada pelo Cron Trigger do Worker (custom-worker.ts) às 9h de Brasília,
 * ou à mão com o `CRON_SECRET` no cabeçalho (`x-cron-secret` ou `Authorization: Bearer`).
 * O segredo na URL (`?cron_secret=`) não é aceito aqui.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "cron_secret_not_configured" }, { status: 503 });
  if (!requestHasSecret(req, secret, { headerOnly: true })) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const appUrl = process.env.APP_URL || req.nextUrl.origin;
  try {
    const summary = await runHygiene(prisma, { enqueue: enqueueEmail, appUrl, renewSecret: process.env.RENEW_LINK_SECRET });
    console.log("[higiene]", JSON.stringify(summary));
    return NextResponse.json({ ok: true, ...summary }, { status: 200 });
  } catch (e) {
    console.error("[higiene] falhou:", e instanceof Error ? `${e.name}: ${e.message}` : e);
    return NextResponse.json({ error: "hygiene_failed" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}

export const dynamic = "force-dynamic";
