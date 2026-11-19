/**
 * Fila `notificacoes` (1.5.15): quem produz (rota do Cron) põe o e-mail na fila; quem consome
 * (custom-worker.ts) envia pelo Resend, com novas tentativas automáticas.
 * Fora do Worker (next dev, testes) ou sem a fila configurada, envia direto.
 */
import { emailEnvFromProcess, sendEmail, type EmailMessage } from "./email";
import type { MensagemWebhook, MensagemWhatsapp } from "./fila";

type QueueBinding = { send: (body: unknown, opts?: { delaySeconds?: number }) => Promise<void> };

function notificationsQueue(): QueueBinding | undefined {
  const cf = (globalThis as Record<symbol, unknown>)[Symbol.for("__cloudflare-context__")] as
    | { env?: { NOTIFICACOES?: QueueBinding } }
    | undefined;
  return cf?.env?.NOTIFICACOES;
}

export async function enqueueEmail(msg: EmailMessage): Promise<void> {
  const q = notificationsQueue();
  if (q) {
    await q.send({ tipo: "email", ...msg });
    return;
  }
  const r = await sendEmail(msg, emailEnvFromProcess());
  if (r.status === "falhou") throw new Error(`Resend respondeu ${r.http}${r.codigo ? ` (${r.codigo})` : ""}`);
}

/**
 * 3.4a: evento de webhook na mesma fila (só ids). Fora do Worker (next dev) entrega na hora, uma vez,
 * sem novas tentativas.
 */
export async function enqueueWebhook(msg: MensagemWebhook): Promise<void> {
  const q = notificationsQueue();
  if (q) {
    await q.send(msg);
    return;
  }
  const [{ getPrisma }, { entregarWebhook }] = await Promise.all([import("./prisma"), import("./webhook")]);
  const r = await entregarWebhook(getPrisma(), msg, 1);
  if (r.resultado !== "ok") console.warn(`[webhook] entrega direta: ${r.status ?? r.erro ?? r.resultado}`);
}

/**
 * 3.5a: aviso de WhatsApp na mesma fila (só ids). `delaySeconds` segura o aviso até as 8h de Brasília (D5).
 * Fora do Worker (next dev) entrega na hora, uma vez, sem novas tentativas.
 */
export async function enqueueWhatsapp(msg: MensagemWhatsapp, delaySeconds = 0): Promise<void> {
  const q = notificationsQueue();
  if (q) {
    await q.send(msg, delaySeconds > 0 ? { delaySeconds } : undefined);
    return;
  }
  const [{ getPrisma }, { entregarAviso }] = await Promise.all([import("./prisma"), import("./whatsapp-db")]);
  const r = await entregarAviso(getPrisma(), msg, 1);
  if (r.resultado !== "ok") console.warn(`[whatsapp] entrega direta: ${r.status ?? r.erro ?? r.resultado}`);
}
