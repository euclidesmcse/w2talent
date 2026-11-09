import { NextRequest, NextResponse } from "next/server";
import { pedidoDeEnvio, NO_STORE } from "@/lib/envio-request";
import { listarEnviadas } from "@/lib/envio";

/** Candidaturas enviadas pelo perfil (Minhas candidaturas e o "Enviada em" da lista de vagas). */
export async function POST(req: NextRequest) {
  const p = await pedidoDeEnvio(req);
  if ("erro" in p) return p.erro;
  try {
    return NextResponse.json({ applications: await listarEnviadas(p.db, p.perfil.id) }, { headers: NO_STORE });
  } catch (e) {
    console.error("[envio/enviadas] falhou:", e instanceof Error ? e.name : e);
    return NextResponse.json({ error: "erro" }, { status: 500, headers: NO_STORE });
  }
}

export const dynamic = "force-dynamic";
