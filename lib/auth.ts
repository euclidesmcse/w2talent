import * as crypto from "crypto";
import { otpExpiresAt } from "./hygiene";

// ── Constantes ───────────────────────────────────────────────────────
export const OTP_TTL_MINUTES = 5;
export const OTP_BLOCK_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 3;
export const OTP_COOLDOWN_SECONDS = 60;
export const JWT_COOKIE_NAME = "w2talent_token";
export const JWT_EXPIRES_DAYS = 7;
export const CONSENT_TYPES = [
  "tratamentoBusca",
  "contatoProxy",
  "nudges",
  "iaReescrita",
] as const;

function getJwtSecret(): string {
  const s = process.env.JWT_SECRET;
  if (s) return s;
  // Durante `next build` o Cloudflare roda com NODE_ENV=production mas sem secrets ainda injetados
  // — não quebrar o build, usar fallback apenas para geração estática.
  // Em runtime real (request), signJwt/verifyJwt vão exigir JWT_SECRET.
  if (process.env.NEXT_PHASE === "phase-production-build" || process.env.CI) {
    return "build-dummy-w2talent-jwt-not-for-runtime";
  }
  if (process.env.NODE_ENV === "production") throw new Error("JWT_SECRET não configurado em produção");
  return "dev-secret-change-me-w2talent-jwt";
}

// ── Tipos ────────────────────────────────────────────────────────────
export type ConsentPayload = {
  tratamentoBusca: boolean;
  contatoProxy: boolean;
  nudges: boolean;
  iaReescrita: boolean;
  versao?: number;
  textos?: string[];
};

type OtpRecord = {
  celular: string; // normalized E.164
  codigoHash: string;
  codigo: string; // kept for test/debug; prod would not expose
  expiraEm: Date;
  createdAt: Date;
  tentativas: number;
  bloqueioAte: Date | null;
};

// in-memory store (MVP). Persist to DB in production via prisma.OtpCode
const otpStore = new Map<string, OtpRecord>();
// cooldown tracker: celular -> last request timestamp ms
const cooldownStore = new Map<string, number>();

// consent logs in-memory fallback
type ConsentEntry = {
  userId: string;
  tipo: string;
  versao: number;
  texto: string;
  baseLegal: string;
  createdAt: Date;
};
const consentStore: ConsentEntry[] = [];

// ── Celular helpers ─────────────────────────────────────────────────
export function normalizeCelular(raw: string): string {
  if (!raw || typeof raw !== "string") return raw;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return raw;
  // já com DDI 55
  if (digits.startsWith("55") && digits.length >= 12) {
    return "+" + digits;
  }
  // 11 digitos (DDD+9+8) ou 10 digitos sem DDI
  if (digits.length === 11 || digits.length === 10) {
    return "+55" + digits;
  }
  // fallback: se tiver + já
  if (raw.trim().startsWith("+")) return "+" + digits;
  return "+" + digits;
}

export function isValidCelularBR(raw: string): boolean {
  if (!raw || typeof raw !== "string") return false;
  const norm = normalizeCelular(raw);
  return /^\+55\d{10,11}$/.test(norm);
}

// ── OTP helpers ─────────────────────────────────────────────────────
export function generateOtp(): string {
  // 6 dígitos, sem leading zeros perdidos
  const n = crypto.randomInt(0, 1_000_000);
  return String(n).padStart(6, "0");
}

export function hashOtp(codigo: string): string {
  return crypto.createHash("sha256").update(codigo + getJwtSecret()).digest("hex");
}

