import { NextRequest, NextResponse } from "next/server";
import { requestHasSecret } from "@/lib/secret";
import { AiBudgetError, AiUnavailableError } from "@/lib/ai";
import { indexPending } from "@/lib/indexing";
import { QUERY_CACHE_DAYS } from "@/lib/search-db";

/** Máximo de registros indexados por chamada (vagas primeiro, depois perfis). */
const REINDEX_LIMIT = 50;

/**
 * Reindexação da busca (1.5.9): gera o vetor (bge-m3) de vagas e perfis ativos que ainda não
 * têm um, ou que têm vetor de outro modelo. Até 50 por chamada; repetir até `faltam` chegar a 0.
 * Também apaga os vetores de busca guardados há mais de 7 dias.
 * Fechada pelo CRON_SECRET no cabeçalho (nunca na URL).
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.nextUrl.searchParams.has("cron_secret") || !requestHasSecret(req, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const vagas = await indexPending("vacancy", REINDEX_LIMIT);
    const sobra = Math.max(0, REINDEX_LIMIT - vagas.indexados);
    const candidatos = await indexPending("candidate", sobra);

    const { getPrisma } = await import("@/lib/prisma");
    const cacheApagado = await getPrisma()
      .$executeRaw`DELETE FROM "QueryEmbedding" WHERE "createdAt" < now() - make_interval(days => ${QUERY_CACHE_DAYS})`
      .catch(() => 0);

    return NextResponse.json({
      ok: true,
      vagas,
      candidatos,
      faltam: vagas.pendentes + candidatos.pendentes,
      cacheApagado,
    });
  } catch (err) {
    if (err instanceof AiBudgetError) return NextResponse.json({ ok: false, error: err.message }, { status: 429 });
    if (err instanceof AiUnavailableError) {
      return NextResponse.json({ ok: false, error: err.message, attempts: err.attempts }, { status: 502 });
    }
    // eslint-disable-next-line no-console
    console.error("[reindex] falhou:", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "falha na reindexação (veja os logs do Worker)" }, { status: 500 });
  }
}
