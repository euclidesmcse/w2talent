/** B1 "O que falta para as vagas": a rota no banco de verdade. Só roda num Postgres local. */
import type { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { cookieDeTeste, type ContaTeste } from "./helpers/sessao-mock";
import { DEMO_FICHAS } from "../lib/demo-data";

jest.mock("../lib/sessao", () => require("./helpers/sessao-mock").sessaoMock());
jest.mock("../lib/background", () => ({ runInBackground: () => {} }));

function localDb(url: string | undefined): boolean {
  try {
    return !!url && ["localhost", "127.0.0.1"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}
const describeDb = localDb(process.env.DATABASE_URL) ? describe : describe.skip;

const EMPRESA = "emp-teste-b1";
const SKILL = "zz-teste-b1";

describeDb("GET /api/painel/lacunas", () => {
  let db: PrismaClient;
  const pedir = async (c?: ContaTeste) => {
    const { GET } = await import("../app/api/painel/lacunas/route");
    return GET(new NextRequest("http://w2.test/api/painel/lacunas", { headers: c ? { cookie: cookieDeTeste(c) } : {} }));
  };

  beforeAll(async () => {
    const { createPrismaClient } = await import("../lib/prisma");
    db = createPrismaClient(process.env.DATABASE_URL!);
    await db.companyProfile.deleteMany({ where: { id: EMPRESA } });
    await db.companyProfile.create({ data: { id: EMPRESA, nome: "Empresa B1", validacaoStatus: "validado" } });
    const fim = new Date(Date.now() + 7 * 86400000);
    for (let i = 0; i < 3; i++) {
      await db.vacancy.create({
        data: { companyId: EMPRESA, titulo: `B1 ${i}`, stack: [{ skillId: "aws" }, { skillId: "terraform" }, { skillId: SKILL }] as any, nivel: "Pleno", regime: "CLT", localidade: "Remoto", status: "ativa", expiresAt: fim, descricaoBullets: ["x"] as any },
      });
    }
    // Vaga vencida não conta.
    await db.vacancy.create({ data: { companyId: EMPRESA, titulo: "B1 vencida", stack: [{ skillId: "aws" }, { skillId: "zz-teste-b1-vencida" }] as any, status: "ativa", expiresAt: new Date(Date.now() - 86400000) } });
  });
  afterAll(async () => {
    await db.companyProfile.deleteMany({ where: { id: EMPRESA } });
    await db.candidateProfile.deleteMany({ where: { userId: { startsWith: "conta-teste-b1" } } });
    await db.$disconnect();
  });

  it("sem login 401; recrutador 403", async () => {
    expect((await pedir()).status).toBe(401);
    expect((await pedir({ id: "conta-teste-b1-rec", perfil: "recrutador", mfaLigado: true })).status).toBe(403);
  });

  it("candidato sem ficha publicada recebe o convite", async () => {
    const r = await pedir({ id: "conta-teste-b1-sem" });
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(await r.json()).toEqual({ estado: "sem_ficha" });
  });

  it("com a ficha publicada, conta o que falta nas vagas ativas próximas", async () => {
    const { POST } = await import("../app/api/ficha/publicar/route");
    const cookie = cookieDeTeste({ id: "conta-teste-b1-ana" });
    const ficha = { ...DEMO_FICHAS["demo-c-01"], nome: "Ana B1", email: "ana.b1@exemplo.com", titulo: "Analista Cloud", localidade: "São Paulo", modo: "remoto", regimes: ["CLT"], senioridade: "pleno" };
    const pub = await POST(new NextRequest("http://w2.test/api/ficha/publicar", { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ ficha, fichaW2: { resumo: "Resumo." } }) }));
    expect(pub.status).toBe(200);
    const r = await pedir({ id: "conta-teste-b1-ana" });
    const j = await r.json();
    expect(j.estado).toBe("ok");
    expect(j.faltam).toContainEqual({ skill: SKILL, label: SKILL, n: 3 });
    expect(JSON.stringify(j)).not.toContain("zz-teste-b1-vencida");
    // Nada é guardado: nenhum sinal de aprendizado novo.
    const antes = await db.feedbackSignal.count();
    await pedir({ id: "conta-teste-b1-ana" });
    expect(await db.feedbackSignal.count()).toBe(antes);
  });
});