export function verifyHash(codigo: string, hash: string): boolean {
  const a = hashOtp(codigo);
  const b = hash;
  try {
    const ba = Buffer.from(a, "utf-8");
    const bb = Buffer.from(b, "utf-8");
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export function clearOtpStore(): void {
  otpStore.clear();
  cooldownStore.clear();
}

// ── LGPD consent ────────────────────────────────────────────────────
// em globalThis para sobreviver a jest.resetModules() (cada require cria uma cópia do módulo)
const pendingConsentWrites: Set<Promise<unknown>> = ((globalThis as any).__w2PendingConsent ??=
  new Set<Promise<unknown>>());

/** Aguarda as gravações de consentimento ainda em andamento (usado em testes e shutdown). */
export async function flushConsentWrites(): Promise<void> {
  await Promise.all([...pendingConsentWrites]);
}

export async function logConsent(
  userId: string,
  tipo: string,
  versao: number,
  texto: string
): Promise<ConsentEntry> {
  const entry: ConsentEntry = {
    userId,
    tipo,
    versao,
    texto,
    baseLegal: "consentimento",
    createdAt: new Date(),
  };
  consentStore.push(entry);
  // best-effort DB persist (ignore if no DB)
  try {
    const { prisma } = await import("./prisma");
    await prisma.consentLog
      .create({
        data: {
          userId,
          tipo,
          versao,
          texto,
          baseLegal: "consentimento",
        },
      })
      .catch(() => {});
  } catch {}
  return entry;
}

// ── JWT helpers ─────────────────────────────────────────────────────
function base64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}
function base64urlDecode(input: string): string {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(b64, "base64").toString("utf-8");
}

export function signJwt(payload: Record<string, unknown>, expiresDays = JWT_EXPIRES_DAYS): string {
  const header = { alg: "HS256", typ: "JWT" };
  const nowSec = Math.floor(Date.now() / 1000);
  const expSec = nowSec + expiresDays * 24 * 60 * 60;
  const fullPayload = { iat: nowSec, exp: expSec, ...payload };
  const h = base64url(JSON.stringify(header));
  const p = base64url(JSON.stringify(fullPayload));
  const data = `${h}.${p}`;
  const sig = base64url(crypto.createHmac("sha256", getJwtSecret()).update(data).digest());
  return `${data}.${sig}`;
}

export function verifyJwt(token: string): Record<string, any> | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, sig] = parts;
  const data = `${h}.${p}`;
  const expected = base64url(crypto.createHmac("sha256", getJwtSecret()).update(data).digest());
  try {
    const a = Buffer.from(sig, "utf-8");
    const b = Buffer.from(expected, "utf-8");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(base64urlDecode(p));
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.exp && nowSec > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

// ── Auth business ───────────────────────────────────────────────────

function httpError(message: string, status: number): Error & { status: number; statusCode: number } {
  const e: any = new Error(message);
  e.status = status;
  e.statusCode = status;
  return e;
}

export function requestOtp(celularRaw: string): OtpRecord {
  const celular = normalizeCelular(celularRaw);
  if (!isValidCelularBR(celular)) {
    throw httpError("celular inválido, use formato E.164 BR (+55...)", 400);
  }
  const now = new Date();
  const last = cooldownStore.get(celular);
  if (last != null) {
    const diffSec = (now.getTime() - last) / 1000;
    if (diffSec < OTP_COOLDOWN_SECONDS) {
      throw httpError(`cooldown 60s, aguarde ${Math.ceil(OTP_COOLDOWN_SECONDS - diffSec)}s`, 429);
    }
  }
  // bloqueio check: se existe registro bloqueado
  const existing = otpStore.get(celular);
  if (existing?.bloqueioAte && now < existing.bloqueioAte) {
    throw httpError("bloqueado por 10min após 3 tentativas", 429);
  }

  const codigo = generateOtp();
  const codigoHash = hashOtp(codigo);
  const createdAt = new Date(now);
  const expiraEm = otpExpiresAt(createdAt);

  const rec: OtpRecord = {
    celular,
    codigo,
    codigoHash,
    expiraEm,
    createdAt,
    tentativas: 0,
    bloqueioAte: null,
  };
  otpStore.set(celular, rec);
  cooldownStore.set(celular, now.getTime());

  // fallback SMS stub — only log OTP in test (never in prod)
  if (process.env.NODE_ENV === "test") {
    // eslint-disable-next-line no-console
    console.log(`[auth] OTP para ${celular}: ${codigo} expira ${expiraEm.toISOString()} (stub SMS)`);
  }
  return rec;
}

function validateConsents(consents: ConsentPayload): void {
  if (!consents || typeof consents !== "object") {
    throw httpError(
      "consentimentos obrigatórios: tratamentoBusca, contatoProxy, nudges, iaReescrita (LGPD granular)",
      400
    );
  }
  for (const t of CONSENT_TYPES) {
    if ((consents as any)[t] !== true) {
      throw httpError(
        `consentimento obrigatório faltando ou não aceito: ${t} (LGPD granular, 4 flags)`,
        400
      );
    }
  }
}

export function verifyOtp(
  celularRaw: string,
  codigo: string,
  consents: ConsentPayload
): { token: string; userId: string } {
  const celular = normalizeCelular(celularRaw);
  if (!isValidCelularBR(celular)) {
    throw httpError("celular inválido", 400);
  }
  const now = new Date();
  const rec = otpStore.get(celular);
  if (!rec) {
    throw httpError("código expirado, reenviar", 410);
  }
  // bloqueio ativo
  if (rec.bloqueioAte && now < rec.bloqueioAte) {
    throw httpError("bloqueado por 10min após 3 tentativas, aguarde", 429);
  }
  // expirou bloqueio? limpa se passou
  if (rec.bloqueioAte && now >= rec.bloqueioAte) {
    rec.bloqueioAte = null;
    rec.tentativas = 0;
  }
  // expiração 5min
  if (now > rec.expiraEm) {
    // também 410 Review Focus
    throw httpError("código expirado, reenviar", 410);
  }

  const ok = verifyHash(codigo, rec.codigoHash);
  if (!ok) {
    rec.tentativas += 1;
    if (rec.tentativas >= OTP_MAX_ATTEMPTS) {
      rec.bloqueioAte = new Date(now.getTime() + OTP_BLOCK_MINUTES * 60 * 1000);
      throw httpError("bloqueado por 10min após 3 tentativas", 429);
    }
    throw httpError("código inválido", 401);
  }

  // código correto -> valida consentimentos (só após acerto para não vazar info)
  validateConsents(consents);

  // sucesso: log consentimentos versionados + limpar OTP
  const versao = (consents as any).versao ?? 1;
  const textos: string[] = (consents as any).textos ?? [];
  for (let i = 0; i < CONSENT_TYPES.length; i++) {
    const tipo = CONSENT_TYPES[i];
    const texto = textos[i] ?? `Consentimento ${tipo} v${versao} — LGPD granular`;
    // fire-and-forget (sync push já; async DB) — rastreado para flushConsentWrites()
    const p: Promise<unknown> = logConsent(celular, tipo, versao, texto).catch(() => {});
    pendingConsentWrites.add(p);
    p.finally(() => pendingConsentWrites.delete(p));
  }

  otpStore.delete(celular);
  // keep cooldown but don't block verify; cooldown only for requestOtp

  const token = signJwt({ userId: celular, celular });
  return { token, userId: celular };
}

// ── requireAuth ─────────────────────────────────────────────────────
export function requireAuth(req: Request | { headers: any; cookies?: any }): { userId: string; celular: string; [k: string]: any } {
  let token: string | null = null;
  // headers: Request, NextRequest, ou plain object
  const headers: any = (req as any).headers;
  let authHeader: string | null = null;
  let cookieHeader: string | null = null;

  if (headers) {
    if (typeof headers.get === "function") {
      authHeader = headers.get("authorization") ?? headers.get("Authorization");
      cookieHeader = headers.get("cookie") ?? headers.get("Cookie");
    } else {
      authHeader = headers["authorization"] ?? headers["Authorization"] ?? headers["authorization".toLowerCase()];
      cookieHeader = headers["cookie"] ?? headers["Cookie"];
    }
  }
  // NextRequest cookies API
  const cookiesObj: any = (req as any).cookies;
  if (cookiesObj && typeof cookiesObj.get === "function") {
    const c = cookiesObj.get(JWT_COOKIE_NAME);
    if (c?.value) token = c.value;
  }

  if (!token && authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7).trim();
  }
  if (!token && cookieHeader) {
    const match = cookieHeader.match(new RegExp(`${JWT_COOKIE_NAME}=([^;\\s]+)`));
    if (match) token = match[1];
  }
  if (!token) {
    throw httpError("não autorizado: token ausente", 401);
  }
  const payload = verifyJwt(token);
  if (!payload || !payload.userId) {
    throw httpError("não autorizado: token inválido ou expirado", 401);
  }
  return payload as any;
}
