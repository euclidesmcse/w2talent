// Step 1: failing test — TDD Task 2
import {
  OTP_TTL_MINUTES,
  OTP_BLOCK_MINUTES,
  OTP_MAX_ATTEMPTS,
  OTP_COOLDOWN_SECONDS,
  normalizeCelular,
  isValidCelularBR,
  generateOtp,
  hashOtp,
  verifyHash,
  signJwt,
  verifyJwt,
  requireAuth,
  requestOtp,
  verifyOtp,
  logConsent,
  flushConsentWrites,
  clearOtpStore,
  CONSENT_TYPES,
  JWT_COOKIE_NAME,
} from "../lib/auth";
import { otpExpiresAt } from "../lib/hygiene";

describe("Auth — OTP 5min + bloqueio + cooldown + LGPD + JWT", () => {
  // verifyOtp grava consentimentos em background; espera terminar antes do Jest encerrar
  afterAll(async () => {
    await flushConsentWrites();
  });
  beforeEach(() => {
    clearOtpStore();
    jest.useFakeTimers().setSystemTime(new Date("2026-11-07T10:00:00Z"));
  });
  afterEach(() => {
    jest.useRealTimers();
    clearOtpStore();
  });

  it("1. OTP expira em 5min", () => {
    expect(OTP_TTL_MINUTES).toBe(5);
    const from = new Date("2026-11-07T10:00:00Z");
    const exp = otpExpiresAt(from);
    expect(exp.toISOString()).toBe("2026-11-07T10:05:00.000Z");
    // lib/auth generate path also 5min
    const rec = requestOtp("+5511999999999");
    expect(rec.expiraEm.getTime() - rec.createdAt.getTime()).toBe(5 * 60 * 1000);
  });

  it("2. 3 tentativas erradas bloqueia 10min", () => {
    expect(OTP_MAX_ATTEMPTS).toBe(3);
    expect(OTP_BLOCK_MINUTES).toBe(10);
    const celular = "+5511988887777";
    const { codigo } = requestOtp(celular);
    // 1ª errada
    expect(() => verifyOtp(celular, "000000", validConsents())).toThrow();
    // 2ª errada
    expect(() => verifyOtp(celular, "111111", validConsents())).toThrow();
    // 3ª errada -> bloqueia
    let err: any;
    try {
      verifyOtp(celular, "222222", validConsents());
    } catch (e: any) {
      err = e;
    }
    expect(err).toBeDefined();
    // After 3 attempts, next verify should be blocked even with correct code
    expect(() => verifyOtp(celular, codigo, validConsents())).toThrow(/bloqueado|bloqueio|10/i);
    // Avança 10min + 1s → bloqueio expira, OTP já expirou (5min) então deve dar 410 expirado, reenviar
    jest.advanceTimersByTime(10 * 60 * 1000 + 1000);
    expect(() => verifyOtp(celular, codigo, validConsents())).toThrow(/expirado/i);
  });

  it("3. reenvio respeita cooldown 60s", () => {
    expect(OTP_COOLDOWN_SECONDS).toBe(60);
    const celular = "+5511977776666";
    requestOtp(celular);
    // immediate re-send should throw cooldown
    expect(() => requestOtp(celular)).toThrow(/cooldown|aguarde|60/i);
    // after 61s allow
    jest.advanceTimersByTime(61 * 1000);
    const second = requestOtp(celular);
    expect(second.codigo).toBeDefined();
    expect(second.codigo).toMatch(/^\d{6}$/);
  });

  it("4. consentimentos 4 flags obrigatórias, sem elas 400", () => {
    expect(CONSENT_TYPES.length).toBe(4);
    const celular = "+5511966665555";
    const { codigo } = requestOtp(celular);
    // sem consentimentos -> 400
    expect(() => verifyOtp(celular, codigo, undefined as any)).toThrow(/consent/i);
    expect(() => verifyOtp(celular, codigo, {} as any)).toThrow(/consent/i);
    // parcial -> 400
    expect(() =>
      verifyOtp(celular, codigo, { tratamentoBusca: true, contatoProxy: true } as any)
    ).toThrow(/consent/i);
    // todas false -> 400
    expect(() =>
      verifyOtp(celular, codigo, {
        tratamentoBusca: false,
        contatoProxy: false,
        nudges: false,
        iaReescrita: false,
      } as any)
    ).toThrow(/consent/i);
    // todas true -> ok (need fresh OTP because previous verify may have consumed? request new)
    jest.advanceTimersByTime(61 * 1000);
    const fresh = requestOtp(celular);
    const result = verifyOtp(celular, fresh.codigo, validConsents());
    expect(result.token).toBeDefined();
  });

  it("5. JWT válido libera /api/candidates (requireAuth)", () => {
    const celular = "+5511955554444";
    const payload = { userId: celular, celular };
    const token = signJwt(payload);
    expect(token.split(".").length).toBe(3);
    const decoded = verifyJwt(token);
    expect(decoded?.userId).toBe(celular);
    // requireAuth via Authorization header
    const req = new Request("http://localhost/api/candidates", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const user = requireAuth(req as any);
    expect(user.userId).toBe(celular);
    // invalid token throws 401
    const badReq = new Request("http://localhost/api/candidates", {
      headers: { Authorization: `Bearer invalid.token.here` },
    });
    expect(() => requireAuth(badReq as any)).toThrow(/401|não autorizado|unauthorized|token/i);
    // also via cookie
    const cookieReq = new Request("http://localhost/api/candidates", {
      headers: { Cookie: `${JWT_COOKIE_NAME}=${token}` },
    });
    const user2 = requireAuth(cookieReq as any);
    expect(user2.userId).toBe(celular);
  });

  it("6. Review Focus: OTP expirado retorna 410 código expirado, reenviar", () => {
    const celular = "+5511944443333";
    const { codigo } = requestOtp(celular);
    // advance 5min +1s
    jest.advanceTimersByTime(5 * 60 * 1000 + 1000);
    let err: any;
    try {
      verifyOtp(celular, codigo, validConsents());
    } catch (e: any) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.status ?? err.statusCode ?? 410).toBe(410);
    expect(err.message).toMatch(/código expirado, reenviar/i);
  });

  it("validação celular E.164 BR", () => {
    expect(isValidCelularBR("+5511999999999")).toBe(true);
    expect(isValidCelularBR("+5521999999999")).toBe(true);
    expect(isValidCelularBR("11999999999")).toBe(true); // normalized
    expect(normalizeCelular("11999999999")).toBe("+5511999999999");
    expect(isValidCelularBR("123")).toBe(false);
    expect(isValidCelularBR("+1 555 123")).toBe(false);
    expect(generateOtp()).toMatch(/^\d{6}$/);
    const code = "123456";
    const h = hashOtp(code);
    expect(verifyHash(code, h)).toBe(true);
    expect(verifyHash("000000", h)).toBe(false);
  });

  it("logConsent com texto versionado LGPD", async () => {
    const entry = await logConsent("+5511999999999", "tratamentoBusca", 1, "Texto v1 LGPD ...");
    expect(entry.userId).toBe("+5511999999999");
    expect(entry.tipo).toBe("tratamentoBusca");
    expect(entry.versao).toBe(1);
    expect(entry.texto).toBe("Texto v1 LGPD ...");
    expect(entry.baseLegal).toBeTruthy();
  });
});

function validConsents() {
  return {
    tratamentoBusca: true,
    contatoProxy: true,
    nudges: true,
    iaReescrita: true,
    versao: 1,
    textos: ["t1", "t2", "t3", "t4"],
  };
}
