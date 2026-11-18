import { NextRequest, NextResponse } from "next/server";
import { requestHasSecret } from "@/lib/secret";
import { runHygiene } from "@/lib/hygiene";
import { prisma } from "@/lib/prisma";
import { enqueueEmail } from "@/lib/notifications";
import { reenviarEmailsPendentes } from "@/lib/envio";
import { reenviarEmailsEntrevista } from "@/lib/entrevista";
import { chatDeTraducao, traduzirPendentes } from "@/lib/traducao";

/**
 * Higiene diária (1.5.15). Chamada pelo Cron Trigger do Worker (custom-worker.ts) às 9h de Brasília,
 * ou à mão com o `CRON_SECRET` no cabeçalho (`x-cron-secret` ou `Authorization: Bearer`).
 * O segredo na URL (`?cron_secret=`) não é aceito aqui.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "cron_secret_not_configured" }, { status: 503 });
  if (!requestHasSecret(req, secret, { headerOnly: true })) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const appUrl = process.env.APP_URL || req.nextUrl.origin;
  try {
    const summary = await runHygiene(prisma, { enqueue: enqueueEmail, appUrl, renewSecret: process.env.RENEW_LINK_SECRET });
    console.log("[higiene]", JSON.stringify(summary));
    // 1.5.13: e-mails de candidatura que não entraram na fila na hora do envio.
    const candidaturas = await reenviarEmailsPendentes(prisma, enqueueEmail).catch((e) => {
      console.error("[envio] reenvio falhou:", e instanceof Error ? e.name : e);
      return { enviados: 0, falhas: -1 };
    });
    // 2.5a: e-mails de agenda (convite, marcada, cancelada) que não entraram na fila.
    const agenda = await reenviarEmailsEntrevista(prisma, enqueueEmail).catch((e) => {
      console.error("[agenda] reenvio falhou:", e instanceof Error ? e.name : e);
      return { enviados: 0, falhas: -1 };
    });
    // 2.7a: vagas ativas sem tradução atual (inclui as anteriores ao 2.7), até 30 por dia.
    const chat = await chatDeTraducao();
    const traducoes = chat
      ? await traduzirPendentes(prisma, chat, 30).catch((e) => {
          console.error("[traducao] cron falhou:", e instanceof Error ? e.name : e);
          return { traduzidas: 0, mesmoIdioma: 0, falhas: -1, semLimite: false, vagas: 0 };
        })
      : null;
    // 2.7b: Fichas W2 publicadas sem tradução atual (tarefa translate_profile, dado pessoal).
    const fichas = await (async () => {
      const { chatDeTraducaoFicha, traduzirFichasPendentes } = await import("@/lib/traducao");
      const c = await chatDeTraducaoFicha();
      return c ? traduzirFichasPendentes(prisma, c, 30) : null;
    })().catch((e) => {
      console.error("[traducao] cron das fichas falhou:", e instanceof Error ? e.name : e);
      return null;
    });
    // 3.2a: agregados de mercado da semana (MarketStat).
    const mercado = await (async () => {
      const { atualizarMercado } = await import("@/lib/mercado");
      return atualizarMercado(prisma);
    })().catch((e) => {
      console.error("[mercado] cron falhou:", e instanceof Error ? e.name : e);
      return null;
    });
    // 3.1a: pesos do ranking adaptativo (global e por empresa).
    const ranking = await (async () => {
      const { atualizarPesos } = await import("@/lib/ranking");
      return atualizarPesos(prisma);
    })().catch((e) => {
      console.error("[ranking] cron falhou:", e instanceof Error ? e.name : e);
      return null;
    });
    // 2.6b-2: conversas do Atendimento encerradas há mais de 180 dias (D4), com mensagens e códigos.
    const conversasApagadas = await (async () => {
      const { apagarConversasAntigas } = await import("@/lib/atendimento");
      return apagarConversasAntigas(prisma);
    })().catch((e) => {
      console.error("[atendimento] cron falhou:", e instanceof Error ? e.name : e);
      return -1;
    });
    return NextResponse.json(
      { ok: true, ...summary, emailsCandidatura: candidaturas, emailsAgenda: agenda, traducoes, traducoesFichas: fichas, mercado, ranking, conversasApagadas },
      { status: 200 },
    );
  } catch (e) {
    console.error("[higiene] falhou:", e instanceof Error ? `${e.name}: ${e.message}` : e);
    return NextResponse.json({ error: "hygiene_failed" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}

export const dynamic = "force-dynamic";
