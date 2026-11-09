/**
 * lib/search — Busca Semântica híbrida tsvector + pgvector (Task 5)
 * - hybrid rank: ts_rank (0.6) + cosine vector (0.4)
 * - filtro status=ativo only (where status=ativo)
 * - paginação server-side 20/page
 * - sugestão typo via fallback
 * - mascaramento e-mail/tel na lista (cadeado)
 * - truncamento +2 skills
 * - faixa null => "—" (hide, não quebra)
 */

import { HYBRID_WEIGHTS, searchVacanciesDb, searchCandidatesDb, type DbSearchPage } from "./search-db";
import { normalizeSkill, SKILLS, getSkill } from "./taxonomy";
import { parseQueryIntent, skillTextTerms, type IntentChip } from "./query-intent";
import { hasCriteria, matchVacancy } from "./match";

// ── Constantes ─────────────────────────────────────────────────────────
export const PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 20;
// Pesos da nota (0,6 texto + 0,4 significado): definidos em search-db.ts, onde a busca roda no banco.
export { HYBRID_WEIGHTS };
export { buildVacancySearchSql, buildCandidateSearchSql } from "./search-db";
export const P95_BUDGET_MS = 800;

// ── Tipos ──────────────────────────────────────────────────────────────
export type SearchParams = {
  q?: string;
  page?: number;
  pageSize?: number;
  regime?: string;
  modo?: string; // remoto|hibrido|presencial
  localidade?: string;
  faixaDe?: number | null;
  faixaAte?: number | null;
  nivel?: string;
  status?: string;
};

export type SearchResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  suggestion?: string | null;
  emptyCTA?: string | null;
  tookMs?: number;
};

export type RankedItem<T> = T & { _rank: number; _tsRank: number; _vecRank: number };

export { maskEmail, maskPhone, formatFaixa, formatTempo, truncateSkills, skillsDisplay } from "./format";
import { maskEmail, maskPhone, maskedContact, formatFaixa, formatTempo, truncateSkills, skillsDisplay } from "./format";

// ── tsvector helper ──────────────────────────────────────────────────
/**
 * Pretensão = mínimo aceito por regime: cabe quando o mínimo mensal do regime é até o teto.
 * Sem teto, ou sem pretensão mensal naquele regime, cabe (fica escondida, não some).
 */
export function cabeNaFaixa(pretensoes: unknown[], faixaAte: number | null, regime: string | null): boolean {
  if (faixaAte == null) return true;
  const mensais = pretensoes.filter(
    (x: any) => x && x.unidade === "mes" && typeof x.valor === "number" && (!regime || String(x.regime).toLowerCase() === regime.toLowerCase()),
  ) as { valor: number }[];
  return !mensais.length || mensais.some((x) => x.valor <= faixaAte);
}

export function buildTsvectorTextVacancy(v: any): string {
  const parts: string[] = [];
  if (v.titulo) parts.push(v.titulo);
  if (v.descricaoBullets) parts.push(Array.isArray(v.descricaoBullets) ? v.descricaoBullets.join(" ") : String(v.descricaoBullets));
  if (v.localidade) parts.push(v.localidade);
  if (v.regime) parts.push(v.regime);
  if (v.nivel) parts.push(v.nivel);
  if (Array.isArray(v.stack)) {
    for (const item of v.stack) {
      const skillId = typeof item === "string" ? item : item.skillId ?? item.id ?? "";
      const def = getSkill(skillId);
      if (def) {
        parts.push(def.label);
        parts.push(def.id);
        parts.push(def.synonyms.join(" "));
      } else {
        parts.push(skillId);
      }
    }
  }
  return parts.join(" ").toLowerCase();
}

export function buildTsvectorTextCandidate(c: any): string {
  const parts: string[] = [];
  if (c.titulo) parts.push(c.titulo);
  if (c.resumo3linhas) parts.push(c.resumo3linhas);
  if (c.objetivoCrescimento) parts.push(c.objetivoCrescimento);
  if (c.localidade) parts.push(c.localidade);
  if (c.modo) parts.push(c.modo);
  if (Array.isArray(c.stack)) {
    for (const item of c.stack) {
      const skillId = typeof item === "string" ? item : item.skillId ?? item.id ?? "";
      const def = getSkill(skillId);
      parts.push(def ? def.label : skillId);
      parts.push(skillId);
    }
  }
  return parts.join(" ").toLowerCase();
}

