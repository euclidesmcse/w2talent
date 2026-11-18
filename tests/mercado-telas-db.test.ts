/**
 * 3.2b no banco de verdade: os números do mercado no /painel (GET /api/painel/mercado), no Publicar
 * (POST /api/vacancies/conferir) e no Painel RH (GET /api/rh). As linhas de MarketStat entram direto,
 * numa semana no futuro (a "última" lida pelas telas), e saem no fim. Só roda num Postgres local.
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

const SEMANA = new Date("2099-01-05T00:00:00Z"); // segunda-feira
const REC = "mkt32b-rec";
const REC_SEM = "mkt32b-rec-sem";
const CAND = "mkt32b-cand";
const CAND_POUCOS = "mkt32b-cand-poucos";
const CAND_SEM = "mkt32b-cand-sem";
const USERS = [REC, REC_SEM];
const PERFIS = [CAND, CAND_POUCOS];

const rec = (id: string): ContaTeste => ({ id, perfil: "recrutador", mfaLigado: true });
const cand = (id: string): ContaTeste => ({ id });

function req(url: string, method: string, conta: ContaTeste | null, body?: unknown) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (conta) headers.cookie = cookieDeTeste(conta);
  return new NextRequest(`https://w2.test${url}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

type Linha = { metrica: string; skillId: string; nivel?: string; regime?: string; n: number; nEmpresas?: number | null; p?: [number, number, number] | null; nRecentes?: number; nAnteriores?: number };
const linha = (l: Linha) => ({
  semana: SEMANA,
  metrica: l.metrica,
  skillId: l.skillId,
  nivel: l.nivel ?? "",
  regime: l.regime ?? "",
  modo: "",
  moeda: l.nivel ? "BRL" : "",
  n: l.n,
  nEmpresas: l.nEmpresas ?? null,
  nRecentes: l.nRecentes ?? null,
  nAnteriores: l.nAnteriores ?? null,
  p25: l.p?.[0] ?? null,
  p50: l.p?.[1] ?? null,
  p75: l.p?.[2] ?? null,
});

describeDb("mercado nas telas logadas (3.2b)", () => {
  let db: PrismaClient;
  let empresa = "";
  const vagaIds: Record<string, string> = {};

  const limpar = async () => {
    const membros = await db.companyMember.findMany({ where: { userId: { in: USERS } }, select: { companyId: true } });
    const ids = membros.map((m) => m.companyId);
    await db.vacancy.deleteMany({ where: { companyId: { in: ids } } });
    await db.companyProfile.deleteMany({ where: { id: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: USERS } } });
    await db.candidateProfile.deleteMany({ where: { userId: { in: PERFIS } } });
    await db.marketStat.deleteMany({ where: { semana: SEMANA } });
    await db.$executeRawUnsafe(`DELETE FROM "UsoDiario"`).catch(() => 0);
  };

  beforeAll(async () => {
    const { createPrismaClient } = await import("../lib/prisma");
    db = createPrismaClient(process.env.DATABASE_URL!);
    await limpar();
    await db.marketStat.createMany({
      data: [
        // AWS Pleno CLT: publicável. Faixa típica das vagas = 10.000 a 14.000 (mediana 12.000).
        linha({ metrica: "faixa_de", skillId: "aws", nivel: "pleno", regime: "CLT", n: 12, nEmpresas: 3, p: [9000, 10000, 11000] }),
        linha({ metrica: "faixa_ate", skillId: "aws", nivel: "pleno", regime: "CLT", n: 12, nEmpresas: 3, p: [13000, 14000, 15000] }),
        linha({ metrica: "pretensao", skillId: "aws", nivel: "pleno", regime: "CLT", n: 11, p: [9500, 12000, 13500] }),
        // Go Pleno CLT: abaixo do mínimo, só contagens.
        linha({ metrica: "faixa_de", skillId: "go", nivel: "pleno", regime: "CLT", n: 4, nEmpresas: 2 }),
        linha({ metrica: "faixa_ate", skillId: "go", nivel: "pleno", regime: "CLT", n: 4, nEmpresas: 2 }),
        linha({ metrica: "pretensao", skillId: "go", nivel: "pleno", regime: "CLT", n: 9 }),
        // Em alta.
        linha({ metrica: "demanda", skillId: "kubernetes", n: 8, nEmpresas: 3, nRecentes: 7, nAnteriores: 1 }),
        linha({ metrica: "demanda", skillId: "aws", n: 20, nEmpresas: 5, nRecentes: 9, nAnteriores: 4 }),
      ],
    });
    for (const id of USERS) await db.user.create({ data: { id, name: id, email: `${id}@exemplo.com`, perfil: "recrutador" } });
    const { cadastrarEmpresa } = await import("../lib/empresa");
    empresa = (await cadastrarEmpresa(db, REC, { nome: "Acme 3.2b", site: null, cnpj: null, emailContato: null })).id;
    const futuro = new Date(Date.now() + 10 * 864e5);
    const vaga = async (nome: string, extra: Record<string, unknown>) => {
      vagaIds[nome] = (
        await db.vacancy.create({ data: { companyId: empresa, titulo: `3.2b ${nome}`, stack: [{ skillId: "aws" }, { skillId: "terraform" }], nivel: "Pleno", regime: "CLT", status: "ativa", expiresAt: futuro, ...extra } as any })
      ).id;
    };
    await vaga("abaixo", { faixaDe: 7000, faixaAte: 9000 });
    await vaga("dentro", { faixaDe: 11000, faixaAte: 13000 });
    await vaga("acima", { faixaDe: 18000, faixaAte: 22000 });
    await vaga("so-ate", { faixaAte: 9500 });
    await vaga("sem-faixa", {});
    await vaga("poucos", { stack: [{ skillId: "go" }], faixaDe: 7000, faixaAte: 9000 });
    await vaga("senior", { nivel: "Sênior", faixaDe: 7000, faixaAte: 9000 });
    await vaga("arquivada", { status: "arquivada", faixaDe: 7000, faixaAte: 9000 });

    const perfil = (userId: string, stack: string[], pretensoes: unknown[]) =>
      db.candidateProfile.create({
        data: { userId, nome: userId, titulo: "Cloud", email: `${userId}@exemplo.com`, senioridade: "pleno", stack: stack.map((skillId) => ({ skillId })), pretensoes: pretensoes as any, status: "ativo", expiresAt: futuro } as any,
      });
    await perfil(CAND, ["go", "aws", "kubernetes"], [
      { regime: "CLT", valor: 15000, unidade: "mes", moeda: "BRL" },
      { regime: "PJ", valor: 9000, unidade: "mes", moeda: "BRL" },
    ]);
    await perfil(CAND_POUCOS, ["go"], [{ regime: "CLT", valor: 8000, unidade: "mes", moeda: "BRL" }]);
  });
  afterAll(async () => {
    await limpar();
    await db.$disconnect();
  });

  describe("GET /api/painel/mercado", () => {
    const pedir = async (c: ContaTeste | null) => {
      const { GET } = await import("../app/api/painel/mercado/route");
      return GET(req("/api/painel/mercado", "GET", c));
    };

    it("sem login 401; recrutador 403", async () => {
      expect((await pedir(null)).status).toBe(401);
      expect((await pedir(rec(REC))).status).toBe(403);
    });

    it("candidato sem ficha publicada recebe sem_ficha", async () => {
      const r = await pedir(cand(CAND_SEM));
      expect(r.status).toBe(200);
      expect(r.headers.get("cache-control")).toBe("no-store");
      expect(await r.json()).toEqual({ estado: "sem_ficha" });
    });

    it("compara a pretensão com a faixa da primeira competência publicável e marca as em alta que a ficha tem", async () => {
      const j = await (await pedir(cand(CAND))).json();
      expect(j.estado).toBe("ok");
      expect(j.semana).toBe("2099-01-05");
      // Go vem antes no stack, mas o grupo dela não tem números: a principal é AWS. O PJ não tem grupo.
      expect(j.principal).toEqual({
        skillId: "aws",
        label: "AWS",
        nivel: "pleno",
        comparacoes: [{ regime: "CLT", moeda: "BRL", valor: 15000, faixa: { de: 10000, ate: 14000, mediana: 12000 }, posicao: "acima" }],
      });
      expect(j.semPretensao).toBe(false);
      expect(j.emAlta.map((s: { skillId: string; tem: boolean }) => [s.skillId, s.tem])).toEqual(
        expect.arrayContaining([
          ["kubernetes", true],
          ["aws", true],
        ]),
      );
    });

    it("sem grupo publicável: principal null (a tela mostra Ainda poucos dados)", async () => {
      const j = await (await pedir(cand(CAND_POUCOS))).json();
      expect(j.estado).toBe("ok");
      expect(j.principal).toBeNull();
      expect(j.semPretensao).toBe(false);
    });
  });

  describe("POST /api/vacancies/conferir (mercado do rascunho)", () => {
    const conferir = async (rascunho: unknown) => {
      const { POST } = await import("../app/api/vacancies/conferir/route");
      return (await POST(req("/api/vacancies/conferir", "POST", rec(REC), { rascunho }))).json();
    };

    it("faixa das vagas e pretensão agregada do grupo da primeira competência", async () => {
      const j = await conferir({ titulo: "Engenheira de Plataforma", stack: ["aws", "terraform"], nivel: "Pleno", regime: "CLT" });
      expect(j.mercado).toEqual({
        skillId: "aws",
        label: "AWS",
        nivel: "pleno",
        regime: "CLT",
        moeda: "BRL",
        vagas: { de: 10000, ate: 14000, mediana: 12000, n: 12 },
        pretensao: { de: 9500, ate: 13500, mediana: 12000, n: 11 },
      });
      // Nunca a pretensão de alguém: só a faixa agregada.
      expect(JSON.stringify(j)).not.toContain("15000");
    });

    it("grupo abaixo do mínimo: sem números (vagas e pretensão null)", async () => {
      const j = await conferir({ titulo: "Dev Go", stack: ["go"], nivel: "Pleno", regime: "CLT" });
      expect(j.mercado).toMatchObject({ skillId: "go", vagas: null, pretensao: null });
    });

    it("sem nível, regime ou competência: sem mercado", async () => {
      expect((await conferir({ titulo: "Dev", stack: ["aws"], nivel: "", regime: "CLT" })).mercado).toBeNull();
      expect((await conferir({ titulo: "Dev", stack: ["aws"], nivel: "Pleno", regime: "" })).mercado).toBeNull();
      expect((await conferir({ titulo: "Dev", stack: [], nivel: "Pleno", regime: "CLT" })).mercado).toBeNull();
    });
  });

  describe("GET /api/rh (etiqueta do mercado)", () => {
    it("abaixo / dentro / acima pelo meio da faixa; nada sem grupo publicável, sem faixa ou fora do ar", async () => {
      const { GET } = await import("../app/api/rh/route");
      const r = await GET(req("/api/rh", "GET", rec(REC)));
      expect(r.status).toBe(200);
      const j = await r.json();
      const por = Object.fromEntries((j.vagas as { id: string; mercado: unknown }[]).map((v) => [v.id, v.mercado]));
      const faixa = { de: 10000, ate: 14000, mediana: 12000 };
      expect(por[vagaIds.abaixo]).toEqual({ posicao: "abaixo", faixa, moeda: "BRL" });
      expect(por[vagaIds.dentro]).toEqual({ posicao: "dentro", faixa, moeda: "BRL" });
      expect(por[vagaIds.acima]).toEqual({ posicao: "acima", faixa, moeda: "BRL" });
      expect(por[vagaIds["so-ate"]]).toEqual({ posicao: "abaixo", faixa, moeda: "BRL" });
      for (const nome of ["sem-faixa", "poucos", "senior", "arquivada"]) expect(por[vagaIds[nome]]).toBeNull();
    });

    it("recrutador sem empresa continua sem_empresa", async () => {
      const { GET } = await import("../app/api/rh/route");
      const j = await (await GET(req("/api/rh", "GET", rec(REC_SEM)))).json();
      expect(j.estado).toBe("sem_empresa");
    });
  });
});
