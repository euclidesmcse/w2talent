/**
 * 3.5b Webhook da Meta (WhatsApp Cloud API), plano https://claude.ai/artifact/B1kcRjUJ5emNK2W4Xu9WSW (D4).
 * GET: verificação do endereço (hub.mode=subscribe, hub.verify_token = WHATSAPP_VERIFY_TOKEN → hub.challenge).
 * POST: só com X-Hub-Signature-256 válida (HMAC-SHA256 do corpo cru com WHATSAPP_APP_SECRET, comparação em
 * tempo constante); senão 401. Mensagens recebidas: SAIR desliga, o resto ganha a resposta automática.
 * Status de entrega e outros campos são ignorados. Nada do texto recebido é guardado.
 */
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqualStr } from "@/lib/secret";
import { assinaturaMetaConfere, mensagensRecebidas } from "@/lib/whatsapp";
import { NO_STORE } from "@/lib/sessao";

export const dynamic = "force-dynamic";

/** A Meta manda lotes pequenos; acima disto não é dela. */
const CORPO_MAX = 256 * 1024;

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const esperado = process.env.WHATSAPP_VERIFY_TOKEN;
  const desafio = q.get("hub.challenge") ?? "";
  if (q.get("hub.mode") === "subscribe" && esperado && timingSafeEqualStr(q.get("hub.verify_token") ?? "", esperado) && /^[\w-]{1,200}$/.test(desafio)) {
    return new NextResponse(desafio, { status: 200, headers: { "content-type": "text/plain; charset=utf-8", ...NO_STORE } });
  }
  return NextResponse.json({ error: "proibido" }, { status: 403, headers: NO_STORE });
}

export async function POST(req: NextRequest) {
  const segredo = process.env.WHATSAPP_APP_SECRET;
  if (!segredo) return NextResponse.json({ error: "nao_configurado" }, { status: 503, headers: NO_STORE });
  const tamanho = Number(req.headers.get("content-length") ?? 0);
  if (tamanho > CORPO_MAX) return NextResponse.json({ error: "grande" }, { status: 413, headers: NO_STORE });
  const cru = await req.text();
  if (cru.length > CORPO_MAX) return NextResponse.json({ error: "grande" }, { status: 413, headers: NO_STORE });
  if (!(await assinaturaMetaConfere(cru, req.headers.get("x-hub-signature-256"), segredo))) {
    return NextResponse.json({ error: "assinatura" }, { status: 401, headers: NO_STORE });
  }
  let corpo: unknown;
  try {
    corpo = JSON.parse(cru);
  } catch {
    return NextResponse.json({ error: "json" }, { status: 400, headers: NO_STORE });
  }
  const recebidas = mensagensRecebidas(corpo);
  if (!recebidas.length) return NextResponse.json({ ok: true }, { headers: NO_STORE });
  try {
    const [{ prisma }, { tratarRecebidas }] = await Promise.all([import("@/lib/prisma"), import("@/lib/whatsapp-db")]);
    await tratarRecebidas(prisma, recebidas);
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (e) {
    // 500: a Meta manda de novo (um SAIR não se perde).
    console.error("[whatsapp] webhook falhou:", e instanceof Error ? e.name : e);
    return NextResponse.json({ error: "erro" }, { status: 500, headers: NO_STORE });
  }
}
