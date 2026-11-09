import { NextRequest, NextResponse } from "next/server";
import { pedidoDeEnvio, NO_STORE } from "@/lib/envio-request";
import { enviarCandidaturas } from "@/lib/envio";
import { enqueueEmail } from "@/lib/notifications";

/** Envia as vagas aprovadas: até 10 por vez e 30 nas últimas 24 h. */
export async function POST(req: NextRequest) {
  const p = await pedidoDeEnvio(req);
  if ("erro" in p) return p.erro;
  const { db, perfil, body } = p;
  try {
    const r = await enviarCandidaturas(db, perfil, body.vacancyIds, {
      loteId: typeof body.loteId === "string" ? body.loteId : undefined,
      enviarEmail: enqueueEmail,
    });
    if (!r.ok) {
      const status = r.erro === "limite_dia" ? 429 : 400;
      return NextResponse.json({ error: r.erro, ...r }, { status, headers: NO_STORE });
    }
    return NextResponse.json(r, { headers: NO_STORE });
  } catch (e) {
    console.error("[envio/enviar] falhou:", e instanceof Error ? e.name : e);
    return NextResponse.json({ error: "erro" }, { status: 500, headers: NO_STORE });
  }
}

export const dynamic = "force-dynamic";
