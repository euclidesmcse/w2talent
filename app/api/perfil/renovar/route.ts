import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyRenewToken } from "@/lib/renew-token";
import { renewCandidate } from "@/lib/hygiene";

/**
 * "Continuo procurando" (1.5.15): o link assinado do e-mail renova o perfil por 180 dias, sem login.
 * O link abre a página /renovar, que só renova quando a pessoa aperta o botão (POST), para que
 * antivírus de e-mail que abrem links sozinhos não renovem por ela.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { t?: unknown };
  const check = await verifyRenewToken(typeof body.t === "string" ? body.t : null, process.env.RENEW_LINK_SECRET);
  if (!check.ok) return NextResponse.json({ error: check.erro }, { status: 400 });
  try {
    const r = await renewCandidate(prisma, check.userId);
    if (!r.ok) return NextResponse.json({ error: "perfil_nao_encontrado" }, { status: 404 });
    return NextResponse.json({ ok: true, ate: r.ate.toISOString() });
  } catch (e) {
    console.error("[renovar] falhou:", e instanceof Error ? e.name : e);
    return NextResponse.json({ error: "erro" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