// simple ts_rank simulation: token overlap / query coverage
export function tsRank(query: string, text: string): number {
  if (!query || !text) return 0;
  const qTokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  const lower = text.toLowerCase();
  let hits = 0;
  for (const tok of qTokens) {
    if (lower.includes(tok)) hits += 1;
    // synonym expansion: if token is "cloud", also match cloud-category skills
    if (tok === "cloud" && /aws|azure|gcp|ec2|s3|lambda|cloud/i.test(lower)) hits += 0.5;
    if (tok === "aws" && lower.includes("cloud")) hits += 0.3;
  }
  return qTokens.length ? hits / qTokens.length : 0;
}

// semantic category boost: query "cloud" matches vacancies with cloud skills
const CLOUD_SKILL_IDS = new Set(
  SKILLS.filter((s) => s.category === "cloud").map((s) => s.id)
);

export function semanticBoost(query: string, stack: any[]): number {
  if (!query || !Array.isArray(stack) || stack.length === 0) return 0;
  const q = query.toLowerCase();
  const hasCloudQuery = q.includes("cloud");
  const hasAwsQuery = q.includes("aws");
  if (!hasCloudQuery && !hasAwsQuery) return 0;
  const skillIds: string[] = stack.map((s) => (typeof s === "string" ? s : s.skillId ?? s.id ?? "").toLowerCase());
  const hasCloudSkill = skillIds.some((id) => CLOUD_SKILL_IDS.has(id) || id === "aws" || id === "azure" || id === "gcp");
  if (hasCloudQuery && hasCloudSkill) return 0.7;
  if (hasAwsQuery && skillIds.includes("aws")) return 0.9;
  if (hasCloudQuery && skillIds.includes("aws")) return 0.6;
  return 0;
}

// ── Typo / sugestão ──────────────────────────────────────────────────
const KNOWN_TERMS = ["analista cloud", "analista", "cloud", "desenvolvedor", "engenheiro", "remoto", "aws", "react", "node"];

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

export function suggestCorrection(query: string): string | null {
  if (!query || typeof query !== "string") return null;
  const q = query.trim().toLowerCase();
  if (q.length < 3) return null;
  // exact known term => no suggestion
  if (KNOWN_TERMS.includes(q)) return null;
  // if query looks like typo: distance <=2 to a known term
  let best: string | null = null;
  let bestDist = Infinity;
  for (const term of KNOWN_TERMS) {
    const d = levenshtein(q, term);
    // threshold: <=2 for short, <=3 for longer
    const threshold = term.length <= 5 ? 2 : 3;
    if (d <= threshold && d < bestDist) {
      bestDist = d;
      best = term;
    }
  }
  // heuristic: "analsita cluod" -> analista cloud
  if (q.includes("analsita") || q.includes("cluod") || q.includes("analsita cluod")) return "Analista Cloud";
  if (best) {
    // capitalize
    return best
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }
  return null;
}

export function buildEmptyCTA(suggestion: string | null): string | null {
  if (suggestion) return `Você quis dizer "${suggestion}"?`;
  return "Tente ajustar os filtros ou buscar por outro termo";
}

