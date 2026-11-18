/**
 * 2.1c perguntas de entrevista: geradas na hora das competências e responsabilidades da vaga.
 * Só para o recrutador, não ficam guardadas e não dão nota a ninguém. Sem IA, saem de modelos fixos.
 */
import { NextRequest, NextResponse } from "next/server";
import { acessoVaga } from "@/lib/empresa";
import { NO_STORE } from "@/lib/sessao";
import { chaveUso, consumirUso, LIMITE_PERGUNTAS_VAGA_DIA } from "@/lib/uso-diario";
import { sanitizarRascunho } from "@/lib/vaga-ai";
import { gerarPerguntas, type ChatExtraFn, type Idioma } from "@/lib/vaga-ia-extra";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });
const IDIOMAS: Idioma[] = ["pt-BR", "en", "es"];

export async function POST(req: NextRequest) {
  const { prisma } = await import("@/lib/prisma");
  const a = await acessoVaga(req, prisma);
  if ("erro" in a) return a.erro;
  const body = (await req.json().catch(() => ({}))) as { rascunho?: unknown; idioma?: unknown };
  const r = sanitizarRascunho(body.rascunho);
  const idioma = IDIOMAS.includes(body.idioma as Idioma) ? (body.idioma as Idioma) : "pt-BR";
  if (!r.stack.length && !r.descricaoBullets.length) return json({ error: "sem_competencias" }, 422);

  let chat: ChatExtraFn | null = null;
  try {
    const quem = a.acesso.tipo === "admin" ? "admin" : a.acesso.conta.id;
    const uso = await consumirUso(prisma, await chaveUso("perguntas-vaga", quem), LIMITE_PERGUNTAS_VAGA_DIA);
    // Passou do limite: sem IA, mas os modelos fixos continuam.
    if (uso.permitido) {
      const { getAiRouter } = await import("@/lib/ai");
      const router = getAiRouter();
      chat = (task, q) => router.chat(task, q);
    }
  } catch {
    chat = null;
  }
  const out = await gerarPerguntas(r, idioma, chat);
  return json(out);
}

export const dynamic = "force-dynamic";
