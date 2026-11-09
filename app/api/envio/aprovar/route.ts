import { NextRequest, NextResponse } from "next/server";
import { pedidoDeEnvio, NO_STORE } from "@/lib/envio-request";
import { aprovarVaga, desfazerAprovacao } from "@/lib/envio";

/** Aprova uma vaga (guarda o hash do que a pessoa leu) ou desfaz a aprovação. */
export async function POST(req: NextRequest) {
  const p = await pedidoDeEnvio(req);
  if ("erro" in p) return p.erro;
  const { db, perfil, body } = p;
  const vacancyId = typeof body.vacancyId === "string" ? body.vacancyId.slice(0, 64) : "";
  if (!vacancyId) return NextResponse.json({ error: "vaga_obrigatoria" }, { status: 400, headers: NO_STORE });
  try {
    if (body.aprovar === false) {
      await desfazerAprovacao(db, perfil.id, vacancyId);
      return NextResponse.json({ ok: true, estado: "nova" }, { headers: NO_STORE });
    }
    const hash = typeof body.hash === "string" ? body.hash.slice(0, 128) : "";
    const r = await aprovarVaga(db, perfil.id, vacancyId, hash);
    if (!r.ok) return NextResponse.json({ error: r.motivo }, { status: r.motivo === "nao_encontrada" ? 404 : 409, headers: NO_STORE });
    return NextResponse.json({ ok: true, estado: "aprovada", aprovadaEm: r.aprovadaEm }, { headers: NO_STORE });
  } catch (e) {
    console.error("[envio/aprovar] falhou:", e instanceof Error ? e.name : e);
    return NextResponse.json({ error: "erro" }, { status: 500, headers: NO_STORE });
  }
}

export const dynamic = "force-dynamic";
