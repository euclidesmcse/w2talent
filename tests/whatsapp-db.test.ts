/**
 * 3.5a Canal WhatsApp no banco de verdade: ligar (código, tentativas, validade, limite de pedidos,
 * consentimento), desligar, avisos (junta do mesmo tipo, 3 por dia, espera fora do horário), entrega com
 * fetch falso (ok, repetir, desistir, modo teste, desligou no meio) e os avisos ao lado dos e-mails que
 * já existiam, sem quebrar o e-mail quando a fila falha. Só roda num Postgres local.
 */
import type { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { cookieDeTeste, type ContaTeste } from "./helpers/sessao-mock";
import type { MensagemWhatsapp } from "../lib/fila";
import type { EmailMessage } from "../lib/email";

jest.mock("../lib/sessao", () => require("./helpers/sessao-mock").sessaoMock());
jest.mock("../lib/background", () => ({ runInBackground: () => undefined }));
const emails: EmailMessage[] = [];
const filaWa: { m: MensagemWhatsapp; atraso?: number }[] = [];
let waFora = false;
jest.mock("../lib/notifications", () => ({
  enqueueEmail: async (m: EmailMessage) => {
    emails.push(m);
  },
  enqueueWebhook: async () => undefined,
  enqueueWhatsapp: async (m: MensagemWhatsapp, atraso?: number) => {
    if (waFora) throw new Error("fila fora do ar");
    filaWa.push({ m, atraso });
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

const CAND = "wa35-cand";
const CAND2 = "wa35-cand2";
const DONO = "wa35-dono";
const USERS = [CAND, CAND2, DONO];
const NUMERO = "+5511987654321";
const DIA = 86_400_000;
const MEIO_DIA = new Date("2026-11-19T15:00:00Z"); // 12:00 em Brasília
const cand = (id: string): ContaTeste => ({ id, perfil: "candidato" });
const rec = (id: string): ContaTeste => ({ id, perfil: "recrutador", mfaLigado: true });
const REAL = { token: "tok-teste", phoneId: "999" };

describeDb("WhatsApp 3.5a", () => {
  let db: PrismaClient;
  let companyId = "";
  let vagaA = "";
  let appA = "";
  let appB = "";

  const limpar = async () => {
    await db.candidateProfile.deleteMany({ where: { id: { in: [CAND, CAND2] } } });
    await db.companyProfile.deleteMany({ where: { nome: { startsWith: "WA35 Teste" } } });
    await db.user.deleteMany({ where: { id: { in: USERS } } });
    await db.usoDiario.deleteMany({ where: { dia: { gte: "2026-11-01" } } }).catch(() => undefined);
  };
  const fila = () => {
    const xs: { m: MensagemWhatsapp; atraso?: number }[] = [];
    return { xs, enviar: async (m: MensagemWhatsapp, atraso?: number) => void xs.push({ m, atraso }) };
  };
  const ligar = (id = CAND) =>
    db.candidateProfile.update({ where: { id }, data: { whatsappOpt: true, whatsappNumero: NUMERO, whatsappVerificadoEm: new Date() } });
  const resp = (status: number, corpo?: unknown) => jest.fn(async (_u: unknown, _i?: RequestInit) => new Response(corpo ? JSON.stringify(corpo) : null, { status }));

  beforeAll(async () => {
    const { createPrismaClient } = await import("../lib/prisma");
    db = createPrismaClient(process.env.DATABASE_URL!);
    await limpar();
    await db.user.create({ data: { id: CAND, name: "Carla", email: "wa35.cand@exemplo.com", perfil: "candidato" } });
    await db.user.create({ data: { id: CAND2, name: "Davi", email: "wa35.cand2@exemplo.com", perfil: "candidato" } });
    await db.user.create({ data: { id: DONO, name: "Dona", email: "wa35.dono@exemplo.com", perfil: "recrutador" } });
    companyId = (await db.companyProfile.create({ data: { nome: "WA35 Teste SA" } })).id;
    await db.companyMember.create({ data: { userId: DONO, companyId, papel: "dono" } });
    const futuro = new Date(Date.now() + 30 * DIA);
    for (const [id, email] of [[CAND, "wa35.cand@exemplo.com"], [CAND2, "wa35.cand2@exemplo.com"]]) {
      await db.candidateProfile.create({
        data: { id, userId: id, nome: "Carla Mendes", titulo: "Dev", email, celular: "(11) 98765-4321", stack: [{ skillId: "aws" }], expiresAt: futuro, idiomaOriginal: "pt-BR" } as any,
      });
    }
    const vaga = () => db.vacancy.create({ data: { companyId, titulo: "WA35 Backend", stack: [{ skillId: "aws" }] as any, status: "ativa", expiresAt: futuro } });
    vagaA = (await vaga()).id;
    const vagaB = (await vaga()).id;
    appA = (await db.application.create({ data: { candidateId: CAND, vacancyId: vagaA, companyId, origem: "candidaturaLote", proxyThreadId: "wa35-a" } })).id;
    appB = (await db.application.create({ data: { candidateId: CAND, vacancyId: vagaB, companyId, origem: "candidaturaLote", proxyThreadId: "wa35-b" } })).id;
  });

  afterAll(async () => {
    await limpar();
    await db.$disconnect();
    const { prisma } = await import("../lib/prisma");
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await db.whatsappAviso.deleteMany({ where: { candidateId: { in: [CAND, CAND2] } } });
    await db.usoDiario.deleteMany({ where: { dia: { gte: "2026-11-01" } } });
    emails.length = 0;
    filaWa.length = 0;
    waFora = false;
  });

  afterEach(() => jest.restoreAllMocks());

  // ── ligar e desligar ──

  it("ligar: código pelo modelo de autenticação, consentimento obrigatório, código certo liga e grava o ConsentLog", async () => {
    jest.spyOn(console, "log").mockImplementation(() => undefined);
    const w = await import("../lib/whatsapp-db");
    const f = resp(200, { messages: [{ id: "wamid.1" }] });
    const pedido = await w.pedirCodigo(db, CAND, "(11) 98765-4321", "en", { cfg: REAL, fetch: f as unknown as typeof fetch, now: MEIO_DIA, gerar: () => "123456" });
    expect(pedido).toEqual({ ok: true, numero: NUMERO, expiraEm: new Date(MEIO_DIA.getTime() + 600_000).toISOString(), modoTeste: false });
    const corpo = JSON.parse(String(f.mock.calls[0][1]?.body));
    expect(corpo).toMatchObject({ to: "5511987654321", template: { name: "w2_codigo", language: { code: "en" } } });
    expect(JSON.stringify(corpo)).toContain("123456");
    const p = await db.candidateProfile.findUniqueOrThrow({ where: { id: CAND } });
    expect(p.whatsappCodigoHash).toMatch(/^[0-9a-f]{64}$/);
    expect(p.whatsappCodigoHash).not.toContain("123456");
    expect(p.whatsappOpt).toBe(false);

    expect(await w.estadoWhatsapp(db, CAND, MEIO_DIA, {})).toMatchObject({ temFicha: true, ligado: false, pendente: { numero: NUMERO }, sugestao: "(11) 98765-4321", modoTeste: true });
    expect(await w.confirmarCodigo(db, CAND, "123456", false, "en", MEIO_DIA)).toEqual({ ok: false, erro: "consentimento" });
    expect(await w.confirmarCodigo(db, CAND, "654321", true, "en", MEIO_DIA)).toEqual({ ok: false, erro: "codigo" });
    expect(await w.confirmarCodigo(db, CAND, "123456", true, "en", MEIO_DIA)).toEqual({ ok: true, numero: NUMERO });

    const depois = await db.candidateProfile.findUniqueOrThrow({ where: { id: CAND } });
    expect(depois).toMatchObject({ whatsappOpt: true, whatsappNumero: NUMERO, whatsappCodigoHash: null, celular: "(11) 98765-4321" });
    const logs = await db.consentLog.findMany({ where: { userId: CAND, tipo: "whatsapp" } });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ versao: 1, baseLegal: "consentimento" });
    expect(logs[0].texto).toMatch(/^I want to receive W2Talent notices on WhatsApp/);
    // O mesmo código não liga de novo.
    expect(await w.confirmarCodigo(db, CAND, "123456", true, "en", MEIO_DIA)).toEqual({ ok: false, erro: "sem_pedido" });
    await w.desligarWhatsapp(db, { userId: CAND });
  });

  it("código: vence em 10 minutos, 5 tentativas no máximo, 3 pedidos por dia; sem ficha não liga", async () => {
    jest.spyOn(console, "log").mockImplementation(() => undefined);
    const w = await import("../lib/whatsapp-db");
    const pedir = () => w.pedirCodigo(db, CAND, "11987654321", "pt-BR", { cfg: {}, now: MEIO_DIA, gerar: () => "111111" });
    expect(await pedir()).toMatchObject({ ok: true, modoTeste: true });
    expect(await w.confirmarCodigo(db, CAND, "111111", true, "pt-BR", new Date(MEIO_DIA.getTime() + 10 * 60_000))).toEqual({ ok: false, erro: "expirado" });

    expect(await pedir()).toMatchObject({ ok: true });
    for (let i = 0; i < 4; i++) expect(await w.confirmarCodigo(db, CAND, "000000", true, "pt-BR", MEIO_DIA)).toEqual({ ok: false, erro: "codigo" });
    expect(await w.confirmarCodigo(db, CAND, "000000", true, "pt-BR", MEIO_DIA)).toEqual({ ok: false, erro: "tentativas" });
    // Depois de 5 erradas, nem o certo vale.
    expect(await w.confirmarCodigo(db, CAND, "111111", true, "pt-BR", MEIO_DIA)).toEqual({ ok: false, erro: "tentativas" });

    expect(await pedir()).toMatchObject({ ok: true });
    expect(await pedir()).toEqual({ ok: false, erro: "limite" });
    expect(await w.pedirCodigo(db, CAND2, "(11) 3333-4444", "pt-BR", { cfg: {}, now: MEIO_DIA })).toEqual({ ok: false, erro: "fixo" });
    expect(await w.pedirCodigo(db, DONO, "11987654321", "pt-BR", { cfg: {}, now: MEIO_DIA })).toEqual({ ok: false, erro: "sem_ficha" });
    expect((await db.candidateProfile.findUniqueOrThrow({ where: { id: CAND } })).whatsappOpt).toBe(false);
  });

  it("falha no envio do código: erro 'envio'; com WHATSAPP_TEST_TO, número fora da lista não recebe", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    const log = jest.spyOn(console, "log").mockImplementation(() => undefined);
    const w = await import("../lib/whatsapp-db");
    const f = resp(400, { error: { code: 131026 } });
    expect(await w.pedirCodigo(db, CAND2, "11987654321", "pt-BR", { cfg: REAL, fetch: f as unknown as typeof fetch, now: MEIO_DIA })).toEqual({ ok: false, erro: "envio" });
    const f2 = resp(200);
    expect(await w.pedirCodigo(db, CAND2, "11987654321", "pt-BR", { cfg: { ...REAL, testTo: ["+5521999990000"] }, fetch: f2 as unknown as typeof fetch, now: MEIO_DIA })).toMatchObject({ ok: true, modoTeste: true });
    expect(f2).not.toHaveBeenCalled();
    // Nunca o número inteiro no log.
    expect(JSON.stringify(log.mock.calls)).not.toContain("987654321");
  });

  it("desligar: na hora, apaga o número e segura os avisos que ainda estavam na fila", async () => {
    const w = await import("../lib/whatsapp-db");
    await ligar();
    const f = fila();
    expect(await w.avisarWhatsapp(db, { candidateId: CAND, tipo: "vista", refId: appA }, f.enviar, MEIO_DIA)).toBe("fila");
    expect(await w.desligarWhatsapp(db, { userId: CAND })).toBe(true);
    const p = await db.candidateProfile.findUniqueOrThrow({ where: { id: CAND } });
    expect(p).toMatchObject({ whatsappOpt: false, whatsappNumero: null, whatsappVerificadoEm: null });
    expect((await db.whatsappAviso.findUniqueOrThrow({ where: { id: f.xs[0].m.avisoId } })).status).toBe("desligado");
    const fetch = resp(200);
    expect(await w.entregarAviso(db, f.xs[0].m, 1, { cfg: REAL, fetch: fetch as unknown as typeof globalThis.fetch, now: MEIO_DIA })).toMatchObject({ resultado: "desistir" });
    expect(fetch).not.toHaveBeenCalled();
    expect(await w.avisarWhatsapp(db, { candidateId: CAND, tipo: "etapa", refId: appA }, f.enviar, MEIO_DIA)).toBe("desligado");
  });

  it("rota de Minha conta: só candidato; pedir, confirmar e desligar", async () => {
    jest.spyOn(console, "log").mockImplementation(() => undefined);
    const { GET, POST } = await import("../app/api/conta/whatsapp/route");
    const pedir = (c: ContaTeste, body: unknown) =>
      POST(new NextRequest("https://w2.test/api/conta/whatsapp", { method: "POST", headers: { "content-type": "application/json", cookie: cookieDeTeste(c), "x-locale": "es" }, body: JSON.stringify(body) }));
    expect((await GET(new NextRequest("https://w2.test/api/conta/whatsapp", { headers: { cookie: cookieDeTeste(rec(DONO)) } }))).status).toBe(403);
    const g = await GET(new NextRequest("https://w2.test/api/conta/whatsapp", { headers: { cookie: cookieDeTeste(cand(CAND2)) } }));
    expect(await g.json()).toMatchObject({ temFicha: true, ligado: false, modoTeste: true });
    expect((await pedir(cand(CAND2), { acao: "codigo", numero: "abc" })).status).toBe(422);
    const r = await pedir(cand(CAND2), { acao: "codigo", numero: "+34 612 345 678" });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true, numero: "+34612345678", modoTeste: true });
    expect((await pedir(cand(CAND2), { acao: "confirmar", codigo: "000000", aceite: true })).status).toBe(422);
    // O código certo vem do banco só aqui no teste: trocamos o hash por um conhecido.
    const { hashCodigoWhatsapp } = await import("../lib/whatsapp");
    await db.candidateProfile.update({ where: { id: CAND2 }, data: { whatsappCodigoHash: await hashCodigoWhatsapp(CAND2, "+34612345678", "424242") } });
    const ok = await pedir(cand(CAND2), { acao: "confirmar", codigo: "424242", aceite: true });
    expect(ok.status).toBe(200);
    expect((await ok.json()).estado).toMatchObject({ ligado: true, numero: "+34612345678" });
    expect((await db.consentLog.findFirstOrThrow({ where: { userId: CAND2, tipo: "whatsapp" } })).texto).toMatch(/^Quiero recibir avisos de W2Talent/);
    const off = await pedir(cand(CAND2), { acao: "desligar" });
    expect((await off.json()).estado).toMatchObject({ ligado: false, numero: null });
  });

  // ── avisos ──

  it("avisos: junta o mesmo tipo no dia, até 3 por dia, espera até as 8h fora do horário", async () => {
    const w = await import("../lib/whatsapp-db");
    await ligar();
    const f = fila();
    const a = (tipo: any, refId = appA, now = MEIO_DIA) => w.avisarWhatsapp(db, { candidateId: CAND, tipo, refId }, f.enviar, now);
    expect(await a("vista")).toBe("fila");
    expect(await a("vista", appB)).toBe("junto");
    expect(f.xs).toHaveLength(1);
    expect(f.xs[0]).toEqual({ m: { tipo: "whatsapp", avisoId: expect.any(String), aviso: "vista" }, atraso: 0 });
    // O assunto passa a ser o mais novo (ainda não saiu).
    expect((await db.whatsappAviso.findUniqueOrThrow({ where: { id: f.xs[0].m.avisoId } })).refId).toBe(appB);
    expect(await a("etapa")).toBe("fila");
    expect(await a("entrevista")).toBe("fila");
    expect(await a("atendimento", "conv")).toBe("limite");
    expect(f.xs).toHaveLength(3);

    // 21h de Brasília: conta para o dia seguinte e espera 11 horas.
    const noite = new Date("2026-11-20T00:00:00Z");
    expect(await a("atendimento", "conv", noite)).toBe("fila");
    expect(f.xs[3].atraso).toBe(11 * 3600);
    expect((await db.whatsappAviso.findUniqueOrThrow({ where: { id: f.xs[3].m.avisoId } })).dia).toBe("2026-11-20");

    // Fila fora do ar: o aviso não fica preso e nada é lançado.
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    const quebra = async () => {
      throw new Error("fila fora");
    };
    expect(await w.avisarWhatsapp(db, { candidateId: CAND, tipo: "vista", refId: appA }, quebra, noite)).toBe("erro");
    expect(await db.whatsappAviso.count({ where: { candidateId: CAND, tipo: "vista", dia: "2026-11-20" } })).toBe(0);
    await w.desligarWhatsapp(db, { userId: CAND });
  });

  it("entrega: monta o texto na hora (vaga e empresa), ok, repete, desiste, modo teste e repetição da fila", async () => {
    const log = jest.spyOn(console, "log").mockImplementation(() => undefined);
    const w = await import("../lib/whatsapp-db");
    await ligar();
    const f = fila();
    await w.avisarWhatsapp(db, { candidateId: CAND, tipo: "vista", refId: appA }, f.enviar, MEIO_DIA);
    await w.avisarWhatsapp(db, { candidateId: CAND, tipo: "etapa", refId: appA }, f.enviar, MEIO_DIA);
    await w.avisarWhatsapp(db, { candidateId: CAND, tipo: "entrevista", refId: appA }, f.enviar, MEIO_DIA);
    const [vista, etapa, entrevista] = f.xs.map((x) => x.m);
    const linha = (m: MensagemWhatsapp) => db.whatsappAviso.findUniqueOrThrow({ where: { id: m.avisoId } });

    // ok
    const ok = resp(200, { messages: [{ id: "wamid.2" }] });
    expect(await w.entregarAviso(db, vista, 1, { cfg: REAL, fetch: ok as unknown as typeof fetch, now: MEIO_DIA })).toEqual({ resultado: "ok", status: 200 });
    const corpo = JSON.parse(String(ok.mock.calls[0][1]?.body));
    expect(corpo).toMatchObject({ to: "5511987654321", template: { name: "w2_candidatura_vista", language: { code: "pt_BR" } } });
    expect(corpo.template.components[0].parameters.map((p: any) => p.text)).toEqual(["WA35 Backend", "WA35 Teste SA"]);
    expect(corpo.template.components[1].parameters[0].text).toBe("minhas-candidaturas");
    expect(JSON.stringify(corpo)).not.toContain("wa35.cand@exemplo.com");
    expect(await linha(vista)).toMatchObject({ status: "enviado", tentativas: 1 });
    // A fila entregou de novo: não envia outra vez.
    expect(await w.entregarAviso(db, vista, 2, { cfg: REAL, fetch: ok as unknown as typeof fetch, now: MEIO_DIA })).toMatchObject({ resultado: "ok" });
    expect(ok).toHaveBeenCalledTimes(1);

    // repetir (500) e, na 10ª, desistir
    const erro = resp(500);
    expect(await w.entregarAviso(db, etapa, 1, { cfg: REAL, fetch: erro as unknown as typeof fetch, now: MEIO_DIA })).toMatchObject({ resultado: "repetir", status: 500 });
    expect(await linha(etapa)).toMatchObject({ status: "fila", tentativas: 1, erro: "http_500" });
    expect(await w.entregarAviso(db, etapa, 10, { cfg: REAL, fetch: erro as unknown as typeof fetch, now: MEIO_DIA })).toMatchObject({ resultado: "repetir" });
    expect(await linha(etapa)).toMatchObject({ status: "desistiu", tentativas: 2 });

    // fora do horário: volta para a fila sem chamar a Meta
    const cedo = new Date("2026-11-19T10:00:00Z");
    expect(await w.entregarAviso(db, entrevista, 1, { cfg: REAL, fetch: ok as unknown as typeof fetch, now: cedo })).toEqual({ resultado: "repetir", erro: "fora_do_horario", atrasoSeg: 3600 });
    expect(ok).toHaveBeenCalledTimes(1);
    // desistir (400 da Meta)
    const recusa = resp(400, { error: { code: 131026 } });
    expect(await w.entregarAviso(db, entrevista, 1, { cfg: REAL, fetch: recusa as unknown as typeof fetch, now: MEIO_DIA })).toMatchObject({ resultado: "desistir", status: 400 });
    expect(await linha(entrevista)).toMatchObject({ status: "desistiu", erro: "meta_131026" });

    // modo teste: grava e confirma, sem rede
    await db.whatsappAviso.deleteMany({ where: { candidateId: CAND } });
    const g = fila();
    await w.avisarWhatsapp(db, { candidateId: CAND, tipo: "vista", refId: appA }, g.enviar, MEIO_DIA);
    expect(await w.entregarAviso(db, g.xs[0].m, 1, { cfg: {}, now: MEIO_DIA })).toEqual({ resultado: "ok", erro: "modo_teste" });
    expect(await linha(g.xs[0].m)).toMatchObject({ status: "modo_teste" });
    expect(JSON.stringify(log.mock.calls)).not.toContain("987654321");
    await w.desligarWhatsapp(db, { userId: CAND });
  });

  it("entrega: duas ao mesmo tempo mandam uma vez só; reserva parada há mais de 2 minutos é retomada", async () => {
    const w = await import("../lib/whatsapp-db");
    await ligar();
    const f = fila();
    await w.avisarWhatsapp(db, { candidateId: CAND, tipo: "vista", refId: appA }, f.enviar, MEIO_DIA);
    const m = f.xs[0].m;
    const ok = resp(200, { messages: [{ id: "wamid.c" }] });
    const rs = await Promise.all([1, 2].map(() => w.entregarAviso(db, m, 1, { cfg: REAL, fetch: ok as unknown as typeof fetch, now: MEIO_DIA })));
    expect(ok).toHaveBeenCalledTimes(1);
    expect(rs.map((r) => r.resultado).sort()).toEqual(expect.arrayContaining(["ok"]));
    // A que perdeu a corrida (se perdeu na reserva) tenta de novo depois; na próxima vê "enviado".
    for (const r of rs) if (r.resultado !== "ok") expect(r).toMatchObject({ resultado: "repetir", erro: "enviando" });
    // Uma entrega caiu no meio (ficou "enviando"): depois de 2 minutos, outra pode mandar.
    await db.whatsappAviso.update({ where: { id: m.avisoId }, data: { status: "enviando", updatedAt: MEIO_DIA } });
    expect(await w.entregarAviso(db, m, 2, { cfg: REAL, fetch: ok as unknown as typeof fetch, now: new Date(MEIO_DIA.getTime() + 60_000) })).toEqual({ resultado: "repetir", erro: "enviando", atrasoSeg: 150 });
    expect(ok).toHaveBeenCalledTimes(1);
    expect(await w.entregarAviso(db, m, 2, { cfg: REAL, fetch: ok as unknown as typeof fetch, now: new Date(MEIO_DIA.getTime() + 180_000) })).toMatchObject({ resultado: "ok", status: 200 });
    expect(ok).toHaveBeenCalledTimes(2);
    await w.desligarWhatsapp(db, { userId: CAND });
  });

  it("entrega em outro dia: conta no limite de hoje (3 por dia, um por tipo)", async () => {
    const w = await import("../lib/whatsapp-db");
    await ligar();
    const f = fila();
    const ontem = MEIO_DIA;
    const hoje = new Date(ontem.getTime() + DIA);
    // Três avisos de ontem ficaram na fila (falharam perto das 20h).
    for (const tipo of ["vista", "etapa", "entrevista"] as const) await w.avisarWhatsapp(db, { candidateId: CAND, tipo, refId: appA }, f.enviar, ontem);
    const [vista, etapa, entrevista] = f.xs.map((x) => x.m);
    // Hoje já saíram dois avisos novos (vista e atendimento).
    const g = fila();
    expect(await w.avisarWhatsapp(db, { candidateId: CAND, tipo: "vista", refId: appB }, g.enviar, hoje)).toBe("fila");
    expect(await w.avisarWhatsapp(db, { candidateId: CAND, tipo: "atendimento", refId: "conv" }, g.enviar, hoje)).toBe("fila");
    const ok = resp(200, { messages: [{ id: "wamid.d" }] });
    const entrega = (m: MensagemWhatsapp) => w.entregarAviso(db, m, 2, { cfg: REAL, fetch: ok as unknown as typeof fetch, now: hoje });
    // "vista" de ontem: hoje já tem um "vista" → junta (desiste).
    expect(await entrega(vista)).toEqual({ resultado: "desistir", erro: "junto" });
    // "etapa" de ontem: passa a contar hoje (3º do dia) e sai.
    expect(await entrega(etapa)).toMatchObject({ resultado: "ok" });
    expect(await db.whatsappAviso.findUniqueOrThrow({ where: { id: etapa.avisoId } })).toMatchObject({ dia: "2026-11-20", status: "enviado" });
    // "entrevista" de ontem: seria o 4º de hoje → desiste.
    expect(await entrega(entrevista)).toEqual({ resultado: "desistir", erro: "limite" });
    expect(ok).toHaveBeenCalledTimes(1);
    await w.desligarWhatsapp(db, { userId: CAND });
  });

  it("entrega: a pessoa desligou entre a fila e a entrega; a candidatura sumiu", async () => {
    const w = await import("../lib/whatsapp-db");
    await ligar();
    const f = fila();
    await w.avisarWhatsapp(db, { candidateId: CAND, tipo: "vista", refId: appA }, f.enviar, MEIO_DIA);
    await w.avisarWhatsapp(db, { candidateId: CAND, tipo: "etapa", refId: "wa35-nao-existe" }, f.enviar, MEIO_DIA);
    const fetch = resp(200);
    expect(await w.entregarAviso(db, f.xs[1].m, 1, { cfg: REAL, fetch: fetch as unknown as typeof globalThis.fetch, now: MEIO_DIA })).toEqual({ resultado: "desistir", erro: "sem_assunto" });
    // Desligou direto no banco (sem passar pelo desligar): a entrega confere de novo.
    await db.candidateProfile.update({ where: { id: CAND }, data: { whatsappOpt: false } });
    expect(await w.entregarAviso(db, f.xs[0].m, 1, { cfg: REAL, fetch: fetch as unknown as typeof globalThis.fetch, now: MEIO_DIA })).toEqual({ resultado: "desistir", erro: "desligado" });
    expect(fetch).not.toHaveBeenCalled();
    expect(await w.entregarAviso(db, { tipo: "whatsapp", avisoId: "wa35-sumiu", aviso: "vista" }, 1, { cfg: REAL, now: MEIO_DIA })).toEqual({ resultado: "desistir", erro: "aviso_apagado" });
    await w.desligarWhatsapp(db, { userId: CAND });
  });

  it("rota interna de entrega: só com o CRON_SECRET", async () => {
    const antes = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "segredo-de-teste-wa35-123456";
    const { POST } = await import("../app/api/whatsapp/entregar/route");
    const chamar = (seg: string | null, body: unknown) =>
      POST(new NextRequest("https://w2.test/api/whatsapp/entregar", { method: "POST", headers: { "content-type": "application/json", ...(seg ? { "x-cron-secret": seg } : {}) }, body: JSON.stringify(body) }));
    expect((await chamar(null, { tipo: "whatsapp", avisoId: "x", aviso: "vista" })).status).toBe(401);
    expect(await (await chamar("segredo-de-teste-wa35-123456", { tipo: "outro" })).json()).toEqual({ resultado: "desistir", erro: "mensagem" });
    expect(await (await chamar("segredo-de-teste-wa35-123456", { tipo: "whatsapp", avisoId: "wa35-sumiu", aviso: "vista", tentativa: 2 })).json()).toEqual({ resultado: "desistir", erro: "aviso_apagado" });
    process.env.CRON_SECRET = antes;
  });

  // ── ao lado dos e-mails ──

  it("viu e mudou de etapa: avisos pela rota; fila do WhatsApp fora do ar não quebra a etapa nem o e-mail", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    await ligar();
    const { PATCH } = await import("../app/api/rh/candidaturas/[id]/route");
    const patch = (id: string, body: unknown) =>
      PATCH(
        new NextRequest(`https://w2.test/api/rh/candidaturas/${id}`, { method: "PATCH", headers: { "content-type": "application/json", cookie: cookieDeTeste(rec(DONO)) }, body: JSON.stringify(body) }),
        { params: Promise.resolve({ id }) },
      );
    await db.application.updateMany({ where: { id: { in: [appA, appB] } }, data: { status: "enviado", etapa: "nova", contatoLiberadoEm: null, emailPendente: undefined } });
    expect((await patch(appA, { visto: true })).status).toBe(200);
    expect((await patch(appA, { visto: true })).status).toBe(200); // segunda vez: já era "Vista"
    expect(filaWa.map((x) => x.m.aviso)).toEqual(["vista"]);
    expect((await patch(appA, { de: "nova", para: "em_analise" })).status).toBe(200);
    expect(filaWa.map((x) => x.m.aviso)).toEqual(["vista", "etapa"]);

    // Fila do WhatsApp fora: a etapa muda, a Entrevista libera o contato e o e-mail ao candidato sai.
    await db.whatsappAviso.deleteMany({ where: { candidateId: CAND } });
    waFora = true;
    const r = await patch(appB, { de: "nova", para: "entrevista" });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true, etapa: "entrevista" });
    expect(emails.map((e) => e.idempotencyKey)).toEqual([`entrevista:${appB}`]);
    expect((await db.application.findUniqueOrThrow({ where: { id: appB } })).contatoLiberadoEm).not.toBeNull();
    await (await import("../lib/whatsapp-db")).desligarWhatsapp(db, { userId: CAND });
  });

  it("entrevista oferecida: o e-mail de convite e o aviso; sem WhatsApp, só o e-mail", async () => {
    const { POST } = await import("../app/api/rh/candidaturas/[id]/entrevista/route");
    const oferecer = (id: string) => {
      const base = Math.ceil((Date.now() + 3 * DIA) / 3600_000) * 3600_000;
      const horarios = [0, 1, 2].map((i) => new Date(base + i * 3600_000).toISOString());
      return POST(
        new NextRequest(`https://w2.test/api/rh/candidaturas/${id}/entrevista`, { method: "POST", headers: { "content-type": "application/json", cookie: cookieDeTeste(rec(DONO)) }, body: JSON.stringify({ duracaoMin: 30, horarios }) }),
        { params: Promise.resolve({ id }) },
      );
    };
    // Sem WhatsApp ligado.
    expect((await oferecer(appB)).status).toBe(200);
    expect(emails.some((e) => e.idempotencyKey.startsWith("entrevista:") && e.idempotencyKey.endsWith(":convite:0:c"))).toBe(true);
    expect(filaWa).toHaveLength(0);
    // Ligado: o e-mail continua e o aviso entra.
    await ligar();
    emails.length = 0;
    expect((await oferecer(appB)).status).toBe(200);
    expect(emails.some((e) => e.idempotencyKey.endsWith(":convite:0:c"))).toBe(true);
    expect(filaWa.map((x) => x.m.aviso)).toEqual(["entrevista"]);
    await (await import("../lib/whatsapp-db")).desligarWhatsapp(db, { userId: CAND });
  });

  it("a equipe respondeu: e-mail e aviso para conta de candidato; sem conta, só o e-mail", async () => {
    const { responderConversa } = await import("../lib/atendimento");
    await ligar();
    const comConta = await db.conversa.create({ data: { email: "wa35.cand@exemplo.com", userId: CAND, perfil: "candidato", idioma: "pt-BR" } });
    const semConta = await db.conversa.create({ data: { email: "wa35.anon@exemplo.com", idioma: "pt-BR" } });
    const f = fila();
    const enviados: EmailMessage[] = [];
    const enqueue = async (m: EmailMessage) => void enviados.push(m);
    expect(await responderConversa(db, comConta.id, "Oi!", { appUrl: "https://w2.test", enqueue, enviarWhatsapp: f.enviar })).toEqual({ ok: true, emailEnviado: true });
    expect(await responderConversa(db, semConta.id, "Oi!", { appUrl: "https://w2.test", enqueue, enviarWhatsapp: f.enviar })).toEqual({ ok: true, emailEnviado: true });
    expect(enviados).toHaveLength(2);
    expect(f.xs.map((x) => x.m.aviso)).toEqual(["atendimento"]);
    // Fila do WhatsApp fora do ar: a resposta e o e-mail seguem.
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    await db.whatsappAviso.deleteMany({ where: { candidateId: CAND } });
    const r = await responderConversa(db, comConta.id, "De novo", { appUrl: "https://w2.test", enqueue, enviarWhatsapp: async () => { throw new Error("fora"); } });
    expect(r).toEqual({ ok: true, emailEnviado: true });
    const ok = resp(200);
    const w = await import("../lib/whatsapp-db");
    await w.avisarAtendimento(db, CAND, comConta.id, f.enviar, MEIO_DIA);
    expect(await w.entregarAviso(db, f.xs[f.xs.length - 1].m, 1, { cfg: REAL, fetch: ok as unknown as typeof fetch, now: MEIO_DIA })).toMatchObject({ resultado: "ok" });
    const corpo = JSON.parse(String(ok.mock.calls[0][1]?.body));
    expect(corpo.template).toMatchObject({ name: "w2_atendimento" });
    expect(JSON.stringify(corpo)).not.toContain("Oi!");
    await db.conversa.deleteMany({ where: { id: { in: [comConta.id, semConta.id] } } });
    await w.desligarWhatsapp(db, { userId: CAND });
  });

  it("Cron: vagas aprovadas e não enviadas vencendo em 24 a 48 horas, um aviso por pessoa", async () => {
    const w = await import("../lib/whatsapp-db");
    await ligar(CAND2);
    const now = new Date();
    const em = (h: number) => new Date(now.getTime() + h * 3600_000);
    const v1 = await db.vacancy.create({ data: { companyId, titulo: "WA35 Vence 30h", stack: [] as any, status: "ativa", expiresAt: em(30) } });
    const v2 = await db.vacancy.create({ data: { companyId, titulo: "WA35 Vence 40h", stack: [] as any, status: "ativa", expiresAt: em(40) } });
    const v3 = await db.vacancy.create({ data: { companyId, titulo: "WA35 Vence 10h", stack: [] as any, status: "ativa", expiresAt: em(10) } });
    const v4 = await db.vacancy.create({ data: { companyId, titulo: "WA35 Enviada", stack: [] as any, status: "ativa", expiresAt: em(26) } });
    for (const v of [v1, v2, v3, v4]) await db.applicationApproval.create({ data: { candidateId: CAND2, vacancyId: v.id, vacancyHash: "h", snapshot: {} } });
    await db.application.create({ data: { candidateId: CAND2, vacancyId: v4.id, companyId, origem: "candidaturaLote", proxyThreadId: "wa35-v4" } });
    const velho = await db.whatsappAviso.create({ data: { candidateId: CAND2, tipo: "vista", refId: "x", dia: "2026-01-01", createdAt: new Date(now.getTime() - 40 * DIA) } });
    const f = fila();
    const r = await w.avisarAprovadasVencendo(db, f.enviar, now);
    expect(r.avisos).toBe(1);
    expect(r.apagados).toBeGreaterThanOrEqual(1);
    expect(await db.whatsappAviso.findUnique({ where: { id: velho.id } })).toBeNull();
    const a = await db.whatsappAviso.findUniqueOrThrow({ where: { id: f.xs[0].m.avisoId } });
    expect(a).toMatchObject({ tipo: "aprovadas", refId: v1.id });
    // Rodar de novo no mesmo dia não manda outro.
    expect((await w.avisarAprovadasVencendo(db, f.enviar, now)).avisos).toBe(0);
    // Entrega com o texto da vaga; enviada antes da entrega, desiste.
    const ok = resp(200);
    expect(await w.entregarAviso(db, f.xs[0].m, 1, { cfg: REAL, fetch: ok as unknown as typeof fetch, now: MEIO_DIA })).toMatchObject({ resultado: "ok" });
    const corpo = JSON.parse(String(ok.mock.calls[0][1]?.body));
    expect(corpo.template.name).toBe("w2_aprovadas_vencer");
    expect(corpo.template.components[0].parameters.map((p: any) => p.text)).toEqual(["WA35 Vence 30h", "WA35 Teste SA"]);
    expect(corpo.template.components[1].parameters[0].text).toBe(`vagas/aprovar?v=${v1.id}`);
    await w.desligarWhatsapp(db, { userId: CAND2 });
  });
});
