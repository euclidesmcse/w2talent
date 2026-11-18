import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirConta, NO_STORE } from "@/lib/sessao";
import { empresaDaConta } from "@/lib/empresa";
import { resumoDaEmpresa } from "@/lib/painel-rh";

/**
 * 2.4a Painel RH (plano 2.4, D5 e D6): só recrutador com autenticador, só a própria empresa.
 * Sem empresa cadastrada responde { estado: "sem_empresa" } para a tela mandar a Minha empresa.
 */
export async function GET(req: NextRequest) {
  const r = await exigirConta(req, { perfil: "recrutador" });
  if ("erro" in r) return r.erro;
  try {
    const empresa = await empresaDaConta(prisma, r.conta.id);
    if (!empresa) return NextResponse.json({ estado: "sem_empresa" }, { headers: NO_STORE });
    const resumo = await resumoDaEmpresa(prisma, empresa.id);
    return NextResponse.json({ estado: "ok", empresa: { nome: empresa.nome, validacaoStatus: empresa.validacaoStatus }, ...resumo }, { headers: NO_STORE });
  } catch (e) {
    console.error("[rh] falhou:", e instanceof Error ? e.name : e);
    return NextResponse.json({ error: "erro" }, { status: 500, headers: NO_STORE });
  }
}

export const dynamic = "force-dynamic";
