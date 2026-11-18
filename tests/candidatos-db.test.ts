/**
 * 2.2b no banco de verdade: filtros da tela Candidatos em SQL, vaga de referência só da própria
 * empresa e lista ordenada pelo match. Só roda num Postgres local.
 */
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

const REC_A = "cand-teste-rec-a";
const REC_B = "cand-teste-rec-b";
const USERS = [REC_A, REC_B];
const IDS = ["cand-teste-ana", "cand-teste-beto", "cand-teste-caio"];
const rec = (id: string): ContaTeste => ({ id, perfil: "recrutador", mfaLigado: true });

function req(url: string, conta: ContaTeste | null) {
  const headers: Record<string, string> = {};
  if (conta) headers.cookie = cookieDeTeste(conta);
  return new NextRequest(`https://w2.test${url}`, { method: "GET", headers });
}

describeDb("tela Candidatos no banco", () => {
  let db: PrismaClient;
  let vagaA = "";
  let vagaB = "";
  const futuro = () => new Date(Date.now() + 30 * 864e5);

  const limpar = async () => {
    const membros = await db.companyMember.findMany({ where: { userId: { in: USERS } }, select: { companyId: true } });
    const ids = membros.map((m) => m.companyId);
    await db.vacancy.deleteMany({ where: { companyId: { in: ids } } });
    await db.companyProfile.deleteMany({ where: { id: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: USERS } } });
    await db.candidateProfile.deleteMany({ where: { id: { in: IDS } } });
  };

  const perfil = (id: string, extra: Record<string, unknown>) =>
    db.candidateProfile.create({
      data: {
        id,
        userId: id,
        nome: id,
        titulo: "Engenharia Cloud",
        email: `${id}@exemplo.com`,
        localidade: "São Paulo",
        expiresAt: futuro(),
        ...extra,
      } as any,
    });

  beforeAll(async () => {
    const { createPrismaClient } = await import("../lib/prisma");
    db = createPrismaClient(process.env.DATABASE_URL!);
    await limpar();
    for (const id of USERS) await db.user.create({ data: { id, name: id, email: `${id}@exemplo.com`, perfil: "recrutador" } });
    const { cadastrarEmpresa } = await import("../lib/empresa");
    const empresaA = (await cadastrarEmpresa(db, REC_A, { nome: "Acme Cand", site: null, cnpj: null, emailContato: null })).id;
    const empresaB = (await cadastrarEmpresa(db, REC_B, { nome: "Beta Cand", site: null, cnpj: null, emailContato: null })).id;
    const vaga = (companyId: string, titulo: string) =>
      db.vacancy.create({
        data: { companyId, titulo, stack: [{ skillId: "aws" }, { skillId: "kubernetes" }] as any, nivel: "Pleno", regime: "PJ", localidade: "Remoto", faixaDe: 10000, faixaAte: 14000, status: "ativa", expiresAt: futuro() },
      });
    vagaA = (await vaga(empresaA, "Cloud Pleno A")).id;
    vagaB = (await vaga(empresaB, "Cloud Pleno B")).id;

    await perfil(IDS[0], {
      senioridade: "pleno", modo: "remoto", regimePreferido: ["PJ"], disponibilidade: "30d",
      stack: [{ skillId: "aws", anos: 5 }, { skillId: "openshift", anos: 2 }],
      pretensoes: [{ regime: "PJ", valor: 12000, unidade: "mes", moeda: "BRL" }],
      idiomas: [{ idioma: "Inglês", nivel: "fluente" }],
    });
    await perfil(IDS[1], {
      senioridade: "senior", modo: "presencial", regimePreferido: ["CLT"], disponibilidade: "90d",
      stack: [{ skillId: "cobol", anos: 9 }],
      idiomas: [{ idioma: "Español", nivel: "nativo" }],
    });
    await perfil(IDS[2], {
      senioridade: "pleno", modo: "remoto", regimePreferido: ["PJ"],
      stack: [{ skillId: "aws", anos: 3 }, { skillId: "kubernetes", anos: 3 }],
      idiomas: [{ idioma: "English", nivel: "basico" }],
    });
    await db.$executeRawUnsafe(`UPDATE "CandidateProfile" SET "updatedAt" = now() - interval '60 days' WHERE id = $1`, IDS[1]);
  });
  afterAll(async () => {
    await limpar();
    await db.$disconnect();
  });

  const busca = async (qs: string, conta: ContaTeste | null = rec(REC_A)) => {
    const { GET } = await import("../app/api/search/candidates/route");
    const res = await GET(req(`/api/search/candidates?pageSize=20&${qs}`, conta));
    const body = await res.json();
    return { status: res.status, body, ids: (body.items ?? []).map((i: any) => i.id).filter((id: string) => IDS.includes(id)) };
  };

  it("filtros em SQL", async () => {
    expect((await busca("skills=aws")).ids.sort()).toEqual([IDS[0], IDS[2]]);
    expect((await busca("skills=aws,kubernetes")).ids).toEqual([IDS[2]]);
    expect((await busca("senioridade=senior")).ids).toEqual([IDS[1]]);
    expect((await busca("idioma=en")).ids.sort()).toEqual([IDS[0], IDS[2]]);
    expect((await busca("idioma=en&idiomaNivel=avancado")).ids).toEqual([IDS[0]]);
    expect((await busca("idioma=es")).ids).toEqual([IDS[1]]);
    // Quem não informou a disponibilidade continua aparecendo.
    expect((await busca("disponibilidade=30d")).ids.sort()).toEqual([IDS[0], IDS[2]]);
    expect((await busca("atualizada=30")).ids.sort()).toEqual([IDS[0], IDS[2]]);
    expect((await busca("modo=presencial")).ids).toEqual([IDS[1]]);
  });

  it("vaga de referência: ordena pelo match, explica e não mostra contatos", async () => {
    const r = await busca(`vaga=${vagaA}&skills=aws`);
    expect(r.status).toBe(200);
    expect(r.body.vaga).toEqual({ id: vagaA, titulo: "Cloud Pleno A" });
    expect(r.ids).toEqual([IDS[2], IDS[0]]);
    const ana = r.body.items.find((i: any) => i.id === IDS[0]);
    expect(ana.gaps).toEqual([{ kind: "skill", skill: "kubernetes", proxima: "openshift" }]);
    expect(ana.email).toBeUndefined();
    expect(typeof ana.match).toBe("number");
  });

  it("vaga de outra empresa não serve de referência", async () => {
    expect((await busca(`vaga=${vagaB}`)).status).toBe(404);
    expect((await busca(`vaga=nao-existe`)).status).toBe(404);
  });

  it("lista de vagas do 'Para a vaga': só as ativas da própria empresa", async () => {
    const { GET } = await import("../app/api/conta/empresa/vagas/route");
    const res = await GET(req("/api/conta/empresa/vagas", rec(REC_A)));
    const body = await res.json();
    expect(body.vagas.map((v: any) => v.id)).toEqual([vagaA]);
    expect((await GET(req("/api/conta/empresa/vagas", null))).status).toBe(401);
  });

  it("candidato não busca candidatos", async () => {
    expect((await busca("skills=aws", { id: "x", perfil: "candidato" })).status).toBe(403);
  });
});
