import { AiProviderError, type CallContext } from "../types";

/** Endereço base do AI Gateway: https://gateway.ai.cloudflare.com/v1/<conta>/<gateway>. */
export function gatewayBase(ctx: CallContext): string | null {
  const { accountId, id } = ctx.gateway;
  return accountId && id ? `https://gateway.ai.cloudflare.com/v1/${accountId}/${id}` : null;
}

/**
 * Monta a URL da chamada: pelo gateway quando o fornecedor tem caminho lá, senão direto no baseUrl.
 * `path` é o resto do endereço depois do fornecedor (ex.: "/chat/completions").
 */
export function providerUrl(ctx: CallContext, path: string): string {
  const base = gatewayBase(ctx);
  if (ctx.gatewayPath && base) return `${base}/${ctx.gatewayPath.replace(/^\/|\/$/g, "")}${path}`;
  if (ctx.baseUrl) return `${ctx.baseUrl.replace(/\/$/, "")}${path}`;
  throw new AiProviderError("fornecedor sem endereço: configure o AI Gateway (AI_GATEWAY_ACCOUNT_ID e AI_GATEWAY_ID) ou o baseUrl");
}

export async function postJson(ctx: CallContext, url: string, body: unknown, headers: Record<string, string>): Promise<any> {
  const res = await ctx.fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    // Só o começo da resposta: mensagens de erro podem ecoar o pedido.
    throw new AiProviderError(`HTTP ${res.status}: ${text.slice(0, 200)}`, res.status);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new AiProviderError("resposta do fornecedor não é JSON");
  }
}
