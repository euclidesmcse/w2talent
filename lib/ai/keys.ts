/**
 * Cifra das chaves de API dos fornecedores (AES-GCM 256, WebCrypto: roda no Worker e no Node).
 * A chave mestra é o Worker Secret AI_KEYS_MASTER (32 bytes em base64), nunca o banco nem o repositório.
 * Formato guardado: "v1:<iv base64>:<cifra base64>".
 */

const PREFIX = "v1";

function b64encode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export class AiKeysError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiKeysError";
  }
}

async function masterKey(master: string | undefined): Promise<CryptoKey> {
  if (!master) throw new AiKeysError("AI_KEYS_MASTER não configurada");
  let raw: Uint8Array;
  try {
    raw = b64decode(master.trim());
  } catch {
    throw new AiKeysError("AI_KEYS_MASTER não é base64");
  }
  if (raw.length !== 32) throw new AiKeysError("AI_KEYS_MASTER deve ter 32 bytes (gere com: openssl rand -base64 32)");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptApiKey(plain: string, master = process.env.AI_KEYS_MASTER): Promise<string> {
  const key = await masterKey(master);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain)));
  return `${PREFIX}:${b64encode(iv)}:${b64encode(ct)}`;
}

export async function decryptApiKey(stored: string, master = process.env.AI_KEYS_MASTER): Promise<string> {
  const [v, ivB64, ctB64] = stored.split(":");
  if (v !== PREFIX || !ivB64 || !ctB64) throw new AiKeysError("chave guardada em formato desconhecido");
  const key = await masterKey(master);
  try {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64decode(ivB64) }, key, b64decode(ctB64));
    return new TextDecoder().decode(plain);
  } catch {
    // Não repassa o erro original: a mensagem não deve ajudar a adivinhar a chave.
    throw new AiKeysError("não foi possível decifrar a chave (AI_KEYS_MASTER trocada?)");
  }
}

/** Os 4 últimos caracteres, para o painel mostrar qual chave está cadastrada. */
export function keyHint(plain: string): string {
  return plain.length <= 4 ? "****" : plain.slice(-4);
}
