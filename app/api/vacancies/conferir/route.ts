/**
 * Publicar vaga, conferência (2.1b, D4 e D6): avisa vaga parecida já ativa na mesma empresa e
 * sugere a faixa salarial pela mediana das vagas parecidas (com 5 ou mais de base). Nada é salvo.
 */
import { NextRequest, NextResponse } from "next/server";
import { acessoVaga } from "@/lib/empresa";
import { NO_STORE } from "@/lib/sessao";
import { sanitizarRascunho } from "@/lib/vaga-ai";
import { conferirVaga } from "@/lib/vaga-conferir";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

export async function POST(req: NextRequest) {
  const { prisma } = await import("@/lib/prisma");
  const a = await acessoVaga(req, prisma);
  if ("erro" in a) return a.erro;
  const body = (await req.json().catch(() => ({}))) as { rascunho?: unknown; ignorarId?: unknown; companyId?: unknown };
  const rascunho = sanitizarRascunho(body.rascunho);
  // A empresa vem do vínculo da conta; só o admin escolhe (seed e suporte).
  const companyId = a.acesso.tipo === "recrutador" ? a.acesso.empresa.id : typeof body.companyId === "string" ? body.companyId : null;
  const ignorarId = typeof body.ignorarId === "string" && body.ignorarId.length <= 100 ? body.ignorarId : null;
  try {
    return json(await conferirVaga(prisma, { companyId, rascunho, ignorarId }));
  } catch (e) {
    console.error("[vacancies/conferir]", (e as { code?: string })?.code ?? (e as Error)?.name ?? "erro");
    return json({ duplicadas: [], faixa: null });
  }
}

export const dynamic = "force-dynamic";
