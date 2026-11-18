/**
 * 2.6a-2 "mandar para a equipe" (D5): a pergunta sem resposta vai por e-mail para a equipe, pela fila
 * `notificacoes`. O e-mail de quem pergunta vai só no corpo da mensagem; o banco guarda apenas que a
 * pergunta foi enviada. 3 envios por dia por IP.
 */
import { NextRequest, NextResponse } from "next/server";
import { sameOrigin } from "@/lib/admin-request";
import { idiomaAjuda, telaDeOrigem } from "@/lib/ajuda";
import { emailParaEquipe, emailValido, perguntaValida } from "@/lib/ajuda-ia";
import { EMAIL_REVISAO } from "@/lib/ia-transparencia";
import { enqueueEmail } from "@/lib/notifications";
import { NO_STORE } from "@/lib/sessao";
import { chaveUso, consumirUso, ipDaRequisicao, LIMITE_AJUDA_EQUIPE_DIA } from "@/lib/uso-diario";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ error: "origem_invalida" }, 403);
  const body = (await req.json().catch(() => ({}))) as { id?: unknown; pergunta?: unknown; email?: unknown; locale?: unknown; de?: unknown };
  if (!perguntaValida(body.pergunta)) return json({ error: "pergunta_invalida" }, 422);
  if (!emailValido(body.email)) return json({ error: "email_invalido" }, 422);
  const id = typeof body.id === "string" && body.id.length <= 40 ? body.id : null;

  const { prisma } = await import("@/lib/prisma");
  const uso = await consumirUso(prisma, await chaveUso("ajuda-equipe", ipDaRequisicao(req)), LIMITE_AJUDA_EQUIPE_DIA);
  if (!uso.permitido) return json({ error: "limite_dia" }, 429);

  const msg = await emailParaEquipe(
    { pergunta: body.pergunta, email: body.email, locale: idiomaAjuda(typeof body.locale === "string" ? body.locale : null), tela: telaDeOrigem(body.de), id },
    EMAIL_REVISAO,
  );
  try {
    await enqueueEmail(msg);
  } catch (e) {
    console.error("[ajuda/equipe] fila:", e instanceof Error ? e.name : e);
    return json({ error: "envio_falhou" }, 502);
  }
  if (id) await prisma.perguntaSemResposta.updateMany({ where: { id }, data: { enviadaEquipe: true } }).catch(() => undefined);
  return json({ ok: true });
}

export const dynamic = "force-dynamic";