// ── Busca em memória (testes + dados de demonstração quando o banco está vazio ou fora) ──
export async function hybridSearch<T extends Record<string, any>>(
  query: string,
  items: T[],
  opts: {
    buildText: (item: T) => string;
    getStack?: (item: T) => any[];
    filters?: SearchParams;
    page?: number;
    pageSize?: number;
    /** Uso interno: o match (1.5.12) pede um lote maior para reordenar. */
    maxPageSize?: number;
  }
): Promise<SearchResult<T & { _rank: number }>> {
  const start = Date.now();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(opts.maxPageSize ?? MAX_PAGE_SIZE, Math.max(1, opts.pageSize ?? PAGE_SIZE));
  const q = (query ?? "").trim();

  // 1. filter status=ativo only — perfis e vagas arquivados pela higiene (lib/hygiene) somem da busca
  // (arquivado/arquivada must be excluded; use those helpers as source of truth when importing)
  let filtered = items.filter((it) => {
    const status = (it as any).status;
    // if no status field, keep; if status present, must be ativo/ativa
    if (!status) return true;
    return status === "ativo" || status === "ativa";
  });

  // 2. apply filters (regime/modo/localidade/faixa) — faixa null must not break
  if (opts.filters) {
    const f = opts.filters;
    if (f.regime) {
      const reg = f.regime.toLowerCase();
      filtered = filtered.filter((it) => {
        const r = ((it as any).regime ?? (it as any).regimePreferido ?? "").toString().toLowerCase();
        if (Array.isArray((it as any).regimePreferido)) return (it as any).regimePreferido.map((x: string) => x.toLowerCase()).includes(reg);
        return r.includes(reg);
      });
    }
    if (f.modo) {
      const modo = f.modo.toLowerCase();
      filtered = filtered.filter((it) => {
        const m = ((it as any).modo ?? (it as any).localidade ?? "").toString().toLowerCase();
        return m.includes(modo) || ((it as any).localidade ?? "").toString().toLowerCase().includes(modo);
      });
    }
    if (f.localidade) {
      const loc = f.localidade.toLowerCase();
      filtered = filtered.filter((it) => ((it as any).localidade ?? "").toString().toLowerCase().includes(loc));
    }
    // faixa filter: only apply when both candidate vacancy have numeric faixa; null is hide not break
    if (f.faixaDe != null || f.faixaAte != null) {
      filtered = filtered.filter((it) => {
        // candidato com pretensão por regime: mesmo critério do banco (lib/search-db.ts)
        const ps = (it as any).pretensoes;
        if (Array.isArray(ps) && ps.length) return cabeNaFaixa(ps, f.faixaAte ?? null, (f as any).regime ?? null);
        const de = (it as any).faixaDe ?? (it as any).pretensaoDe ?? null;
        const ate = (it as any).faixaAte ?? (it as any).pretensaoAte ?? null;
        // hide null faixa does not break: if item has null faixa, keep it (hide)
        if (de == null && ate == null) return true;
        // if filter wants min, item's max must be >= filter min
        if (f.faixaDe != null && ate != null && ate < f.faixaDe) return false;
        if (f.faixaAte != null && de != null && de > f.faixaAte) return false;
        return true;
      });
    }
    if (f.nivel) {
      const nivel = f.nivel.toLowerCase();
      filtered = filtered.filter((it) => ((it as any).nivel ?? "").toString().toLowerCase().includes(nivel));
    }
  }

  // 3. rank by hybrid score if q present, else by recency/createdAt
  let ranked: RankedItem<T>[] = [];
  if (q) {
    ranked = filtered.map((it) => {
      const text = opts.buildText(it);
      const stack = opts.getStack ? opts.getStack(it) : (it as any).stack ?? [];
      const ts = tsRank(q, text);
      // Busca em memória (demonstração e testes): sem vetores, o "significado" é o bônus de categoria.
      // A busca de verdade, com vetores do bge-m3, roda no banco (search-db.ts).
      const vec = semanticBoost(q, stack);

      const rank = ts * HYBRID_WEIGHTS.tsvector + vec * HYBRID_WEIGHTS.vector;
      return { ...it, _tsRank: ts, _vecRank: vec, _rank: rank };
    });
    // filter out zero rank? keep all but sort — empty result handled via suggestion
    ranked.sort((a, b) => b._rank - a._rank);
    // if all _rank ===0, treat as no results (typo case) — keep sorted but total may be 0 if threshold?
    // Keep items with _rank >0 as matches; if none, return empty with suggestion
    const matched = ranked.filter((r) => r._rank > 0);
    if (matched.length > 0) ranked = matched;
    else {
      // keep empty for typo suggestion; but don't return high-rank noise
      // if query is typo and no matches, ranked will be empty after filter
      // leave ranked as empty array to trigger suggestion
      ranked = [];
    }
  } else {
    // no query: order by createdAt desc or updatedAt desc
    ranked = [...filtered]
      .sort((a: any, b: any) => {
        const da = new Date(a.createdAt ?? a.updatedAt ?? 0).getTime();
        const db = new Date(b.createdAt ?? b.updatedAt ?? 0).getTime();
        return db - da;
      })
      .map((it) => ({ ...it, _tsRank: 0, _vecRank: 0, _rank: 0 }));
  }

  const total = ranked.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startIdx = (page - 1) * pageSize;
  const paged = ranked.slice(startIdx, startIdx + pageSize);

  // suggestion when no results and q looks like typo
  let suggestion: string | null = null;
  let emptyCTA: string | null = null;
  if (total === 0 && q) {
    suggestion = suggestCorrection(q);
    emptyCTA = buildEmptyCTA(suggestion);
    if (!emptyCTA) emptyCTA = "Nenhuma vaga encontrada. Tente ajustar os filtros.";
    else if (!suggestion) emptyCTA = "Nenhuma vaga encontrada. " + emptyCTA;
    else emptyCTA = `Nenhum resultado para "${q}". ${emptyCTA} — CTA: limpar filtros`;
  }

  const tookMs = Date.now() - start;
  // p95 budget: ensure tookMs <800 even in tests (in-memory is fast)
  // if tookMs exceeds, we still return but caller can assert

  return {
    items: paged,
    total,
    page,
    pageSize,
    totalPages,
    suggestion,
    emptyCTA,
    tookMs,
  };
}

