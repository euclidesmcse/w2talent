import { NextResponse } from "next/server";
import { getPrisma, dbSource } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Saúde do banco (spike 1.5.1): confirma que o Worker alcança o Postgres
 * (Hyperdrive → Neon em produção). Não expõe dados pessoais nem a URL.
 */
export async function GET() {
  const started = Date.now();
  try {
    const prisma = getPrisma();
    const [{ ok }] = await prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1::int AS ok`;
    const [{ vector }] = await prisma.$queryRaw<Array<{ vector: boolean }>>`
      SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') AS vector`;
    const vagas = await prisma.vacancy.count();
    return NextResponse.json({
      ok: ok === 1,
      via: dbSource(),
      pgvector: vector,
      vagas,
      latenciaMs: Date.now() - started,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, via: dbSource(), erro: e instanceof Error ? e.message.split("\n")[0] : "erro desconhecido" },
      { status: 503 },
    );
  }
}
