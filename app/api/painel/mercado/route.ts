import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirConta, NO_STORE } from "@/lib/sessao";
import { painelMercado } from "@/lib/painel-mercado";
import { getSkill } from "@/lib/taxonomy";

/**
 * 3.2b "Sua pretensão e o mercado" (plano 3.2, D5): só o candidato logado, a partir da ficha
 * publicada da conta. Lê os números já calculados (MarketStat); nada é guardado.
 */
export async function GET(req: NextRequest) {
  const r = await exigirConta(req, { perfil: "candidato" });
  if ("erro" in r) return r.erro;
  try {
    const perfil = await prisma.candidateProfile.findUnique({
      where: { userId: r.conta.id },
      select: { status: true, stack: true, senioridade: true, pretensoes: true },
    });
    if (!perfil || perfil.status !== "ativo") return NextResponse.json({ estado: "sem_ficha" }, { headers: NO_STORE });
    const corpo = await painelMercado(prisma, perfil, (s) => getSkill(s)?.label ?? s);
    return NextResponse.json(corpo, { headers: NO_STORE });
  } catch (e) {
    console.error("[painel/mercado] falhou:", e instanceof Error ? e.name : e);
    return NextResponse.json({ error: "erro" }, { status: 500, headers: NO_STORE });
  }
}

export const dynamic = "force-dynamic";
