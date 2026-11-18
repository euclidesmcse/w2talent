import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirConta, NO_STORE } from "@/lib/sessao";
import { empresaDaConta, mesmaOrigem } from "@/lib/empresa";
import { idsDoPedido } from "@/lib/comparar";
import { vagaDaEmpresa } from "@/lib/comparar-montar";
import { assinarLinkComparacao } from "@/lib/comparar-link";

/**
 * 2.3 Link para compartilhar a comparação: só recrutador com autenticador e empresa.
 * Devolve o caminho com o token depois do "#" e a data em que vence (14 dias). Nada é gravado.
 */
export async function POST(req: NextRequest) {
  if (!mesmaOrigem(req)) return NextResponse.json({ error: "origem_invalida" }, { status: 403, headers: NO_STORE });
  const acesso = await exigirConta(req, { perfil: "recrutador" });
  if ("erro" in acesso) return acesso.erro;
  const body = (await req.json().catch(() => ({}))) as { ids?: unknown; vaga?: unknown };
  const ids = idsDoPedido(body.ids);
  if (!ids) return NextResponse.json({ error: "ids" }, { status: 422, headers: NO_STORE });
  try {
    const empresa = await empresaDaConta(prisma, acesso.conta.id);
    if (!empresa) return NextResponse.json({ error: "sem_empresa" }, { status: 409, headers: NO_STORE });
    let vaga: string | null = null;
    if (typeof body.vaga === "string" && body.vaga) {
      const v = await vagaDaEmpresa(prisma, body.vaga, empresa.id);
      if (!v) return NextResponse.json({ error: "vaga_nao_encontrada" }, { status: 404, headers: NO_STORE });
      vaga = v.id;
    }
    const { segredoDoLogin } = await import("@/lib/auth-server");
    const { token, expira } = await assinarLinkComparacao({ empresa: empresa.id, ids, vaga }, segredoDoLogin());
    return NextResponse.json({ caminho: `/candidatos/comparar#link=${token}`, expira: expira.toISOString() }, { headers: NO_STORE });
  } catch (e) {
    // Só o nome do erro: o token nunca vai para o log.
    console.error("[candidates/comparar/link] falhou:", e instanceof Error ? e.name : "erro");
    return NextResponse.json({ error: "erro" }, { status: 500, headers: NO_STORE });
  }
}

export const dynamic = "force-dynamic";