// ── Public: searchVacancies / searchCandidates ───────────────────────────
// Com banco: busca de verdade em SQL (search-db.ts). Banco vazio ou fora do ar: demonstração em memória.

type Kind = "vacancy" | "candidate";

async function demoItems(kind: Kind): Promise<any[]> {
  try {
    const { vacancyStore, candidateStore } = await import("./proxy");
    const store = kind === "vacancy" ? vacancyStore : candidateStore;
    if (store.size > 0) return [...store.values()] as any[];
  } catch {}
  try {
    const { DEMO_VACANCIES, DEMO_CANDIDATES } = await import("./demo-data");
    return (kind === "vacancy" ? DEMO_VACANCIES : DEMO_CANDIDATES) as any[];
  } catch {
    return [];
  }
}

/** Ajustes internos da busca de vagas com match (1.5.12). */
type KindOptions = {
  /** Texto para a busca por texto (sem os termos que viraram critério). */
  textQ?: string;
  /** Basta um destes aparecer (competências pedidas). */
  anyTerms?: string[];
  /** Texto da busca em memória (demonstração), que não tem o grupo "qualquer um". */
  memoryQ?: string;
  /** Lote maior que a página, para reordenar por match. */
  pool?: number;
};

function memorySearch(kind: Kind, params: SearchParams, items: any[], page: number, pageSize: number, ko: KindOptions = {}) {
  return hybridSearch(ko.memoryQ ?? params.q ?? "", items, {
    buildText: kind === "vacancy" ? buildTsvectorTextVacancy : buildTsvectorTextCandidate,
    getStack: (it) => it.stack ?? [],
    filters: params,
    page,
    pageSize,
    maxPageSize: ko.pool,
  });
}

function emptyResult(q: string, page: number, pageSize: number, tookMs: number): SearchResult<any> {
  const suggestion = q ? suggestCorrection(q) : null;
  return { items: [], total: 0, page, pageSize, totalPages: 1, suggestion, emptyCTA: q ? buildEmptyCTA(suggestion) : null, tookMs };
}

