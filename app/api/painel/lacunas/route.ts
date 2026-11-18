import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirConta, NO_STORE } from "@/lib/sessao";
import { LACUNAS_LOTE_VAGAS, lacunasDasVagas } from "@/lib/painel-lacunas";
import { getSkill } from "@/lib/taxonomy";

/**
 * B1 "O que falta para as vagas" (plano B1, D1 e D5): só o candidato logado, a partir da ficha
 * publicada da conta. Calculado a cada pedido, nada é guardado e não gera sinal de aprendizado.
 */

export async function GET(req: NextRequest) {
  const r = await exigirConta(req, { perfil: "candidato" });
  if ("erro" in r) return r.erro;
  try {
    const perfil = await prisma.candidateProfile.findUnique({ where: { userId: r.conta.id } });
    if (!perfil || perfil.status !== "ativo") return NextResponse.json({ estado: "sem_ficha" }, { headers: NO_STORE });
    const vagas = await prisma.vacancy.findMany({
      where: { status: "ativa", expiresAt: { gt: new Date() } },
      select: { id: true, stack: true, nivel: true, regime: true, localidade: true, faixaDe: true, faixaAte: true, faixaMoeda: true, descricaoBullets: true, createdAt: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: LACUNAS_LOTE_VAGAS,
    });
    const lacunas = lacunasDasVagas(perfil, vagas, { rotulo: (s) => getSkill(s)?.label ?? s });
    return NextResponse.json(lacunas, { headers: NO_STORE });
  } catch (e) {
    console.error("[painel/lacunas] falhou:", e instanceof Error ? e.name : e);
    return NextResponse.json({ error: "erro" }, { status: 500, headers: NO_STORE });
  }
}

export const dynamic = "force-dynamic";
