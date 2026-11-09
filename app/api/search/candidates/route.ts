import { NextRequest, NextResponse } from "next/server";
import { searchCandidates, PAGE_SIZE } from "@/lib/search";
import { isValidLocale, defaultLocale, type Locale } from "@/i18n";

export async function GET(req: NextRequest) {
  const start = Date.now();
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? undefined;
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(20, Math.max(1, parseInt(url.searchParams.get("pageSize") ?? String(PAGE_SIZE), 10) || PAGE_SIZE));
  const modo = url.searchParams.get("modo") ?? url.searchParams.get("localidade") ?? undefined;
  const regime = url.searchParams.get("regime") ?? undefined;
  const nivel = url.searchParams.get("nivel") ?? undefined;
  const langRaw = url.searchParams.get("lang") ?? req.headers.get("x-locale") ?? defaultLocale;
  const lang: Locale = isValidLocale(langRaw) ? langRaw : defaultLocale;

  // lang: idioma da resposta; o vetor da busca (bge-m3) é o mesmo nos três idiomas.
  const params = { q, page, pageSize, modo, regime, nivel, lang } as any;

  const result = await searchCandidates(params);
  const tookMs = Date.now() - start;

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
    },
    { status: 200, headers: { "x-took-ms": String(tookMs) } }
  );
}
