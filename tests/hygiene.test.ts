/**
 * Higiene (1.5.15): regras puras, link assinado, textos dos e-mails, envio pelo Resend e a rota do Cron.
 * O fluxo no banco está em tests/hygiene-db.test.ts.
 */
import { NextRequest } from "next/server";
import {
  VACANCY_TTL_DAYS,
  CANDIDATE_TTL_DAYS,
  OTP_TTL_MINUTES,
  PURGE_AFTER_ARCHIVED_DAYS,
  vacancyExpiresAt,
  candidateExpiresAt,
  otpExpiresAt,
  isEligibleForPurge,
  withVacancyExpiry,
  withCandidateExpiry,
  dueNudge,
  isPlaceholderEmail,
} from "../lib/hygiene";
import { signRenewToken, verifyRenewToken } from "../lib/renew-token";
import { renderHygieneEmail, emailLocale } from "../lib/email-templates";
import { sendEmail, type EmailMessage } from "../lib/email";

const DAY = 24 * 60 * 60 * 1000;
const SECRET = "x".repeat(40);

describe("Hygiene helpers — expiresAt defaults (C2)", () => {
  it("VACANCY_TTL=14d, CANDIDATE_TTL=180d, OTP_TTL=5min, PURGE=30d", () => {
    expect(VACANCY_TTL_DAYS).toBe(14);
    expect(CANDIDATE_TTL_DAYS).toBe(180);
    expect(OTP_TTL_MINUTES).toBe(5);
    expect(PURGE_AFTER_ARCHIVED_DAYS).toBe(30);
  });

  it("vacancyExpiresAt = from +14d", () => {
    const from = new Date("2026-11-01T10:00:00Z");
    expect(vacancyExpiresAt(from).toISOString()).toBe("2026-11-15T10:00:00.000Z");
  });

  it("candidateExpiresAt = from +180d", () => {
    const from = new Date("2026-11-01T00:00:00Z");
    expect(candidateExpiresAt(from).toISOString()).toBe("2027-04-30T00:00:00.000Z");
  });

  it("otpExpiresAt = from +5min", () => {
    const from = new Date("2026-11-07T10:00:00Z");
    expect(otpExpiresAt(from).toISOString()).toBe("2026-11-07T10:05:00.000Z");
  });

  it("withVacancyExpiry auto-preenche se ausente, preserva se presente", () => {
    const from = new Date("2026-11-01T00:00:00Z");
    const auto = withVacancyExpiry({ titulo: "Dev", createdAt: from } as any);
    expect(auto.expiresAt.toISOString()).toBe("2026-11-15T00:00:00.000Z");
    const explicit = new Date("2026-12-01T00:00:00Z");
    const kept = withVacancyExpiry({ titulo: "Dev", expiresAt: explicit } as any);
    expect(kept.expiresAt).toBe(explicit);
  });

  it("withCandidateExpiry auto-preenche se ausente (usa updatedAt > createdAt > now)", () => {
    const updatedAt = new Date("2026-11-01T00:00:00Z");
    const auto = withCandidateExpiry({ nome: "Ana", updatedAt } as any);
    expect(auto.expiresAt.toISOString()).toBe("2027-04-30T00:00:00.000Z");
  });

  it("isEligibleForPurge: arquivado >=30d => true, else false", () => {
    const now = new Date("2026-11-07T00:00:00Z");
    const d30 = new Date("2026-10-08T00:00:00Z");
    const d29 = new Date("2026-10-09T00:00:00Z");
    const d31 = new Date("2026-10-07T00:00:00Z");
    expect(isEligibleForPurge("arquivado", d30, now)).toBe(true);
    expect(isEligibleForPurge("arquivado", d31, now)).toBe(true);
    expect(isEligibleForPurge("arquivado", d29, now)).toBe(false);
    expect(isEligibleForPurge("ativo", d30, now)).toBe(false);
    expect(isEligibleForPurge("arquivado", null, now)).toBe(false);
  });
});

