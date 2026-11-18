/** 2.4a Painel RH no banco de verdade. Só roda num Postgres local. */
import type { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { cookieDeTeste, type ContaTeste } from "./helpers/sessao-mock";

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

const REC_A = "rh-teste-rec-a";
const REC_B = "rh-teste-rec-b";
const REC_SEM = "rh-teste-rec-sem";
const USERS = [REC_A, REC_B, REC_SEM];
const CANDS = ["rh-teste-ana", "rh-teste-beto", "rh-teste-caio"];
const rec = (id: string, extra: Partial<ContaTeste> = {}): ContaTeste => ({ id, perfil: "recrutador", mfaLigado: true, ...extra });

describeDb("GET /api/rh", () => {
  let db: PrismaClient;
  let vagaA = "";

  const pedir = async (conta: ContaTeste | null) => {
    const { GET } = await import("../app/api/rh/route");
    const headers: Record<string, string> = {};
    if (conta) headers.cookie = cookieDeTeste(conta);
    return GET(new NextRequest("https://w2.test/api/rh", { headers }));
  };

  const limpar = async () => {
    const membros = await db.companyMember.findMany({ where: { userId: { in: USERS } }, select: { companyId: true } });
    const ids = membros.map((m) => m.companyId);
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
    const empresaA = (await cadastrarEmpresa(db, REC_A, { nome: "Acme RH", site: null, cnpj: null, emailContato: null })).id;
    const empresaB = (await cadastrarEmpresa(db, REC_B, { nome: "Beta RH", site: null, cnpj: null, emailContato: null })).id;
    const vaga = (companyId: string, titulo: string, dias: number) =>
      db.vacancy.create({ data: { companyId, titulo, status: "ativa", expiresAt: new Date(Date.now() + dias * 864e5) } });
    vagaA = (await vaga(empresaA, "Cloud Pleno", 30)).id;
    await vaga(empresaA, "Dados Sênior", 2);
    const vagaB = (await vaga(empresaB, "Outra", 30)).id;
    for (const id of CANDS) {
      await db.candidateProfile.create({ data: { id, userId: id, nome: id, titulo: "Cloud", email: `${id}@exemplo.com`, localidade: "São Paulo", expiresAt: new Date(Date.now() + 30 * 864e5) } as any });
    }
    const criada = new Date(Date.now() - 10 * 3600e3);
    const app = (candidateId: string, vacancyId: string, companyId: string, extra: Record<string, unknown> = {}) =>
      db.application.create({ data: { candidateId, vacancyId, companyId, origem: "candidaturaLote", proxyThreadId: `rh-teste-${candidateId}-${vacancyId}`, createdAt: criada, ...extra } as any });
    await app(CANDS[0], vagaA, empresaA);
    await app(CANDS[1], vagaA, empresaA, { etapa: "em_analise", etapaEm: new Date(criada.getTime() + 4 * 3600e3), respondidaEm: new Date(criada.getTime() + 4 * 3600e3) });
    // Contato do recrutador não é candidatura.
    await app(CANDS[2], vagaA, empresaA, { origem: "contatoLote" });
    // Candidatura de outra empresa não aparece.
    await app(CANDS[0], vagaB, empresaB);
  });
  afterAll(async () => {
    await limpar();
    await db.$disconnect();
  });

  it("só recrutador logado com autenticador", async () => {
    expect((await pedir(null)).status).toBe(401);
    expect((await pedir({ id: "rh-teste-cand", perfil: "candidato" })).status).toBe(403);
    expect((await pedir(rec(REC_A, { mfaLigado: false }))).status).toBe(403);
  });

  it("sem empresa, pede o cadastro", async () => {
    const r = await pedir(rec(REC_SEM));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ estado: "sem_empresa" });
  });

  it("mostra só a própria empresa, sem contatos de recrutador", async () => {
    const r = await pedir(rec(REC_A));
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    const j = await r.json();
    expect(j.empresa.nome).toBe("Acme RH");
    expect(j.metricas).toEqual({ vagasAtivas: 2, vencendo: 1, candidaturas: 2, novas: 1, respondidas: 1, tempoMedioHoras: 4, taxaResposta: 50 });
    expect(j.vagas.map((v: { titulo: string }) => v.titulo)).toEqual(["Dados Sênior", "Cloud Pleno"]);
    const cloud = j.vagas.find((v: { id: string }) => v.id === vagaA);
    expect([cloud.total, cloud.novas, cloud.porEtapa.em_analise]).toEqual([2, 1, 1]);
    expect(JSON.stringify(j)).not.toMatch(/exemplo\.com/);
  });
});
