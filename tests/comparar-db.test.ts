/** 2.3a Comparar candidatos no banco de verdade. Só roda num Postgres local. */
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

const REC_A = "cmp-teste-rec-a";
const REC_B = "cmp-teste-rec-b";
const USERS = [REC_A, REC_B];
const IDS = ["cmp-teste-ana", "cmp-teste-beto", "cmp-teste-arquivada", "cmp-teste-vencida"];
const rec = (id: string, extra: Partial<ContaTeste> = {}): ContaTeste => ({ id, perfil: "recrutador", mfaLigado: true, ...extra });

describeDb("POST /api/candidates/comparar", () => {
  let db: PrismaClient;
  let vagaA = "";
  let vagaB = "";
  const futuro = () => new Date(Date.now() + 30 * 864e5);

  const pedir = async (conta: ContaTeste | null, body: unknown) => {
    const { POST } = await import("../app/api/candidates/comparar/route");
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (conta) headers.cookie = cookieDeTeste(conta);
    return POST(new NextRequest("https://w2.test/api/candidates/comparar", { method: "POST", headers, body: JSON.stringify(body) }));
  };

  const limpar = async () => {
    const membros = await db.companyMember.findMany({ where: { userId: { in: USERS } }, select: { companyId: true } });
    const ids = membros.map((m) => m.companyId);
    await db.vacancy.deleteMany({ where: { companyId: { in: ids } } });
    await db.companyProfile.deleteMany({ where: { id: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: USERS } } });
    await db.candidateProfile.deleteMany({ where: { id: { in: IDS } } });
  };

  beforeAll(async () => {
    const { createPrismaClient } = await import("../lib/prisma");
    db = createPrismaClient(process.env.DATABASE_URL!);
    await limpar();
    for (const id of USERS) await db.user.create({ data: { id, name: id, email: `${id}@exemplo.com`, perfil: "recrutador" } });
    const { cadastrarEmpresa } = await import("../lib/empresa");
    const empresaA = (await cadastrarEmpresa(db, REC_A, { nome: "Acme Cmp", site: null, cnpj: null, emailContato: null })).id;
    const empresaB = (await cadastrarEmpresa(db, REC_B, { nome: "Beta Cmp", site: null, cnpj: null, emailContato: null })).id;
    const vaga = (companyId: string) =>
      db.vacancy.create({ data: { companyId, titulo: "Cloud Pleno", stack: [{ skillId: "aws" }, { skillId: "kubernetes" }] as any, nivel: "Pleno", regime: "PJ", localidade: "Remoto", status: "ativa", expiresAt: futuro() } });
    vagaA = (await vaga(empresaA)).id;
    vagaB = (await vaga(empresaB)).id;
    const perfil = (id: string, extra: Record<string, unknown>) =>
      db.candidateProfile.create({
        data: { id, userId: id, nome: id, titulo: "Engenharia Cloud", email: `${id}@exemplo.com`, celular: "+5511988887777", localidade: "São Paulo", expiresAt: futuro(), ...extra } as any,
      });
    await perfil(IDS[0], { stack: [{ skillId: "aws", anos: 4 }, { skillId: "kubernetes", anos: 2 }], senioridade: "pleno", regimePreferido: ["PJ"], modo: "remoto" });
    await perfil(IDS[1], { stack: [{ skillId: "aws", anos: 1 }], senioridade: "junior", regimePreferido: ["CLT"] });
    await perfil(IDS[2], { status: "arquivado" });
    // Vencido, mas a higiene ainda não arquivou.
    await perfil(IDS[3], { expiresAt: new Date(Date.now() - 864e5) });
  });
  afterAll(async () => {
    await limpar();
    await db.$disconnect();
  });

  it("só recrutador logado com autenticador", async () => {
    expect((await pedir(null, { ids: [IDS[0]] })).status).toBe(401);
    expect((await pedir({ id: "cmp-teste-cand", perfil: "candidato" }, { ids: [IDS[0]] })).status).toBe(403);
    expect((await pedir(rec(REC_A, { mfaLigado: false }), { ids: [IDS[0]] })).status).toBe(403);
  });

  it("recusa lista vazia ou com mais de 10", async () => {
    expect((await pedir(rec(REC_A), { ids: [] })).status).toBe(422);
    expect((await pedir(rec(REC_A), { ids: Array.from({ length: 11 }, (_, i) => `x${i}`) })).status).toBe(422);
  });

  it("devolve na ordem pedida, sem arquivados e sem contato completo", async () => {
    const r = await pedir(rec(REC_A), { ids: [IDS[1], IDS[2], IDS[0], IDS[3]] });
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    const j = await r.json();
    expect(j.itens.map((i: { id: string }) => i.id)).toEqual([IDS[1], IDS[0]]);
    expect(j.fora).toEqual([IDS[2], IDS[3]]);
    expect(j.vaga).toBeNull();
    expect(j.itens[0].match).toBeNull();
    const texto = JSON.stringify(j);
    expect(texto).not.toContain("@exemplo.com");
    expect(texto).not.toContain("988887777");
  });

  it("com vaga da própria empresa traz o match; vaga de outra empresa dá 404", async () => {
    const r = await pedir(rec(REC_A), { ids: [IDS[0], IDS[1]], vaga: vagaA });
    const j = await r.json();
    expect(j.vaga).toEqual({ id: vagaA, titulo: "Cloud Pleno" });
    expect(j.itens[0].match).toBeGreaterThan(j.itens[1].match);
    expect(j.itens[1].gaps).toContainEqual({ kind: "skill", skill: "kubernetes" });
    expect((await pedir(rec(REC_A), { ids: [IDS[0]], vaga: vagaB })).status).toBe(404);
  });

  it("2.3b: exportar grava um sinal por candidato ativo, sem conteúdo da ficha", async () => {
    const { POST } = await import("../app/api/candidates/exportou/route");
    const exportou = (conta: ContaTeste | null, body: unknown) =>
      POST(new NextRequest("https://w2.test/api/candidates/exportou", { method: "POST", headers: { "content-type": "application/json", ...(conta ? { cookie: cookieDeTeste(conta) } : {}) }, body: JSON.stringify(body) }));
    expect((await exportou(null, { ids: [IDS[0]], formato: "csv" })).status).toBe(401);
    expect((await exportou(rec(REC_A), { ids: [IDS[0]], formato: "docx" })).status).toBe(422);
    await db.feedbackSignal.deleteMany({ where: { candidateId: { in: IDS }, tipo: "exportou" } });
    const r = await exportou(rec(REC_A), { ids: [IDS[0], IDS[1], IDS[2]], vaga: vagaA, formato: "xlsx" });
    expect(await r.json()).toEqual({ ok: true, sinais: 2 });
    // Vaga de outra empresa não entra no sinal.
    await exportou(rec(REC_A), { ids: [IDS[0]], vaga: vagaB, formato: "pdf" });
    const sinais = await db.feedbackSignal.findMany({ where: { candidateId: { in: IDS }, tipo: "exportou" }, orderBy: { createdAt: "asc" } });
    expect(sinais.map((s) => [s.candidateId, s.vacancyId, s.ator, s.dados])).toEqual(
      expect.arrayContaining([
        [IDS[0], vagaA, "recrutador", { formato: "xlsx" }],
        [IDS[1], vagaA, "recrutador", { formato: "xlsx" }],
        [IDS[0], null, "recrutador", { formato: "pdf" }],
      ]),
    );
    expect(sinais).toHaveLength(3);
  });
});
