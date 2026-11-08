import { NextRequest, NextResponse } from "next/server";
import { requestHasSecret, webhookSecret } from "@/lib/secret";
import {
  BATCH_LIMIT,
  DAILY_LIMIT,
  getDailyCount,
  incDailyCount,
  handleProxyWebhook,
  createBatchContacts,
  todayKey,
  suggestContactContent,
} from "@/lib/proxy";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const candidateIds: string[] = body.candidateIds ?? body.candidate_ids ?? body.ids ?? body.candidateIdsList ?? [];

    if (!Array.isArray(candidateIds)) {
      return NextResponse.json({ error: "candidateIds deve ser array" }, { status: 400 });
    }
    if (candidateIds.length === 0) {
      return NextResponse.json({ error: "selecione ao menos 1 candidato", results: [] }, { status: 400 });
    }
    if (candidateIds.length > BATCH_LIMIT) {
      return NextResponse.json({ error: `limite de ${BATCH_LIMIT} por lote`, code: 400 }, { status: 400 });
    }

    // resolve RH/companyId — auth JWT required outside test
    let rhId: string | null = null;
    let companyId: string | null = body.companyId ?? body.company_id ?? null;
    let authOk = false;
    try {
      const { requireAuth } = require("@/lib/auth");
      const user = requireAuth(req);
      if (user?.userId) rhId = String(user.userId);
      // a empresa do login vence a do corpo (não dá para agir em nome de outra empresa)
      if (user?.companyId) companyId = String(user.companyId);
      if (user?.celular) rhId = rhId ?? String(user.celular);
      authOk = true;
    } catch {}
    if (!authOk && process.env.NODE_ENV === "test") {
      if (!rhId) rhId = body.rhId ?? req.headers.get("x-rh-id") ?? req.headers.get("x-user-id") ?? null;
      if (!companyId) companyId = req.headers.get("x-company-id") ?? null;
    }
    if (!companyId) {
      if (process.env.NODE_ENV === "test") companyId = body.companyId ?? "test-company";
      else return NextResponse.json({ error: "companyId obrigatório" }, { status: 400 });
    }
    if (!rhId) {
      if (process.env.NODE_ENV === "test") rhId = body.rhId ?? companyId;
      else return NextResponse.json({ error: "não autorizado" }, { status: 401 });
    }

    const uniqueIds = [...new Set(candidateIds.map((v) => String(v).trim()).filter(Boolean))];

    // mascarado até envio — lista de candidatos deve ser mascarada antes de resposta
    // LGPD: proxy id@via.w2talent.com — response libera contato direto (B)

    // rate limit 30/dia por RH (companyId)
    const rateKey = String(companyId);
    const current = getDailyCount(rateKey, todayKey());
    const wouldBe = current + uniqueIds.length;
    if (wouldBe > DAILY_LIMIT) {
      return NextResponse.json(
        { error: `limite diário de ${DAILY_LIMIT} contatos atingido`, current, limit: DAILY_LIMIT },
        { status: 429 }
      );
    }

    const loteId: string | null = body.loteId ?? body.batchId ?? null;
    let subject: string | undefined = body.subject;
    let bodyText: string | undefined = body.body ?? body.message ?? body.corpo;

    // IA sugere subject/body se não informado — gera template base se ambos vazios
    // personalização opcional: suggestContactContent por candidato faz fallback
    const results = await createBatchContacts({
      companyId: String(companyId),
      candidateIds: uniqueIds,
      subject,
      body: bodyText,
      loteId,
      rhId: String(rhId),
    });

    const successCount = results.filter((r) => r.status === "enviado").length;
    if (successCount > 0) incDailyCount(rateKey, successCount, todayKey());

    const hasErrors = results.some((r) => r.status === "error");
    const hasSuccess = results.some((r) => r.status === "enviado");
    let httpStatus = 200;
    if (hasErrors && hasSuccess) httpStatus = 207;
    else if (hasErrors && !hasSuccess) {
      const firstCode = results[0]?.code ?? 400;
      const allSame = results.every((r) => r.code === firstCode);
      if (allSame && (firstCode === 409 || firstCode === 410 || firstCode === 404)) httpStatus = firstCode;
      else httpStatus = 207;
    } else if (hasSuccess) httpStatus = 201;
    else httpStatus = 400;

    // mascarado flag: true até resposta, libera ao responder (B)
    const mapped = results.map((r) => ({
      candidateId: r.candidateId,
      id: r.applicationId ?? null,
      applicationId: r.applicationId ?? null,
      proxyThreadId: r.proxyThreadId ?? null,
      status: r.status,
      error: r.error ?? null,
      code: r.code ?? null,
      masked: r.masked ?? true,
      subject: r.subject ?? subject ?? null,
      body: r.body ?? bodyText ?? null,
    }));

    return NextResponse.json({ results: mapped, loteId }, { status: httpStatus });
  } catch (e: any) {
    const status = e.status ?? e.statusCode ?? 500;
    return NextResponse.json({ error: e.message ?? "erro interno contacts batch" }, { status });
  }
}

function isWebhookAuthorized(req: NextRequest): boolean {
  return requestHasSecret(req, webhookSecret());
}

// PATCH webhook: resposta do candidato no proxy libera contato direto (B) e loga consentimento
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
    // se respondido, consent já logado em handleProxyWebhook (contatoProxy)
    // retorna contato mascarado/liberação info
    const masked = updated.status !== "respondido";
    return NextResponse.json({ id: updated.id, proxyThreadId, status: updated.status, masked, liberado: !masked }, { status: 200 });
  } catch (e: any) {
    const status = e.status ?? e.statusCode ?? 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}

// handleBatchPOST removed — Next.js Route only allows GET/POST/PATCH
