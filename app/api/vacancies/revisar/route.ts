/**
 * 2.1c revisor de viés: a IA propõe o texto da vaga sem os termos apontados pelas regras.
 * Só quando o recrutador pede; nada é salvo. Quem pode gravar vagas, com limite por dia.
 */
import { NextRequest, NextResponse } from "next/server";
import { acessoVaga } from "@/lib/empresa";
import { NO_STORE } from "@/lib/sessao";
import { chaveUso, consumirUso, LIMITE_REVISOES_VAGA_DIA } from "@/lib/uso-diario";
import { avisosDoTexto, reescreverSemVies, textoParaRevisar, type ChatExtraFn } from "@/lib/vaga-ia-extra";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

export async function POST(req: NextRequest) {
  const { prisma } = await import("@/lib/prisma");
  const a = await acessoVaga(req, prisma);
  if ("erro" in a) return a.erro;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  // O texto vai inteiro (sem o corte da leitura da vaga); longo demais é recusado, nunca cortado.
  const texto = textoParaRevisar(body);
  if (!texto) return json({ error: "texto_longo" }, 413);
  // Sem aviso das regras, não há o que reescrever (e não gasta IA).
  if (!avisosDoTexto(texto).length) return json({ error: "sem_avisos" }, 422);

  try {
    const quem = a.acesso.tipo === "admin" ? "admin" : a.acesso.conta.id;
    const uso = await consumirUso(prisma, await chaveUso("revisar-vaga", quem), LIMITE_REVISOES_VAGA_DIA);
    if (!uso.permitido) return json({ error: "limite_dia" }, 429);
  } catch (e) {
    console.error("[vacancies/revisar] limite:", e instanceof Error ? e.name : e);
  }

  let chat: ChatExtraFn;
  try {
    const { getAiRouter } = await import("@/lib/ai");
    const router = getAiRouter();
    chat = (task, q) => router.chat(task, q);
  } catch {
    return json({ error: "ia_indisponivel" }, 503);
  }
  const proposta = await reescreverSemVies(texto, chat);
  if (!proposta) return json({ error: "ia_indisponivel" }, 503);
  return json({ proposta });
}

export const dynamic = "force-dynamic";
