import { NextRequest, NextResponse } from "next/server";
import { MAX_PARECIDAS, parecidasPorCompetencia, resumoDaVaga, type VagaResumo } from "@/lib/parecidas";

/**
 * Vagas parecidas (ideia do portal emagine, 2026-11-12). Público, como a busca de vagas:
 * só vagas ativas e só os campos da lista e a descrição que o detalhe mostra (sem contato).
 */
const CAMPOS = `id, titulo, nivel, localidade, regime, "faixaDe", "faixaAte", "faixaMoeda", stack, "descricaoBullets", "updatedAt", "createdAt", status, "expiresAt"`;

async function doBanco(id: string): Promise<VagaResumo[] | null> {
  const { prisma } = await import("@/lib/prisma");
  const alvo = await prisma.vacancy.findUnique({ where: { id } });
  if (!alvo) return null;
  // 1. Pelo vetor guardado na indexação (bge-m3), quando a vaga tem um.
  const porVetor = await prisma
    .$queryRawUnsafe<any[]>(
      `SELECT ${CAMPOS} FROM "Vacancy"
       WHERE id <> $1 AND status = 'ativa' AND "expiresAt" > now() AND embedding IS NOT NULL
         AND (SELECT embedding FROM "Vacancy" WHERE id = $1) IS NOT NULL
       ORDER BY embedding <=> (SELECT embedding FROM "Vacancy" WHERE id = $1)
       LIMIT ${MAX_PARECIDAS}`,
      id,
    )
    .catch(() => [] as any[]);
  if (porVetor.length) return porVetor.map(resumoDaVaga);
  // 2. Sem vetor: pelas competências em comum, entre as vagas ativas mais recentes.
  const ativas = await prisma.vacancy.findMany({ where: { status: "ativa", expiresAt: { gt: new Date() } }, orderBy: { updatedAt: "desc" }, take: 300 });
  return parecidasPorCompetencia(alvo, ativas);
}

async function daDemonstracao(id: string): Promise<VagaResumo[] | null> {
  const { DEMO_VACANCIES } = await import("@/lib/demo-data");
  const alvo = DEMO_VACANCIES.find((v) => v.id === id);
  return alvo ? parecidasPorCompetencia(alvo, DEMO_VACANCIES) : null;
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id || id.length > 100) return NextResponse.json({ error: "id inválido" }, { status: 400 });
  let itens: VagaResumo[] | null = null;
  try {
    itens = await doBanco(id);
  } catch {
    itens = null;
  }
  // Banco fora do ar ou vaga de demonstração: usa os dados de exemplo, como a busca.
  if (itens === null) itens = await daDemonstracao(id).catch(() => null);
  if (itens === null) return NextResponse.json({ items: [] }, { status: 404 });
  return NextResponse.json({ items: itens }, { headers: { "cache-control": "public, max-age=300" } });
}

export const dynamic = "force-dynamic";
