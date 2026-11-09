/**
 * Worker do W2Talent (1.5.15): o app do OpenNext + o Cron diário + o consumidor da fila `notificacoes`.
 * O `wrangler.jsonc` aponta `main` para este arquivo; `.open-next/worker.js` é gerado pelo build.
 */
// @ts-ignore -- gerado por `opennextjs-cloudflare build`
import { default as handler } from "./.open-next/worker.js";
import { retryDelay, sendEmail, type EmailMessage } from "./lib/email";

type Env = Record<string, unknown> & {
  CRON_SECRET?: string;
  APP_URL?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  EMAIL_MODE?: string;
  EMAIL_TEST_TO?: string;
};
type Ctx = { waitUntil(p: Promise<unknown>): void; passThroughOnException?(): void };
type QueueMessage = { id: string; body: unknown; attempts: number; ack(): void; retry(o?: { delaySeconds?: number }): void };
type MessageBatch = { queue: string; messages: readonly QueueMessage[] };

function isEmail(b: unknown): b is EmailMessage & { tipo: "email" } {
  const m = b as Record<string, unknown> | null;
  return !!m && m.tipo === "email" && typeof m.to === "string" && typeof m.subject === "string" && typeof m.html === "string" && typeof m.text === "string" && typeof m.idempotencyKey === "string";
}

const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));


export default {
  fetch: handler.fetch,

  /** Cron Trigger (todo dia às 12:00 UTC = 9h de Brasília): roda a higiene pela própria rota do app. */
  async scheduled(_controller: unknown, env: Env, ctx: Ctx) {
    if (!env.CRON_SECRET) {
      console.error("[cron] CRON_SECRET não configurado; higiene não rodou.");
      return;
    }
    const base = (env.APP_URL || "https://w2talent.internal").replace(/\/+$/, "");
    const req = new Request(`${base}/api/cron/hygiene`, { method: "POST", headers: { "x-cron-secret": env.CRON_SECRET } });
    const res: Response = await handler.fetch(req, env, ctx);
    console.log(`[cron] higiene respondeu ${res.status}`);
  },

  /** Fila `notificacoes`: envia pelo Resend, um por vez (o Resend aceita poucos por segundo). */
  async queue(batch: MessageBatch, env: Env) {
    const emailEnv = { apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM, mode: env.EMAIL_MODE, testTo: env.EMAIL_TEST_TO };
    for (const msg of batch.messages) {
      if (!isEmail(msg.body)) {
        console.error(`[fila] mensagem ${msg.id} em formato desconhecido; descartada.`);
        msg.ack();
        continue;
      }
      const r = await sendEmail(msg.body, emailEnv);
      if (r.status === "falhou" && r.tentarDeNovo) {
        // Limite do dia: até a meia-noite UTC; 429 por segundo: 1 min; falha do Resend ou de rede: 5 min.
        console.warn(`[fila] envio falhou (${r.http}${r.codigo ? ` ${r.codigo}` : ""}), nova tentativa ${msg.attempts + 1}`);
        msg.retry({ delaySeconds: retryDelay(r.codigo, r.http) });
      } else {
        if (r.status === "falhou") console.error(`[fila] envio recusado (${r.http}${r.codigo ? ` ${r.codigo}` : ""}); não será repetido.`);
        msg.ack();
      }
      await pausa(600);
    }
  },
};
