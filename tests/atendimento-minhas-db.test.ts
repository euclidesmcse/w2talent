/**
 * 2.6b-2 Minhas conversas e prazo de guarda, no banco de verdade. Só roda num Postgres local.
 * Dados de teste: contas "cv26b2-*" e e-mails @cv26b2.example.
 */
import type { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { cookieDeTeste } from "./helpers/sessao-mock";
import type { EmailMessage } from "../lib/email";

jest.mock("../lib/sessao", () => require("./helpers/sessao-mock").sessaoMock());
const fila: EmailMessage[] = [];
jest.mock("../lib/notifications", () => ({
  enqueueEmail: async (m: EmailMessage) => {
    fila.push(m);
  },
}));

import { apagarConversasAntigas, LIMITE_MENSAGENS_CONVERSA_DIA, PRAZO_GUARDA_DIAS } from "../lib/atendimento";
import { chaveUso } from "../lib/uso-diario";

function localDb(url: string | undefined): boolean {
  try {
    return !!url && ["localhost", "127.0.0.1"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}
const describeDb = localDb(process.env.DATABASE_URL) ? describe : describe.skip;

const DOMINIO = "@cv26b2.example";
const ANA = "cv26b2-ana";
const BIA = "cv26b2-bia";
const ORIGEM = "https://w2.test";
const DIA = 24 * 60 * 60 * 1000;
const RUN = Math.random().toString(36).slice(2, 8);

describeDb("2.6b-2 Minhas conversas", () => {
  let db: PrismaClient;
  let rota: typeof import("../app/api/ajuda/conversa/route");
  const antes = process.env.APP_URL;
  let n = 0;
  const ips: string[] = [];
  const novoIp = () => {
    const ip = `cv26b2-${RUN}-${++n}`;
    ips.push(ip);
    return ip;
  };
  const ana = cookieDeTeste({ id: ANA, perfil: "candidato", email: `ana${DOMINIO}` });
  const bia = cookieDeTeste({ id: BIA, perfil: "recrutador", mfaLigado: true, email: `bia${DOMINIO}` });

  function pessoa(body: unknown, { cookie = "", origin = ORIGEM, ip = novoIp() }: { cookie?: string; origin?: string; ip?: string } = {}) {
    const headers: Record<string, string> = { "content-type": "application/json", origin, "cf-connecting-ip": ip };
    if (cookie) headers.cookie = cookie;
    return rota.POST(new NextRequest(`${ORIGEM}/api/ajuda/conversa`, { method: "POST", headers, body: JSON.stringify(body) }));
  }

  async function abrir(cookie: string, texto: string) {
    const r = await pessoa({ acao: "abrir", texto, locale: "pt-BR", de: "/painel" }, { cookie });
    expect(r.status).toBe(200);
    const { codigo } = await r.json();
    const c = await db.conversaCodigo.findFirstOrThrow({ where: { conversa: { mensagens: { some: { texto } } } }, select: { conversaId: true } });
    return { codigo: codigo as string, id: c.conversaId };
  }

  const limpar = async () => {
    const conversas = await db.conversa.findMany({ where: { OR: [{ email: { endsWith: DOMINIO } }, { userId: { in: [ANA, BIA] } }] }, select: { id: true } });
    const chaves = [
      ...(await Promise.all(conversas.map((c) => chaveUso("conversa-msg", c.id)))),
      ...(await Promise.all(ips.map((ip) => chaveUso("conversa-nova", ip)))),
    ];
    await db.usoDiario.deleteMany({ where: { chave: { in: chaves } } });
    await db.conversa.deleteMany({ where: { id: { in: conversas.map((c) => c.id) } } });
    await db.user.deleteMany({ where: { id: { in: [ANA, BIA] } } });
  };

  beforeAll(async () => {
    process.env.APP_URL = "https://app.w2.test";
    const { createPrismaClient } = await import("../lib/prisma");
    db = createPrismaClient(process.env.DATABASE_URL!);
    await limpar();
    await db.user.create({ data: { id: ANA, name: "Ana", email: `ana${DOMINIO}`, perfil: "candidato" } });
    await db.user.create({ data: { id: BIA, name: "Bia", email: `bia${DOMINIO}`, perfil: "recrutador" } });
    rota = await import("../app/api/ajuda/conversa/route");
  });
  beforeEach(() => {
    fila.length = 0;
  });
  afterAll(async () => {
    await limpar();
    await db.$disconnect();
    process.env.APP_URL = antes;
  });

  it("a dona vê só as conversas dela, atividade mais recente primeiro", async () => {
    const um = await abrir(ana, `cv26b2 primeira ${RUN}`);
    const dois = await abrir(ana, `cv26b2 segunda ${RUN}`);
    const daBia = await abrir(bia, `cv26b2 da bia ${RUN}`);
    // A primeira teve a atividade mais recente.
    await db.conversa.update({ where: { id: um.id }, data: { ultimaEm: new Date(Date.now() + 60_000), ultimaDe: "equipe" } });

    const r = await pessoa({ acao: "minhas" }, { cookie: ana });
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    const { conversas } = await r.json();
    expect(conversas.map((c: { id: string }) => c.id)).toEqual([um.id, dois.id]);
    expect(conversas[0]).toMatchObject({ status: "aberta", respondida: true, aguardando: false, assunto: `cv26b2 primeira ${RUN}` });
    expect(conversas[1]).toMatchObject({ status: "aberta", respondida: false, aguardando: true });
    expect(JSON.stringify(conversas)).not.toContain(daBia.id);
    expect(JSON.stringify(conversas)).not.toContain(DOMINIO);

    const daOutra = await (await pessoa({ acao: "minhas" }, { cookie: bia })).json();
    expect(daOutra.conversas.map((c: { id: string }) => c.id)).toEqual([daBia.id]);
  });

  it("a dona abre e escreve pelo id, sem o código; outra conta recebe 404", async () => {
    const { id, codigo } = await abrir(ana, `cv26b2 pelo id ${RUN}`);
    const ver = await pessoa({ acao: "ver", id }, { cookie: ana });
    expect(ver.status).toBe(200);
    expect(ver.headers.get("cache-control")).toBe("no-store");
    expect((await ver.json()).visao.mensagens.map((m: { texto: string }) => m.texto)).toEqual([`cv26b2 pelo id ${RUN}`]);

    fila.length = 0;
    const env = await pessoa({ acao: "enviar", id, texto: "Mais um detalhe" }, { cookie: ana });
    expect(env.status).toBe(200);
    expect((await env.json()).visao.mensagens).toHaveLength(2);
    expect(fila).toHaveLength(1);
    // O código do link continua valendo e vê a mesma conversa.
    expect((await (await pessoa({ acao: "ver", c: codigo })).json()).visao.mensagens).toHaveLength(2);

    for (const acao of [{ acao: "ver", id }, { acao: "enviar", id, texto: "intrometida" }]) {
      const r = await pessoa(acao, { cookie: bia });
      expect(r.status).toBe(404);
    }
    expect(await db.conversaMensagem.count({ where: { conversaId: id } })).toBe(2);
    expect((await pessoa({ acao: "ver", id: "nao-existe" }, { cookie: ana })).status).toBe(404);
    expect((await pessoa({ acao: "ver", id: { $ne: null } }, { cookie: ana })).status).toBe(404);
  });

  it("sem login, ou com o autenticador pendente, o caminho pelo id e a lista dão 401", async () => {
    const { id } = await abrir(ana, `cv26b2 anonimo ${RUN}`);
    const pendente = cookieDeTeste({ id: ANA, perfil: "candidato", mfaPendente: true });
    for (const cookie of ["", pendente]) {
      for (const body of [{ acao: "minhas" }, { acao: "ver", id }, { acao: "enviar", id, texto: "oi" }]) {
        const r = await pessoa(body, { cookie });
        expect([JSON.stringify(body), r.status]).toEqual([JSON.stringify(body), 401]);
        expect(r.headers.get("cache-control")).toBe("no-store");
      }
    }
    expect(await db.conversaMensagem.count({ where: { conversaId: id } })).toBe(1);
  });

  it("de outro site é recusado também pelo id", async () => {
    const { id } = await abrir(ana, `cv26b2 origem ${RUN}`);
    expect((await pessoa({ acao: "enviar", id, texto: "oi" }, { cookie: ana, origin: "https://mal.example" })).status).toBe(403);
    expect((await pessoa({ acao: "minhas" }, { cookie: ana, origin: "https://mal.example" })).status).toBe(403);
  });

  it("pelo id valem os mesmos limites: 2000 caracteres, 30 por dia e encerrada não aceita", async () => {
    const { id } = await abrir(ana, `cv26b2 limites ${RUN}`);
    expect((await pessoa({ acao: "enviar", id, texto: "x".repeat(2001) }, { cookie: ana })).status).toBe(422);
    for (let i = 1; i < LIMITE_MENSAGENS_CONVERSA_DIA; i++) expect((await pessoa({ acao: "enviar", id, texto: `msg ${i}` }, { cookie: ana })).status).toBe(200);
    expect((await pessoa({ acao: "enviar", id, texto: "uma a mais" }, { cookie: ana })).status).toBe(429);

    const outra = await abrir(ana, `cv26b2 encerrada ${RUN}`);
    await db.conversa.update({ where: { id: outra.id }, data: { status: "encerrada", encerradaEm: new Date() } });
    const r = await pessoa({ acao: "enviar", id: outra.id, texto: "oi" }, { cookie: ana });
    expect(r.status).toBe(409);
    expect((await r.json()).visao.status).toBe("encerrada");
  });

  it("Cron: apaga só as encerradas há mais de 180 dias, com mensagens e códigos", async () => {
    const agora = new Date();
    const velha = await abrir(ana, `cv26b2 velha ${RUN}`);
    const quase = await abrir(ana, `cv26b2 quase ${RUN}`);
    const aberta = await abrir(ana, `cv26b2 aberta antiga ${RUN}`);
    await db.conversa.update({ where: { id: velha.id }, data: { status: "encerrada", encerradaEm: new Date(agora.getTime() - (PRAZO_GUARDA_DIAS + 1) * DIA) } });
    await db.conversa.update({ where: { id: quase.id }, data: { status: "encerrada", encerradaEm: new Date(agora.getTime() - (PRAZO_GUARDA_DIAS - 1) * DIA) } });
    // Aberta há muito tempo não é apagada (não há encerramento automático).
    await db.conversa.update({ where: { id: aberta.id }, data: { ultimaEm: new Date(agora.getTime() - 400 * DIA) } });

    const apagadas = await apagarConversasAntigas(db, agora);
    expect(apagadas).toBeGreaterThanOrEqual(1);
    expect(await db.conversa.findUnique({ where: { id: velha.id } })).toBeNull();
    expect(await db.conversaMensagem.count({ where: { conversaId: velha.id } })).toBe(0);
    expect(await db.conversaCodigo.count({ where: { conversaId: velha.id } })).toBe(0);
    expect((await pessoa({ acao: "ver", c: velha.codigo })).status).toBe(404);
    expect(await db.conversa.findUnique({ where: { id: quase.id } })).not.toBeNull();
    expect(await db.conversa.findUnique({ where: { id: aberta.id } })).not.toBeNull();
  });
});

describe("2.6b-2 Cron chama o prazo de guarda", () => {
  it("a higiene diária apaga as conversas antigas", () => {
    const fs = require("fs") as typeof import("fs");
    const src = fs.readFileSync(require("path").join(__dirname, "../app/api/cron/hygiene/route.ts"), "utf-8");
    expect(src).toContain("apagarConversasAntigas(prisma)");
    expect(PRAZO_GUARDA_DIAS).toBe(180);
  });
});
