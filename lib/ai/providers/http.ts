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
    // Nunca o corpo da resposta: mensagens de erro podem ecoar o pedido (nome, histórico do CV).
    const code = errorCode(text);
    throw new AiProviderError(`HTTP ${res.status}${code ? ` (${code})` : ""}`, res.status);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new AiProviderError("resposta do fornecedor não é JSON");
  }
}

/**
 * Só o código de erro do fornecedor (ex.: "rate_limit_exceeded", "invalid_api_key", "RESOURCE_EXHAUSTED"),
 * e só se parecer um identificador. Texto livre nunca sai daqui.
 */
export function errorCode(body: string): string | null {
  let parsed: any;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  const err = parsed?.error;
  const candidates = [err?.code, err?.type, err?.status, parsed?.type];
  for (const c of candidates) {
    if (typeof c === "string" && /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(c)) return c;
  }
  return null;
}
