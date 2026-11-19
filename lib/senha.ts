/**
 * Senha do login por e-mail (plano "login com e-mail e senha", D3).
 *
 * PBKDF2-SHA256 pelo Web Crypto (nativo no Worker e no Node), não o scrypt em JavaScript do Better
 * Auth: o plano gratuito do Workers dá ~10 ms de CPU por pedido e o scrypt passa disso.
 * O workerd recusa mais de 100 mil rodadas de PBKDF2, então esse é o teto aqui (a OWASP pede 600 mil
 * para SHA-256; subir depende de sair do Web Crypto). Cada hash guarda as próprias rodadas: dá para
 * mudar SENHA_RODADAS depois sem invalidar senhas antigas.
 *
 * Formato: `pbkdf2-sha256$<rodadas>$<sal base64url>$<hash base64url>`.
 */
export const SENHA_RODADAS = 100_000;
export const SENHA_MIN = 10;
export const SENHA_MAX = 128;
const PREFIXO = "pbkdf2-sha256";
const SAL_BYTES = 16;
const HASH_BYTES = 32;
/** Teto aceito ao verificar (um hash adulterado não pode pedir milhões de rodadas). */
const RODADAS_MAX = 100_000;

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function deB64url(s: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) return null;
  try {
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

async function derivar(senha: string, sal: Uint8Array, rodadas: number): Promise<Uint8Array> {
  const chave = await crypto.subtle.importKey("raw", new TextEncoder().encode(senha.normalize("NFKC")), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: sal as BufferSource, iterations: rodadas }, chave, HASH_BYTES * 8);
  return new Uint8Array(bits);
}

export async function hashSenha(senha: string, rodadas: number = SENHA_RODADAS): Promise<string> {
  const sal = crypto.getRandomValues(new Uint8Array(SAL_BYTES));
  const h = await derivar(senha, sal, rodadas);
  return `${PREFIXO}$${rodadas}$${b64url(sal)}$${b64url(h)}`;
}

function iguais(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}

export async function verificarSenha({ hash, password }: { hash: string; password: string }): Promise<boolean> {
  const partes = hash.split("$");
  if (partes.length !== 4 || partes[0] !== PREFIXO) return false;
  const rodadas = Number(partes[1]);
  if (!Number.isSafeInteger(rodadas) || rodadas < 1 || rodadas > RODADAS_MAX) return false;
  const sal = deB64url(partes[2]);
  const esperado = deB64url(partes[3]);
  if (!sal || !esperado || esperado.length !== HASH_BYTES) return false;
  return iguais(await derivar(password, sal, rodadas), esperado);
}
