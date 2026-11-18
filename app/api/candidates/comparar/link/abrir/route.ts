import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirConta, NO_STORE } from "@/lib/sessao";
import { empresaDaConta } from "@/lib/empresa";
import { montarComparacao, vagaDaEmpresa } from "@/lib/comparar-montar";
import { lerLinkComparacao } from "@/lib/comparar-link";
import { comTraducaoDasFichas, idiomaDoPedido } from "@/lib/traducao";

/**
 * 2.3 Abre o link compartilhado da comparação. O token vem no corpo (nunca na URL).
 * - sem login → 401 "login" (a tela pede para entrar); recrutador sem autenticador → 403, como na tela Comparar
 * - token adulterado → 404 "link_invalido"; vencido (14 dias) → 410 "link_vencido"
 * - quem não é da empresa que criou o link → 403 "sem_acesso"
 * Nenhum dado de candidato sai antes dessas checagens. A comparação é a mesma da tela Comparar.
 */
export async function POST(req: NextRequest) {
  const acesso = await exigirConta(req, { perfil: "recrutador" });
  if ("erro" in acesso) return acesso.erro;
  const body = (await req.json().catch(() => ({}))) as { t?: unknown; lang?: unknown };
  try {
    const { segredoDoLogin } = await import("@/lib/auth-server");
    const lido = await lerLinkComparacao(body.t, segredoDoLogin());
    if (!lido.ok) return NextResponse.json({ error: lido.erro }, { status: lido.erro === "link_vencido" ? 410 : 404, headers: NO_STORE });
    const { conteudo } = lido;
    const empresa = await empresaDaConta(prisma, acesso.conta.id);
    if (!empresa || empresa.id !== conteudo.empresa) return NextResponse.json({ error: "sem_acesso" }, { status: 403, headers: NO_STORE });
    // A vaga que saiu do ar (ou mudou de empresa) não entra: compara sem ela e avisa.
    const vaga = conteudo.vaga ? await vagaDaEmpresa(prisma, conteudo.vaga, empresa.id) : null;
    const { itens, fora } = await montarComparacao(prisma, conteudo.ids, vaga);
    const comTraducao = await comTraducaoDasFichas(prisma, itens, idiomaDoPedido(req, body.lang));
    return NextResponse.json(
      {
        vaga: vaga ? { id: vaga.id, titulo: vaga.titulo } : null,
        vagaSumiu: !!conteudo.vaga && !vaga,
        itens: comTraducao,
        fora,
        expira: new Date(conteudo.expira).toISOString(),
      },
      { headers: NO_STORE },
    );
  } catch (e) {
    console.error("[candidates/comparar/link/abrir] falhou:", e instanceof Error ? e.name : "erro");
    return NextResponse.json({ error: "erro" }, { status: 500, headers: NO_STORE });
  }
}

export const dynamic = "force-dynamic";
