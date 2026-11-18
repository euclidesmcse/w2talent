import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirConta, NO_STORE } from "@/lib/sessao";
import { empresaDaConta } from "@/lib/empresa";
import { withoutContacts } from "@/lib/search";
import { matchCandidato } from "@/lib/match-candidato";
import { idsDoPedido, itemDaComparacao } from "@/lib/comparar";

/**
 * 2.3a Comparar candidatos (plano 2.3, D3 e D6): só recrutador logado com autenticador,
 * até 10 perfis ativos, vaga de referência só da própria empresa. Contato só mascarado.
 */
export async function POST(req: NextRequest) {
  const acesso = await exigirConta(req, { perfil: "recrutador" });
  if ("erro" in acesso) return acesso.erro;
  const body = (await req.json().catch(() => ({}))) as { ids?: unknown; vaga?: unknown };
  const ids = idsDoPedido(body.ids);
  if (!ids) return NextResponse.json({ error: "ids" }, { status: 422, headers: NO_STORE });

  try {
    let vaga = null;
    if (typeof body.vaga === "string" && body.vaga) {
      const empresa = await empresaDaConta(prisma, acesso.conta.id);
      vaga = empresa
        ? await prisma.vacancy.findFirst({
            // Mesmo critério da busca de Candidatos: vaga ativa, no prazo e da empresa de quem pede.
            where: { id: body.vaga, companyId: empresa.id, status: "ativa", expiresAt: { gt: new Date() } },
            select: { id: true, titulo: true, stack: true, nivel: true, regime: true, localidade: true, faixaDe: true, faixaAte: true, faixaMoeda: true, descricaoBullets: true, updatedAt: true, createdAt: true },
          })
        : null;
      if (!vaga) return NextResponse.json({ error: "vaga_nao_encontrada" }, { status: 404, headers: NO_STORE });
    }

    const perfis = await prisma.candidateProfile.findMany({ where: { id: { in: ids }, status: "ativo" } });
    const now = new Date();
    const porId = new Map(perfis.map((p) => [p.id, p]));
    // Na ordem em que o recrutador selecionou; quem saiu do ar (arquivado, apagado) vem em "fora".
    const itens = ids
      .filter((id) => porId.has(id))
      .map((id) => {
        const p = porId.get(id)!;
        const m = vaga ? matchCandidato(p, vaga, now.getTime()) : null;
        return itemDaComparacao(withoutContacts(p), m ? { match: m.pct, gaps: m.gaps } : null, now);
      });
    const fora = ids.filter((id) => !porId.has(id));
    return NextResponse.json({ vaga: vaga ? { id: vaga.id, titulo: vaga.titulo } : null, itens, fora }, { headers: NO_STORE });
  } catch (e) {
    console.error("[candidates/comparar] falhou:", e instanceof Error ? e.name : e);
    return NextResponse.json({ error: "erro" }, { status: 500, headers: NO_STORE });
  }
}

export const dynamic = "force-dynamic";
