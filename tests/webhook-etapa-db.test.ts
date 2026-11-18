/**
 * 3.4b Integração com ATS no banco de verdade: "candidatura.etapa" ao mudar a etapa (só com webhook ligado,
 * contato só depois da Entrevista, fila fora do ar não quebra a mudança) e a pausa depois de 50 falhas
 * seguidas, com um e-mail só ao dono e a contagem zerada ao ligar de novo. Só roda num Postgres local.
 */
import type { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { cookieDeTeste, type ContaTeste } from "./helpers/sessao-mock";
import type { MensagemWebhook } from "../lib/fila";
import type { EmailMessage } from "../lib/email";

jest.mock("../lib/sessao", () => require("./helpers/sessao-mock").sessaoMock());
jest.mock("../lib/background", () => ({ runInBackground: () => undefined }));
const emails: EmailMessage[] = [];
const filaWebhook: MensagemWebhook[] = [];
let filaFora = false;
jest.mock("../lib/notifications", () => ({
  enqueueEmail: async (m: EmailMessage) => {
    emails.push(m);
  },
  enqueueWebhook: async (m: MensagemWebhook) => {
    if (filaFora) throw new Error("fila fora do ar");
    filaWebhook.push(m);
  },
}));

function localDb(url: string | undefined): boolean {
  try {
    return !!url && ["localhost", "127.0.0.1"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}
const describeDb = localDb(process.env.DATABASE_URL) ? describe : describe.skip;

const DONO = "wh34b-dono";
const MEMBRO = "wh34b-membro";
const DONO_SEM = "wh34b-dono-sem";
const USERS = [DONO, MEMBRO, DONO_SEM];
const CAND = "wh34b-cand";
const EMAIL_CAND = "wh34b.cand@exemplo.com";
const MASTER = Buffer.alloc(32, 9).toString("base64");
const DIA = 86_400_000;
const rec = (id: string): ContaTeste => ({ id, perfil: "recrutador", mfaLigado: true });

describeDb("webhook 3.4b: etapa e pausa", () => {
  let db: PrismaClient;
  let companyId = "";
  let semId = "";
  let appA = "";
  let appB = "";
  let appSem = "";
  const masterAntes = process.env.AI_KEYS_MASTER;

  const limpar = async () => {
    await db.candidateProfile.deleteMany({ where: { id: CAND } });
    await db.companyProfile.deleteMany({ where: { nome: { startsWith: "WH34b Teste" } } });
    await db.user.deleteMany({ where: { id: { in: USERS } } });
  };
  const fila = () => {
    const xs: MensagemWebhook[] = [];
    return { xs, enviar: async (m: MensagemWebhook) => void xs.push(m) };
  };
  const status = (s: number) => jest.fn(async () => new Response(null, { status: s })) as unknown as typeof fetch;

  beforeAll(async () => {
    process.env.AI_KEYS_MASTER = MASTER;
    const { createPrismaClient } = await import("../lib/prisma");
    db = createPrismaClient(process.env.DATABASE_URL!);
    await limpar();
    for (const id of USERS) await db.user.create({ data: { id, name: `Dona ${id}`, email: `${id}@exemplo.com`, perfil: "recrutador" } });
    companyId = (await db.companyProfile.create({ data: { nome: "WH34b Teste SA" } })).id;
    semId = (await db.companyProfile.create({ data: { nome: "WH34b Teste Sem Webhook" } })).id;
    await db.companyMember.create({ data: { userId: DONO, companyId, papel: "dono" } });
    await db.companyMember.create({ data: { userId: MEMBRO, companyId, papel: "membro" } });
    await db.companyMember.create({ data: { userId: DONO_SEM, companyId: semId, papel: "dono" } });
    const { salvarWebhook } = await import("../lib/webhook");
    await salvarWebhook(db, companyId, { url: "https://ats.wh34b-teste.com.br/hook" }, MASTER);

    const futuro = new Date(Date.now() + 30 * DIA);
    await db.candidateProfile.create({
      data: {
        id: CAND, userId: CAND, nome: "Carla Mendes", titulo: "Dev Backend", email: EMAIL_CAND, celular: "+5511977776666",
        stack: [{ skillId: "aws", anos: 3 }], senioridade: "pleno", regimePreferido: ["PJ"], expiresAt: futuro,
      } as any,
    });
    const vaga = (cid: string) =>
      db.vacancy.create({ data: { companyId: cid, titulo: "WH34b Backend", stack: [{ skillId: "aws" }] as any, nivel: "Pleno", regime: "PJ", localidade: "Remoto", status: "ativa", expiresAt: futuro } });
    const v = await vaga(companyId);
    const v2 = await vaga(companyId);
    const vs = await vaga(semId);
    const app = (vacancyId: string, cid: string, ref: string) =>
      db.application.create({ data: { candidateId: CAND, vacancyId, companyId: cid, origem: "candidaturaLote", proxyThreadId: ref } });
    appA = (await app(v.id, companyId, "wh34b-a")).id;
    appB = (await app(v2.id, companyId, "wh34b-b")).id;
    appSem = (await app(vs.id, semId, "wh34b-sem")).id;
  });

  afterAll(async () => {
    await limpar();
    process.env.AI_KEYS_MASTER = masterAntes;
    await db.$disconnect();
    const { prisma } = await import("../lib/prisma");
    await prisma.$disconnect();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    filaFora = false;
  });

  it("mudar a etapa põe candidatura.etapa na fila só com webhook ligado e só quando muda", async () => {
    const { mudarEtapa } = await import("../lib/rh-candidaturas");
    const now = new Date("2026-11-18T15:00:00Z");
    const f = fila();
    expect(await mudarEtapa(db, companyId, appA, "nova", "em_analise", now, { enviarWebhook: f.enviar })).toMatchObject({ ok: true, etapa: "em_analise" });
    expect(f.xs).toEqual([
      { tipo: "webhook", evento: "candidatura.etapa", id: expect.stringMatching(/^evt_[0-9a-f]{32}$/), companyId, applicationId: appA, occurredAt: now.toISOString(), etapaDe: "nova", etapaPara: "em_analise" },
    ]);

    // Mesma etapa e conflito ("mudou"): nada na fila.
    expect((await mudarEtapa(db, companyId, appA, "em_analise", "em_analise", now, { enviarWebhook: f.enviar })).ok).toBe(true);
    expect(await mudarEtapa(db, companyId, appA, "nova", "proposta", now, { enviarWebhook: f.enviar })).toEqual({ ok: false, erro: "mudou" });
    // Empresa sem webhook.
    expect((await mudarEtapa(db, semId, appSem, "nova", "em_analise", now, { enviarWebhook: f.enviar })).ok).toBe(true);
    expect(f.xs).toHaveLength(1);

    // Webhook desligado.
    await db.webhook.update({ where: { companyId }, data: { ativo: false } });
    expect((await mudarEtapa(db, companyId, appB, "nova", "em_analise", now, { enviarWebhook: f.enviar })).ok).toBe(true);
    expect(f.xs).toHaveLength(1);
    await db.webhook.update({ where: { companyId }, data: { ativo: true } });
    await db.application.update({ where: { id: appB }, data: { etapa: "nova" } });
  });

  it("corpo do candidatura.etapa: mudança de/para e contato só depois da Entrevista", async () => {
    const { mudarEtapa } = await import("../lib/rh-candidaturas");
    const { entregarWebhook } = await import("../lib/webhook");
    const corpos: any[] = [];
    const fetchOk = jest.fn(async (_u: unknown, init?: RequestInit) => {
      corpos.push(JSON.parse(String(init?.body)));
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch;

    const f = fila();
    await mudarEtapa(db, companyId, appA, "em_analise", "nao_seguiu", new Date(), { enviarWebhook: f.enviar });
    expect(await entregarWebhook(db, f.xs[0], 1, { fetch: fetchOk, master: MASTER })).toMatchObject({ resultado: "ok" });
    expect(corpos[0]).toMatchObject({
      event: "candidatura.etapa",
      id: f.xs[0].id,
      company: { id: companyId },
      data: { candidatura: { id: appA, etapa: "nao_seguiu", referencia: "wh34b-a" }, mudanca: { de: "em_analise", para: "nao_seguiu", em: f.xs[0].occurredAt }, candidato: { contato: null } },
    });
    expect(JSON.stringify(corpos[0])).not.toContain(EMAIL_CAND);
    expect(JSON.stringify(corpos[0])).not.toContain("97777");

    // Entrevista libera o contato (2.4c); o aviso leva e-mail e telefone.
    await mudarEtapa(db, companyId, appA, "nao_seguiu", "entrevista", new Date(), { enviarWebhook: f.enviar });
    expect(await entregarWebhook(db, f.xs[1], 1, { fetch: fetchOk, master: MASTER })).toMatchObject({ resultado: "ok" });
    expect(corpos[1].data.mudanca).toMatchObject({ de: "nao_seguiu", para: "entrevista" });
    expect(corpos[1].data.candidato.contato).toEqual({ email: EMAIL_CAND, celular: "+5511977776666" });
    // Liberado uma vez, continua liberado mesmo voltando a etapa.
    await mudarEtapa(db, companyId, appA, "entrevista", "em_analise", new Date(), { enviarWebhook: f.enviar });
    await entregarWebhook(db, f.xs[2], 1, { fetch: fetchOk, master: MASTER });
    expect(corpos[2].data.candidato.contato).toEqual({ email: EMAIL_CAND, celular: "+5511977776666" });

    const linhas = await db.webhookEntrega.findMany({ where: { deliveryId: { in: f.xs.map((x) => x.id) } } });
    expect(linhas.map((l) => l.evento)).toEqual(["candidatura.etapa", "candidatura.etapa", "candidatura.etapa"]);
  });

  it("fila fora do ar não quebra a mudança de etapa (lib e rota)", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    const { mudarEtapa } = await import("../lib/rh-candidaturas");
    const r = await mudarEtapa(db, companyId, appB, "nova", "em_analise", new Date(), { enviarWebhook: async () => { throw new Error("fila fora"); } });
    expect(r).toMatchObject({ ok: true, etapa: "em_analise" });
    expect((await db.application.findUniqueOrThrow({ where: { id: appB } })).etapa).toBe("em_analise");

    // Pela rota: com a fila no ar o evento entra; fora do ar a resposta continua 200.
    const { PATCH } = await import("../app/api/rh/candidaturas/[id]/route");
    const mudar = (body: unknown) =>
      PATCH(
        new NextRequest(`https://w2.test/api/rh/candidaturas/${appB}`, { method: "PATCH", headers: { "content-type": "application/json", cookie: cookieDeTeste(rec(DONO)) }, body: JSON.stringify(body) }),
        { params: Promise.resolve({ id: appB }) },
      );
    filaWebhook.length = 0;
    const ok = await mudar({ de: "em_analise", para: "proposta" });
    expect(ok.status).toBe(200);
    expect(filaWebhook).toEqual([expect.objectContaining({ evento: "candidatura.etapa", applicationId: appB, etapaDe: "em_analise", etapaPara: "proposta" })]);
    filaFora = true;
    const fora = await mudar({ de: "proposta", para: "contratada" });
    expect(fora.status).toBe(200);
    expect(await fora.json()).toMatchObject({ ok: true, etapa: "contratada" });
    expect((await db.application.findUniqueOrThrow({ where: { id: appB } })).etapa).toBe("contratada");
  });

  it("50 falhas seguidas pausam o webhook e mandam um e-mail só, ao dono", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const { entregarWebhook, lerConfig, WEBHOOK_PAUSA_FALHAS } = await import("../lib/webhook");
    expect(WEBHOOK_PAUSA_FALHAS).toBe(50);
    const msg = (id: string): MensagemWebhook => ({ tipo: "webhook", evento: "candidatura.etapa", id, companyId, applicationId: appA, occurredAt: new Date().toISOString(), etapaDe: "nova", etapaPara: "em_analise" });
    emails.length = 0;
    await db.webhook.update({ where: { companyId }, data: { falhasSeguidas: 47, ativo: true } });

    // 48ª e 49ª: ainda ligado.
    expect(await entregarWebhook(db, msg("evt_wh34b_1"), 1, { fetch: status(500), master: MASTER, appUrl: "https://w2.test/" })).toMatchObject({ resultado: "repetir" });
    expect(await entregarWebhook(db, msg("evt_wh34b_1"), 2, { fetch: status(404), master: MASTER, appUrl: "https://w2.test/" })).toMatchObject({ resultado: "desistir" });
    expect(await db.webhook.findUniqueOrThrow({ where: { companyId } })).toMatchObject({ ativo: true, falhasSeguidas: 49 });
    expect(emails).toHaveLength(0);

    // A 50ª chega por duas entregas ao mesmo tempo: uma pausa só, um e-mail só.
    await Promise.all([
      entregarWebhook(db, msg("evt_wh34b_2"), 1, { fetch: status(503), master: MASTER, appUrl: "https://w2.test/" }),
      entregarWebhook(db, msg("evt_wh34b_3"), 1, { fetch: status(503), master: MASTER, appUrl: "https://w2.test/" }),
    ]);
    const wh = await db.webhook.findUniqueOrThrow({ where: { companyId } });
    expect(wh.ativo).toBe(false);
    expect(wh.falhasSeguidas).toBeGreaterThanOrEqual(50);
    expect(await db.webhookEntrega.count({ where: { webhookId: wh.id, erro: "pausado" } })).toBe(1);
    expect(emails).toHaveLength(1);
    expect(emails[0].to).toBe(`${DONO}@exemplo.com`);
    expect(emails[0].subject).toBe("Integração com ATS pausada");
    expect(emails[0].text).toContain("50 entregas seguidas para ats.wh34b-teste.com.br");
    expect(emails[0].text).toContain("WH34b Teste SA");
    expect(emails[0].text).toContain("https://w2.test/empresa");
    expect(emails[0].idempotencyKey).toMatch(/^webhook-pausado:.+:wh34b-dono$/);

    // Pausado: novas tentativas não enviam, não contam e não mandam outro e-mail.
    const f = status(500);
    expect(await entregarWebhook(db, msg("evt_wh34b_2"), 2, { fetch: f, master: MASTER })).toEqual({ resultado: "desistir", erro: "desligado" });
    expect(f).not.toHaveBeenCalled();
    expect(emails).toHaveLength(1);

    const cfg = (await lerConfig(db, companyId))!;
    expect(cfg).toMatchObject({ ativo: false, pausada: true });
    expect(cfg.pausadaEm).not.toBeNull();
    // A linha da pausa aparece nas entregas (a outra entrega simultânea pode ter gravado depois dela).
    expect(cfg.entregas.slice(0, 2)).toContainEqual(expect.objectContaining({ erro: "pausado", ok: false }));

    // O teste vai mesmo pausado e não mexe na contagem.
    const antes = wh.falhasSeguidas;
    await entregarWebhook(db, { tipo: "webhook", evento: "teste", id: "evt_wh34b_t", companyId, occurredAt: new Date().toISOString() }, 1, { fetch: status(500), master: MASTER });
    expect((await db.webhook.findUniqueOrThrow({ where: { companyId } })).falhasSeguidas).toBe(antes);
  });

  it("ativar de novo pela tela zera a contagem e tira a pausa", async () => {
    const rota = await import("../app/api/conta/empresa/webhook/route");
    const r = await rota.PATCH(
      new NextRequest("https://w2.test/api/conta/empresa/webhook", { method: "PATCH", headers: { "content-type": "application/json", cookie: cookieDeTeste(rec(DONO)) }, body: JSON.stringify({ ativo: true }) }),
    );
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.webhook).toMatchObject({ ativo: true, falhasSeguidas: 0, pausada: false, pausadaEm: null });
    expect(await db.webhook.findUniqueOrThrow({ where: { companyId } })).toMatchObject({ ativo: true, falhasSeguidas: 0 });

    // Desligar à mão: "Desativada", não "Pausada".
    const { salvarWebhook, lerConfig } = await import("../lib/webhook");
    await salvarWebhook(db, companyId, { ativo: false }, MASTER);
    expect(await lerConfig(db, companyId)).toMatchObject({ ativo: false, pausada: false });
  });
});
