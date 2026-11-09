/** Limite de uso por dia da "Minha ficha" (1.5.10) no banco de verdade. Só roda num Postgres local. */
import type { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { ADMIN_COOKIE, signAdminSession } from "../lib/admin-auth";
import { DEMO_FICHAS } from "../lib/demo-data";

// A indexação em segundo plano chamaria a IA; aqui só interessa o que a rota grava.
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
    await db.candidateProfile.deleteMany({ where: { userId: { startsWith: "teste:" } } });
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
    const SECRET = "uma-senha-de-admin-bem-comprida-123";
    process.env.ADMIN_SECRET = SECRET;
    const { POST } = await import("../app/api/ficha/publicar/route");
    const cookie = `${ADMIN_COOKIE}=${encodeURIComponent((await signAdminSession(SECRET)).value)}`;
    const ficha = { ...DEMO_FICHAS["demo-c-01"], nome: "Ana Teste", email: "ana.publicar@exemplo.com", titulo: "Analista Cloud", localidade: "São Paulo", modo: "remoto", regimes: ["CLT"] };
    const req = (resumo: string) =>
      new NextRequest("http://w2.test/api/ficha/publicar", { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ ficha, fichaW2: { resumo } }) });
    const r1 = await POST(req("Primeiro resumo."));
    expect(r1.status).toBe(200);
    const p = await db.candidateProfile.findFirstOrThrow({ where: { email: "ana.publicar@exemplo.com" } });
    expect(p.userId).toMatch(/^teste:[0-9a-f]{24}$/);
    expect(p.userId).not.toContain("ana.publicar");
    await db.$executeRaw`UPDATE "CandidateProfile" SET "searchVector" = to_tsvector('portuguese', 'antigo'), "embeddingHash" = 'x' WHERE "userId" = ${p.userId}`;
    expect((await POST(req("Segundo resumo."))).status).toBe(200);
    const [row] = await db.$queryRaw<{ sv: string | null; h: string | null; r: string }[]>`
      SELECT "searchVector"::text AS sv, "embeddingHash" AS h, "resumo3linhas" AS r FROM "CandidateProfile" WHERE "userId" = ${p.userId}`;
    expect(row).toEqual({ sv: null, h: null, r: "Segundo resumo." });
  });
});
