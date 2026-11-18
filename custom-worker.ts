/**
 * Worker do W2Talent (1.5.15): o app do OpenNext + o Cron diário + o consumidor da fila `notificacoes`.
 * O `wrangler.jsonc` aponta `main` para este arquivo; `.open-next/worker.js` é gerado pelo build.
 */
// @ts-ignore -- gerado por `opennextjs-cloudflare build`
import { default as handler } from "./.open-next/worker.js";
import { processarFila, type MensagemWebhook, type MessageBatch, type ResultadoEntrega } from "./lib/fila";

type Env = Record<string, unknown> & {
  CRON_SECRET?: string;
  APP_URL?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  EMAIL_MODE?: string;
  EMAIL_TEST_TO?: string;
};
type Ctx = { waitUntil(p: Promise<unknown>): void; passThroughOnException?(): void };

const baseInterna = (env: Env) => (env.APP_URL || "https://w2talent.internal").replace(/\/+$/, "");

/**
 * 3.4a: a entrega do webhook roda dentro do app (rota interna `/api/webhooks/entregar`, protegida pelo
 * CRON_SECRET, como a higiene do Cron). Lá o Prisma usa o Hyperdrive da requisição; este arquivo não
 * carrega o Prisma de novo no pacote.
 */
async function entregarWebhook(m: MensagemWebhook, tentativa: number, env: Env, ctx: Ctx): Promise<ResultadoEntrega> {
  if (!env.CRON_SECRET) return { resultado: "repetir", erro: "sem_cron_secret" };
  const req = new Request(`${baseInterna(env)}/api/webhooks/entregar`, {
    method: "POST",
    headers: { "x-cron-secret": env.CRON_SECRET, "content-type": "application/json" },
    body: JSON.stringify({ ...m, tentativa }),
  });
  const res: Response = await handler.fetch(req, env, ctx);
  if (!res.ok) return { resultado: "repetir", erro: `rota_${res.status}` };
  return (await res.json()) as ResultadoEntrega;
}

export default {
  fetch: handler.fetch,

  /** Cron Trigger (todo dia às 12:00 UTC = 9h de Brasília): roda a higiene pela própria rota do app. */
  async scheduled(_controller: unknown, env: Env, ctx: Ctx) {
    if (!env.CRON_SECRET) {
      console.error("[cron] CRON_SECRET não configurado; higiene não rodou.");
      return;
    }
    const base = baseInterna(env);
    const req = new Request(`${base}/api/cron/hygiene`, { method: "POST", headers: { "x-cron-secret": env.CRON_SECRET } });
    const res: Response = await handler.fetch(req, env, ctx);
    console.log(`[cron] higiene respondeu ${res.status}`);
  },

  /** Fila `notificacoes`: e-mails pelo Resend (um por vez) e webhooks das empresas (3.4a). Ver lib/fila.ts. */
  async queue(batch: MessageBatch, env: Env, ctx: Ctx) {
    const emailEnv = { apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM, mode: env.EMAIL_MODE, testTo: env.EMAIL_TEST_TO };
    await processarFila(batch, { emailEnv, entregarWebhook: (m, tentativa) => entregarWebhook(m, tentativa, env, ctx) });
  },
};
