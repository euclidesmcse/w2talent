/**
 * Acesso de admin temporário (1.5.8), até o login do 1.5.5 trazer o papel de admin.
 *
 * Decisão do Euclides em 2026-11-09: uma senha só, guardada no Worker Secret ADMIN_SECRET
 * (criada no servidor dele com openssl, sem o valor aparecer na tela). Quem acerta recebe um
 * cookie assinado (HMAC-SHA256 com a própria senha), só do servidor, que vale 12 horas.
 * Cinco erros seguidos do mesmo IP bloqueiam por 15 minutos (admin-lock.ts).
 *
 * WebCrypto puro: roda no Worker e no Node (jest).
 */
import { timingSafeEqualStr } from "./secret";

export const ADMIN_COOKIE = "w2_admin";
export const ADMIN_SESSION_HOURS = 12;
export const ADMIN_MAX_FAILS = 5;
export const ADMIN_LOCK_MINUTES = 15;

const enc = new TextEncoder();

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

export async function sha256Hex(s: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s)));
  return [...d].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Senha forte o bastante para valer (evita ligar o painel com um segredo curto por engano). */
export function adminSecretUsable(secret: string | undefined): secret is string {
  return typeof secret === "string" && secret.trim().length >= 24;
}

/** Valor do cookie: "<expira em ms>.<assinatura>". */
export async function signAdminSession(secret: string, now = Date.now()): Promise<{ value: string; expires: Date }> {
  const exp = now + ADMIN_SESSION_HOURS * 3600_000;
  return { value: `${exp}.${await hmac(secret, `w2-admin:${exp}`)}`, expires: new Date(exp) };
}

export async function verifyAdminSession(value: string | undefined | null, secret: string | undefined, now = Date.now()): Promise<boolean> {
  if (!value || !adminSecretUsable(secret)) return false;
  const dot = value.indexOf(".");
  if (dot <= 0) return false;
  const expRaw = value.slice(0, dot);
  if (!/^\d{10,16}$/.test(expRaw)) return false;
  const exp = Number(expRaw);
  if (exp <= now || exp > now + ADMIN_SESSION_HOURS * 3600_000 + 60_000) return false;
  const expected = await hmac(secret, `w2-admin:${exp}`);
  return timingSafeEqualStr(value.slice(dot + 1), expected);
}

export function passwordMatches(given: unknown, secret: string | undefined): boolean {
  if (typeof given !== "string" || !adminSecretUsable(secret)) return false;
  return timingSafeEqualStr(given, secret);
}

/** Lê um cookie do cabeçalho Cookie. */
export function readCookie(header: string | null | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

/** A requisição traz um cookie de admin válido? */
export async function isAdminRequest(req: Request, secret = process.env.ADMIN_SECRET): Promise<boolean> {
  return verifyAdminSession(readCookie(req.headers.get("cookie"), ADMIN_COOKIE), secret);
}

export function cookieHeader(value: string, expires: Date): string {
  return `${ADMIN_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Strict; Expires=${expires.toUTCString()}`;
}

export function clearCookieHeader(): string {
  return `${ADMIN_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}
