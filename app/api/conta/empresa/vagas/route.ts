/**
 * Vagas ativas da empresa do recrutador (2.2b): a lista do "Para a vaga" na tela Candidatos.
 * Só recrutador logado com o autenticador ligado; só as vagas da própria empresa.
 */
import { NextRequest, NextResponse } from "next/server";
import { exigirConta, NO_STORE } from "@/lib/sessao";
import { empresaDaConta } from "@/lib/empresa";

export async function GET(req: NextRequest) {
  const r = await exigirConta(req, { perfil: "recrutador" });
  if ("erro" in r) return r.erro;
  const { prisma } = await import("@/lib/prisma");
  const empresa = await empresaDaConta(prisma, r.conta.id);
  if (!empresa) return NextResponse.json({ vagas: [] }, { headers: NO_STORE });
  const vagas = await prisma.vacancy.findMany({
    where: { companyId: empresa.id, status: "ativa", expiresAt: { gt: new Date() } },
    select: { id: true, titulo: true, nivel: true, regime: true, stack: true },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ vagas }, { headers: NO_STORE });
}
