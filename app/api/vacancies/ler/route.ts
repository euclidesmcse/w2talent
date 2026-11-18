/**
 * Publicar vaga, passo 1 (2.1b): lê o texto colado e devolve os campos para o recrutador conferir.
 * Nada é salvo. Só quem pode gravar vagas (recrutador com empresa ou admin), com limite por dia.
 */
import { NextRequest, NextResponse } from "next/server";
import { acessoVaga } from "@/lib/empresa";
import { NO_STORE } from "@/lib/sessao";
import { chaveUso, consumirUso, LIMITE_LEITURAS_VAGA_DIA } from "@/lib/uso-diario";
import { lerVaga, MAX_TEXTO_VAGA, MIN_TEXTO_VAGA, type ChatVagaFn } from "@/lib/vaga-ai";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

export async function POST(req: NextRequest) {
  const { prisma } = await import("@/lib/prisma");
  const a = await acessoVaga(req, prisma);
  if ("erro" in a) return a.erro;
  const body = (await req.json().catch(() => ({}))) as { texto?: unknown };
  const texto = typeof body.texto === "string" ? body.texto.slice(0, MAX_TEXTO_VAGA) : "";
  if (texto.trim().length < MIN_TEXTO_VAGA) return json({ error: "texto_curto" }, 422);

  // Limite por conta (o admin conta como uma conta só), antes de qualquer chamada à IA.
  try {
    const quem = a.acesso.tipo === "admin" ? "admin" : a.acesso.conta.id;
    const uso = await consumirUso(prisma, await chaveUso("ler-vaga", quem), LIMITE_LEITURAS_VAGA_DIA);
    if (!uso.permitido) return json({ error: "limite_dia" }, 429);
  } catch (e) {
    console.error("[vacancies/ler] limite:", e instanceof Error ? e.name : e);
  }

  let chat: ChatVagaFn | null = null;
  try {
    const { getAiRouter } = await import("@/lib/ai");
    const router = getAiRouter();
    chat = (task, r) => router.chat(task, r);
  } catch {
    chat = null;
  }
  const r = await lerVaga(texto, chat);
  return json({ vaga: r.vaga, origem: r.origem });
}

export const dynamic = "force-dynamic";
