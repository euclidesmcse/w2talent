/**
 * 2.6a-2: pergunta na Ajuda. Sem login (D2), 20 por dia por IP (só o hash do IP fica no banco).
 * A resposta vem só dos artigos de ajuda; sem resposta, a pergunta fica guardada sem contatos por 90 dias.
 */
import { NextRequest, NextResponse } from "next/server";
import { sameOrigin } from "@/lib/admin-request";
import { telaDeOrigem } from "@/lib/ajuda";
import { perguntaValida, perguntarAjuda, type ChatAjudaFn } from "@/lib/ajuda-ia";
import { NO_STORE } from "@/lib/sessao";
import { chaveUso, consumirUso, ipDaRequisicao, LIMITE_PERGUNTAS_AJUDA_DIA } from "@/lib/uso-diario";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ error: "origem_invalida" }, 403);
  const body = (await req.json().catch(() => ({}))) as { pergunta?: unknown; locale?: unknown; de?: unknown };
  if (!perguntaValida(body.pergunta)) return json({ error: "pergunta_invalida" }, 422);

  const { prisma } = await import("@/lib/prisma");
  const uso = await consumirUso(prisma, await chaveUso("ajuda-pergunta", ipDaRequisicao(req)), LIMITE_PERGUNTAS_AJUDA_DIA);
  if (!uso.permitido) return json({ error: "limite_dia" }, 429);

  const { getAiRouter } = await import("@/lib/ai");
  const router = getAiRouter();
  const chat: ChatAjudaFn = (task, q) => router.chat(task, q);
  const r = await perguntarAjuda(
    prisma,
    { pergunta: body.pergunta, locale: typeof body.locale === "string" ? body.locale : null, tela: telaDeOrigem(body.de) },
    { chat },
  );
  return json(r);
}

export const dynamic = "force-dynamic";
