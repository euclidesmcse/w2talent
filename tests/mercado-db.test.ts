/** 3.2a Inteligência de mercado no banco de verdade: grava a semana, deixa de fora os exemplos e lê. Só num Postgres local. */
import type { PrismaClient } from "@prisma/client";

function localDb(url: string | undefined): boolean {
  try {
    return !!url && ["localhost", "127.0.0.1"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}
const describeDb = localDb(process.env.DATABASE_URL) ? describe : describe.skip;

const SKILL = "mercado-teste-skill";
const EMPRESAS = ["mkt-teste-a", "mkt-teste-b", "mkt-teste-c"];
const FICHA = "mkt-teste-ficha-";

describeDb("mercado (3.2a)", () => {
  let db: PrismaClient;
  const futuro = new Date(Date.now() + 30 * 864e5);

  const limpar = async () => {
    await db.vacancy.deleteMany({ where: { companyId: { in: [...EMPRESAS, "demo-company"] }, titulo: { startsWith: "MKT" } } });
    await db.companyProfile.deleteMany({ where: { id: { in: EMPRESAS } } });
    await db.candidateProfile.deleteMany({ where: { OR: [{ userId: { startsWith: FICHA } }, { userId: { startsWith: "demo-mkt" } }] } });
    await db.marketStat.deleteMany({});
  };

  beforeAll(async () => {
    const { createPrismaClient } = await import("../lib/prisma");
    db = createPrismaClient(process.env.DATABASE_URL!);
    await limpar();
    await db.companyProfile.upsert({ where: { id: "demo-company" }, create: { id: "demo-company", nome: "Demo", validacaoStatus: "validado" }, update: {} });
    for (const id of EMPRESAS) await db.companyProfile.create({ data: { id, nome: id, validacaoStatus: id.endsWith("c") ? "pendente" : "validado" } });
    const base = { stack: [{ skillId: SKILL }] as any, nivel: "Sênior", regime: "PJ", localidade: "Remoto", faixaMoeda: "BRL", status: "ativa" as const, expiresAt: futuro };
    for (let i = 0; i < 12; i++) {
      await db.vacancy.create({ data: { ...base, titulo: `MKT ${i}`, companyId: EMPRESAS[i % 3], faixaDe: 10000 + i * 500, faixaAte: 15000 + i * 500 } });
    }
    // Exemplos com faixa absurda: se entrassem, mudariam a mediana.
    for (let i = 0; i < 5; i++) {
      await db.vacancy.create({ data: { ...base, titulo: `MKT demo ${i}`, companyId: "demo-company", faixaDe: 900000, faixaAte: 990000 } });
    }
    for (let i = 0; i < 10; i++) {
      await db.candidateProfile.create({
        data: { userId: `${FICHA}${i}`, nome: "X", titulo: "Y", email: `${FICHA}${i}@exemplo.com`, senioridade: "senior", stack: [{ skillId: SKILL }], pretensoes: [{ regime: "PJ", valor: 12000 + i * 1000, unidade: "mes", moeda: "BRL" }], status: "ativo", expiresAt: futuro },
      });
    }
    await db.candidateProfile.create({
      data: { userId: "demo-mkt-1", nome: "X", titulo: "Y", email: "demo-mkt-1@exemplo.com", senioridade: "senior", stack: [{ skillId: SKILL }], pretensoes: [{ regime: "PJ", valor: 1, unidade: "mes", moeda: "BRL" }], status: "ativo", expiresAt: futuro },
    });
  });
  afterAll(async () => {
    await limpar();
    await db.$disconnect();
  });

  it("calcula a semana sem os exemplos e a tela lê a competência", async () => {
    const { atualizarMercado, lerMercado } = await import("../lib/mercado");
    const r = await atualizarMercado(db);
    expect(r.publicaveis).toBeGreaterThan(0);
    // Rodar de novo no mesmo dia troca a foto da semana, sem duplicar.
    await atualizarMercado(db);
    expect(await db.marketStat.count({ where: { metrica: "demanda", skillId: SKILL } })).toBe(1);

    const v = await lerMercado(db, { skillId: SKILL });
    const g = v.faixas.find((f) => f.nivel === "senior" && f.regime === "PJ" && f.moeda === "BRL")!;
    expect(g).toMatchObject({ n: 12, nEmpresas: 3 });
    expect(g.de).toEqual({ p25: 11375, p50: 12750, p75: 14125 });
    expect(v.pretensoes.find((p) => p.nivel === "senior" && p.regime === "PJ")).toMatchObject({ n: 10, valor: { p50: 16500 } });
    expect(v.demanda).toMatchObject({ vagas: 12, empresas: 3, fichas: 10 });

    const remoto = await lerMercado(db, { skillId: SKILL, modo: "remoto" });
    expect(remoto.faixas[0]).toMatchObject({ modo: "remoto", n: 12 });
  });

  it("empresa recusada sai da conta e o grupo perde os números", async () => {
    const { atualizarMercado, lerMercado } = await import("../lib/mercado");
    await db.companyProfile.update({ where: { id: EMPRESAS[2] }, data: { validacaoStatus: "rejeitado" } });
    await atualizarMercado(db);
    const g = (await lerMercado(db, { skillId: SKILL })).faixas.find((f) => f.nivel === "senior")!;
    expect(g).toMatchObject({ n: 8, nEmpresas: 2, de: null, ate: null, faltam: { registros: 2, empresas: 1 } });
  });
});
