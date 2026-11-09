import { NextRequest, NextResponse } from "next/server";
import { searchVacancies, PAGE_SIZE } from "@/lib/search";
import { isValidLocale, defaultLocale, type Locale } from "@/i18n";

export async function GET(req: NextRequest) {
  const start = Date.now();
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? undefined;
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(20, Math.max(1, parseInt(url.searchParams.get("pageSize") ?? String(PAGE_SIZE), 10) || PAGE_SIZE));
  const regime = url.searchParams.get("regime") ?? undefined;
  const localidade = url.searchParams.get("localidade") ?? url.searchParams.get("modo") ?? undefined;
  const nivel = url.searchParams.get("nivel") ?? undefined;
  const faixaDe = url.searchParams.get("faixaDe") ? Number(url.searchParams.get("faixaDe")) : null;
  const faixaAte = url.searchParams.get("faixaAte") ? Number(url.searchParams.get("faixaAte")) : null;
  const langRaw = url.searchParams.get("lang") ?? req.headers.get("x-locale") ?? defaultLocale;
  const lang: Locale = isValidLocale(langRaw) ? langRaw : defaultLocale;

  // lang: idioma da resposta; o vetor da busca (bge-m3) é o mesmo nos três idiomas.
  const params = { q, page, pageSize, regime, localidade, nivel, faixaDe, faixaAte, lang } as any;

  // hybrid tsvector + pgvector where status=ativo only handled inside searchVacancies
  const result = await searchVacancies(params);

  const tookMs = Date.now() - start;
  // p95 budget header
  const headers: Record<string, string> = { "x-took-ms": String(tookMs) };
  // also ensure tomó <800 for p95; in-memory is fast
  void tookMs;

  return NextResponse.json(
    {
      items: result.items,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
      suggestion: result.suggestion ?? null,
      emptyCTA: result.emptyCTA ?? null,
      tookMs: result.tookMs ?? tookMs,
      entendeu: result.entendeu,
    },
    { status: 200, headers }
  );
}
