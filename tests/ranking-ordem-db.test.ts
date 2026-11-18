/** 3.1b Ordem ajustada dos candidatos da vaga no banco de verdade. Só roda num Postgres local. */
import type { PrismaClient } from "@prisma/client";

function localDb(url: string | undefined): boolean {
  try {
    return !!url && ["localhost", "127.0.0.1"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}
const describeDb = localDb(process.env.DATABASE_URL) ? describe : describe.skip;

const EMPRESA = "rko-teste-empresa";
const ANA = "rko-teste-ana"; // tem a competência, mas não o regime nem o modelo, e a ficha está incompleta
const BIA = "rko-teste-bia"; // não tem a competência, mas tem o resto e a ficha completa
const CANDS = [ANA, BIA];
// Dentro de ±50% do padrão {40,20,20,10,10} e somando 100: menos competências, mais condições e completude.
const PESOS = { skills: 25, nivel: 25, condicoes: 25, recencia: 10, completude: 15 };

describeDb("ordem ajustada dos candidatos (3.1b)", () => {
  let db: PrismaClient;
  let vagaId = "";
  const futuro = new Date(Date.now() + 30 * 864e5);

  const limpar = async () => {
    await db.application.deleteMany({ where: { proxyThreadId: { startsWith: "rko-teste-" } } });
    await db.vacancy.deleteMany({ where: { companyId: EMPRESA } });
    await db.rankingWeights.deleteMany({ where: { escopo: "empresa", escopoId: EMPRESA } });
    await db.companyProfile.deleteMany({ where: { id: EMPRESA } });
    await db.candidateProfile.deleteMany({ where: { id: { in: CANDS } } });
  };

  beforeAll(async () => {
    const { createPrismaClient } = await import("../lib/prisma");
    db = createPrismaClient(process.env.DATABASE_URL!);
    await limpar();
    await db.companyProfile.create({ data: { id: EMPRESA, nome: "RKO", validacaoStatus: "validado" } });
    vagaId = (
      await db.vacancy.create({
        data: { companyId: EMPRESA, titulo: "RKO Cloud", stack: [{ skillId: "aws" }] as any, nivel: "Pleno", regime: "PJ", localidade: "Remoto", status: "ativa", expiresAt: futuro },
      })
    ).id;
    const base = { nome: "X", titulo: "Engenharia", localidade: "São Paulo", senioridade: "pleno", status: "ativo", expiresAt: futuro };
    await db.candidateProfile.create({
      data: { id: ANA, userId: ANA, email: `${ANA}@exemplo.com`, ...base, stack: [{ skillId: "aws", anos: 4 }], regimePreferido: ["CLT"], modo: "presencial" } as any,
    });
    await db.candidateProfile.create({
      data: {
        id: BIA, userId: BIA, email: `${BIA}@exemplo.com`, ...base,
        stack: [{ skillId: "python", anos: 4 }], regimePreferido: ["PJ"], modo: "remoto",
        experiencias: [{ cargo: "Dev", empresa: "Y", inicio: "2020-01", fim: "", atual: true }],
        pretensoes: [{ regime: "PJ", valor: 15000, unidade: "mes", moeda: "BRL" }],
        idiomas: [{ idioma: "Inglês", nivel: "avancado" }],
        disponibilidade: "30d",
      } as any,
    });
    for (const c of CANDS) {
      await db.application.create({ data: { candidateId: c, vacancyId: vagaId, companyId: EMPRESA, origem: "candidaturaLote", proxyThreadId: `rko-teste-${c}` } });
    }
    await db.rankingWeights.create({ data: { escopo: "empresa", escopoId: EMPRESA, pesos: PESOS, n: 40, nPositivos: 20, nNegativos: 20 } });
  });
  afterAll(async () => {
    await limpar();
    await db.$disconnect();
  });

  const ordemDe = async (ordem?: "ajustada" | "padrao") => {
    const { candidaturasDaVaga } = await import("../lib/rh-candidaturas");
    const r = await candidaturasDaVaga(db, EMPRESA, vagaId, new Date(), ordem ? { ordem } : {});
    return { ids: r!.itens.map((i) => String(i.candidato.id)), match: Object.fromEntries(r!.itens.map((i) => [String(i.candidato.id), i.match])), ordem: r!.ordem };
  };

  it("com os pesos da empresa, a ordem muda; a % mostrada continua a conta fixa", async () => {
    const padrao = await ordemDe("padrao");
    expect(padrao.ordem).toEqual({ escopo: "empresa", usada: "padrao" });
    expect(padrao.ids).toEqual([ANA, BIA]);
    expect(padrao.match[ANA]).toBeGreaterThan(padrao.match[BIA]);

    const ajustada = await ordemDe("ajustada");
    expect(ajustada.ordem).toEqual({ escopo: "empresa", usada: "ajustada" });
    expect(ajustada.ids).toEqual([BIA, ANA]);
    expect(ajustada.match).toEqual(padrao.match);

    // Sem pedir nada, vale a ajustada.
    expect((await ordemDe()).ids).toEqual([BIA, ANA]);
  });

  it("com o escopo desligado pelo admin, volta à ordem padrão e a tela não mostra a linha", async () => {
    await db.rankingWeights.update({ where: { escopo_escopoId: { escopo: "empresa", escopoId: EMPRESA } }, data: { desligado: true } });
    const r = await ordemDe("ajustada");
    expect(r.ordem).toEqual({ escopo: "padrao", usada: "padrao" });
    expect(r.ids).toEqual([ANA, BIA]);
  });
});