describe("Marcos dos lembretes (faixas, não dia exato)", () => {
  const now = new Date("2026-11-09T12:00:00Z");
  const expiraEm = (diasDoCiclo: number) => new Date(now.getTime() + (CANDIDATE_TTL_DAYS - diasDoCiclo) * DAY);
  it.each([
    [149, null],
    [150, "D150"],
    [164, "D150"],
    [165, "D165"],
    [170, "D165"],
    [175, "D175"],
    [179, "D175"],
  ])("dia %i do ciclo → %s", (dia, marco) => {
    expect(dueNudge(expiraEm(dia as number), now)).toBe(marco);
  });
  it("endereços de exemplo não recebem e-mail", () => {
    expect(isPlaceholderEmail("cand@example.com")).toBe(true);
    expect(isPlaceholderEmail("x@empresa.local")).toBe(true);
    expect(isPlaceholderEmail("sem-arroba")).toBe(true);
    expect(isPlaceholderEmail("ana@gmail.com")).toBe(false);
  });
});

describe("Link 'Continuo procurando'", () => {
  const now = new Date("2026-11-09T12:00:00Z");
  it("assina e confere; vence em 30 dias", async () => {
    const t = await signRenewToken("user_ção_1", SECRET, now);
    expect(await verifyRenewToken(t, SECRET, now)).toEqual({ ok: true, userId: "user_ção_1" });
    expect(await verifyRenewToken(t, SECRET, new Date(now.getTime() + 29 * DAY))).toEqual({ ok: true, userId: "user_ção_1" });
    expect(await verifyRenewToken(t, SECRET, new Date(now.getTime() + 31 * DAY))).toEqual({ ok: false, erro: "link_vencido" });
  });
  it("recusa link adulterado, de outra chave ou sem chave", async () => {
    const t = await signRenewToken("u1", SECRET, now);
    const [, exp, sig] = t.split(".");
    const outroUser = `${Buffer.from("u2").toString("base64url")}.${exp}.${sig}`;
    expect(await verifyRenewToken(outroUser, SECRET, now)).toEqual({ ok: false, erro: "link_invalido" });
    const maisPrazo = t.replace(`.${exp}.`, `.${Number(exp) + 999999}.`);
    expect(await verifyRenewToken(maisPrazo, SECRET, now)).toEqual({ ok: false, erro: "link_invalido" });
    expect(await verifyRenewToken(t, "y".repeat(40), now)).toEqual({ ok: false, erro: "link_invalido" });
    expect(await verifyRenewToken(t, undefined, now)).toEqual({ ok: false, erro: "link_invalido" });
    expect(await verifyRenewToken("lixo", SECRET, now)).toEqual({ ok: false, erro: "link_invalido" });
  });
  it("não assina com chave curta", async () => {
    await expect(signRenewToken("u1", "curta")).rejects.toThrow();
  });
});

describe("Textos dos e-mails", () => {
  it("três idiomas, link no botão e no texto, nome escapado", () => {
    for (const locale of ["pt-BR", "en", "es"] as const) {
      const m = renderHygieneEmail({ marco: "D150", locale, nome: "<b>Ana</b> Souza", renewUrl: "https://w2.test/renovar?t=a.b&c", dias: 30 });
      expect(m.subject).toMatch(/30/);
      expect(m.html).toContain("https://w2.test/renovar?t=a.b&amp;c");
      expect(m.text).toContain("https://w2.test/renovar?t=a.b&c");
      expect(m.html).not.toContain("<b>Ana</b>");
      expect(m.html).toContain("&lt;b&gt;Ana&lt;/b&gt;");
    }
    expect(renderHygieneEmail({ marco: "D180", locale: "pt-BR", nome: "Ana", renewUrl: "u", dias: 30 }).subject).toBe("Seu perfil saiu da busca");
    expect(renderHygieneEmail({ marco: "D175", locale: "en", nome: "", renewUrl: "u", dias: 5 }).text.startsWith("Hi,")).toBe(true);
  });
  it("idioma do perfil → idioma do e-mail", () => {
    expect(emailLocale("pt-BR")).toBe("pt-BR");
    expect(emailLocale("en-US")).toBe("en");
    expect(emailLocale("es")).toBe("es");
    expect(emailLocale(null)).toBe("pt-BR");
  });
});

