/**
 * Login com e-mail e senha (plano de 2026-11-19): e-mails do login e travas contra abuso.
 * Separado de lib/auth-server.ts (o Better Auth é ESM e não roda no Jest).
 *
 * - D2: a opção só aparece com RESEND_API_KEY (senhaDisponivel). Em modo de teste os links vão para
 *   EMAIL_TEST_TO, como todos os e-mails (lib/email.ts).
 * - D6: até 3 links por hora por e-mail (confirmação, nova senha, "já tem conta"); passou disso, a
 *   resposta continua igual (D7) e o e-mail não sai. 10 senhas erradas seguidas travam o login por
 *   senha até a pessoa criar uma nova pelo link.
 * - Os contadores ficam na tabela Verification com o e-mail em SHA-256 (sem o e-mail em claro).
 */
import type { PrismaClient } from "@prisma/client";
import { enqueueEmail } from "./notifications";
import { emailLocale, renderLoginEmail, type EmailLocale, type LoginEmailTipo } from "./email-templates";
import { LOCALE_COOKIE } from "./locale";

export const LINKS_POR_HORA = 3;
export const ERROS_PARA_TRAVAR = 10;
const HORA_MS = 60 * 60 * 1000;
const ERROS_VALIDADE_MS = 30 * 24 * HORA_MS;

type Db = Pick<PrismaClient, "verification" | "$queryRaw" | "$transaction">;

export function senhaDisponivel(): boolean {
  return !!process.env.RESEND_API_KEY;
}

async function sha256(s: string): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(h), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function chave(tipo: "links" | "erros", email: string): Promise<string> {
  return `w2-${tipo}:${await sha256(normalizarEmail(email))}`;
}

function novoId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

/** Idioma do e-mail: o escolhido na tela (cookie) ou o do navegador. */
export function localeDoPedido(req?: Request | null): EmailLocale {
  const h = req?.headers;
  const cookie = h?.get("cookie") ?? "";
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]+)`));
  if (m) return emailLocale(decodeURIComponent(m[1]));
  return emailLocale(h?.get("accept-language")?.split(",")[0] ?? null);
}

/** Endereço do site para links que não vêm do Better Auth. */
export function origemDoSite(req?: Request | null): string {
  const app = process.env.APP_URL || process.env.BETTER_AUTH_URL;
  if (app) return app.replace(/\/+$/, "");
  try {
    if (req?.url) return new URL(req.url).origin;
  } catch {}
  return "https://w2talent.euclidespns.workers.dev";
}

/** Conta e reserva um envio. false = passou do limite da hora (não envia, responde igual). */
export async function reservarLink(db: Db, email: string, agora: Date = new Date()): Promise<boolean> {
  const identifier = await chave("links", email);
  // A trava por e-mail impede que pedidos simultâneos passem todos do limite.
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${identifier}))`;
    await tx.verification.deleteMany({ where: { identifier, expiresAt: { lt: agora } } });
    const usados = await tx.verification.count({ where: { identifier } });
    if (usados >= LINKS_POR_HORA) return false;
    await tx.verification.create({ data: { id: novoId(), identifier, value: "1", expiresAt: new Date(agora.getTime() + HORA_MS) } });
    return true;
  });
}

export type EnvioLogin = { tipo: LoginEmailTipo; email: string; nome?: string | null; url: string; req?: Request | null };

/**
 * Põe o e-mail do login na fila. Nunca lança: uma falha não pode mudar a resposta da tela (D7).
 * O aviso de senha trocada (D8) não conta no limite: é consequência de uma ação já feita.
 */
export async function enviarEmailDeLogin(db: Db, e: EnvioLogin, agora: Date = new Date()): Promise<"enfileirado" | "limite" | "falhou"> {
  try {
    if (e.tipo !== "senha_trocada" && !(await reservarLink(db, e.email, agora))) {
      console.warn(`[login] limite de links por hora (${e.tipo})`);
      return "limite";
    }
    const r = renderLoginEmail({ locale: localeDoPedido(e.req), tipo: e.tipo, nome: e.nome, url: e.url });
    await enqueueEmail({ to: e.email, ...r, idempotencyKey: `login-${e.tipo}-${await sha256(`${e.email}\n${e.url}\n${agora.getTime()}`)}` });
    return "enfileirado";
  } catch (err) {
    console.error(`[login] e-mail ${e.tipo} não enfileirado: ${(err as Error)?.message ?? err}`);
    return "falhou";
  }
}

export async function contaTravada(db: Db, email: string, agora: Date = new Date()): Promise<boolean> {
  const identifier = await chave("erros", email);
  const v = await db.verification.findFirst({ where: { identifier, expiresAt: { gt: agora } }, select: { value: true } });
  return Number(v?.value ?? 0) >= ERROS_PARA_TRAVAR;
}

/** Soma uma senha errada, de forma atômica (vários pedidos ao mesmo tempo não perdem contagem). */
export async function marcarSenhaErrada(db: Db, email: string, agora: Date = new Date()): Promise<number> {
  const identifier = await chave("erros", email);
  const expiresAt = new Date(agora.getTime() + ERROS_VALIDADE_MS);
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const linhas = await db.$queryRaw<{ value: string }[]>`
      UPDATE "Verification"
         SET "value" = ((CASE WHEN "expiresAt" > ${agora} THEN COALESCE(NULLIF("value", '')::int, 0) ELSE 0 END) + 1)::text,
             "expiresAt" = ${expiresAt}, "updatedAt" = ${agora}
       WHERE "id" = (SELECT "id" FROM "Verification" WHERE "identifier" = ${identifier} ORDER BY "createdAt" LIMIT 1)
   RETURNING "value"`;
    if (linhas.length) return Number(linhas[0].value);
    // Primeira senha errada: cria com um id fixo por e-mail, então dois pedidos juntos não criam duas linhas.
    const criadas = await db.$queryRaw<{ value: string }[]>`
      INSERT INTO "Verification" ("id", "identifier", "value", "expiresAt", "createdAt", "updatedAt")
      VALUES (${identifier}, ${identifier}, '1', ${expiresAt}, ${agora}, ${agora})
      ON CONFLICT ("id") DO NOTHING
      RETURNING "value"`;
    if (criadas.length) return 1;
  }
  return ERROS_PARA_TRAVAR;
}

export async function zerarSenhaErrada(db: Db, email: string): Promise<void> {
  await db.verification.deleteMany({ where: { identifier: await chave("erros", email) } });
}