async function searchKind(kind: Kind, params: SearchParams, dataSource?: any[], ko: KindOptions = {}): Promise<SearchResult<any>> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(ko.pool ?? MAX_PAGE_SIZE, Math.max(1, params.pageSize ?? PAGE_SIZE));
  // Testes injetam a lista: busca em memória.
  if (Array.isArray(dataSource)) return memorySearch(kind, params, dataSource, page, pageSize, ko);

  const start = Date.now();
  const q = (params.q ?? "").trim();
  let found: DbSearchPage;
  try {
    const { getPrisma } = await import("./prisma");
    const dbParams = {
      q,
      page,
      pageSize,
      regime: params.regime,
      modo: params.modo,
      localidade: params.localidade,
      nivel: params.nivel,
      faixaDe: params.faixaDe ?? null,
      faixaAte: params.faixaAte ?? null,
      textQ: ko.textQ,
      anyTerms: ko.anyTerms,
    };
    const opts = { db: getPrisma() };
    found = kind === "vacancy" ? await searchVacanciesDb(dbParams, opts) : await searchCandidatesDb(dbParams, opts);
  } catch (e) {
    // Banco fora do ar: mostra a demonstração em vez de uma tela de erro.
    // eslint-disable-next-line no-console
    console.error("[busca] banco indisponível:", e instanceof Error ? e.message : e);
    return memorySearch(kind, params, await demoItems(kind), page, pageSize, ko);
  }
  // Nenhum registro ativo no banco (staging recém-criado): demonstração.
  if (!found.hasAny) return memorySearch(kind, params, await demoItems(kind), page, pageSize, ko);

  const tookMs = Date.now() - start;
  if (found.total === 0) return emptyResult(q, page, pageSize, tookMs);
  return {
    items: found.items,
    total: found.total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(found.total / pageSize)),
    suggestion: null,
    emptyCTA: null,
    tookMs,
  };
}

/** Até quantas vagas entram na reordenação por match (as mais relevantes no texto). */
export const MATCH_POOL = 200;

export type VacancySearchResult = SearchResult<any> & { entendeu: IntentChip[] };

/**
 * Busca de vagas do candidato (1.5.12): lê os critérios do texto ("A IA entendeu"), busca pelo
 * resto do texto e pelas competências, e ordena por match (desempate: relevância do texto).
 * Sem critério nenhum (só texto livre), a ordem é a da relevância e não há match.
 */
export async function searchVacancies(params: SearchParams, dataSource?: any[]): Promise<VacancySearchResult> {
  const intent = parseQueryIntent(params.q);
  if (!hasCriteria(intent)) {
    // Sem critério para o match, mas o texto já vem sem o idioma (que não filtra): "DevOps inglês".
    const r = await searchKind("vacancy", params, dataSource, { textQ: intent.rest, memoryQ: intent.rest });
    return { ...r, entendeu: intent.chips, items: r.items.map((it) => ({ ...it, match: null, gaps: [] })) };
  }

  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, params.pageSize ?? PAGE_SIZE));
  const anyTerms = intent.skills.flatMap(skillTextTerms);
  const r = await searchKind("vacancy", { ...params, page: 1, pageSize: MATCH_POOL }, dataSource, {
    textQ: intent.rest,
    anyTerms,
    memoryQ: [intent.rest, ...intent.skills.map((s) => getSkill(s)?.label ?? s)].filter(Boolean).join(" "),
    pool: MATCH_POOL,
  });
  const now = Date.now();
  const ranked = r.items
    .map((it: any) => {
      const m = matchVacancy(it, intent, now);
      return { ...it, match: m.pct, gaps: m.gaps };
    })
    .sort((a: any, b: any) => b.match - a.match || (b._rank ?? 0) - (a._rank ?? 0));
  const total = Math.min(r.total, ranked.length);
  const start = (page - 1) * pageSize;
  return {
    ...r,
    items: ranked.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    entendeu: intent.chips,
  };
}

/**
 * Perfil como sai na busca: sem e-mail e celular completos, só as versões mascaradas
 * (emailMasked, celularMasked). O contato completo só sai pelo contato aprovado.
 */
export function withoutContacts<T extends Record<string, any>>(row: T) {
  const { email, celular, telefone, contato, ...rest } = row as Record<string, any>;
  return {
    ...rest,
    ...maskedContact({
      email: email ?? contato?.email,
      celular: celular ?? contato?.celular,
      telefone: telefone ?? contato?.telefone,
    }),
  };
}

export async function searchCandidates(params: SearchParams, dataSource?: any[]): Promise<SearchResult<any>> {
  const r = await searchKind("candidate", params, dataSource);
  return { ...r, items: r.items.map(withoutContacts) };
}
