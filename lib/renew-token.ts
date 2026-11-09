/**
 * Link "Continuo procurando" (1.5.15): token assinado (HMAC-SHA256) que renova o perfil sem login.
 *
 * Formato: base64url(userId) + "." + validade (segundos desde 1970) + "." + base64url(assinatura).
 * Vale 30 dias. A chave é o Worker Secret `RENEW_LINK_SECRET` (mínimo 32 caracteres).
 * Web Crypto puro: roda igual no Worker e no Node (jest).
 */

export const RENEW_LINK_TTL_DAYS = 30;
export const RENEW_SECRET_MIN = 32;

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s: string): Uint8Array {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

export function renewSecretOk(secret: string | undefined): secret is string {
  return !!secret && secret.length >= RENEW_SECRET_MIN;
}

export async function signRenewToken(userId: string, secret: string, now: Date = new Date()): Promise<string> {
  if (!renewSecretOk(secret)) throw new Error("RENEW_LINK_SECRET ausente ou curto demais.");
  const exp = Math.floor(now.getTime() / 1000) + RENEW_LINK_TTL_DAYS * 24 * 60 * 60;
  const payload = `${b64url(enc.encode(userId))}.${exp}`;
  return `${payload}.${b64url(await hmac(secret, payload))}`;
}

export type RenewCheck = { ok: true; userId: string } | { ok: false; erro: "link_invalido" | "link_vencido" };

export async function verifyRenewToken(token: string | null | undefined, secret: string | undefined, now: Date = new Date()): Promise<RenewCheck> {
  if (!renewSecretOk(secret) || !token || token.length > 512) return { ok: false, erro: "link_invalido" };
  const parts = token.split(".");
  if (parts.length !== 3 || !/^\d{1,12}$/.test(parts[1])) return { ok: false, erro: "link_invalido" };
  const expected = await hmac(secret, `${parts[0]}.${parts[1]}`);
  let got: Uint8Array;
  try {
    got = fromB64url(parts[2]);
  } catch {
    return { ok: false, erro: "link_invalido" };
  }
  // Comparação em tempo constante.
  let diff = got.length ^ expected.length;
  for (let i = 0; i < expected.length; i++) diff |= (got[i] ?? 0) ^ expected[i];
  if (diff !== 0) return { ok: false, erro: "link_invalido" };
  if (Number(parts[1]) * 1000 < now.getTime()) return { ok: false, erro: "link_vencido" };
  let userId: string;
  try {
    userId = new TextDecoder("utf-8", { fatal: true }).decode(fromB64url(parts[0]));
  } catch {
    return { ok: false, erro: "link_invalido" };
  }
  if (!userId) return { ok: false, erro: "link_invalido" };
  return { ok: true, userId };
}
