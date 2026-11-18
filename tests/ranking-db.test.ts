/** 3.1a Ranking adaptativo no banco de verdade: sinais → pesos por escopo, sem exemplos. Só num Postgres local. */
import type { PrismaClient } from "@prisma/client";
import { partesParaSinal } from "../lib/ranking";

function localDb(url: string | undefined): boolean {
  try {
    return !!url && ["localhost", "127.0.0.1"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}
const describeDb = localDb(process.env.DATABASE_URL) ? describe : describe.skip;

const EMPRESAS = ["rk-teste-a", "rk-teste-b"];
const FICHA = "rk-teste-ficha-";

describeDb("ranking (3.1a)", () => {
  let db: PrismaClient;
  const futuro = new Date(Date.now() + 30 * 864e5);

  const limpar = async () => {
    await db.feedbackSignal.deleteMany({ where: { applicationId: { startsWith: "rk-teste-" } } });
    await db.application.deleteMany({ where: { proxyThreadId: { startsWith: "rk-teste-" } } });
    await db.vacancy.deleteMany({ where: { companyId: { in: [...EMPRESAS, "demo-company"] }, titulo: { startsWith: "RK" } } });
    await db.companyProfile.deleteMany({ where: { id: { in: EMPRESAS } } });
    await db.candidateProfile.deleteMany({ where: { OR: [{ userId: { startsWith: FICHA } }, { userId: { startsWith: "demo-rk" } }] } });
    await db.rankingWeights.deleteMany({});
  };

  /** n candidaturas na vaga, metade foi para Entrevista (com competências) e metade "Não seguiu" (sem). */
  const semear = async (vacancyId: string, companyId: string, n: number, prefixo: string, userPrefix = FICHA) => {
    for (let i = 0; i < n; i++) {
      const c = await db.candidateProfile.create({
        data: { userId: `${userPrefix}${prefixo}${i}`, nome: "X", titulo: "Y", email: `${prefixo}${i}@exemplo.com`, senioridade: "senior", stack: [], status: "ativo", expiresAt: futuro },
      });
      const appId = `rk-teste-${prefixo}${i}`;
      await db.application.create({ data: { id: appId, candidateId: c.id, companyId, vacancyId, origem: "candidaturaLote", proxyThreadId: appId } });
      const positivo = i % 2 === 0;
      await db.feedbackSignal.create({
        data: {
          tipo: "etapa_mudou", ator: "recrutador", candidateId: c.id, vacancyId, applicationId: appId,
          dados: { de: "nova", para: positivo ? "entrevista" : "nao_seguiu", ...partesParaSinal({ skills: positivo ? 1 : 0, nivel: 1, condicoes: 1, recencia: 1, completude: 1 }) },
        },
      });
    }
  };

  beforeAll(async () => {
    const { createPrismaClient } = await import("../lib/prisma");
    db = createPrismaClient(process.env.DATABASE_URL!);
    await limpar();
    await db.companyProfile.upsert({ where: { id: "demo-company" }, create: { id: "demo-company", nome: "Demo", validacaoStatus: "validado" }, update: {} });
    for (const id of EMPRESAS) await db.companyProfile.create({ data: { id, nome: id, validacaoStatus: "validado" } });
    const base = { stack: [] as any, nivel: "Sênior", regime: "PJ", localidade: "Remoto", faixaMoeda: "BRL", status: "ativa" as const, expiresAt: futuro };
    const va = await db.vacancy.create({ data: { ...base, titulo: "RK A", companyId: EMPRESAS[0] } });
    const vb = await db.vacancy.create({ data: { ...base, titulo: "RK B", companyId: EMPRESAS[1] } });
    const vd = await db.vacancy.create({ data: { ...base, titulo: "RK demo", companyId: "demo-company" } });
    await semear(va.id, EMPRESAS[0], 40, "a");
    await semear(vb.id, EMPRESAS[1], 10, "b");
    await semear(vd.id, "demo-company", 20, "d");
    await semear(va.id, EMPRESAS[0], 6, "x", "demo-rk-");
  }, 60_000);
  afterAll(async () => {
    await limpar();
    await db.$disconnect();
  });

  it("calcula global e por empresa, sem dados de exemplo, e a escolha segue o mínimo de 30", async () => {
    const { atualizarPesos, pesosDaEmpresa } = await import("../lib/ranking");
    const r = await atualizarPesos(db);
    expect(r).toEqual({ global: 50, empresas: 2 });
    const linhas = await db.rankingWeights.findMany({ orderBy: { escopoId: "asc" } });
    expect(linhas.map((l) => [l.escopo, l.escopoId, l.n, l.nPositivos, l.nNegativos])).toEqual([
      ["global", "", 50, 25, 25],
      ["empresa", EMPRESAS[0], 40, 20, 20],
      ["empresa", EMPRESAS[1], 10, 5, 5],
    ]);
    expect((linhas[1].pesos as any).skills).toBeGreaterThan(40);

    expect((await pesosDaEmpresa(db, EMPRESAS[0])).escopo).toBe("empresa");
    expect((await pesosDaEmpresa(db, EMPRESAS[1])).escopo).toBe("global");

    // Admin desliga a empresa A: volta ao padrão e o Cron não religa.
    await db.rankingWeights.update({ where: { escopo_escopoId: { escopo: "empresa", escopoId: EMPRESAS[0] } }, data: { desligado: true } });
    await atualizarPesos(db);
    expect(await pesosDaEmpresa(db, EMPRESAS[0])).toMatchObject({ escopo: "padrao", pesos: { skills: 40 } });
    expect(await db.rankingWeights.count()).toBe(3);
  });

  it("empresa recusada sai da conta e perde os pesos", async () => {
    const { atualizarPesos } = await import("../lib/ranking");
    await db.companyProfile.update({ where: { id: EMPRESAS[1] }, data: { validacaoStatus: "rejeitado" } });
    expect(await atualizarPesos(db)).toEqual({ global: 40, empresas: 1 });
    expect(await db.rankingWeights.findFirst({ where: { escopoId: EMPRESAS[1] } })).toBeNull();
  });
});
