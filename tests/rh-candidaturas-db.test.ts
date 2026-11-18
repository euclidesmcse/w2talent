/** 2.4b Candidaturas da vaga e mudança de etapa no banco de verdade. Só roda num Postgres local. */
import type { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { cookieDeTeste, type ContaTeste } from "./helpers/sessao-mock";

jest.mock("../lib/sessao", () => require("./helpers/sessao-mock").sessaoMock());
jest.mock("../lib/background", () => ({ runInBackground: () => undefined }));
const enfileirados: any[] = [];
jest.mock("../lib/notifications", () => ({ enqueueEmail: async (m: any) => void enfileirados.push(m) }));

function localDb(url: string | undefined): boolean {
  try {
    return !!url && ["localhost", "127.0.0.1"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}
const describeDb = localDb(process.env.DATABASE_URL) ? describe : describe.skip;

const REC_A = "rhc-teste-rec-a";
const REC_B = "rhc-teste-rec-b";
const USERS = [REC_A, REC_B];
const CANDS = ["rhc-teste-ana", "rhc-teste-beto", "rhc-teste-caio"];
const rec = (id: string, extra: Partial<ContaTeste> = {}): ContaTeste => ({ id, perfil: "recrutador", mfaLigado: true, ...extra });

describeDb("candidaturas da vaga (2.4b/2.4c)", () => {
  let db: PrismaClient;
  let vagaA = "";
  let vagaB = "";
  const apps: Record<string, string> = {};

  const ler = async (conta: ContaTeste | null, vaga: string) => {
    const { GET } = await import("../app/api/rh/vagas/[id]/route");
    const headers: Record<string, string> = {};
    if (conta) headers.cookie = cookieDeTeste(conta);
    return GET(new NextRequest(`https://w2.test/api/rh/vagas/${vaga}`, { headers }), { params: Promise.resolve({ id: vaga }) });
  };
  const mudar = async (conta: ContaTeste | null, app: string, body: unknown, origin?: string) => {
    const { PATCH } = await import("../app/api/rh/candidaturas/[id]/route");
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (conta) headers.cookie = cookieDeTeste(conta);
    if (origin) headers.origin = origin;
    return PATCH(new NextRequest(`https://w2.test/api/rh/candidaturas/${app}`, { method: "PATCH", headers, body: JSON.stringify(body) }), { params: Promise.resolve({ id: app }) });
  };

  const limpar = async () => {
    const membros = await db.companyMember.findMany({ where: { userId: { in: USERS } }, select: { companyId: true } });
    const ids = membros.map((m) => m.companyId);
    await db.feedbackSignal.deleteMany({ where: { candidateId: { in: CANDS } } });
    await db.application.deleteMany({ where: { companyId: { in: ids } } });
    await db.vacancy.deleteMany({ where: { companyId: { in: ids } } });
    await db.companyProfile.deleteMany({ where: { id: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: USERS } } });
    await db.candidateProfile.deleteMany({ where: { id: { in: CANDS } } });
  };

  beforeAll(async () => {
    const { createPrismaClient } = await import("../lib/prisma");
    db = createPrismaClient(process.env.DATABASE_URL!);
    await limpar();
    for (const id of USERS) await db.user.create({ data: { id, name: id, email: `${id}@exemplo.com`, perfil: "recrutador" } });
    const { cadastrarEmpresa } = await import("../lib/empresa");
    const empresaA = (await cadastrarEmpresa(db, REC_A, { nome: "Acme RHC", site: null, cnpj: null, emailContato: null })).id;
    const empresaB = (await cadastrarEmpresa(db, REC_B, { nome: "Beta RHC", site: null, cnpj: null, emailContato: null })).id;
    const futuro = new Date(Date.now() + 30 * 864e5);
    const vaga = (companyId: string) =>
      db.vacancy.create({ data: { companyId, titulo: "Cloud Pleno", stack: [{ skillId: "aws" }, { skillId: "kubernetes" }] as any, nivel: "Pleno", regime: "PJ", localidade: "Remoto", status: "ativa", expiresAt: futuro } });
    vagaA = (await vaga(empresaA)).id;
    vagaB = (await vaga(empresaB)).id;
    const perfil = (id: string, extra: Record<string, unknown>) =>
      db.candidateProfile.create({ data: { id, userId: id, nome: id, titulo: "Engenharia Cloud", email: `${id}@exemplo.com`, celular: "+5511988887777", localidade: "São Paulo", expiresAt: futuro, ...extra } as any });
    await perfil(CANDS[0], { stack: [{ skillId: "aws", anos: 4 }, { skillId: "kubernetes", anos: 2 }], senioridade: "pleno", regimePreferido: ["PJ"], modo: "remoto" });
    await perfil(CANDS[1], { stack: [{ skillId: "aws", anos: 1 }], senioridade: "junior", regimePreferido: ["CLT"] });
    await perfil(CANDS[2], { status: "arquivado" });
    for (const c of CANDS) {
      const a = await db.application.create({ data: { candidateId: c, vacancyId: vagaA, companyId: empresaA, origem: "candidaturaLote", proxyThreadId: `rhc-${c}` } });
      apps[c] = a.id;
    }
    await db.application.create({ data: { candidateId: CANDS[0], vacancyId: vagaB, companyId: empresaB, origem: "candidaturaLote", proxyThreadId: `rhc-b-${CANDS[0]}` } });
  });
  afterAll(async () => {
    await limpar();
    await db.$disconnect();
  });

  it("só recrutador com autenticador, e só vaga da própria empresa", async () => {
    expect((await ler(null, vagaA)).status).toBe(401);
    expect((await ler(rec(REC_A, { mfaLigado: false }), vagaA)).status).toBe(403);
    expect((await ler(rec(REC_A), vagaB)).status).toBe(404);
    expect((await ler(rec(REC_A), "nao-existe")).status).toBe(404);
  });

  it("lista por match, sem contato completo, com ficha fora do ar marcada", async () => {
    const r = await ler(rec(REC_A), vagaA);
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    const j = await r.json();
    expect(j.total).toBe(3);
    expect(j.itens[0].candidato.id).toBe(CANDS[0]);
    expect(j.itens[0].match).toBeGreaterThan(j.itens[1].match);
    expect(j.itens.find((i: any) => i.candidato.id === CANDS[2]).fichaAtiva).toBe(false);
    expect(j.itens.every((i: any) => i.etapa === "nova")).toBe(true);
    const texto = JSON.stringify(j);
    expect(texto).not.toMatch(/exemplo\.com/);
    expect(texto).not.toMatch(/988887777/);
  });

  it("muda a etapa, marca a primeira resposta, deriva o status e grava o sinal", async () => {
    expect((await mudar(rec(REC_A), apps[CANDS[0]], { de: "nova", para: "cancelada" })).status).toBe(422);
    expect((await mudar(rec(REC_A), apps[CANDS[0]], { de: "nova", para: "entrevista" }, "https://outro.site")).status).toBe(403);
    expect((await mudar(rec(REC_B), apps[CANDS[0]], { de: "nova", para: "entrevista" })).status).toBe(404);

    const r = await mudar(rec(REC_A), apps[CANDS[0]], { de: "nova", para: "entrevista" });
    expect(r.status).toBe(200);
    const j1 = await r.json();
    expect(j1).toMatchObject({ ok: true, etapa: "entrevista", status: "respondido", contato: { email: `${CANDS[0]}@exemplo.com`, celular: "+5511988887777" } });
    expect(j1.aviso).toBeUndefined();
    // 2.4c: o candidato recebe um aviso, uma vez só.
    expect(enfileirados).toHaveLength(1);
    expect(enfileirados[0]).toMatchObject({ to: `${CANDS[0]}@exemplo.com`, idempotencyKey: `entrevista:${apps[CANDS[0]]}` });
    expect(enfileirados[0].subject).toContain("Acme RHC");
    expect(enfileirados[0].html).toContain("/minhas-candidaturas");
    let a = await db.application.findUniqueOrThrow({ where: { id: apps[CANDS[0]] } });
    expect([a.etapa, a.status]).toEqual(["entrevista", "respondido"]);
    const primeira = a.respondidaEm;
    expect(primeira).not.toBeNull();

    // Tela velha: a etapa já não é "nova".
    expect((await mudar(rec(REC_A), apps[CANDS[0]], { de: "nova", para: "proposta" })).status).toBe(409);

    // Voltar para Em análise não volta o status, nem muda a primeira resposta.
    await mudar(rec(REC_A), apps[CANDS[0]], { de: "entrevista", para: "em_analise" });
    a = await db.application.findUniqueOrThrow({ where: { id: apps[CANDS[0]] } });
    expect([a.etapa, a.status]).toEqual(["em_analise", "respondido"]);
    expect(a.respondidaEm?.getTime()).toBe(primeira?.getTime());
    // Liberado uma vez, fica liberado; voltar para Entrevista não manda outro aviso.
    expect(a.contatoLiberadoEm).not.toBeNull();
    const volta = await (await mudar(rec(REC_A), apps[CANDS[0]], { de: "em_analise", para: "entrevista" })).json();
    expect(volta.contato).toMatchObject({ email: `${CANDS[0]}@exemplo.com` });
    expect(enfileirados).toHaveLength(1);
    await mudar(rec(REC_A), apps[CANDS[0]], { de: "entrevista", para: "em_analise" });

    // A lista mostra o contato só de quem foi liberado.
    const lista = await (await ler(rec(REC_A), vagaA)).json();
    expect(lista.itens.find((i: any) => i.candidato.id === CANDS[0]).contato).toEqual({ email: `${CANDS[0]}@exemplo.com`, celular: "+5511988887777" });
    expect(lista.itens.filter((i: any) => i.candidato.id !== CANDS[0]).every((i: any) => i.contato === null)).toBe(true);

    await mudar(rec(REC_A), apps[CANDS[1]], { de: "nova", para: "nao_seguiu" });
    const b = await db.application.findUniqueOrThrow({ where: { id: apps[CANDS[1]] } });
    expect([b.status, b.contatoLiberadoEm]).toEqual(["arquivado", null]);
    expect(enfileirados).toHaveLength(1);

    const sinais = await db.feedbackSignal.findMany({ where: { candidateId: { in: CANDS }, tipo: "etapa_mudou" }, orderBy: { createdAt: "asc" } });
    expect(sinais.map((s) => s.dados)).toEqual([
      { de: "nova", para: "entrevista", contatoLiberado: true },
      { de: "entrevista", para: "em_analise" },
      { de: "em_analise", para: "entrevista" },
      { de: "entrevista", para: "em_analise" },
      { de: "nova", para: "nao_seguiu" },
    ]);
    expect(sinais.every((s) => s.ator === "recrutador" && s.vacancyId === vagaA)).toBe(true);
  });

  it("abrir a ficha marca como vista, sem contar como resposta", async () => {
    const r = await mudar(rec(REC_A), apps[CANDS[2]], { visto: true });
    expect(r.status).toBe(200);
    const a = await db.application.findUniqueOrThrow({ where: { id: apps[CANDS[2]] } });
    expect([a.status, a.etapa, a.respondidaEm]).toEqual(["visualizado", "nova", null]);
    expect((await mudar(rec(REC_B), apps[CANDS[2]], { visto: true })).status).toBe(404);
  });
});
