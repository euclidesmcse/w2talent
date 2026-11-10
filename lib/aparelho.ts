/**
 * "Lembrar este aparelho por 30 dias" (1.5.5). Cookie httpOnly com `userId.expira.assinatura`
 * (HMAC-SHA256 com BETTER_AUTH_SECRET). Com ele válido, o login social não pede o código do
 * autenticador de novo. Usa Web Crypto (Worker e Node).
 */
export const APARELHO_COOKIE = "w2_aparelho";
export const APARELHO_DIAS = 30;

const enc = new TextEncoder();

function b64url(buf: ArrayBuffer): string {
  let s = "";
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function assinatura(texto: string, segredo: string): Promise<string> {
  const chave = await crypto.subtle.importKey("raw", enc.encode(`w2-aparelho:${segredo}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", chave, enc.encode(texto)));
}

export async function assinarAparelho(userId: string, segredo: string, agora = Date.now()): Promise<string> {
  const expira = agora + APARELHO_DIAS * 86_400_000;
  const corpo = `${userId}.${expira}`;
  return `${corpo}.${await assinatura(corpo, segredo)}`;
}

/** Comparação em tempo constante. */
function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function aparelhoConfiavel(valor: string, userId: string, segredo: string, agora = Date.now()): Promise<boolean> {
  const i = valor.lastIndexOf(".");
  if (i < 0) return false;
  const corpo = valor.slice(0, i);
  const j = corpo.lastIndexOf(".");
  if (j < 0) return false;
  if (corpo.slice(0, j) !== userId) return false;
  const expira = Number(corpo.slice(j + 1));
  if (!Number.isFinite(expira) || expira < agora) return false;
  return iguais(valor.slice(i + 1), await assinatura(corpo, segredo));
}

export function lerCookie(headers: Headers | null | undefined, nome: string): string | null {
  const raw = headers?.get?.("cookie");
  if (!raw) return null;
  for (const parte of raw.split(";")) {
    const k = parte.indexOf("=");
    if (k > 0 && parte.slice(0, k).trim() === nome) {
      try { return decodeURIComponent(parte.slice(k + 1).trim()); } catch { return null; }
    }
  }
  return null;
}
