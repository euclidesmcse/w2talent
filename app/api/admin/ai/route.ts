import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { aiAdminEnv } from "@/lib/ai";
import { adminGuard } from "@/lib/admin-request";
import {
  AdminInputError,
  addProvider,
  adminState,
  deleteProvider,
  estimateTests,
  refreshModels,
  runTests,
  setRoute,
  updateModel,
  updateProvider,
} from "@/lib/ai/admin";
import { AiProviderError } from "@/lib/ai/types";
import { AiKeysError } from "@/lib/ai/keys";
import { safeErrorText } from "@/lib/ai/router";

/**
 * Admin de IA (1.5.8). GET: estado do painel. POST {action, ...}: uma operação.
 * Só com o cookie de admin (lib/admin-auth.ts). A chave de API nunca volta na resposta.
 */
export async function GET(req: NextRequest) {
  const denied = await adminGuard(req);
  if (denied) return denied;
  const env = aiAdminEnv();
  return NextResponse.json(await adminState(getPrisma(), env), { headers: { "cache-control": "no-store" } });
}

function idOf(body: Record<string, unknown>): string {
  const id = body.id;
  if (typeof id !== "string" || !id || id.length > 64) throw new AdminInputError("id_obrigatorio");
  return id;
}

export async function POST(req: NextRequest) {
  const denied = await adminGuard(req, { write: true });
  if (denied) return denied;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return NextResponse.json({ error: "corpo_invalido" }, { status: 400 });
  const db = getPrisma();
  const env = aiAdminEnv();
  try {
    let result: unknown;
    switch (body.action) {
      case "addProvider":
        result = await addProvider(db, body, env.master);
        break;
      case "updateProvider":
        result = await updateProvider(db, idOf(body), body, env.master);
        break;
      case "deleteProvider":
        result = await deleteProvider(db, idOf(body));
        break;
      case "listModels":
        result = await refreshModels(db, idOf(body), env);
        break;
      case "updateModel":
        result = await updateModel(db, idOf(body), body);
        break;
      case "estimate":
        result = await estimateTests(db, body, env);
        break;
      case "test":
        result = await runTests(db, body, env);
        break;
      case "setRoute":
        result = await setRoute(db, body);
        break;
      default:
        return NextResponse.json({ error: "acao_invalida" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, result: result ?? null }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    if (err instanceof AdminInputError) return NextResponse.json({ error: err.code }, { status: 400 });
    if (err instanceof AiKeysError) return NextResponse.json({ error: "chave_mestra" }, { status: 400 });
    if (err instanceof AiProviderError) return NextResponse.json({ error: "fornecedor_falhou", detalhe: safeErrorText(err).slice(0, 200) }, { status: 502 });
    if ((err as { code?: string })?.code === "P2025") return NextResponse.json({ error: "nao_encontrado" }, { status: 404 });
    // eslint-disable-next-line no-console
    console.error("[admin/ai] falhou:", safeErrorText(err));
    return NextResponse.json({ error: "erro_interno" }, { status: 500 });
  }
}
