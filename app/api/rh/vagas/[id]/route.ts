import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirConta, NO_STORE } from "@/lib/sessao";
import { empresaDaConta } from "@/lib/empresa";
import { candidaturasDaVaga } from "@/lib/rh-candidaturas";

/**
 * 2.4b Candidaturas da vaga (plano 2.4, D3 e D6): só recrutador com autenticador e só vaga da
 * própria empresa (senão 404). Candidaturas por match, contato mascarado.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await exigirConta(req, { perfil: "recrutador" });
  if ("erro" in r) return r.erro;
  const { id } = await ctx.params;
  try {
    const empresa = await empresaDaConta(prisma, r.conta.id);
    const dados = empresa && id ? await candidaturasDaVaga(prisma, empresa.id, id) : null;
    if (!dados) return NextResponse.json({ error: "vaga_nao_encontrada" }, { status: 404, headers: NO_STORE });
    return NextResponse.json(dados, { headers: NO_STORE });
  } catch (e) {
    console.error("[rh/vagas] falhou:", e instanceof Error ? e.name : e);
    return NextResponse.json({ error: "erro" }, { status: 500, headers: NO_STORE });
  }
}

export const dynamic = "force-dynamic";
