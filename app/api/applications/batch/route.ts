import { NextRequest, NextResponse } from "next/server";
import { contaDoPedido } from "@/lib/sessao";
import { requestHasSecret, webhookSecret } from "@/lib/secret";
import {
  BATCH_LIMIT,
  DAILY_LIMIT,
  getDailyCount,
  incDailyCount,
  applicationByCandidateVacancy,
  createBatchApplications,
  handleProxyWebhook,
  todayKey,
} from "@/lib/proxy";

function httpError(message: string, status: number) {
  const e: any = new Error(message);
  e.status = status;
  e.statusCode = status;
  return e;
}

function isWebhookAuthorized(req: NextRequest): boolean {
  return requestHasSecret(req, webhookSecret());
}

/**
 * Quem está pedindo: só a sessão de candidato (1.5.5) vale em produção. `candidateId` no corpo ou
 * na query é ignorado — senão qualquer pessoa enviaria candidaturas ou leria as de outra (IDOR).
 * Em teste (NODE_ENV=test) aceita o cabeçalho x-candidate-id para os testes TDD.
 */
async function authenticatedCandidateId(req: NextRequest): Promise<string | null> {
  const conta = await contaDoPedido(req).catch(() => null);
  if (conta && !conta.mfaPendente && conta.perfil === "candidato") return conta.id;
  if (process.env.NODE_ENV === "test") {
    return req.headers.get("x-candidate-id") ?? req.headers.get("x-user-id") ?? null;
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const vacancyIds: string[] = body.vacancyIds ?? body.vacancy_ids ?? body.ids ?? [];

    if (!Array.isArray(vacancyIds)) {
      return NextResponse.json({ error: "vacancyIds deve ser array" }, { status: 400 });
    }
    if (vacancyIds.length === 0) {
      return NextResponse.json({ error: "selecione ao menos 1 vaga", results: [] }, { status: 400 });
    }
    if (vacancyIds.length > BATCH_LIMIT) {
      return NextResponse.json({ error: `limite de ${BATCH_LIMIT} por lote`, code: 400 }, { status: 400 });
    }

    const candidateId = await authenticatedCandidateId(req);
    if (!candidateId) {
      return NextResponse.json({ error: "não autorizado" }, { status: 401 });
    }

    const loteId: string | null = body.loteId ?? body.batchId ?? null;

    // deduplicação dentro do lote: ids únicos (evita double count)
    const uniqueIds = [...new Set(vacancyIds.map((v) => String(v).trim()).filter(Boolean))];
    if (uniqueIds.length !== vacancyIds.length) {
      // se tinha duplicata dentro do próprio lote, trata como erro por item? mas por enquanto normaliza
    }

    // rate limit 30/dia — checa antes de criar
    const cid = candidateId as string;
    const current = getDailyCount(cid, todayKey());
    const wouldBe = current + uniqueIds.length;
    if (wouldBe > DAILY_LIMIT) {
      // spec: 31º do dia -> 429
      // mas também se lote parcial ultrapassar, bloqueia lote inteiro
      return NextResponse.json(
        { error: `limite diário de ${DAILY_LIMIT} candidaturas atingido`, current, limit: DAILY_LIMIT },
        { status: 429 }
      );
    }

    const results = await createBatchApplications({
      candidateId: cid,
      vacancyIds: uniqueIds,
      loteId,
    });

    // incrementa daily por sucessos (não por erros)
    const successCount = results.filter((r) => r.status === "enviado").length;
    if (successCount > 0) incDailyCount(cid, successCount, todayKey());

    const hasErrors = results.some((r) => r.status === "error");
    const hasSuccess = results.some((r) => r.status === "enviado");
    let httpStatus = 200;
    if (hasErrors && hasSuccess) httpStatus = 207;
    else if (hasErrors && !hasSuccess) {
      // se todos erros e um deles é 409 duplicada, retorna 409? mas parcial exige 207, então só 207 se mix
      // se todos falharam com 409/410/404, retorna 207? spec: duplicada -> 409 já se candidatou (single)
      // lote com 1 expirada -> 207 parcial: spec exemplo tem mix, então 207
      // se todos erros iguais, retorna código do primeiro erro
      const firstCode = results[0]?.code ?? 400;
      // mas para compatibilidade, se tudo erro 409, retorna 409
      const allSameCode = results.every((r) => r.code === firstCode);
      if (allSameCode && (firstCode === 409 || firstCode === 410 || firstCode === 404)) httpStatus = firstCode;
      else httpStatus = 207;
    } else if (hasSuccess) httpStatus = 201;
    else httpStatus = 400;

    // normaliza results para contrato {results:[{id,status,error}]} -> spec diz {results[{id,status,error}]}
    const mapped = results.map((r) => ({
      vacancyId: r.vacancyId,
      id: r.applicationId ?? null,
      applicationId: r.applicationId ?? null,
      proxyThreadId: r.proxyThreadId ?? null,
      status: r.status,
      error: r.error ?? null,
      code: r.code ?? null,
    }));

    return NextResponse.json({ results: mapped, loteId }, { status: httpStatus });
  } catch (e: any) {
    const status = e.status ?? e.statusCode ?? 500;
    return NextResponse.json({ error: e.message ?? "erro interno batch" }, { status });
  }
}

// Webhook handler inline: PATCH /api/applications/batch {proxyThreadId, event}
export async function PATCH(req: NextRequest) {
  if (!isWebhookAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json().catch(() => ({} as any));
    const proxyThreadId: string = body.proxyThreadId ?? body.threadId ?? body.id;
    const event: string = body.event ?? body.status ?? "";
    if (!proxyThreadId || !event) {
      return NextResponse.json({ error: "proxyThreadId e event obrigatórios" }, { status: 400 });
    }
    const updated = handleProxyWebhook(proxyThreadId, event);
    return NextResponse.json({ id: updated.id, proxyThreadId, status: updated.status }, { status: 200 });
  } catch (e: any) {
    const status = e.status ?? e.statusCode ?? 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}

export async function GET(req: NextRequest) {
  try {
    // Só as candidaturas de quem está logado; ?candidateId= de outra pessoa é ignorado (IDOR).
    const filterId = await authenticatedCandidateId(req);
    if (!filterId) {
      return NextResponse.json({ error: "não autorizado" }, { status: 401 });
    }
    const { applicationStore } = await import("@/lib/proxy");
    let apps = [...applicationStore.values()];
    apps = apps.filter((a: any) => String(a.candidateId) === String(filterId));
    // also try DB if empty and prisma available
    if (apps.length === 0) {
      try {
        const { prisma } = await import("@/lib/prisma");
        const dbApps = await (prisma as any).application.findMany({ where: { candidateId: filterId } }).catch(() => []);
        if (dbApps && dbApps.length) apps = dbApps;
      } catch {}
    }
    const applications = apps.map((a: any) => ({
      id: a.id,
      vacancyId: a.vacancyId ?? null,
      candidateId: a.candidateId,
      proxyThreadId: a.proxyThreadId,
      status: a.status,
      origem: a.origem,
      companyId: a.companyId,
      createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : a.createdAt,
    }));
    return NextResponse.json({ applications, results: applications }, { status: 200 });
  } catch (e: any) {
    const status = e.status ?? e.statusCode ?? 500;
    return NextResponse.json({ error: e.message ?? "erro" }, { status });
  }
}

// handleBatchPOST removed — Next.js Route only allows GET/POST/PATCH etc.
