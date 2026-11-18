/**
 * 2.6b-1 Admin > Atendimento. Só com o cookie de admin (lib/admin-auth.ts).
 * GET ?status=aberta|encerrada|todas&pagina=N: conversas de 50 em 50, as que esperam a equipe primeiro.
 * GET ?id=X: uma conversa com as mensagens (D3: sem e-mail, ficha ou candidaturas).
 * POST { id, acao: "responder", texto } | { id, acao: "encerrar" }. Sem IA na resposta (D7).
 */
import { NextRequest, NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin-request";
import { conversaParaAdmin, encerrarConversa, listarConversas, responderConversa, type FiltroAdmin } from "@/lib/atendimento";
import { enqueueEmail } from "@/lib/notifications";
import { getPrisma } from "@/lib/prisma";

const NO_STORE = { "cache-control": "no-store" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

export async function GET(req: NextRequest) {
  const denied = await adminGuard(req);
  if (denied) return denied;
  try {
    const sp = req.nextUrl.searchParams;
    const id = sp.get("id");
    if (id) {
      const conversa = id.length <= 40 ? await conversaParaAdmin(getPrisma(), id) : null;
      return conversa ? json({ conversa }) : json({ error: "nao_encontrada" }, 404);
    }
    const s = sp.get("status");
    const filtro: FiltroAdmin = s === "encerrada" || s === "todas" ? s : "aberta";
    const pagina = Math.max(1, Math.min(10_000, parseInt(sp.get("pagina") ?? "1", 10) || 1));
    return json({ ...(await listarConversas(getPrisma(), filtro, pagina)), pagina });
  } catch (err) {
    console.error("[admin/atendimento] falhou: leitura", (err as { code?: string })?.code ?? (err as Error)?.name);
    return json({ error: "erro_interno" }, 500);
  }
}

export async function POST(req: NextRequest) {
  const denied = await adminGuard(req, { write: true });
  if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as { id?: unknown; acao?: unknown; texto?: unknown };
  if (typeof body.id !== "string" || !body.id || body.id.length > 40) return json({ error: "nao_encontrada" }, 404);
  try {
    if (body.acao === "encerrar") {
      return (await encerrarConversa(getPrisma(), body.id)) ? json({ ok: true }) : json({ error: "nao_encontrada" }, 404);
    }
    if (body.acao === "responder") {
      const appUrl = process.env.APP_URL || req.nextUrl.origin;
      const r = await responderConversa(getPrisma(), body.id, body.texto, { appUrl, enqueue: enqueueEmail });
      if (r.ok) return json({ ok: true, emailEnviado: r.emailEnviado });
      return json({ error: r.erro }, r.erro === "nao_encontrada" ? 404 : r.erro === "texto_invalido" ? 422 : 409);
    }
    return json({ error: "acao" }, 422);
  } catch (err) {
    console.error("[admin/atendimento] falhou: acao", (err as { code?: string })?.code ?? (err as Error)?.name);
    return json({ error: "erro_interno" }, 500);
  }
}

export const dynamic = "force-dynamic";
