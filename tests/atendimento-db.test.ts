/**
 * 2.6b-1 Atendimento no banco de verdade (rotas da pessoa e do admin). Só roda num Postgres local.
 * Dados de teste: e-mails @atend-teste.example e a conta "atend-teste-user".
 */
import type { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { cookieDeTeste } from "./helpers/sessao-mock";
import type { EmailMessage } from "../lib/email";

jest.mock("../lib/sessao", () => require("./helpers/sessao-mock").sessaoMock());
const fila: EmailMessage[] = [];
let filaFalha = false;
jest.mock("../lib/notifications", () => ({
  enqueueEmail: async (m: EmailMessage) => {
    if (filaFalha) throw new Error("fila fora");
    fila.push(m);
  },
}));

import { LIMITE_MENSAGENS_CONVERSA_DIA } from "../lib/atendimento";
import { EMAIL_REVISAO } from "../lib/ia-transparencia";
import { chaveUso } from "../lib/uso-diario";

function localDb(url: string | undefined): boolean {
  try {
    return !!url && ["localhost", "127.0.0.1"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}
const describeDb = localDb(process.env.DATABASE_URL) ? describe : describe.skip;

const SECRET = "segredo-de-teste-com-mais-de-24-caracteres";
const DOMINIO = "@atend-teste.example";
const USER = "atend-teste-user";
const RUN = Math.random().toString(36).slice(2, 8);
const ORIGEM = "https://w2.test";

describeDb("atendimento: falar com uma pessoa", () => {
  let db: PrismaClient;
  let adminCookie = "";
  let rota: typeof import("../app/api/ajuda/conversa/route");
  let admin: typeof import("../app/api/admin/atendimento/route");
  const antes = { admin: process.env.ADMIN_SECRET, app: process.env.APP_URL };
  const ips: string[] = [];
  let n = 0;
  const novoIp = () => {
    const ip = `atend-${RUN}-${++n}`;
    ips.push(ip);
    return ip;
  };

  function pessoa(body: unknown, { ip = "atend-fixo", cookie = "", origin = ORIGEM }: { ip?: string; cookie?: string; origin?: string } = {}) {
    const headers: Record<string, string> = { "content-type": "application/json", origin, "cf-connecting-ip": ip };
    if (cookie) headers.cookie = cookie;
    return rota.POST(new NextRequest(`${ORIGEM}/api/ajuda/conversa`, { method: "POST", headers, body: JSON.stringify(body) }));
  }
  function adm(method: "GET" | "POST", { query = "", body, cookie = adminCookie }: { query?: string; body?: unknown; cookie?: string } = {}) {
    const headers: Record<string, string> = { "content-type": "application/json", origin: ORIGEM };
    if (cookie) headers.cookie = cookie;
    const req = new NextRequest(`${ORIGEM}/api/admin/atendimento${query}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    return method === "GET" ? admin.GET(req) : admin.POST(req);
  }
  async function abrir(texto = "Como mudo meu e-mail?", ip = novoIp()) {
    const r = await pessoa({ acao: "abrir", texto, email: `ana-${RUN}${DOMINIO}`, locale: "pt-BR", de: "/vagas?q=x" }, { ip });
    expect(r.status).toBe(200);
    const j = await r.json();
    const c = await db.conversa.findFirstOrThrow({ where: { email: `ana-${RUN}${DOMINIO}` }, orderBy: { createdAt: "desc" } });
    return { codigo: j.codigo as string, id: c.id };
  }

  const limpar = async () => {
    const conversas = await db.conversa.findMany({ where: { OR: [{ email: { endsWith: DOMINIO } }, { userId: USER }] }, select: { id: true } });
    const chaves = [
      ...(await Promise.all(conversas.map((c) => chaveUso("conversa-msg", c.id)))),
      ...(await Promise.all(["atend-fixo", ...ips].map((ip) => chaveUso("conversa-nova", ip)))),
    ];
    await db.usoDiario.deleteMany({ where: { chave: { in: chaves } } });
    await db.conversa.deleteMany({ where: { id: { in: conversas.map((c) => c.id) } } });
    await db.user.deleteMany({ where: { id: USER } });
  };

  beforeAll(async () => {
    process.env.ADMIN_SECRET = SECRET;
    process.env.APP_URL = "https://app.w2.test";
    const { createPrismaClient } = await import("../lib/prisma");
    db = createPrismaClient(process.env.DATABASE_URL!);
    await limpar();
    await db.user.create({ data: { id: USER, name: "Bia", email: `bia-${RUN}${DOMINIO}`, perfil: "recrutador" } });
    const { signAdminSession, ADMIN_COOKIE } = await import("../lib/admin-auth");
    const s = await signAdminSession(SECRET);
    adminCookie = `${ADMIN_COOKIE}=${encodeURIComponent(s.value)}`;
    rota = await import("../app/api/ajuda/conversa/route");
    admin = await import("../app/api/admin/atendimento/route");
  });
  beforeEach(() => {
    fila.length = 0;
    filaFalha = false;
  });
  afterAll(async () => {
    await limpar();
    await db.$disconnect();
    process.env.ADMIN_SECRET = antes.admin;
    process.env.APP_URL = antes.app;
  });

  it("sem login pede o e-mail; com e-mail abre, guarda só o hash do código e avisa a equipe", async () => {
    const ip = novoIp();
    const sem = await pessoa({ acao: "abrir", texto: "Oi", locale: "pt-BR" }, { ip });
    expect(sem.status).toBe(422);
    expect((await sem.json()).error).toBe("email_invalido");
    expect(sem.headers.get("cache-control")).toBe("no-store");

    const { codigo, id } = await abrir("Como mudo meu e-mail? 11 99999-0000", ip);
    expect(codigo).toMatch(/^[A-Za-z0-9_-]{20,64}$/);
    const c = await db.conversa.findUniqueOrThrow({ where: { id }, include: { mensagens: true, codigos: true } });
    expect(c).toMatchObject({ status: "aberta", userId: null, perfil: null, idioma: "pt-BR", tela: "/vagas", ultimaDe: "pessoa" });
    expect(c.mensagens.map((m) => [m.autor, m.texto])).toEqual([["pessoa", "Como mudo meu e-mail? 11 99999-0000"]]);
    expect(c.codigos).toHaveLength(1);
    expect(c.codigos[0].tokenHash).not.toBe(codigo);
    expect(JSON.stringify(c)).not.toContain(codigo);

    expect(fila).toHaveLength(1);
    expect(fila[0].to).toBe(EMAIL_REVISAO);
    expect(fila[0].text).toContain("Como mudo meu e-mail? 11 99999-0000");
    expect(fila[0].text).toContain(`https://app.w2.test/admin/atendimento?id=${id}`);
    expect(fila[0].text).not.toContain(DOMINIO);

    const ver = await pessoa({ acao: "ver", c: codigo });
    expect(ver.status).toBe(200);
    const v = (await ver.json()).visao;
    expect(v.status).toBe("aberta");
    expect(v.mensagens.map((m: { autor: string }) => m.autor)).toEqual(["pessoa"]);
  });

  it("com login liga à conta, usa o e-mail dela e não pede e-mail", async () => {
    const cookie = cookieDeTeste({ id: USER, perfil: "recrutador", mfaLigado: true, email: `bia-${RUN}${DOMINIO}` });
    const r = await pessoa({ acao: "abrir", texto: "Não consigo publicar a vaga", locale: "en", de: "/publicar" }, { ip: novoIp(), cookie });
    expect(r.status).toBe(200);
    const c = await db.conversa.findFirstOrThrow({ where: { userId: USER } });
    expect(c).toMatchObject({ userId: USER, perfil: "recrutador", email: `bia-${RUN}${DOMINIO}`, idioma: "en", tela: "/publicar" });
    expect(fila[0].text).toContain("Recrutador logado");
  });

  it("código errado ou mal formado: 404", async () => {
    expect((await pessoa({ acao: "ver", c: "x".repeat(32) })).status).toBe(404);
    expect((await pessoa({ acao: "ver", c: "curto" })).status).toBe(404);
    expect((await pessoa({ acao: "enviar", c: "y".repeat(32), texto: "oi" })).status).toBe(404);
  });

  it("POST de outro site é recusado", async () => {
    expect((await pessoa({ acao: "abrir", texto: "oi", email: `x${DOMINIO}` }, { origin: "https://mal.example" })).status).toBe(403);
  });

  it("limites: 3 conversas novas por dia por IP e 2000 caracteres", async () => {
    const ip = novoIp();
    for (let i = 0; i < 3; i++) await abrir(`pergunta ${i}`, ip);
    const quarta = await pessoa({ acao: "abrir", texto: "mais uma", email: `ana-${RUN}${DOMINIO}`, locale: "pt-BR" }, { ip });
    expect(quarta.status).toBe(429);
    expect((await quarta.json()).error).toBe("limite_dia");

    const longa = await pessoa({ acao: "abrir", texto: "x".repeat(2001), email: `ana-${RUN}${DOMINIO}`, locale: "pt-BR" }, { ip: novoIp() });
    expect(longa.status).toBe(422);
    const { codigo } = await abrir();
    expect((await pessoa({ acao: "enviar", c: codigo, texto: "x".repeat(2001) })).status).toBe(422);
  });

  it("limite: 30 mensagens da pessoa por conversa por dia (a primeira conta)", async () => {
    const { codigo } = await abrir();
    for (let i = 1; i < LIMITE_MENSAGENS_CONVERSA_DIA; i++) expect((await pessoa({ acao: "enviar", c: codigo, texto: `msg ${i}` })).status).toBe(200);
    const r = await pessoa({ acao: "enviar", c: codigo, texto: "uma a mais" });
    expect(r.status).toBe(429);
    expect((await r.json()).visao.mensagens).toHaveLength(LIMITE_MENSAGENS_CONVERSA_DIA);
  });

  it("admin: sem o cookie, 401 em tudo", async () => {
    expect((await adm("GET", { cookie: "" })).status).toBe(401);
    expect((await adm("GET", { cookie: "", query: "?id=x" })).status).toBe(401);
    expect((await adm("POST", { cookie: "", body: { id: "x", acao: "encerrar" } })).status).toBe(401);
    expect((await adm("POST", { cookie: "", body: { id: "x", acao: "responder", texto: "oi" } })).status).toBe(401);
  });

  it("admin lista, lê (sem e-mail), responde com e-mail para a pessoa e o link novo funciona", async () => {
    const { codigo, id } = await abrir("Preciso de ajuda com a ficha");
    await pessoa({ acao: "enviar", c: codigo, texto: "Ainda aí?" });

    const lista = await adm("GET", { query: "?status=aberta" });
    expect(lista.status).toBe(200);
    expect(lista.headers.get("cache-control")).toBe("no-store");
    const linha = (await lista.json()).conversas.find((c: { id: string }) => c.id === id);
    expect(linha).toMatchObject({ aguardando: true, logado: false, tela: "/vagas", previa: "Ainda aí?" });

    const det = await adm("GET", { query: `?id=${id}` });
    const conversa = (await det.json()).conversa;
    expect(conversa.mensagens.map((m: { texto: string }) => m.texto)).toEqual(["Preciso de ajuda com a ficha", "Ainda aí?"]);
    expect(JSON.stringify(conversa)).not.toContain(DOMINIO);
    expect((await adm("GET", { query: "?id=nao-existe" })).status).toBe(404);

    fila.length = 0;
    const resp = await adm("POST", { body: { id, acao: "responder", texto: "Abra Minha ficha e clique em Editar." } });
    expect(resp.status).toBe(200);
    expect((await resp.json()).emailEnviado).toBe(true);
    expect(fila).toHaveLength(1);
    expect(fila[0].to).toBe(`ana-${RUN}${DOMINIO}`);
    expect(fila[0].text).not.toContain("Clique em Editar");
    const novo = /\/ajuda\/conversa\?c=([A-Za-z0-9_-]+)/.exec(fila[0].text)?.[1];
    expect(novo).toBeTruthy();
    expect(novo).not.toBe(codigo);
    expect(fila[0].text).toContain("https://app.w2.test/ajuda/conversa?c=");

    for (const c of [novo!, codigo]) {
      const v = (await (await pessoa({ acao: "ver", c })).json()).visao;
      expect(v.mensagens.map((m: { autor: string }) => m.autor)).toEqual(["pessoa", "pessoa", "equipe"]);
    }
    const depois = (await (await adm("GET", { query: "?status=aberta" })).json()).conversas.find((c: { id: string }) => c.id === id);
    expect(depois.aguardando).toBe(false);
    expect((await adm("POST", { body: { id, acao: "responder", texto: "  " } })).status).toBe(422);
  });

  it("conversa encerrada não aceita mensagem nova da pessoa nem resposta", async () => {
    const { codigo, id } = await abrir("Vou encerrar");
    const enc = await adm("POST", { body: { id, acao: "encerrar" } });
    expect(enc.status).toBe(200);
    const r = await pessoa({ acao: "enviar", c: codigo, texto: "Mais uma coisa" });
    expect(r.status).toBe(409);
    const j = await r.json();
    expect(j.error).toBe("encerrada");
    expect(j.visao.status).toBe("encerrada");
    expect(await db.conversaMensagem.count({ where: { conversaId: id } })).toBe(1);
    expect((await adm("POST", { body: { id, acao: "responder", texto: "Oi" } })).status).toBe(409);
    expect((await (await adm("GET", { query: "?status=encerrada" })).json()).conversas.some((c: { id: string }) => c.id === id)).toBe(true);
    expect((await adm("POST", { body: { id: "nao-existe", acao: "encerrar" } })).status).toBe(404);
  });

  it("fila fora do ar não quebra: a conversa abre e a resposta fica salva", async () => {
    filaFalha = true;
    const err = jest.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const { id } = await abrir("Sem fila");
      const r = await adm("POST", { body: { id, acao: "responder", texto: "Resposta" } });
      expect(r.status).toBe(200);
      expect((await r.json()).emailEnviado).toBe(false);
      expect(await db.conversaMensagem.count({ where: { conversaId: id } })).toBe(2);
      // Log sem dados pessoais: só o nome do erro.
      expect(err.mock.calls.every((c) => !JSON.stringify(c).includes(DOMINIO))).toBe(true);
    } finally {
      err.mockRestore();
    }
  });
});
