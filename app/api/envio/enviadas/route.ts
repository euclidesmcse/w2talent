import { NextRequest, NextResponse } from "next/server";
import { pedidoDeEnvio, NO_STORE } from "@/lib/envio-request";
import { contarEnviadasPorStatus, listarEnviadas } from "@/lib/envio";
import { contarPorStatus } from "@/lib/painel";

/** Candidaturas enviadas pelo perfil (Minhas candidaturas e o "Enviada em" da lista de vagas). */
export async function POST(req: NextRequest) {
  const p = await pedidoDeEnvio(req);
  if ("erro" in p) return p.erro;
  try {
    // applications: as 200 mais recentes; contagem: o histórico todo (números do painel).
    const [applications, grupos] = await Promise.all([listarEnviadas(p.db, p.perfil.id), contarEnviadasPorStatus(p.db, p.perfil.id)]);
    return NextResponse.json({ applications, contagem: contarPorStatus(grupos) }, { headers: NO_STORE });
  } catch (e) {
    console.error("[envio/enviadas] falhou:", e instanceof Error ? e.name : e);
    return NextResponse.json({ error: "erro" }, { status: 500, headers: NO_STORE });
  }
}

export const dynamic = "force-dynamic";
