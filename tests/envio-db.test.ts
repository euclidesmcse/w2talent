/** Aprovar antes de enviar (1.5.13) no banco de verdade. Só roda num Postgres local. */
import type { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { cookieDeTeste } from "./helpers/sessao-mock";
import type { EmailMessage } from "../lib/email";

jest.mock("../lib/sessao", () => require("./helpers/sessao-mock").sessaoMock());
jest.mock("../lib/background", () => ({ runInBackground: () => {} }));
const filaEmails: EmailMessage[] = [];
jest.mock("../lib/notifications", () => ({ enqueueEmail: async (m: EmailMessage) => { filaEmails.push(m); } }));

import {
  ENVIO_LIMITE_24H,
  aprovarVaga,
  enviarCandidaturas,
  estadoDasVagas,
  hashVaga,
  perfilDaConta,
  reenviarEmailsPendentes,
  snapshotVaga,
  type PerfilEnvio,
} from "../lib/envio";

function localDb(url: string | undefined): boolean {
  try {
    return !!url && ["localhost", "127.0.0.1"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}
const describeDb = localDb(process.env.DATABASE_URL) ? describe : describe.skip;

const EMAIL = "bia.envio@exemplo.com";
const CONTA = "conta-bia-envio";
const NOW = new Date("2026-11-09T15:00:00Z");
const DIA = 86_400_000;

describeDb("Aprovar antes de enviar", () => {
  let db: PrismaClient;
  let perfil: PerfilEnvio;
  let companyId: string;
  let semContatoId: string;

  const vaga = (titulo: string, extra: Record<string, unknown> = {}) =>
    db.vacancy.create({
      data: {
        companyId,
        titulo,
        stack: [{ skillId: "aws" }, { skillId: "terraform" }],
        nivel: "Pleno",
        regime: "PJ",
        localidade: "Remoto",
        faixaDe: 10000,
        faixaAte: 15000,
        descricaoBullets: ["Cuidar da AWS"],
        beneficios: ["Plano de saúde"],
        expiresAt: new Date(NOW.getTime() + 20 * DIA),
        ...extra,
      },
    });

  beforeAll(async () => {
    const { createPrismaClient } = await import("../lib/prisma");
    db = createPrismaClient(process.env.DATABASE_URL!);
    await db.companyProfile.deleteMany({ where: { nome: { startsWith: "Envio Teste" } } });
    await db.candidateProfile.deleteMany({ where: { email: EMAIL } });
    companyId = (await db.companyProfile.create({ data: { nome: "Envio Teste SA", emailContato: "rh@envio-teste.example" } })).id;
    semContatoId = (await db.companyProfile.create({ data: { nome: "Envio Teste Sem Contato" } })).id;
    await db.candidateProfile.create({
      data: {
        userId: CONTA,
        nome: "Beatriz Souza Lima",
        email: EMAIL,
        celular: "+5511988887777",
        links: ["https://linkedin.example/bia"],
        titulo: "Analista Cloud",
        senioridade: "pleno",
        localidade: "Recife",
        modo: "remoto",
        regimePreferido: ["CLT", "PJ"],
        pretensoes: [
          { regime: "CLT", valor: 9000, unidade: "mes", moeda: "BRL" },
          { regime: "PJ", valor: 13000, unidade: "mes", moeda: "BRL" },
        ],
        stack: [{ skillId: "aws", anos: 4 }, { skillId: "terraform", anos: 2 }],
        fichaW2: { resumo: "Analista cloud com 4 anos de AWS.", destaques: ["Migrou 30 servidores"], idioma: "pt-BR", geradaEm: NOW.toISOString(), editada: false },
        expiresAt: new Date(NOW.getTime() + 180 * DIA),
      },
    });
    perfil = (await perfilDaConta(db, CONTA))!;
  });

  afterAll(async () => {
    await db.candidateProfile.deleteMany({ where: { email: EMAIL } });
    await db.companyProfile.deleteMany({ where: { nome: { startsWith: "Envio Teste" } } });
    await db.$disconnect();
  });

  beforeEach(() => {
    filaEmails.length = 0;
  });

  /** Aprova a versão que a tela mostraria agora. */
  const aprova = async (id: string) => {
    const [it] = await estadoDasVagas(db, perfil, [id], NOW);
    return aprovarVaga(db, perfil.id, id, it.hash ?? "", NOW);
  };

  it("acha o perfil pela conta e nunca devolve o contato para a empresa", async () => {
    expect(perfil.ficha.nome).toBe("Beatriz Souza Lima");
    const v = await vaga("Analista Cloud PJ");
    const [it] = await estadoDasVagas(db, perfil, [v.id], NOW);
    expect(it.estado).toBe("nova");
    // o perfil pede PJ ≥ 13.000 e a vaga paga até 15.000: sem lacuna de faixa
    expect(it.match!.gaps.find((g) => g.kind === "faixa")).toBeUndefined();
    expect(await perfilDaConta(db, "conta-sem-perfil")).toBeNull();
  });

  it("o hash não muda com renovação e contadores, e muda com o conteúdo", async () => {
    const v = await vaga("Hash estável");
    const row = await db.vacancy.findUniqueOrThrow({ where: { id: v.id }, include: { company: true } });
    const h1 = await hashVaga(snapshotVaga(row as any));
    const renovada = await db.vacancy.update({ where: { id: v.id }, data: { renovacoes: 1, views: 9, candidaturasCount: 2, expiresAt: new Date(NOW.getTime() + 60 * DIA), stack: [{ skillId: "terraform" }, { skillId: "aws" }] }, include: { company: true } });
    expect(await hashVaga(snapshotVaga(renovada as any))).toBe(h1);
    const editada = await db.vacancy.update({ where: { id: v.id }, data: { faixaAte: 12000 }, include: { company: true } });
    expect(await hashVaga(snapshotVaga(editada as any))).not.toBe(h1);
  });

  it("vaga que mudou depois da aprovação: mostra o que mudou e não envia", async () => {
    const v = await vaga("Vai mudar");
    expect((await aprova(v.id)).ok).toBe(true);
    expect((await estadoDasVagas(db, perfil, [v.id], NOW))[0].estado).toBe("aprovada");
    await db.vacancy.update({ where: { id: v.id }, data: { descricaoBullets: ["Cuidar da AWS", "Plantão aos fins de semana"], regime: "CLT" } });
    const [it] = await estadoDasVagas(db, perfil, [v.id], NOW);
    expect(it).toMatchObject({ estado: "mudou", campos: ["regime", "descricao"] });
    const r = await enviarCandidaturas(db, perfil, [v.id], { now: NOW });
    expect(r).toMatchObject({ ok: true, itens: [{ vacancyId: v.id, status: "mudou", campos: ["regime", "descricao"] }] });
    expect(await db.applicationApproval.count({ where: { vacancyId: v.id } })).toBe(0);
    expect(await db.application.count({ where: { vacancyId: v.id } })).toBe(0);
  });

  it("envia só as aprovadas, registra a candidatura e põe o e-mail na fila, sem contato do candidato", async () => {
    const a = await vaga("Aprovada com contato");
    const b = await vaga("Não aprovada");
    const c = await vaga("Aprovada sem contato", { companyId: semContatoId, regime: "CLT" });
    await aprova(a.id);
    await aprova(c.id);
    const emails: EmailMessage[] = [];
    const r = await enviarCandidaturas(db, perfil, [a.id, b.id, c.id], { now: NOW, loteId: "lote-1", enviarEmail: async (m) => { emails.push(m); } });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.itens.map((i) => [i.vacancyId, i.status])).toEqual([[a.id, "enviada"], [b.id, "sem_aprovacao"], [c.id, "enviada"]]);
    expect(r.itens[2]).toMatchObject({ email: false });
    const apps = await db.application.findMany({ where: { candidateId: perfil.id, vacancyId: { in: [a.id, c.id] } } });
    expect(apps).toHaveLength(2);
    expect(apps.every((x) => x.origem === "candidaturaLote" && x.loteId === "lote-1" && x.status === "enviado")).toBe(true);
    expect((await db.vacancy.findUniqueOrThrow({ where: { id: a.id } })).candidaturasCount).toBe(1);
    expect(await db.applicationApproval.count({ where: { vacancyId: { in: [a.id, c.id] } } })).toBe(0);

    // só a empresa com contato recebe e-mail
    expect(emails).toHaveLength(1);
    const msg = emails[0];
    const appA = apps.find((x) => x.vacancyId === a.id)!;
    expect(msg.to).toBe("rh@envio-teste.example");
    expect(msg.idempotencyKey).toBe(`candidatura:${appA.proxyThreadId}`);
    expect(appA.emailPendente).toBeNull();
    expect(msg.subject).toBe("Candidatura para Aprovada com contato: Beatriz L.");
    for (const corpo of [msg.html, msg.text]) {
      expect(corpo).not.toContain(EMAIL);
      expect(corpo).not.toContain("98888");
      expect(corpo).not.toContain("linkedin");
      expect(corpo).not.toContain("Souza");
      // a vaga é PJ: vai só a pretensão PJ
      expect(corpo).toContain("PJ a partir de R$");
      expect(corpo).not.toContain("CLT a partir de");
    }
    expect(msg.text).toContain("Match com a vaga:");

    // a mesma vaga nunca vai duas vezes, nem pode ser aprovada de novo
    expect(await aprova(a.id)).toEqual({ ok: false, motivo: "ja_enviada" });
    const de_novo = await enviarCandidaturas(db, perfil, [a.id], { now: NOW });
    expect(de_novo).toMatchObject({ ok: true, itens: [{ status: "ja_enviada" }] });
    expect((await estadoDasVagas(db, perfil, [a.id], NOW))[0]).toMatchObject({ estado: "enviada", enviadaEm: NOW.toISOString() });
  });

  it("não aprova uma versão da vaga diferente da que a tela mostrou", async () => {
    const v = await vaga("Muda com a tela aberta");
    const [antes] = await estadoDasVagas(db, perfil, [v.id], NOW);
    await db.vacancy.update({ where: { id: v.id }, data: { faixaAte: 11000 } });
    expect(await aprovarVaga(db, perfil.id, v.id, antes.hash!, NOW)).toEqual({ ok: false, motivo: "mudou" });
    expect(await db.applicationApproval.count({ where: { vacancyId: v.id } })).toBe(0);
  });

  it("moedas diferentes não entram na faixa do match", async () => {
    const usd = await vaga("Vaga em dólar", { faixaMoeda: "USD", faixaDe: 3000, faixaAte: 5000 });
    const brl = await vaga("Vaga em real baixa", { faixaAte: 6000 });
    const [a, b] = await estadoDasVagas(db, perfil, [usd.id, brl.id], NOW);
    expect(a.match!.gaps.find((g) => g.kind === "faixa")).toBeUndefined();
    expect(b.match!.gaps.find((g) => g.kind === "faixa")).toMatchObject({ want: 13000, have: 6000 });
  });

  it("e-mail que não entrou na fila fica pendente e o Cron tenta de novo", async () => {
    const v = await vaga("Fila fora do ar");
    await aprova(v.id);
    const r = await enviarCandidaturas(db, perfil, [v.id], { now: NOW, enviarEmail: async () => { throw new Error("fila fora do ar"); } });
    expect(r).toMatchObject({ ok: true, itens: [{ status: "enviada" }] });
    const app = await db.application.findFirstOrThrow({ where: { vacancyId: v.id } });
    expect(app.emailPendente).toMatchObject({ to: "rh@envio-teste.example", idempotencyKey: `candidatura:${app.proxyThreadId}` });
    // o perfil muda antes do Cron: o e-mail reenviado é o do envio, não o perfil novo
    await db.candidateProfile.update({ where: { id: perfil.id }, data: { fichaW2: { resumo: "Resumo novo depois do envio.", destaques: [], idioma: "pt-BR", geradaEm: NOW.toISOString(), editada: true } } });
    const fila: EmailMessage[] = [];
    expect(await reenviarEmailsPendentes(db, async (m) => { fila.push(m); }, NOW)).toMatchObject({ enviados: 1, falhas: 0 });
    expect(fila.map((m) => m.idempotencyKey)).toEqual([`candidatura:${app.proxyThreadId}`]);
    expect(fila[0].text).toContain("Analista cloud com 4 anos de AWS.");
    expect(fila[0].text).not.toContain("Resumo novo");
    expect(fila[0].text).not.toContain(EMAIL);
    expect((await db.application.findUniqueOrThrow({ where: { id: app.id } })).emailPendente).toBeNull();
    expect((await reenviarEmailsPendentes(db, async (m) => { fila.push(m); }, NOW)).enviados).toBe(0);
  });

  it("vaga vencida ou arquivada desde a aprovação não vai", async () => {
    const v = await vaga("Vai vencer");
    const w = await vaga("Vai arquivar");
    await aprova(v.id);
    await aprova(w.id);
    await db.vacancy.update({ where: { id: v.id }, data: { expiresAt: new Date(NOW.getTime() - 1000) } });
    await db.vacancy.update({ where: { id: w.id }, data: { status: "arquivada" } });
    const r = await enviarCandidaturas(db, perfil, [v.id, w.id], { now: NOW });
    expect(r).toMatchObject({ ok: true, itens: [{ status: "indisponivel" }, { status: "indisponivel" }] });
    expect(await aprova(v.id)).toEqual({ ok: false, motivo: "indisponivel" });
  });

  it("no máximo 10 por envio e 30 nas últimas 24 h", async () => {
    expect(await enviarCandidaturas(db, perfil, Array.from({ length: 11 }, (_, i) => `x${i}`), { now: NOW })).toEqual({ ok: false, erro: "limite_lote", max: 10 });

    const ja = await db.application.count({ where: { candidateId: perfil.id, origem: "candidaturaLote", createdAt: { gt: new Date(NOW.getTime() - DIA) } } });
    // completa até 29 nas últimas 24 h (sem vaga, só para contar) e põe 3 antigas, que não contam
    const extra = Array.from({ length: ENVIO_LIMITE_24H - 1 - ja }, (_, i) => ({ candidateId: perfil.id, companyId, origem: "candidaturaLote" as const, proxyThreadId: `t-${i}`, createdAt: new Date(NOW.getTime() - 3600_000) }));
    const antigas = Array.from({ length: 3 }, (_, i) => ({ candidateId: perfil.id, companyId, origem: "candidaturaLote" as const, proxyThreadId: `old-${i}`, createdAt: new Date(NOW.getTime() - 2 * DIA) }));
    await db.application.createMany({ data: [...extra, ...antigas] });

    const v1 = await vaga("Limite 1");
    const v2 = await vaga("Limite 2");
    await aprova(v1.id);
    await aprova(v2.id);
    expect(await enviarCandidaturas(db, perfil, [v1.id, v2.id], { now: NOW })).toEqual({ ok: false, erro: "limite_dia", max: 30, usadas24h: 29, restantes: 1 });
    // nada foi gravado e as aprovações continuam
    expect(await db.application.count({ where: { vacancyId: { in: [v1.id, v2.id] } } })).toBe(0);
    expect(await db.applicationApproval.count({ where: { vacancyId: { in: [v1.id, v2.id] } } })).toBe(2);
    expect(await enviarCandidaturas(db, perfil, [v1.id], { now: NOW })).toMatchObject({ ok: true, usadas24h: 30 });
    // um dia depois, volta a poder
    expect(await enviarCandidaturas(db, perfil, [v2.id], { now: new Date(NOW.getTime() + DIA + 1000) })).toMatchObject({ ok: true, itens: [{ status: "enviada" }] });
    await db.application.deleteMany({ where: { candidateId: perfil.id, vacancyId: null } });
  });

  it("dois envios ao mesmo tempo não mandam a mesma vaga duas vezes", async () => {
    const v = await vaga("Paralelo");
    await aprova(v.id);
    const rs = await Promise.all([1, 2, 3].map(() => enviarCandidaturas(db, perfil, [v.id], { now: NOW })));
    const status = rs.flatMap((r) => (r.ok ? r.itens.map((i) => i.status) : [r.erro]));
    expect(status.filter((s) => s === "enviada")).toHaveLength(1);
    expect(await db.application.count({ where: { vacancyId: v.id } })).toBe(1);
  });

  it("rotas: só o candidato logado, o perfil vem da sessão e o estado não traz contato", async () => {
    const cookie = cookieDeTeste({ id: CONTA });
    const v = await vaga("Pela rota");
    const post = (path: string, body: unknown, h: Record<string, string> = { cookie }) =>
      new NextRequest(`http://w2.test${path}`, { method: "POST", headers: { ...h, "content-type": "application/json" }, body: JSON.stringify(body) });

    const estado = (await import("../app/api/envio/estado/route")).POST;
    const aprovar = (await import("../app/api/envio/aprovar/route")).POST;
    const enviar = (await import("../app/api/envio/enviar/route")).POST;
    const enviadas = (await import("../app/api/envio/enviadas/route")).POST;

    expect((await estado(post("/api/envio/estado", { email: EMAIL, vacancyIds: [v.id] }, {}))).status).toBe(401);
    expect((await estado(post("/api/envio/estado", { vacancyIds: [v.id] }, { cookie: cookieDeTeste({ id: "conta-sem-perfil" }) }))).status).toBe(404);
    expect((await estado(post("/api/envio/estado", { vacancyIds: [v.id] }, { cookie: cookieDeTeste({ id: CONTA, perfil: "recrutador", mfaLigado: true }) }))).status).toBe(403);
    expect((await estado(post("/api/envio/estado", { vacancyIds: [v.id] }, { cookie: cookieDeTeste({ id: CONTA, mfaPendente: true }) }))).status).toBe(401);

    const r1 = await estado(post("/api/envio/estado", { email: EMAIL, vacancyIds: [v.id] }));
    const j1 = await r1.json();
    expect(r1.status).toBe(200);
    expect(JSON.stringify(j1)).not.toContain(EMAIL);
    expect(JSON.stringify(j1)).not.toContain("98888");
    expect(j1.itens[0]).toMatchObject({ estado: "nova", vaga: { titulo: "Pela rota", empresa: "Envio Teste SA", temContato: true } });
    expect(j1.itens[0].paraEmpresa.pretensoes).toEqual([{ regime: "PJ", valor: 13000, unidade: "mes", moeda: "BRL" }]);

    const hash = j1.itens[0].hash;
    expect((await aprovar(post("/api/envio/aprovar", { email: EMAIL, vacancyId: v.id }))).status).toBe(409);
    expect((await aprovar(post("/api/envio/aprovar", { email: EMAIL, vacancyId: v.id, hash }))).status).toBe(200);
    expect((await aprovar(post("/api/envio/aprovar", { email: EMAIL, vacancyId: v.id, aprovar: false }))).status).toBe(200);
    expect(await db.applicationApproval.count({ where: { vacancyId: v.id } })).toBe(0);
    await aprovar(post("/api/envio/aprovar", { email: EMAIL, vacancyId: v.id, hash }));

    const r2 = await enviar(post("/api/envio/enviar", { email: EMAIL, vacancyIds: [v.id] }));
    expect(r2.status).toBe(200);
    expect((await r2.json()).itens[0].status).toBe("enviada");
    expect(filaEmails).toHaveLength(1);
    expect(filaEmails[0].to).toBe("rh@envio-teste.example");

    const lista = await (await enviadas(post("/api/envio/enviadas", { email: EMAIL }))).json();
    expect(lista.applications.find((a: { vacancyId: string }) => a.vacancyId === v.id)).toMatchObject({ vacancyId: v.id, titulo: "Pela rota", empresa: "Envio Teste SA", status: "enviado" });
  });
});
