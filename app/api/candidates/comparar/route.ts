import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirConta, NO_STORE } from "@/lib/sessao";
import { empresaDaConta } from "@/lib/empresa";
import { idsDoPedido } from "@/lib/comparar";
import { montarComparacao, vagaDaEmpresa } from "@/lib/comparar-montar";
import { comTraducaoDasFichas, idiomaDoPedido } from "@/lib/traducao";

/**
 * 2.3a Comparar candidatos (plano 2.3, D3 e D6): só recrutador logado com autenticador,
 * até 10 perfis ativos, vaga de referência só da própria empresa. Contato só mascarado.
 */
export async function POST(req: NextRequest) {
  const acesso = await exigirConta(req, { perfil: "recrutador" });
  if ("erro" in acesso) return acesso.erro;
  const body = (await req.json().catch(() => ({}))) as { ids?: unknown; vaga?: unknown; lang?: unknown };
  const ids = idsDoPedido(body.ids);
  if (!ids) return NextResponse.json({ error: "ids" }, { status: 422, headers: NO_STORE });

  try {
    let vaga = null;
    if (typeof body.vaga === "string" && body.vaga) {
      const empresa = await empresaDaConta(prisma, acesso.conta.id);
      vaga = await vagaDaEmpresa(prisma, body.vaga, empresa?.id);
      if (!vaga) return NextResponse.json({ error: "vaga_nao_encontrada" }, { status: 404, headers: NO_STORE });
    }
    const { itens, fora } = await montarComparacao(prisma, ids, vaga);
    // 2.7b: a tela mostra a tradução; os arquivos exportados saem com o texto original (vem junto).
    const comTraducao = await comTraducaoDasFichas(prisma, itens, idiomaDoPedido(req, body.lang));
    return NextResponse.json({ vaga: vaga ? { id: vaga.id, titulo: vaga.titulo } : null, itens: comTraducao, fora }, { headers: NO_STORE });
  } catch (e) {
    console.error("[candidates/comparar] falhou:", e instanceof Error ? e.name : e);
    return NextResponse.json({ error: "erro" }, { status: 500, headers: NO_STORE });
  }
}

export const dynamic = "force-dynamic";