describe("Envio pelo Resend", () => {
  const msg: EmailMessage = { to: "ana@gmail.com", subject: "Assunto", html: "<p>x</p>", text: "x", idempotencyKey: "higiene:u1:D150:2026-05-13" };
  function fakeFetch(status: number, body: unknown) {
    const calls: { url: string; init: RequestInit }[] = [];
    const f = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify(body), { status });
    }) as unknown as typeof fetch;
    return { f, calls };
  }
  it("sem chave ou em teste sem destino: não envia", async () => {
    const { f, calls } = fakeFetch(200, { id: "1" });
    expect(await sendEmail(msg, { fetch: f })).toEqual({ status: "pulado", motivo: "sem_chave" });
    expect(await sendEmail(msg, { apiKey: "k", mode: "teste", fetch: f })).toEqual({ status: "pulado", motivo: "modo_teste_sem_destino" });
    expect(calls).toHaveLength(0);
  });
  it("modo teste: vai só para EMAIL_TEST_TO, com [teste] no assunto e chave de idempotência", async () => {
    const { f, calls } = fakeFetch(200, { id: "abc" });
    expect(await sendEmail(msg, { apiKey: "k", mode: "teste", testTo: "dono@gmail.com", fetch: f })).toEqual({ status: "enviado", id: "abc" });
    const body = JSON.parse(String(calls[0].init.body));
    expect(body.to).toEqual(["dono@gmail.com"]);
    expect(body.subject).toBe("[teste] Assunto");
    expect(body.from).toBe("W2Talent <avisos@w2talent.com>");
    expect((calls[0].init.headers as Record<string, string>)["Idempotency-Key"]).toBe(msg.idempotencyKey);
  });
  it("modo real: vai para o candidato", async () => {
    const { f, calls } = fakeFetch(200, { id: "abc" });
    await sendEmail(msg, { apiKey: "k", mode: "real", testTo: "dono@gmail.com", fetch: f });
    expect(JSON.parse(String(calls[0].init.body)).to).toEqual(["ana@gmail.com"]);
  });
  it("429 e 5xx tentam de novo; 4xx não", async () => {
    expect(await sendEmail(msg, { apiKey: "k", mode: "real", fetch: fakeFetch(429, { name: "daily_quota_exceeded" }).f })).toEqual({ status: "falhou", http: 429, codigo: "daily_quota_exceeded", tentarDeNovo: true });
    expect((await sendEmail(msg, { apiKey: "k", mode: "real", fetch: fakeFetch(503, {}).f })) as { tentarDeNovo: boolean }).toMatchObject({ tentarDeNovo: true });
    expect((await sendEmail(msg, { apiKey: "k", mode: "real", fetch: fakeFetch(403, { name: "validation_error" }).f })) as { tentarDeNovo: boolean }).toMatchObject({ tentarDeNovo: false });
  });
});

describe("Rota do Cron", () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });
  it("sem CRON_SECRET: 503; segredo só no cabeçalho", async () => {
    const { POST } = await import("../app/api/cron/hygiene/route");
    delete process.env.CRON_SECRET;
    expect((await POST(new NextRequest("http://x/api/cron/hygiene", { method: "POST" }))).status).toBe(503);
    process.env.CRON_SECRET = "s3gredo-do-cron";
    expect((await POST(new NextRequest("http://x/api/cron/hygiene?cron_secret=s3gredo-do-cron", { method: "POST" }))).status).toBe(401);
    expect((await POST(new NextRequest("http://x/api/cron/hygiene", { method: "POST", headers: { "x-cron-secret": "errado" } }))).status).toBe(401);
  });
});

describe("Rota de renovação", () => {
  it("link inválido ou ausente: 400 sem tocar no banco", async () => {
    process.env.RENEW_LINK_SECRET = SECRET;
    const { POST } = await import("../app/api/perfil/renovar/route");
    const r = await POST(new NextRequest("http://x/api/perfil/renovar", { method: "POST", body: JSON.stringify({ t: "a.1.b" }) }));
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: "link_invalido" });
    const r2 = await POST(new NextRequest("http://x/api/perfil/renovar", { method: "POST", body: "{}" }));
    expect(r2.status).toBe(400);
  });
});
