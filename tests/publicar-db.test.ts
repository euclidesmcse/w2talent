/**
 * 2.1b no banco de verdade: ler o texto da vaga, conferir duplicada e faixa, atualizar a existente.
 * Só roda num Postgres local. Sem IA: a leitura cai nas regras e a conferência não tem vetor.
 */
import type { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { cookieDeTeste, type ContaTeste } from "./helpers/sessao-mock";

jest.mock("../lib/sessao", () => require("./helpers/sessao-mock").sessaoMock());
jest.mock("../lib/background", () => ({ runInBackground: () => undefined }));
jest.mock("../lib/ai", () => ({
  getAiRouter: () => {
    throw new Error("sem IA no teste");
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

const REC_A = "pub-teste-rec-a";
const REC_B = "pub-teste-rec-b";
const REC_SEM = "pub-teste-rec-sem";
const CAND = "pub-teste-cand";
const USERS = [REC_A, REC_B, REC_SEM, CAND];
const OUTRA = "pub-teste-outra";

const rec = (id: string): ContaTeste => ({ id, perfil: "recrutador", mfaLigado: true });

function req(url: string, method: string, conta: ContaTeste | null, body?: unknown) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (conta) headers.cookie = cookieDeTeste(conta);
  return new NextRequest(`https://w2.test${url}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

const TEXTO = `Analista Cloud Pleno
Regime CLT, remoto.
Salário: R$ 9.000 a R$ 13.000
Requisitos:
- AWS e Terraform no dia a dia
Benefícios:
- Plano de saúde`;

describeDb("publicar vaga", () => {
  let db: PrismaClient;
  let empresaA = "";
  let empresaB = "";
  const futuro = () => new Date(Date.now() + 7 * 864e5);

  const limpar = async () => {
    const membros = await db.companyMember.findMany({ where: { userId: { in: USERS } }, select: { companyId: true } });
    const ids = [...membros.map((m) => m.companyId), OUTRA];
    await db.vacancy.deleteMany({ where: { companyId: { in: ids } } });
    await db.companyProfile.deleteMany({ where: { id: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: USERS } } });
    await db.$executeRawUnsafe(`DELETE FROM "UsoDiario"`).catch(() => 0);
  };

  beforeAll(async () => {
    const { createPrismaClient } = await import("../lib/prisma");
    db = createPrismaClient(process.env.DATABASE_URL!);
    await limpar();
    for (const id of USERS) await db.user.create({ data: { id, name: id, email: `${id}@exemplo.com`, perfil: id === CAND ? "candidato" : "recrutador" } });
    const { cadastrarEmpresa } = await import("../lib/empresa");
    empresaA = (await cadastrarEmpresa(db, REC_A, { nome: "Acme Pub", site: null, cnpj: null, emailContato: null })).id;
    empresaB = (await cadastrarEmpresa(db, REC_B, { nome: "Beta Pub", site: null, cnpj: null, emailContato: null })).id;
    await db.companyProfile.create({ data: { id: OUTRA, nome: "Outra Pub", validacaoStatus: "validado" } });
  });
  afterAll(async () => {
    await limpar();
    await db.$disconnect();
  });

  it("ler: só recrutador com empresa; sem IA, lê pelas regras", async () => {
    const { POST } = await import("../app/api/vacancies/ler/route");
    expect((await POST(req("/api/vacancies/ler", "POST", null, { texto: TEXTO }))).status).toBe(401);
    expect((await POST(req("/api/vacancies/ler", "POST", { id: CAND, perfil: "candidato", mfaLigado: true }, { texto: TEXTO }))).status).toBe(403);
    const sem = await POST(req("/api/vacancies/ler", "POST", rec(REC_SEM), { texto: TEXTO }));
    expect(sem.status).toBe(409);
    expect(await sem.json()).toEqual({ error: "sem_empresa" });
    const curto = await POST(req("/api/vacancies/ler", "POST", rec(REC_A), { texto: "curto" }));
    expect(curto.status).toBe(422);

    const ok = await POST(req("/api/vacancies/ler", "POST", rec(REC_A), { texto: TEXTO }));
    expect(ok.status).toBe(200);
    const j = await ok.json();
    expect(j.origem).toBe("regras");
    expect(j.vaga).toMatchObject({ titulo: "Analista Cloud Pleno", nivel: "Pleno", regime: "CLT", modo: "remoto", faixaDe: 9000, faixaAte: 13000 });
    expect(j.vaga.stack).toEqual(expect.arrayContaining(["aws", "terraform"]));
  });

  it("ler: recusa pedido de outro site", async () => {
    const { POST } = await import("../app/api/vacancies/ler/route");
    const r = new NextRequest("https://w2.test/api/vacancies/ler", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://mal.example", cookie: cookieDeTeste(rec(REC_A)) },
      body: JSON.stringify({ texto: TEXTO }),
    });
    expect((await POST(r)).status).toBe(403);
  });

  it("conferir: avisa duplicada só da mesma empresa e ignora a vaga em edição", async () => {
    const existente = await db.vacancy.create({
      data: { companyId: empresaA, titulo: "Analista de Cloud Pleno", stack: [{ skillId: "aws" }], expiresAt: futuro(), status: "ativa" },
    });
    await db.vacancy.create({ data: { companyId: empresaA, titulo: "Analista Cloud Pleno (arquivada)", stack: [], expiresAt: futuro(), status: "arquivada" } });
    const { POST } = await import("../app/api/vacancies/conferir/route");
    const rascunho = { titulo: "Analista Cloud Pleno", stack: ["aws", "terraform"], nivel: "Pleno", regime: "CLT" };

    const a = await (await POST(req("/api/vacancies/conferir", "POST", rec(REC_A), { rascunho }))).json();
    expect(a.duplicadas.map((d: { id: string }) => d.id)).toEqual([existente.id]);

    // Outra empresa não vê a vaga da Acme como duplicada (nem pedindo a companyId dela).
    const b = await (await POST(req("/api/vacancies/conferir", "POST", rec(REC_B), { rascunho, companyId: empresaA }))).json();
    expect(b.duplicadas).toEqual([]);

    const editando = await (await POST(req("/api/vacancies/conferir", "POST", rec(REC_A), { rascunho, ignorarId: existente.id }))).json();
    expect(editando.duplicadas).toEqual([]);
  });

  it("conferir: faixa sugerida só com 5 ou mais vagas parecidas do mesmo nível e regime", async () => {
    const { POST } = await import("../app/api/vacancies/conferir/route");
    const faixas = [
      [8000, 12000],
      [9000, 13000],
      [10000, 14000],
      [11000, 15000],
    ];
    for (const [de, ate] of faixas) {
      await db.vacancy.create({
        data: { companyId: OUTRA, titulo: "Cloud", stack: [{ skillId: "aws" }, { skillId: "terraform" }], nivel: "Pleno", regime: "CLT", faixaDe: de, faixaAte: ate, expiresAt: futuro() },
      });
    }
    // Outro nível e outro regime não entram na base.
    await db.vacancy.create({ data: { companyId: OUTRA, titulo: "Cloud", stack: [{ skillId: "aws" }, { skillId: "terraform" }], nivel: "Sênior", regime: "CLT", faixaDe: 20000, faixaAte: 30000, expiresAt: futuro() } });
    await db.vacancy.create({ data: { companyId: OUTRA, titulo: "Cloud", stack: [{ skillId: "aws" }, { skillId: "terraform" }], nivel: "Pleno", regime: "PJ", faixaDe: 20000, faixaAte: 30000, expiresAt: futuro() } });
    const rascunho = { titulo: "Engenheira de Plataforma", stack: ["aws", "terraform"], nivel: "Pleno", regime: "CLT" };

    const poucas = await (await POST(req("/api/vacancies/conferir", "POST", rec(REC_B), { rascunho }))).json();
    expect(poucas.faixa).toBeNull();

    await db.vacancy.create({
      data: { companyId: OUTRA, titulo: "Cloud", stack: [{ skillId: "aws" }, { skillId: "terraform" }], nivel: "Pleno", regime: "CLT", faixaDe: 12000, faixaAte: 18000, expiresAt: futuro() },
    });
    const cinco = await (await POST(req("/api/vacancies/conferir", "POST", rec(REC_B), { rascunho }))).json();
    expect(cinco.faixa).toEqual({ de: 10000, ate: 14000, base: 5, moeda: "BRL" });

    const senior = await (await POST(req("/api/vacancies/conferir", "POST", rec(REC_B), { rascunho: { ...rascunho, nivel: "Sênior" } }))).json();
    expect(senior.faixa).toBeNull();

    // Sem nível ou sem regime não sugere (misturaria Pleno com Sênior, CLT com PJ).
    for (const parcial of [{ ...rascunho, nivel: "" }, { ...rascunho, regime: "" }]) {
      const r = await (await POST(req("/api/vacancies/conferir", "POST", rec(REC_B), { rascunho: parcial }))).json();
      expect(r.faixa).toBeNull();
    }
  });

  it("conferir com vetor: a consulta pelo vetor roda e, sem vagas com vetor, cai nas competências", async () => {
    const { conferirVaga } = await import("../lib/vaga-conferir");
    const { rascunhoVazio } = await import("../lib/vaga-campos");
    const vetor = Array.from({ length: 1024 }, (_, i) => (i % 7) / 7);
    // Título bem diferente, mas o mesmo vetor: só a consulta pelo vetor acha.
    const outra = await db.vacancy.create({ data: { companyId: empresaA, titulo: "Plataforma Interna", stack: [], expiresAt: futuro() } });
    await db.$executeRawUnsafe(`UPDATE "Vacancy" SET embedding = $1::vector WHERE id = $2`, `[${vetor.join(",")}]`, outra.id);
    const r = await conferirVaga(
      db,
      { companyId: empresaA, rascunho: { ...rascunhoVazio(), titulo: "Analista Cloud Pleno", stack: ["aws", "terraform"], nivel: "Pleno", regime: "CLT" } },
      { embed: async (texts) => texts.map(() => vetor) },
    );
    expect(r.duplicadas.map((d) => d.titulo).sort()).toEqual(["Analista de Cloud Pleno", "Plataforma Interna"]);
    expect(r.faixa).toEqual({ de: 10000, ate: 14000, base: 5, moeda: "BRL" });
  });

  it("atualizar a existente: PUT troca os campos e null tira a faixa", async () => {
    const v = await db.vacancy.create({
      data: { companyId: empresaA, titulo: "Vaga antiga", stack: [], nivel: "Júnior", faixaDe: 5000, faixaAte: 7000, expiresAt: futuro() },
    });
    const { PUT } = await import("../app/api/vacancies/[id]/route");
    const r = await PUT(
      req(`/api/vacancies/${v.id}`, "PUT", rec(REC_A), { titulo: "Vaga nova", nivel: "Pleno", faixaDe: null, faixaAte: null, localidade: "Remoto", stack: ["aws"] }),
      { params: Promise.resolve({ id: v.id }) },
    );
    expect(r.status).toBe(200);
    const depois = await db.vacancy.findUniqueOrThrow({ where: { id: v.id } });
    expect(depois).toMatchObject({ titulo: "Vaga nova", nivel: "Pleno", faixaDe: null, faixaAte: null, localidade: "Remoto", stack: [{ skillId: "aws" }] });
  });
});
