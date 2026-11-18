/**
 * 2.6b-1 "Falar com uma pessoa": uma rota só, como o /api/agendar (o código vai no corpo, não na URL).
 * { acao: "abrir", texto, email?, locale, de, perguntaId? } → { codigo } (3 conversas novas por dia por IP)
 * { acao: "ver", c } → { visao }   (a tela pergunta a cada 10 s enquanto está aberta e visível)
 * { acao: "enviar", c, texto } → { visao }   (30 mensagens por conversa por dia, 2000 caracteres)
 * Sem IA (D4, D7). Com login, a conversa fica ligada à conta e o aviso vai para o e-mail dela.
 */
import { NextRequest, NextResponse } from "next/server";
import { sameOrigin } from "@/lib/admin-request";
import { idiomaAjuda, telaDeOrigem } from "@/lib/ajuda";
import { abrirConversa, codigoValido, emailValido, enviarMensagem, textoValido, verConversa, type ContaAtendimento } from "@/lib/atendimento";
import { EMAIL_REVISAO } from "@/lib/ia-transparencia";
import { enqueueEmail } from "@/lib/notifications";
import { contaDoPedido, NO_STORE } from "@/lib/sessao";
import { chaveUso, consumirUso, ipDaRequisicao, LIMITE_CONVERSAS_DIA } from "@/lib/uso-diario";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

async function contaOpcional(req: NextRequest): Promise<ContaAtendimento | null> {
  const c = await contaDoPedido(req).catch(() => null);
  if (!c || c.mfaPendente) return null;
  return { id: c.id, email: c.email, perfil: c.perfil };
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ error: "origem_invalida" }, 403);
  const body = (await req.json().catch(() => ({}))) as {
    acao?: unknown; c?: unknown; texto?: unknown; email?: unknown; locale?: unknown; de?: unknown; perguntaId?: unknown;
  };
  const appUrl = process.env.APP_URL || req.nextUrl.origin;
  const opts = { appUrl, emailEquipe: EMAIL_REVISAO, enqueue: enqueueEmail };
  try {
    const { prisma } = await import("@/lib/prisma");
    if (body.acao === "abrir") {
      if (!textoValido(body.texto)) return json({ error: "texto_invalido" }, 422);
      const conta = await contaOpcional(req);
      if (!conta && !emailValido(body.email)) return json({ error: "email_invalido" }, 422);
      const uso = await consumirUso(prisma, await chaveUso("conversa-nova", ipDaRequisicao(req)), LIMITE_CONVERSAS_DIA);
      if (!uso.permitido) return json({ error: "limite_dia" }, 429);
      const perguntaId = typeof body.perguntaId === "string" && body.perguntaId.length <= 40 ? body.perguntaId : null;
      const r = await abrirConversa(
        prisma,
        { texto: body.texto, email: body.email, locale: idiomaAjuda(typeof body.locale === "string" ? body.locale : null), tela: telaDeOrigem(body.de), conta, perguntaId },
        opts,
      );
      if (!r.ok) return json({ error: r.erro }, 422);
      return json({ ok: true, codigo: r.codigo });
    }

    if (!codigoValido(body.c)) return json({ error: "nao_encontrada" }, 404);
    if (body.acao === "ver") {
      const visao = await verConversa(prisma, body.c);
      return visao ? json({ ok: true, visao }) : json({ error: "nao_encontrada" }, 404);
    }
    if (body.acao === "enviar") {
      const r = await enviarMensagem(prisma, body.c, body.texto, opts);
      if (r.ok) return json({ ok: true, visao: r.visao });
      const status = r.erro === "nao_encontrada" ? 404 : r.erro === "texto_invalido" ? 422 : r.erro === "limite_dia" ? 429 : 409;
      return json({ error: r.erro, visao: r.visao ?? null }, status);
    }
    return json({ error: "acao" }, 422);
  } catch (e) {
    console.error("[ajuda/conversa] falhou:", e instanceof Error ? e.name : e);
    return json({ error: "erro" }, 500);
  }
}

export const dynamic = "force-dynamic";
