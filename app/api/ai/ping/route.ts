import { NextRequest, NextResponse } from "next/server";
import { requestHasSecret } from "@/lib/secret";
import { aiConfig, getAiRouter, AiBudgetError, AiUnavailableError } from "@/lib/ai";

/**
 * Teste de ponta a ponta da IA (1.5.7): uma chamada de embeddings e uma de texto pelo
 * roteador e pelo AI Gateway. Fechado pelo segredo do cron (cabeçalho, nunca na URL).
 * Não usa dados de ninguém: os textos são fixos.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.nextUrl.searchParams.has("cron_secret") || !requestHasSecret(req, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const router = getAiRouter();
  const cfg = aiConfig();
  const out: Record<string, unknown> = { gateway: cfg.gateway.id ?? null, viaGateway: Boolean(cfg.gateway.id) };
  try {
    const t0 = Date.now();
    const e = await router.embed("embed", ["teste de conexão do W2Talent"]);
    out.embed = { model: e.model, dim: e.vectors[0]?.length ?? 0, ms: Date.now() - t0 };
    const t1 = Date.now();
    const c = await router.chat("translate_ui", {
      messages: [{ role: "user", content: "Responda só com a palavra: ok" }],
      maxTokens: 5,
      temperature: 0,
    });
    out.chat = { model: c.model, text: c.text.slice(0, 20), ms: Date.now() - t1 };
    return NextResponse.json({ ok: true, ...out });
  } catch (err) {
    const status = err instanceof AiBudgetError ? 429 : 502;
    const attempts = err instanceof AiUnavailableError ? err.attempts : undefined;
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err), attempts, ...out }, { status });
  }
}
