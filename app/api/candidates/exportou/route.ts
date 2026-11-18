import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirConta, NO_STORE } from "@/lib/sessao";
import { empresaDaConta } from "@/lib/empresa";
import { idsDoPedido } from "@/lib/comparar";
import { gravarSinais } from "@/lib/sinais";

const FORMATOS = ["csv", "xlsx", "pdf"] as const;

/**
 * 2.3b (plano 2.3, D6): a tela avisa que exportou a comparação e cada candidato ganha um sinal
 * "exportou" para o ranking da Fase 3. Só ids, vaga e formato: nada da ficha é gravado.
 * O arquivo em si é montado no navegador e não passa por aqui.
 */
export async function POST(req: NextRequest) {
  const acesso = await exigirConta(req, { perfil: "recrutador" });
  if ("erro" in acesso) return acesso.erro;
  const body = (await req.json().catch(() => ({}))) as { ids?: unknown; vaga?: unknown; formato?: unknown };
  const ids = idsDoPedido(body.ids);
  const formato = FORMATOS.find((f) => f === body.formato);
  if (!ids || !formato) return NextResponse.json({ error: "pedido" }, { status: 422, headers: NO_STORE });
  try {
    // Vaga só conta se for da empresa de quem exporta; senão o sinal vai sem vaga.
    let vacancyId: string | null = null;
    if (typeof body.vaga === "string" && body.vaga) {
      const empresa = await empresaDaConta(prisma, acesso.conta.id);
      const v = empresa ? await prisma.vacancy.findFirst({ where: { id: body.vaga, companyId: empresa.id }, select: { id: true } }) : null;
      vacancyId = v?.id ?? null;
    }
    const perfis = await prisma.candidateProfile.findMany({ where: { id: { in: ids }, status: "ativo" }, select: { id: true } });
    await gravarSinais(
      prisma,
      perfis.map((p) => ({ tipo: "exportou" as const, ator: "recrutador" as const, candidateId: p.id, vacancyId, dados: { formato } })),
    );
    return NextResponse.json({ ok: true, sinais: perfis.length }, { headers: NO_STORE });
  } catch (e) {
    // Um sinal perdido não pode atrapalhar quem exportou: o arquivo já foi baixado.
    console.error("[candidates/exportou] falhou:", e instanceof Error ? e.name : e);
    return NextResponse.json({ ok: false }, { status: 500, headers: NO_STORE });
  }
}

export const dynamic = "force-dynamic";
