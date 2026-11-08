import { SKILLS } from "../lib/taxonomy";

/**
 * Seed de taxonomia (Fase 1): Skills são estáticas em lib/taxonomy.ts.
 * Não há tabela Skill no Prisma ainda — seed valida 500 skills + categorias.
 * Quando Task 3 criar tabela Skill, este seed pode popular via prisma.skill.createMany.
 * Uso: `npm run db:seed` ou `npx prisma db seed` (via package.json#prisma.seed).
 */
async function main() {
  console.log(`[seed] Taxonomy: ${SKILLS.length} skills carregadas`);
  if (SKILLS.length !== 500) {
    throw new Error(`Taxonomia deve ter 500 skills, encontrou ${SKILLS.length}`);
  }
  const ids = new Set(SKILLS.map((s) => s.id));
  if (ids.size !== 500) {
    throw new Error(`skillIds devem ser únicos: ${SKILLS.length} vs ${ids.size}`);
  }
  // Valida labels/categorias preenchidos (evita placeholders vazios)
  const withoutLabel = SKILLS.filter((s) => !s.label.trim());
  const withoutCategory = SKILLS.filter((s) => !s.category.trim());
  if (withoutLabel.length || withoutCategory.length) {
    throw new Error(`Skills sem label/category: label=${withoutLabel.length} category=${withoutCategory.length}`);
  }
  const placeholders = SKILLS.filter((s) => s.category === "extra" || s.id.startsWith("skill-extra"));
  if (placeholders.length > 0) {
    throw new Error(`Placeholders remanescentes detectados (${placeholders.length}): ${placeholders.slice(0, 3).map((s) => s.id).join(", ")} — substituir por skills reais`);
  }
  // Estatísticas por categoria (útil para curadoria)
  const byCategory: Record<string, number> = {};
  for (const s of SKILLS) byCategory[s.category] = (byCategory[s.category] ?? 0) + 1;
  console.log("[seed] Por categoria:", byCategory);
  const totalSynonyms = SKILLS.reduce((n, s) => n + s.synonyms.length, 0);
  console.log(`[seed] Sinônimos totais: ${totalSynonyms}`);
  // Se Skill model existir (Task 3+), popular; senão apenas valida
  try {
    // dynamic import para não quebrar se prisma client não gerado
    const { PrismaClient } = await import("@prisma/client");
    const { PrismaPg } = await import("@prisma/adapter-pg");
    const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
    // @ts-ignore — Skill model pode não existir ainda
    if (prisma.skill) {
      console.log("[seed] Populando tabela Skill...");
      // @ts-ignore
      await prisma.skill.createMany({
        data: SKILLS.map((s) => ({
          id: s.id,
          label: s.label,
          category: s.category,
          synonyms: s.synonyms,
        })),
        skipDuplicates: true,
      });
      console.log("[seed] Skill table populada");
    } else {
      console.log("[seed] Modelo Skill ainda não existe — validação apenas (ok para Fase 1)");
    }
    await prisma.$disconnect();
  } catch (e) {
    console.log("[seed] Prisma não disponível ou sem tabela Skill — validação apenas:", (e as Error).message?.slice(0, 200));
  }
  console.log("[seed] Taxonomy seed OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
