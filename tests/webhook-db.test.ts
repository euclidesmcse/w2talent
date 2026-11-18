/**
 * 3.4a Integração com ATS no banco de verdade: só o dono configura, segredo aparece uma vez e fica
 * cifrado, o envio em lote põe o evento na fila e a entrega grava cada tentativa. Só roda num Postgres local.
 */
import type { PrismaClient } from "@prisma/client";
import { createHmac } from "crypto";
import { NextRequest } from "next/server";
import { cookieDeTeste, type ContaTeste } from "./helpers/sessao-mock";
import type { MensagemWebhook } from "../lib/fila";

jest.mock("../lib/sessao", () => require("./helpers/sessao-mock").sessaoMock());
jest.mock("../lib/background", () => ({ runInBackground: () => undefined }));

function localDb(url: string | undefined): boolean {
  try {
    return !!url && ["localhost", "127.0.0.1"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}
const describeDb = localDb(process.env.DATABASE_URL) ? describe : describe.skip;

const DONO = "wh34a-dono";
const MEMBRO = "wh34a-membro";
const SEM_EMPRESA = "wh34a-sem-empresa";
const USERS = [DONO, MEMBRO, SEM_EMPRESA];
const CONTA_CAND = "wh34a-conta-cand";
const EMAIL_CAND = "wh34a.cand@exemplo.com";
const NOW = new Date("2026-11-18T15:00:00Z");
const DIA = 86_400_000;
const MASTER = Buffer.alloc(32, 7).toString("base64");

const rec = (id: string): ContaTeste => ({ id, perfil: "recrutador", mfaLigado: true });
function req(method: string, conta: ContaTeste | null, body?: unknown, extra: Record<string, string> = {}) {
  const headers: Record<string, string> = { "content-type": "application/json", ...extra };
  if (conta) headers.cookie = cookieDeTeste(conta);
  return new NextRequest("https://w2.test/api/conta/empresa/webhook", { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

describeDb("webhook da empresa (3.4a)", () => {
  let db: PrismaClient;
  let companyId: string;
  let outraId: string;
  let rota: typeof import("../app/api/conta/empresa/webhook/route");
  const masterAntes = process.env.AI_KEYS_MASTER;

  const limpar = async () => {
    await db.candidateProfile.deleteMany({ where: { email: EMAIL_CAND } });
    await db.companyProfile.deleteMany({ where: { nome: { startsWith: "WH34a Teste" } } });
    await db.user.deleteMany({ where: { id: { in: USERS } } });
  };

  beforeAll(async () => {
    process.env.AI_KEYS_MASTER = MASTER;
    const { createPrismaClient } = await import("../lib/prisma");
    db = createPrismaClient(process.env.DATABASE_URL!);
    // A rota usa o `prisma` global, que lê DATABASE_URL.
    rota = await import("../app/api/conta/empresa/webhook/route");
    await limpar();
    for (const id of USERS) await db.user.create({ data: { id, name: id, email: `${id}@exemplo.com`, perfil: "recrutador" } });
    companyId = (await db.companyProfile.create({ data: { nome: "WH34a Teste SA", emailContato: "rh@wh34a.example" } })).id;
    outraId = (await db.companyProfile.create({ data: { nome: "WH34a Teste Sem Webhook" } })).id;
    await db.companyMember.create({ data: { userId: DONO, companyId, papel: "dono" } });
    await db.companyMember.create({ data: { userId: MEMBRO, companyId, papel: "membro" } });
  });

  afterAll(async () => {
    await limpar();
    process.env.AI_KEYS_MASTER = masterAntes;
    await db.$disconnect();
    const { prisma } = await import("../lib/prisma");
    await prisma.$disconnect();
  });

  afterEach(() => jest.restoreAllMocks());

  let segredo = "";

  it("só o dono configura; outra origem e endereço interno são recusados", async () => {
    expect((await rota.GET(req("GET", null))).status).toBe(401);
    expect((await rota.GET(req("GET", { ...rec(DONO), mfaLigado: false }))).status).toBe(403);
    expect((await rota.GET(req("GET", rec(SEM_EMPRESA)))).status).toBe(404);
    const membro = await rota.PATCH(req("PATCH", rec(MEMBRO), { url: "https://ats.wh34a-teste.com.br/hook" }));
    expect(membro.status).toBe(403);
    expect(await membro.json()).toEqual({ error: "so_dono" });
    expect((await rota.GET(req("GET", rec(MEMBRO)))).status).toBe(403);
    expect((await rota.POST(req("POST", rec(MEMBRO), { acao: "segredo" }))).status).toBe(403);
    const origem = await rota.PATCH(req("PATCH", rec(DONO), { url: "https://ats.wh34a-teste.com.br/hook" }, { origin: "https://outro.example" }));
    expect(origem.status).toBe(403);
    const interno = await rota.PATCH(req("PATCH", rec(DONO), { url: "https://192.168.0.5/hook" }));
    expect(interno.status).toBe(400);
    expect(await interno.json()).toEqual({ error: "url", motivo: "host_privado" });
    expect(await db.webhook.count({ where: { companyId } })).toBe(0);
  });

  it("cria ligado e mostra o segredo uma vez; no banco ele fica cifrado", async () => {
    const r = await rota.PATCH(req("PATCH", rec(DONO), { url: "https://ats.wh34a-teste.com.br/hook" }));
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.segredo).toMatch(/^whsec_[0-9a-f]{64}$/);
    expect(j.webhook).toMatchObject({ url: "https://ats.wh34a-teste.com.br/hook", ativo: true, entregas: [] });
    segredo = j.segredo;

    const wh = await db.webhook.findUniqueOrThrow({ where: { companyId } });
    expect(wh.segredoCifrado).toMatch(/^v1:/);
    expect(wh.segredoCifrado).not.toContain(segredo);
    const { decryptApiKey } = await import("../lib/ai/keys");
    expect(await decryptApiKey(wh.segredoCifrado, MASTER)).toBe(segredo);

    // Depois, nunca mais aparece.
    const get = await (await rota.GET(req("GET", rec(DONO)))).json();
    expect(JSON.stringify(get)).not.toContain(segredo);
    expect(get).not.toHaveProperty("segredo");
    const mudaUrl = await (await rota.PATCH(req("PATCH", rec(DONO), { url: "https://ats2.wh34a-teste.com.br/hook" }))).json();
    expect(mudaUrl.segredo).toBeNull();
    expect(mudaUrl.webhook.url).toBe("https://ats2.wh34a-teste.com.br/hook");
    await rota.PATCH(req("PATCH", rec(DONO), { url: "https://ats.wh34a-teste.com.br/hook" }));
  });

  it("novo segredo troca o cifrado e aparece só na resposta", async () => {
    const antes = (await db.webhook.findUniqueOrThrow({ where: { companyId } })).segredoCifrado;
    const j = await (await rota.POST(req("POST", rec(DONO), { acao: "segredo" }))).json();
    expect(j.segredo).toMatch(/^whsec_/);
    expect(j.segredo).not.toBe(segredo);
    const depois = (await db.webhook.findUniqueOrThrow({ where: { companyId } })).segredoCifrado;
    expect(depois).not.toBe(antes);
    segredo = j.segredo;
  });

  it("enviar teste: POST assinado ao endereço e a entrega aparece na lista", async () => {
    const chamadas: { url: string; init: RequestInit }[] = [];
    jest.spyOn(global, "fetch").mockImplementation(async (url, init) => {
      chamadas.push({ url: String(url), init: init! });
      return new Response(null, { status: 204 });
    });
    const j = await (await rota.POST(req("POST", rec(DONO), { acao: "teste" }))).json();
    expect(j.teste).toEqual({ ok: true, status: 204, erro: null });
    expect(chamadas).toHaveLength(1);
    const { url, init } = chamadas[0];
    expect(url).toBe("https://ats.wh34a-teste.com.br/hook");
    expect(init.redirect).toBe("manual");
    const h = init.headers as Record<string, string>;
    const corpo = String(init.body);
    expect(JSON.parse(corpo)).toMatchObject({ event: "teste", company: { id: companyId }, version: 1 });
    expect(h["x-w2talent-event"]).toBe("teste");
    const [, t, v1] = /^t=(\d+),v1=([0-9a-f]+)$/.exec(h["x-w2talent-signature"])!;
    expect(v1).toBe(createHmac("sha256", segredo).update(`${t}.${corpo}`).digest("hex"));
    expect(j.webhook.entregas[0]).toMatchObject({ evento: "teste", status: 204, ok: true, tentativa: 1 });
  });

  it("envio em lote põe candidatura.recebida na fila só para empresa com webhook ligado", async () => {
    const { aprovarVaga, enviarCandidaturas, estadoDasVagas, perfilDaConta } = await import("../lib/envio");
    await db.candidateProfile.create({
      data: {
        userId: CONTA_CAND,
        nome: "Carla Mendes Rocha",
        email: EMAIL_CAND,
        celular: "+5511977776666",
        links: ["https://linkedin.example/carla"],
        titulo: "Dev Backend",
        senioridade: "pleno",
        regimePreferido: ["PJ"],
        pretensoes: [{ regime: "PJ", valor: 12000, unidade: "mes", moeda: "BRL" }],
        stack: [{ skillId: "aws", anos: 3 }],
        expiresAt: new Date(NOW.getTime() + 180 * DIA),
      },
    });
    const perfil = (await perfilDaConta(db, CONTA_CAND))!;
    const vaga = (cid: string, titulo: string) =>
      db.vacancy.create({ data: { companyId: cid, titulo, stack: [{ skillId: "aws" }], nivel: "Pleno", regime: "PJ", localidade: "Remoto", expiresAt: new Date(NOW.getTime() + 20 * DIA) } });
    const a = await vaga(companyId, "WH34a com webhook");
    const b = await vaga(outraId, "WH34a sem webhook");
    for (const v of [a, b]) {
      const [it] = await estadoDasVagas(db, perfil, [v.id], NOW);
      expect((await aprovarVaga(db, perfil.id, v.id, it.hash ?? "", NOW)).ok).toBe(true);
    }
    const fila: MensagemWebhook[] = [];
    const r = await enviarCandidaturas(db, perfil, [a.id, b.id], { now: NOW, enviarEmail: async () => {}, enviarWebhook: async (m) => { fila.push(m); } });
    expect(r.ok).toBe(true);
    const app = await db.application.findFirstOrThrow({ where: { vacancyId: a.id } });
    expect(fila).toEqual([{ tipo: "webhook", evento: "candidatura.recebida", id: expect.stringMatching(/^evt_[0-9a-f]{32}$/), companyId, applicationId: app.id, occurredAt: NOW.toISOString() }]);

    // Fila fora do ar: o envio não quebra.
    const c = await vaga(companyId, "WH34a fila fora");
    const [it] = await estadoDasVagas(db, perfil, [c.id], NOW);
    await aprovarVaga(db, perfil.id, c.id, it.hash ?? "", NOW);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    const r2 = await enviarCandidaturas(db, perfil, [c.id], { now: NOW, enviarWebhook: async () => { throw new Error("fila fora"); } });
    expect(r2).toMatchObject({ ok: true, itens: [{ vacancyId: c.id, status: "enviada" }] });

    // Entrega: corpo sem contato, assinado; 500 repete e conta falha; 200 zera; 404 não repete.
    const { entregarWebhook } = await import("../lib/webhook");
    const respostas = [500, 200, 404, 429];
    const corpos: string[] = [];
    const fetchFalso = jest.fn(async (_u: unknown, init?: RequestInit) => {
      corpos.push(String(init?.body));
      return new Response(null, { status: respostas.shift()! });
    }) as unknown as typeof fetch;
    const m = fila[0];
    expect(await entregarWebhook(db, m, 1, { fetch: fetchFalso, master: MASTER })).toMatchObject({ resultado: "repetir", status: 500 });
    expect((await db.webhook.findUniqueOrThrow({ where: { companyId } })).falhasSeguidas).toBe(1);
    expect(await entregarWebhook(db, m, 2, { fetch: fetchFalso, master: MASTER })).toMatchObject({ resultado: "ok", status: 200 });
    expect((await db.webhook.findUniqueOrThrow({ where: { companyId } })).falhasSeguidas).toBe(0);
    expect(await entregarWebhook(db, m, 1, { fetch: fetchFalso, master: MASTER })).toMatchObject({ resultado: "desistir", status: 404 });
    expect(await entregarWebhook(db, m, 1, { fetch: fetchFalso, master: MASTER })).toMatchObject({ resultado: "repetir", status: 429 });
    const rede = jest.fn(async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch;
    expect(await entregarWebhook(db, m, 3, { fetch: rede, master: MASTER })).toMatchObject({ resultado: "repetir", erro: "rede" });

    const corpo = JSON.parse(corpos[0]);
    expect(corpo).toMatchObject({ event: "candidatura.recebida", id: m.id, occurred_at: NOW.toISOString(), company: { id: companyId } });
    expect(corpo.data).toMatchObject({ vaga: { id: a.id, titulo: "WH34a com webhook" }, candidatura: { id: app.id, etapa: "nova" }, candidato: { contato: null, titulo: "Dev Backend" } });
    for (const c of corpos) {
      expect(c).not.toContain(EMAIL_CAND);
      expect(c).not.toContain("97777");
      expect(c).not.toContain("linkedin");
    }

    const entregas = await db.webhookEntrega.findMany({ where: { deliveryId: m.id }, orderBy: { createdAt: "asc" } });
    expect(entregas.map((e) => [e.status, e.erro, e.tentativa])).toEqual([[500, null, 1], [200, null, 2], [404, null, 1], [429, null, 1], [null, "rede", 3]]);
    expect(entregas.every((e) => e.evento === "candidatura.recebida" && e.duracaoMs >= 0)).toBe(true);
  });

  it("desligado: não envia nem põe na fila; a rota interna exige o CRON_SECRET", async () => {
    const j = await (await rota.PATCH(req("PATCH", rec(DONO), { ativo: false }))).json();
    expect(j.webhook.ativo).toBe(false);
    const { enfileirarRecebidas, entregarWebhook } = await import("../lib/webhook");
    const fila: MensagemWebhook[] = [];
    expect(await enfileirarRecebidas(db, [{ applicationId: "x", companyId }], async (m) => { fila.push(m); })).toBe(0);
    const f = jest.fn() as unknown as typeof fetch;
    expect(await entregarWebhook(db, { tipo: "webhook", evento: "candidatura.recebida", id: "evt_x", companyId, applicationId: "x", occurredAt: NOW.toISOString() }, 1, { fetch: f, master: MASTER })).toEqual({ resultado: "desistir", erro: "desligado" });
    expect(f).not.toHaveBeenCalled();

    const secretAntes = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "wh34a-cron-secret-de-teste";
    try {
      const interna = await import("../app/api/webhooks/entregar/route");
      const sem = await interna.POST(new NextRequest("https://w2.test/api/webhooks/entregar", { method: "POST", body: "{}" }));
      expect(sem.status).toBe(401);
      const com = await interna.POST(
        new NextRequest("https://w2.test/api/webhooks/entregar", {
          method: "POST",
          headers: { "x-cron-secret": "wh34a-cron-secret-de-teste" },
          body: JSON.stringify({ tipo: "webhook", evento: "candidatura.recebida", id: "evt_y", companyId, applicationId: "x", occurredAt: NOW.toISOString(), tentativa: 2 }),
        }),
      );
      expect(await com.json()).toEqual({ resultado: "desistir", erro: "desligado" });
    } finally {
      process.env.CRON_SECRET = secretAntes;
    }
  });
});
