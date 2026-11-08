/**
 * Comparação de segredos sem vazar informação pelo tempo de resposta.
 *
 * `===` para no primeiro caractere diferente, então quem mede o tempo da resposta
 * consegue descobrir o segredo aos poucos. Aqui o tempo depende só do tamanho do
 * segredo esperado. Puro JS: roda igual no Worker da Cloudflare e no Node (jest).
 */

const encoder = new TextEncoder();

export function timingSafeEqualStr(received: string, expected: string): boolean {
  const a = encoder.encode(received ?? "");
  const b = encoder.encode(expected ?? "");
  let diff = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) {
    diff |= (a[i] ?? 0) ^ b[i];
  }
  return diff === 0 && b.length > 0;
}

/**
 * Valores de segredo que a requisição apresentou: `Authorization: Bearer <s>`,
 * `Authorization: <s>`, `x-cron-secret`, `x-webhook-secret` e (legado) `?cron_secret=`.
 */
function presentedSecrets(req: Request & { nextUrl?: URL }): string[] {
  const out: string[] = [];
  const auth = req.headers.get("authorization") ?? "";
  if (auth) {
    out.push(auth);
    if (auth.startsWith("Bearer ")) out.push(auth.slice(7).trim());
  }
  for (const h of ["x-cron-secret", "x-webhook-secret"]) {
    const v = req.headers.get(h);
    if (v) out.push(v);
  }
  const url = req.nextUrl ?? new URL(req.url);
  const q = url.searchParams.get("cron_secret");
  if (q) out.push(q);
  return out;
}

/** true se a requisição trouxe `expected` em algum dos lugares aceitos. Sem segredo configurado, nega. */
export function requestHasSecret(req: Request & { nextUrl?: URL }, expected: string | undefined): boolean {
  if (!expected) return false;
  let ok = false;
  // Compara todos (sem parar no primeiro acerto) para o tempo não indicar qual campo bateu.
  for (const v of presentedSecrets(req)) {
    if (timingSafeEqualStr(v, expected)) ok = true;
  }
  return ok;
}

/** Segredo dos webhooks do proxy: CRON_SECRET, ou WEBHOOK_SECRET se o primeiro não existir. */
export function webhookSecret(): string | undefined {
  return process.env.CRON_SECRET || process.env.WEBHOOK_SECRET || undefined;
}
