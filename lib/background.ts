/**
 * Trabalho em segundo plano: roda depois que a resposta já saiu.
 * No Worker usa `ctx.waitUntil` (a Cloudflare espera a promessa terminar);
 * fora dele (next dev, testes) só deixa a promessa correr.
 * Erros são registrados e nunca derrubam a requisição.
 */
export function runInBackground(label: string, task: () => Promise<unknown>): void {
  const p = Promise.resolve()
    .then(task)
    .catch((e) => {
      // eslint-disable-next-line no-console
      console.error(`[segundo plano] ${label} falhou:`, e instanceof Error ? e.message : e);
    });
  const cf = (globalThis as Record<symbol, unknown>)[Symbol.for("__cloudflare-context__")] as
    | { ctx?: { waitUntil?: (p: Promise<unknown>) => void } }
    | undefined;
  cf?.ctx?.waitUntil?.(p);
}
