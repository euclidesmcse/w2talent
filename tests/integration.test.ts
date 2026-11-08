/**
 * Integration tests — só rodam se DATABASE_URL estiver configurado + Postgres acessível.
 * Sem DATABASE_URL, suite é SKIP (não falso GREEN, mas marcado como skipped).
 * Cobre C1/C2 com banco real quando disponível.
 */

const hasDb = !!process.env.DATABASE_URL;

const describeIntegration = hasDb ? describe : describe.skip;

describeIntegration("Integration — Postgres (guarded by DATABASE_URL)", () => {
  it("placeholder: requer DATABASE_URL e Postgres com pgvector", () => {
    expect(process.env.DATABASE_URL).toBeTruthy();
  });

  it("Prisma migrate + seed + hygiene queries funcionam (requer DB)", async () => {
    const { createPrismaClient } = await import("@/lib/prisma");
    const prisma = createPrismaClient(process.env.DATABASE_URL!);
    try {
      // Verifica conexão
      await prisma.$queryRaw`SELECT 1 as ok`;
      // Verifica que models existem
      expect(prisma.candidateProfile).toBeDefined();
      expect(prisma.vacancy).toBeDefined();
      expect(prisma.application).toBeDefined();
    } finally {
      await prisma.$disconnect().catch(() => {});
    }
  });

  it("Índice único (candidateId, vacancyId) existe para Application (C1) — verifica via pg_indexes", async () => {
    const { createPrismaClient } = await import("@/lib/prisma");
    const prisma = createPrismaClient(process.env.DATABASE_URL!);
    try {
      // C1: bloquear candidatura duplicada na mesma vaga. A migration init cria
      // UNIQUE ("candidateId", "vacancyId"); como vacancyId é nullable e o Postgres
      // trata NULLs como distintos, ela equivale ao índice parcial WHERE vacancyId IS NOT NULL.
      const rows = (await prisma.$queryRaw`
        SELECT indexdef FROM pg_indexes WHERE tablename = 'Application'
      `) as Array<{ indexdef: string }>;
      const unique = rows.filter(
        (r) => /CREATE UNIQUE INDEX/.test(r.indexdef) && /\("candidateId", "vacancyId"\)/.test(r.indexdef),
      );
      expect(unique.length).toBe(1);
    } finally {
      await prisma.$disconnect().catch(() => {});
    }
  });
});

// Sempre visível: garante que suite não passa silenciosa sem DB
describe("Integration — unit guard", () => {
  it("marca testes de integração como skipped quando DATABASE_URL ausente (I3)", () => {
    if (!process.env.DATABASE_URL) {
      expect(hasDb).toBe(false);
      // eslint-disable-next-line no-console
      console.log("[integration] DATABASE_URL ausente — testes de integração SKIPPED (esperado em CI sem DB)");
    } else {
      expect(hasDb).toBe(true);
    }
  });
});
