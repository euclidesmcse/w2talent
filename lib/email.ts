/**
 * Envio de e-mail pelo Resend (1.5.15). `fetch` puro, sem SDK: roda no Worker (fila `notificacoes`)
 * e no Node (testes).
 *
 * Modos (`EMAIL_MODE`):
 * - "real": envia para o destinatário de verdade (só depois de o domínio estar verificado no Resend);
 * - qualquer outro valor (padrão "teste"): manda tudo para `EMAIL_TEST_TO`, com "[teste]" no assunto;
 *   sem `EMAIL_TEST_TO`, não envia nada, só registra no log.
 * Sem `RESEND_API_KEY` também só registra. Nunca grava o corpo do e-mail nem a resposta do Resend no log.
 */

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Mesmo valor = mesmo e-mail: o Resend não reenvia se a fila repetir a mensagem. */
  idempotencyKey: string;
};

export type EmailEnv = {
  apiKey?: string;
  from?: string;
  mode?: string;
  testTo?: string;
  fetch?: typeof fetch;
};

export const DEFAULT_EMAIL_FROM = "W2Talent <avisos@w2talent.com>";

export type SendResult =
  | { status: "enviado"; id?: string }
  | { status: "pulado"; motivo: "sem_chave" | "modo_teste_sem_destino" }
  /** `tentarDeNovo`: limite de envio ou falha do Resend; a fila tenta mais tarde. */
  | { status: "falhou"; http: number; codigo?: string; tentarDeNovo: boolean };

export function emailEnvFromProcess(): EmailEnv {
  return {
    apiKey: process.env.RESEND_API_KEY || undefined,
    from: process.env.EMAIL_FROM || undefined,
    mode: process.env.EMAIL_MODE || undefined,
    testTo: process.env.EMAIL_TEST_TO || undefined,
  };
}

/** Para onde o e-mail vai de fato, conforme o modo. null = não envia. */
export function resolveRecipient(msg: EmailMessage, env: EmailEnv): { to: string; subject: string } | null {
  if (env.mode === "real") return { to: msg.to, subject: msg.subject };
  if (!env.testTo) return null;
  return { to: env.testTo, subject: `[teste] ${msg.subject}` };
}

export async function sendEmail(msg: EmailMessage, env: EmailEnv): Promise<SendResult> {
  if (!env.apiKey) {
    console.log(`[e-mail] sem RESEND_API_KEY, não enviado (${msg.idempotencyKey})`);
    return { status: "pulado", motivo: "sem_chave" };
  }
  const dest = resolveRecipient(msg, env);
  if (!dest) {
    console.log(`[e-mail] modo teste sem EMAIL_TEST_TO, não enviado (${msg.idempotencyKey})`);
    return { status: "pulado", motivo: "modo_teste_sem_destino" };
  }
  const doFetch = env.fetch ?? fetch;
  let res: Response;
  try {
    res = await doFetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": msg.idempotencyKey.slice(0, 256),
      },
      body: JSON.stringify({ from: env.from || DEFAULT_EMAIL_FROM, to: [dest.to], subject: dest.subject, html: msg.html, text: msg.text }),
    });
  } catch {
    return { status: "falhou", http: 0, codigo: "rede", tentarDeNovo: true };
  }
  if (res.ok) {
    const body = (await res.json().catch(() => ({}))) as { id?: string };
    return { status: "enviado", id: body.id };
  }
  const err = (await res.json().catch(() => ({}))) as { name?: string };
  const codigo = typeof err.name === "string" ? err.name.slice(0, 60) : undefined;
  // 429 (limite por segundo ou do dia) e 5xx: tenta de novo. Outros 4xx (endereço inválido,
  // domínio não verificado) não melhoram repetindo.
  const tentarDeNovo = res.status === 429 || res.status >= 500;
  return { status: "falhou", http: res.status, codigo, tentarDeNovo };
}
