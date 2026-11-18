/**
 * 3.4a Integração com ATS (D4): só o dono da empresa, recrutador com autenticador, mesma origem.
 * GET: endereço, ligado/desligado e as últimas 20 entregas (nunca o segredo).
 * PATCH { url?, ativo? }: grava; na primeira vez cria e devolve o segredo (só nesta resposta).
 * POST { acao: "segredo" }: troca o segredo e devolve o novo (só nesta resposta).
 * POST { acao: "teste" }: manda o evento "teste" na hora e devolve o resultado (30 por dia por empresa).
 */
import { NextRequest, NextResponse } from "next/server";
import { exigirConta, NO_STORE } from "@/lib/sessao";
import { mesmaOrigem } from "@/lib/empresa";
import { chaveUso, consumirUso } from "@/lib/uso-diario";
import { empresaDoDono, entregarWebhook, lerConfig, LIMITE_TESTES_WEBHOOK_DIA, mensagemDeTeste, novoSegredo, salvarWebhook, WebhookErro } from "@/lib/webhook";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

const STATUS: Record<WebhookErro["codigo"], number> = { sem_empresa: 404, so_dono: 403, rejeitada: 403, sem_webhook: 404, sem_chave: 503, url: 400 };

async function comDono(req: NextRequest, grava: boolean, fn: (companyId: string, db: import("@prisma/client").PrismaClient) => Promise<NextResponse>) {
  if (grava && !mesmaOrigem(req)) return json({ error: "origem_invalida" }, 403);
  const r = await exigirConta(req, { perfil: "recrutador" });
  if ("erro" in r) return r.erro;
  const { prisma } = await import("@/lib/prisma");
  try {
    return await fn(await empresaDoDono(prisma, r.conta.id), prisma);
  } catch (e) {
    if (e instanceof WebhookErro) return json({ error: e.codigo, ...(e.codigo === "url" ? { motivo: (e as WebhookErro & { motivo?: string }).motivo } : {}) }, STATUS[e.codigo]);
    console.error("conta/empresa/webhook", (e as { code?: string })?.code ?? (e as Error)?.name ?? "erro");
    return json({ error: "erro_interno" }, 500);
  }
}

export async function GET(req: NextRequest) {
  return comDono(req, false, async (companyId, db) => json({ webhook: await lerConfig(db, companyId) }));
}

export async function PATCH(req: NextRequest) {
  return comDono(req, true, async (companyId, db) => {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const { segredo } = await salvarWebhook(db, companyId, { url: body.url, ativo: body.ativo });
    return json({ webhook: await lerConfig(db, companyId), segredo });
  });
}

export async function POST(req: NextRequest) {
  return comDono(req, true, async (companyId, db) => {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (body.acao === "segredo") {
      const segredo = await novoSegredo(db, companyId);
      return json({ webhook: await lerConfig(db, companyId), segredo });
    }
    if (body.acao === "teste") {
      if (!(await db.webhook.findUnique({ where: { companyId }, select: { id: true } }))) throw new WebhookErro("sem_webhook");
      const uso = await consumirUso(db, await chaveUso("teste-webhook", companyId), LIMITE_TESTES_WEBHOOK_DIA);
      if (!uso.permitido) return json({ error: "limite_dia", max: LIMITE_TESTES_WEBHOOK_DIA }, 429);
      const r = await entregarWebhook(db, mensagemDeTeste(companyId), 1);
      return json({ webhook: await lerConfig(db, companyId), teste: { ok: r.resultado === "ok", status: r.status ?? null, erro: r.erro ?? null } });
    }
    return json({ error: "acao_invalida" }, 400);
  });
}

export const dynamic = "force-dynamic";
