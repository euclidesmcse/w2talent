/** Limite de uso por dia da "Minha ficha" (1.5.10) no banco de verdade. Só roda num Postgres local. */
import type { PrismaClient } from "@prisma/client";
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
});
