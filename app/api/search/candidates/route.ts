import { NextRequest, NextResponse } from "next/server";
import { searchCandidates, PAGE_SIZE } from "@/lib/search";
import { isValidLocale, defaultLocale, type Locale } from "@/i18n";
import { exigirConta, NO_STORE } from "@/lib/sessao";
import { lerFiltros } from "@/lib/candidatos-filtros";
import { empresaDaConta } from "@/lib/empresa";
import { comTraducaoDasFichas } from "@/lib/traducao";

/** Busca de candidatos: só recrutador logado, com o autenticador (1.5.5, decisões 2 e 4). */
export async function GET(req: NextRequest) {
  const acesso = await exigirConta(req, { perfil: "recrutador" });
  if ("erro" in acesso) return acesso.erro;
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
  // 2.2b: filtros da tela (na URL) e vaga de referência, só da empresa de quem busca.
  const filtros = lerFiltros(url.searchParams);
  const faixaAte = filtros.faixaAte ?? null;
  const params = { q, page, pageSize, modo: filtros.modo ?? modo, regime: filtros.regime ?? regime, nivel, faixaAte, lang, filtros } as any;

  let vaga = null;
  let ordem: { pesos: import("@/lib/match").PesosMatch | null; info: import("@/lib/ranking").OrdemInfo } | null = null;
  if (filtros.vaga) {
    const { prisma } = await import("@/lib/prisma");
    const empresa = await empresaDaConta(prisma, acesso.conta.id);
    const v = empresa
      ? await prisma.vacancy.findFirst({
          // Mesmo critério da lista do "Para a vaga": só vaga ativa e dentro do prazo.
          where: { id: filtros.vaga, companyId: empresa.id, status: "ativa", expiresAt: { gt: new Date() } },
          select: { id: true, titulo: true, stack: true, nivel: true, regime: true, localidade: true, faixaDe: true, faixaAte: true, faixaMoeda: true, descricaoBullets: true, updatedAt: true, createdAt: true },
        })
      : null;
    if (!v) return NextResponse.json({ error: "vaga_nao_encontrada" }, { status: 404, headers: NO_STORE });
    vaga = v;
    // 3.1b: ordem ajustada pelos pesos da empresa, salvo ?ordem=padrao.
    const { lerOrdem, ordemDaEmpresa } = await import("@/lib/ranking");
    ordem = await ordemDaEmpresa(prisma, empresa!.id, lerOrdem(url.searchParams.get("ordem")));
  }

  const result = await searchCandidates(params, undefined, vaga, ordem?.pesos);
  // 2.7b: título, resumo e experiências da ficha no idioma de quem vê, quando a tradução está pronta.
  const { prisma } = await import("@/lib/prisma");
  const traduzidos = await comTraducaoDasFichas(prisma, result.items, lang);
  // Linha do tempo (PR c): marca quem liberou o CV completo (botão no cartão do cargo).
  const { perfisComCv } = await import("@/lib/cv-completo");
  const comCv = await perfisComCv(prisma, traduzidos.map((i: any) => i.id)).catch(() => new Set<string>());
  const items = traduzidos.map((i: any) => ({ ...i, temCv: comCv.has(i.id) }));
  const tookMs = Date.now() - start;

  return NextResponse.json(
    {
      items,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
      suggestion: result.suggestion ?? null,
      ordem: ordem?.info ?? null,
      emptyCTA: result.emptyCTA ?? null,
      tookMs: result.tookMs ?? tookMs,
      vaga: vaga ? { id: vaga.id, titulo: vaga.titulo } : null,
    },
    { status: 200, headers: { ...NO_STORE, "x-took-ms": String(tookMs) } }
  );
}
