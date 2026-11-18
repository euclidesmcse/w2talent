/**
 * Consumidor da fila `notificacoes` (1.5.15; webhooks no 3.4a). O `custom-worker.ts` chama `processarFila`.
 * Cada mensagem tem um `tipo`:
 * - "email": envia pelo Resend, um por vez (o Resend aceita poucos por segundo);
 * - "webhook": entrega um evento ao sistema da empresa (ATS). A mensagem leva só ids; quem entrega
 *   monta o corpo na hora, assina e grava a tentativa (`WebhookEntrega`), sem guardar o corpo.
 *
 * Este arquivo não importa o Prisma: o Worker já leva o app do OpenNext, e o banco é usado pela rota
 * interna `/api/webhooks/entregar` (ver `custom-worker.ts`). Assim o pacote não carrega o Prisma duas vezes.
 */
import { retryDelay, sendEmail, type EmailEnv, type EmailMessage, type SendResult } from "./email";

/** Eventos do 3.4a; o 3.4b acrescenta "candidatura.etapa". */
export type EventoWebhook = "candidatura.recebida" | "candidatura.etapa" | "teste";
export const EVENTOS_WEBHOOK: readonly EventoWebhook[] = ["candidatura.recebida", "candidatura.etapa", "teste"];

/** Mensagem de webhook na fila: só ids, nunca o corpo. `id` = id do evento (igual em todas as tentativas). */
export type MensagemWebhook = {
  tipo: "webhook";
  evento: EventoWebhook;
  id: string;
  companyId: string;
  applicationId?: string;
  occurredAt: string;
};

/** O que a entrega devolve: "repetir" volta para a fila; "ok" e "desistir" saem dela. */
export type ResultadoEntrega = { resultado: "ok" | "repetir" | "desistir"; status?: number | null; erro?: string | null; atrasoSeg?: number };

export type QueueMessage = { id: string; body: unknown; attempts: number; ack(): void; retry(o?: { delaySeconds?: number }): void };
export type MessageBatch = { queue: string; messages: readonly QueueMessage[] };

export type DepsFila = {
  emailEnv: EmailEnv;
  /** Entrega um webhook (no Worker: a rota interna do app). `tentativa` começa em 1. */
  entregarWebhook: (m: MensagemWebhook, tentativa: number) => Promise<ResultadoEntrega>;
  enviarEmail?: (m: EmailMessage, env: EmailEnv) => Promise<SendResult>;
  pausa?: (ms: number) => Promise<void>;
};

/** Até 10 tentativas (`max_retries` do consumidor no wrangler.jsonc). */
export const WEBHOOK_MAX_TENTATIVAS = 10;

export function ehEmail(b: unknown): b is EmailMessage & { tipo: "email" } {
  const m = b as Record<string, unknown> | null;
  return !!m && m.tipo === "email" && typeof m.to === "string" && typeof m.subject === "string" && typeof m.html === "string" && typeof m.text === "string" && typeof m.idempotencyKey === "string";
}

export function ehWebhook(b: unknown): b is MensagemWebhook {
  const m = b as Record<string, unknown> | null;
  return (
    !!m &&
    m.tipo === "webhook" &&
    typeof m.evento === "string" &&
    (EVENTOS_WEBHOOK as readonly string[]).includes(m.evento) &&
    typeof m.id === "string" &&
    typeof m.companyId === "string" &&
    typeof m.occurredAt === "string" &&
    (m.applicationId === undefined || typeof m.applicationId === "string")
  );
}

/** Espera antes da próxima tentativa: 1, 2, 4, 8... minutos, no máximo 1 hora (cerca de 6 h nas 10). */
export function atrasoWebhook(tentativa: number): number {
  const n = Math.max(1, Math.floor(tentativa));
  return Math.min(3600, 60 * 2 ** (n - 1));
}

const pausaPadrao = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function processarFila(batch: MessageBatch, deps: DepsFila): Promise<void> {
  const enviar = deps.enviarEmail ?? sendEmail;
  const pausa = deps.pausa ?? pausaPadrao;
  for (const msg of batch.messages) {
    if (ehWebhook(msg.body)) {
      const tentativa = Math.max(1, msg.attempts || 1);
      let r: ResultadoEntrega;
      try {
        r = await deps.entregarWebhook(msg.body, tentativa);
      } catch (e) {
        r = { resultado: "repetir", erro: e instanceof Error ? e.name : "erro" };
      }
      if (r.resultado === "repetir" && tentativa < WEBHOOK_MAX_TENTATIVAS) {
        console.warn(`[fila] webhook ${msg.body.evento} falhou (${r.status ?? r.erro ?? "?"}), nova tentativa ${tentativa + 1}`);
        msg.retry({ delaySeconds: r.atrasoSeg ?? atrasoWebhook(tentativa) });
      } else {
        if (r.resultado !== "ok") console.error(`[fila] webhook ${msg.body.evento} desistiu (${r.status ?? r.erro ?? "?"}) na tentativa ${tentativa}.`);
        msg.ack();
      }
      continue;
    }
    if (!ehEmail(msg.body)) {
      console.error(`[fila] mensagem ${msg.id} em formato desconhecido; descartada.`);
      msg.ack();
      continue;
    }
    const r = await enviar(msg.body, deps.emailEnv);
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
}
