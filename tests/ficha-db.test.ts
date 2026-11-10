/** Limite de uso por dia da "Minha ficha" (1.5.10) no banco de verdade. Só roda num Postgres local. */
import type { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { cookieDeTeste } from "./helpers/sessao-mock";
import { DEMO_FICHAS } from "../lib/demo-data";

// A indexação em segundo plano chamaria a IA; aqui só interessa o que a rota grava.
jest.mock("../lib/sessao", () => require("./helpers/sessao-mock").sessaoMock());
jest.mock("../lib/background", () => ({ runInBackground: () => {} }));
import { chaveUso, consumirUso } from "../lib/uso-diario";

function localDb(url: string | undefined): boolean {
  try {
    return !!url && ["localhost", "127.0.0.1"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}
const describeDb = localDb(process.env.DATABASE_URL) ? describe : describe.skip;

describeDb("Uso por dia no banco", () => {
  let db: PrismaClient;
  beforeAll(async () => {
    const { createPrismaClient } = await import("../lib/prisma");
    db = createPrismaClient(process.env.DATABASE_URL!);
    await db.usoDiario.deleteMany({});
  });
  afterAll(async () => {
    await db.usoDiario.deleteMany({});
    await db.candidateProfile.deleteMany({ where: { userId: { startsWith: "conta-teste-" } } });
    await db.$disconnect();
  });

  it("conta por chave e por dia, sem passar do limite em pedidos paralelos", async () => {
    const chave = await chaveUso("ler", "203.0.113.7");
    expect(chave).not.toContain("203.0.113.7");
    const hoje = new Date("2026-11-09T10:00:00Z");
    const r = await Promise.all(Array.from({ length: 15 }, () => consumirUso(db, chave, 10, hoje)));
    expect(r.filter((x) => x.permitido)).toHaveLength(10);
    expect(Math.max(...r.map((x) => x.total))).toBe(15);
    // outro dia e outra chave começam do zero
    expect(await consumirUso(db, chave, 10, new Date("2026-11-10T00:00:01Z"))).toEqual({ permitido: true, total: 1 });
    expect((await consumirUso(db, await chaveUso("w2", "203.0.113.7"), 10, hoje)).total).toBe(1);
  });

  it("publicar de novo tira o índice antigo e deixa o vetor pendente", async () => {
    const { POST } = await import("../app/api/ficha/publicar/route");
    const cookie = cookieDeTeste({ id: "conta-teste-ana" });
    const ficha = { ...DEMO_FICHAS["demo-c-01"], nome: "Ana Teste", email: "ana.publicar@exemplo.com", titulo: "Analista Cloud", localidade: "São Paulo", modo: "remoto", regimes: ["CLT"] };
    const req = (resumo: string) =>
      new NextRequest("http://w2.test/api/ficha/publicar", { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ ficha, fichaW2: { resumo } }) });
    const r1 = await POST(req("Primeiro resumo."));
    expect(r1.status).toBe(200);
    const p = await db.candidateProfile.findFirstOrThrow({ where: { email: "ana.publicar@exemplo.com" } });
    expect(p.userId).toBe("conta-teste-ana");
    await db.$executeRaw`UPDATE "CandidateProfile" SET "searchVector" = to_tsvector('portuguese', 'antigo'), "embeddingHash" = 'x' WHERE "userId" = ${p.userId}`;
    expect((await POST(req("Segundo resumo."))).status).toBe(200);
    const [row] = await db.$queryRaw<{ sv: string | null; h: string | null; r: string }[]>`
      SELECT "searchVector"::text AS sv, "embeddingHash" AS h, "resumo3linhas" AS r FROM "CandidateProfile" WHERE "userId" = ${p.userId}`;
    expect(row).toEqual({ sv: null, h: null, r: "Segundo resumo." });
  });

  it("pretensão por regime: grava a lista e a busca compara o mínimo do regime com o teto", async () => {
    const { POST } = await import("../app/api/ficha/publicar/route");
    const { searchCandidatesDb } = await import("../lib/search-db");
    const publicar = (email: string, regimes: string[], pretensoes: unknown[]) =>
      POST(
        new NextRequest("http://w2.test/api/ficha/publicar", {
          method: "POST",
          headers: { cookie: cookieDeTeste({ id: `conta-teste-${email}` }), "content-type": "application/json" },
          body: JSON.stringify({
            ficha: { ...DEMO_FICHAS["demo-c-02"], nome: "Teste Regime", email, titulo: "Engenheiro Cloud", localidade: "Lisboa", modo: "remoto", regimes, pretensoes },
            fichaW2: { resumo: "Resumo." },
          }),
        }),
      );
    // CLT pede 9 mil, PJ pede 22 mil: numa vaga PJ até 15 mil não cabe; numa CLT até 15 mil cabe.
    expect((await publicar("dois.regimes@exemplo.com", ["CLT", "PJ"], [{ regime: "CLT", valor: 9000 }, { regime: "PJ", valor: 22000 }])).status).toBe(200);
    expect((await publicar("so.hora@exemplo.com", ["Freelancer"], [{ regime: "Freelancer", valor: 80, unidade: "hora" }])).status).toBe(200);
    const salvo = await db.candidateProfile.findFirstOrThrow({ where: { email: "dois.regimes@exemplo.com" } });
    expect(salvo.pretensoes).toEqual([
      { regime: "CLT", valor: 9000, unidade: "mes", moeda: "BRL" },
      { regime: "PJ", valor: 22000, unidade: "mes", moeda: "BRL" },
    ]);
    expect([salvo.pretensaoDe, salvo.pretensaoAte]).toEqual([9000, null]);

    const emails = async (p: { regime?: string; faixaAte?: number }) => {
      const r = await searchCandidatesDb({ page: 1, pageSize: 100, ...p }, { db });
      return r.items.map((x) => x.email).filter((e: string) => e.endsWith("@exemplo.com") && e !== "ana.publicar@exemplo.com").sort();
    };
    expect(await emails({ regime: "PJ", faixaAte: 15000 })).toEqual([]);
    expect(await emails({ regime: "CLT", faixaAte: 15000 })).toEqual(["dois.regimes@exemplo.com"]);
    // sem regime: cabe se algum regime cabe; quem só tem valor por hora não é comparado com mês
    expect(await emails({ faixaAte: 15000 })).toEqual(["dois.regimes@exemplo.com", "so.hora@exemplo.com"]);
    expect(await emails({ faixaAte: 5000 })).toEqual(["so.hora@exemplo.com"]);
  });
});
