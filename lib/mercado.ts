/**
 * 3.2 Inteligência de mercado (plano https://claude.ai/artifact/REZMdpPqMMgLgUvwxXYRox, D1–D7).
 *
 * Números tirados das vagas e fichas do próprio W2Talent, sem IA:
 * - faixa_de / faixa_ate: p25, mediana e p75 da faixa das vagas ativas;
 * - pretensao: p25, mediana e p75 do mínimo mensal pedido nas fichas ativas;
 * - demanda: vagas ativas que pedem a competência, com as publicadas nos últimos 30 dias e nos 30 anteriores;
 * - oferta: fichas ativas com a competência;
 * - resposta_horas: tempo até a primeira resposta das candidaturas (site todo, últimos 90 dias).
 *
 * Grupos: competência + nível + regime + moeda (e o mesmo com modo). "" = todos.
 * Anonimato (D3): um grupo só ganha números com 10+ registros e, quando vem de vagas ou candidaturas,
 * de 3+ empresas. Abaixo disso a linha guarda só as contagens (para "faltam N vagas"). Nunca mínimo/máximo.
 * Vagas e fichas de exemplo (`demo-company`, `demo-*`) e de teste ficam fora.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { regimeDaVaga, vacancyModo, vacancySkillIds } from "./match";
import { senioridadesDoNivel } from "./match-candidato";
import { REGIMES } from "./vaga-campos";
import { faixaDaPretensao, faixaDasVagas, posicaoNaFaixa, valorDaVaga, type MercadoRascunho, type MercadoVagaRh } from "./mercado-tela";

export const MIN_REGISTROS = 10;
export const MIN_EMPRESAS = 3;
export const SEMANAS_GUARDADAS = 12;
export const DIAS_RECENTES = 30;
export const DIAS_RESPOSTA = 90;
const LOTE = 1000;
const DIA = 864e5;

export const METRICAS = ["faixa_de", "faixa_ate", "pretensao", "demanda", "oferta", "resposta_horas"] as const;
export type Metrica = (typeof METRICAS)[number];

export const NIVEIS_MERCADO = ["estagio", "junior", "pleno", "senior", "especialista", "lideranca"] as const;
export type NivelMercado = (typeof NIVEIS_MERCADO)[number];

export type Grupo = { skillId: string; nivel: string; regime: string; modo: string; moeda: string };
export type LinhaMercado = Grupo & {
  metrica: Metrica;
  n: number;
  nEmpresas: number | null;
  nRecentes: number | null;
  nAnteriores: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
};

// ---------- contas puras ----------

/** Percentil com interpolação linear (p em 0..1). Lista vazia = NaN. */
export function percentil(ordenados: number[], p: number): number {
  if (!ordenados.length) return NaN;
  const i = (ordenados.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return ordenados[lo] + (ordenados[hi] - ordenados[lo]) * (i - lo);
}

/** O grupo pode mostrar números? (D3) */
export function publicavel(n: number, nEmpresas: number | null): boolean {
  return n >= MIN_REGISTROS && (nEmpresas == null || nEmpresas >= MIN_EMPRESAS);
}

/** Quantos registros/empresas faltam para o grupo aparecer (D7). */
export function faltam(l: Pick<LinhaMercado, "n" | "nEmpresas">): { registros: number; empresas: number } {
  return {
    registros: Math.max(0, MIN_REGISTROS - l.n),
    empresas: l.nEmpresas == null ? 0 : Math.max(0, MIN_EMPRESAS - l.nEmpresas),
  };
}

/** Nível da vaga ("Sênior", "Pleno/Sênior", "Jr") no nível de mercado; sem leitura = null. */
export function nivelDaVaga(nivel: string | null | undefined): NivelMercado | null {
  const s = senioridadesDoNivel(nivel);
  return (s?.[0] as NivelMercado | undefined) ?? null;
}

export function nivelDaFicha(senioridade: string | null | undefined): NivelMercado | null {
  return (NIVEIS_MERCADO as readonly string[]).includes(senioridade ?? "") ? (senioridade as NivelMercado) : null;
}

/** Regime da vaga ("CLT ou PJ" conta no primeiro que aparecer). */
export function regimeMercado(regime: string | null | undefined): string | null {
  return regimeDaVaga([...REGIMES], regime);
}

const r2 = (x: number) => Math.round(x * 100) / 100;

function linhaDe(metrica: Metrica, g: Grupo, valores: number[], empresas: Set<string> | null, extra: Partial<LinhaMercado> = {}): LinhaMercado {
  const n = valores.length;
  const nEmpresas = empresas ? empresas.size : null;
  const ok = publicavel(n, nEmpresas);
  const ord = ok ? [...valores].sort((a, b) => a - b) : [];
  return {
    ...g,
    metrica,
    n,
    nEmpresas,
    nRecentes: null,
    nAnteriores: null,
    p25: ok ? r2(percentil(ord, 0.25)) : null,
    p50: ok ? r2(percentil(ord, 0.5)) : null,
    p75: ok ? r2(percentil(ord, 0.75)) : null,
    ...extra,
  };
}

type Acum = { metrica: Metrica; grupo: Grupo; valores: number[]; empresas: Set<string> | null };
const chave = (m: string, g: Grupo) => [m, g.skillId, g.nivel, g.regime, g.modo, g.moeda].join("|");

function acumular(mapa: Map<string, Acum>, metrica: Metrica, g: Grupo, valor: number, empresa: string | null) {
  const k = chave(metrica, g);
  let a = mapa.get(k);
  if (!a) mapa.set(k, (a = { metrica, grupo: g, valores: [], empresas: empresa == null ? null : new Set() }));
  a.valores.push(valor);
  if (empresa != null) a.empresas!.add(empresa);
}

/** Os grupos de um registro: sempre por nível+regime+moeda, com e sem a competência, com e sem o modo. */
function gruposDe(skills: string[], nivel: string, regime: string, moeda: string, modo: string | null): Grupo[] {
  const out: Grupo[] = [];
  for (const skillId of ["", ...new Set(skills)]) {
    out.push({ skillId, nivel, regime, modo: "", moeda });
    if (modo) out.push({ skillId, nivel, regime, modo, moeda });
  }
  return out;
}

export type VagaMercado = {
  companyId: string;
  stack: unknown;
  nivel: string | null;
  regime: string | null;
  localidade: string | null;
  faixaDe: number | null;
  faixaAte: number | null;
  faixaMoeda: string | null;
  status: string;
  expiresAt: Date;
  createdAt: Date;
};
export type FichaMercado = { stack: unknown; senioridade: string | null; pretensoes: unknown };
export type RespostaMercado = { companyId: string | null; createdAt: Date; respondidaEm: Date };

export function skillsDaFicha(stack: unknown): string[] {
  if (!Array.isArray(stack)) return [];
  return stack.map((s: any) => (typeof s === "string" ? s : s?.skillId ?? "")).filter((s): s is string => typeof s === "string" && !!s);
}

/** Mínimo mensal da pretensão por regime (só unidade "mes"). */
export function pretensoesMensais(p: unknown): { regime: string; valor: number; moeda: string }[] {
  if (!Array.isArray(p)) return [];
  const out: { regime: string; valor: number; moeda: string }[] = [];
  for (const x of p as any[]) {
    const regime = regimeMercado(typeof x?.regime === "string" ? x.regime : null);
    const valor = Number(x?.valor);
    if (!regime || !Number.isFinite(valor) || valor <= 0) continue;
    if ((x?.unidade ?? "mes") !== "mes") continue;
    out.push({ regime, valor, moeda: typeof x?.moeda === "string" && x.moeda ? x.moeda : "BRL" });
  }
  return out;
}

/** Calcula todas as linhas a partir dos registros já filtrados (sem exemplo/teste). */
export function calcularMercado(
  vagas: VagaMercado[],
  vagasRecentes: { stack: unknown; createdAt: Date }[],
  fichas: FichaMercado[],
  respostas: RespostaMercado[],
  now: Date,
): LinhaMercado[] {
  const t = now.getTime();
  const faixa = new Map<string, Acum>();
  const demanda = new Map<string, { n: number; empresas: Set<string> }>();
  for (const v of vagas) {
    if (v.status !== "ativa" || v.expiresAt.getTime() <= t) continue;
    const skills = vacancySkillIds(v as any);
    for (const s of new Set(skills)) {
      const d = demanda.get(s) ?? { n: 0, empresas: new Set<string>() };
      d.n++;
      d.empresas.add(v.companyId);
      demanda.set(s, d);
    }
    const nivel = nivelDaVaga(v.nivel);
    const regime = regimeMercado(v.regime);
    if (!nivel || !regime) continue;
    const de = v.faixaDe;
    const ate = v.faixaAte;
    if (typeof de !== "number" || typeof ate !== "number" || de <= 0 || ate < de) continue;
    const moeda = v.faixaMoeda || "BRL";
    for (const g of gruposDe(skills, nivel, regime, moeda, vacancyModo(v.localidade))) {
      acumular(faixa, "faixa_de", g, de, v.companyId);
      acumular(faixa, "faixa_ate", g, ate, v.companyId);
    }
  }

  // Tendência: vagas publicadas (qualquer status) nos últimos 30 dias contra os 30 anteriores.
  const rec = new Map<string, [number, number]>();
  for (const v of vagasRecentes) {
    const idade = (t - v.createdAt.getTime()) / DIA;
    if (idade >= 2 * DIAS_RECENTES) continue;
    const i: 0 | 1 = idade < DIAS_RECENTES ? 0 : 1;
    for (const s of new Set(vacancySkillIds(v as any))) {
      const c = rec.get(s) ?? [0, 0];
      c[i]++;
      rec.set(s, c);
    }
  }

  const pret = new Map<string, Acum>();
  const oferta = new Map<string, number>();
  for (const f of fichas) {
    const skills = skillsDaFicha(f.stack);
    for (const s of new Set(skills)) oferta.set(s, (oferta.get(s) ?? 0) + 1);
    const nivel = nivelDaFicha(f.senioridade);
    if (!nivel) continue;
    for (const p of pretensoesMensais(f.pretensoes)) {
      for (const g of gruposDe(skills, nivel, p.regime, p.moeda, null)) acumular(pret, "pretensao", g, p.valor, null);
    }
  }

  const out: LinhaMercado[] = [];
  for (const a of [...faixa.values(), ...pret.values()]) out.push(linhaDe(a.metrica, a.grupo, a.valores, a.empresas));

  const vazio = { nivel: "", regime: "", modo: "", moeda: "" };
  const todasSkills = new Set([...demanda.keys(), ...rec.keys()]);
  for (const s of todasSkills) {
    const d = demanda.get(s);
    const [nRecentes, nAnteriores] = rec.get(s) ?? [0, 0];
    out.push({ ...vazio, skillId: s, metrica: "demanda", n: d?.n ?? 0, nEmpresas: d?.empresas.size ?? 0, nRecentes, nAnteriores, p25: null, p50: null, p75: null });
  }
  for (const [s, n] of oferta) out.push({ ...vazio, skillId: s, metrica: "oferta", n, nEmpresas: null, nRecentes: null, nAnteriores: null, p25: null, p50: null, p75: null });

  const horas: number[] = [];
  const empResp = new Set<string>();
  for (const r of respostas) {
    if (t - r.createdAt.getTime() > DIAS_RESPOSTA * DIA) continue;
    const h = (r.respondidaEm.getTime() - r.createdAt.getTime()) / 36e5;
    if (!(h >= 0)) continue;
    horas.push(h);
    if (r.companyId) empResp.add(r.companyId);
  }
  out.push(linhaDe("resposta_horas", { skillId: "", ...vazio }, horas, empResp));
  return out;
}

/** Segunda-feira 00:00 UTC da semana de `d`. */
export function inicioDaSemana(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = (x.getUTCDay() + 6) % 7;
  return new Date(x.getTime() - dow * DIA);
}

// ---------- banco ----------

type DbMercado = Pick<PrismaClient, "vacancy" | "candidateProfile" | "application" | "marketStat" | "$transaction">;

/** Vagas e fichas de exemplo/teste não entram. */
export const VAGA_REAL: Prisma.VacancyWhereInput = {
  companyId: { not: "demo-company" },
  company: { validacaoStatus: { not: "rejeitado" } },
};
export const FICHA_REAL: Prisma.CandidateProfileWhereInput = {
  NOT: [{ userId: { startsWith: "demo-" } }, { userId: { startsWith: "teste:" } }],
};

async function todas<T extends { id: string }>(buscar: (cursor: string | undefined) => Promise<T[]>): Promise<T[]> {
  const out: T[] = [];
  let cursor: string | undefined;
  for (;;) {
    const lote = await buscar(cursor);
    out.push(...lote);
    if (lote.length < LOTE) return out;
    cursor = lote[lote.length - 1].id;
  }
}
const pagina = (cursor: string | undefined) => ({ take: LOTE, orderBy: { id: "asc" as const }, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}) });

/** Recalcula a semana atual e apaga as fotos com mais de 12 semanas. Chamado pelo Cron diário. */
export async function atualizarMercado(db: DbMercado, now = new Date()): Promise<{ linhas: number; publicaveis: number; semana: string }> {
  const t = now.getTime();
  const vagas = await todas((c) =>
    db.vacancy.findMany({
      where: { ...VAGA_REAL, status: "ativa", expiresAt: { gt: now } },
      select: { id: true, companyId: true, stack: true, nivel: true, regime: true, localidade: true, faixaDe: true, faixaAte: true, faixaMoeda: true, status: true, expiresAt: true, createdAt: true },
      ...pagina(c),
    }),
  );
  const recentes = await todas((c) =>
    db.vacancy.findMany({ where: { ...VAGA_REAL, createdAt: { gt: new Date(t - 2 * DIAS_RECENTES * DIA) } }, select: { id: true, stack: true, createdAt: true }, ...pagina(c) }),
  );
  const fichas = await todas((c) =>
    db.candidateProfile.findMany({
      where: { ...FICHA_REAL, status: "ativo", expiresAt: { gt: now } },
      select: { id: true, stack: true, senioridade: true, pretensoes: true },
      ...pagina(c),
    }),
  );
  const respostas = (await todas((c) =>
    db.application.findMany({
      where: { origem: "candidaturaLote", respondidaEm: { not: null }, createdAt: { gt: new Date(t - DIAS_RESPOSTA * DIA) }, companyId: { not: "demo-company" }, company: { validacaoStatus: { not: "rejeitado" } }, candidate: FICHA_REAL },
      select: { id: true, companyId: true, createdAt: true, respondidaEm: true },
      ...pagina(c),
    }),
  )) as (RespostaMercado & { id: string })[];

  const linhas = calcularMercado(vagas as VagaMercado[], recentes, fichas, respostas, now);
  const semana = inicioDaSemana(now);
  await db.$transaction([
    db.marketStat.deleteMany({ where: { semana } }),
    db.marketStat.createMany({ data: linhas.map((l) => ({ ...l, semana })) }),
    db.marketStat.deleteMany({ where: { semana: { lt: new Date(semana.getTime() - SEMANAS_GUARDADAS * 7 * DIA) } } }),
  ]);
  return { linhas: linhas.length, publicaveis: linhas.filter((l) => l.p50 != null).length, semana: semana.toISOString().slice(0, 10) };
}

// ---------- leitura (telas) ----------

export type Faixa = { p25: number; p50: number; p75: number };
export type GrupoFaixa = Grupo & { n: number; nEmpresas: number | null; de: Faixa | null; ate: Faixa | null; faltam: { registros: number; empresas: number } };
export type GrupoPretensao = Grupo & { n: number; valor: Faixa | null; faltam: { registros: number; empresas: number } };
export type Demanda = { skillId: string; vagas: number; empresas: number; recentes: number; anteriores: number; fichas: number };
export type VisaoMercado = {
  semana: string | null;
  skillId: string | null;
  faixas: GrupoFaixa[];
  pretensoes: GrupoPretensao[];
  maisPedidas: Demanda[];
  emAlta: Demanda[];
  demanda: Demanda | null;
  respostaHoras: Faixa | null;
};

const faixaDe = (l: { p25: number | null; p50: number | null; p75: number | null } | undefined): Faixa | null =>
  l && l.p25 != null && l.p50 != null && l.p75 != null ? { p25: l.p25, p50: l.p50, p75: l.p75 } : null;

type LinhaLida = Grupo & { metrica: string; n: number; nEmpresas: number | null; p25: number | null; p50: number | null; p75: number | null };

/** Junta as linhas faixa_de/faixa_ate de um grupo numa só e separa as de pretensão. */
function montarGrupos(linhas: LinhaLida[]): { faixas: GrupoFaixa[]; pretensoes: GrupoPretensao[] } {
  const porGrupo = new Map<string, GrupoFaixa>();
  const pretensoes: GrupoPretensao[] = [];
  for (const l of linhas) {
    const g: Grupo = { skillId: l.skillId, nivel: l.nivel, regime: l.regime, modo: l.modo, moeda: l.moeda };
    if (l.metrica === "pretensao") {
      pretensoes.push({ ...g, n: l.n, valor: faixaDe(l), faltam: faltam(l) });
      continue;
    }
    const k = chave("f", g);
    const atual = porGrupo.get(k) ?? { ...g, n: l.n, nEmpresas: l.nEmpresas, de: null, ate: null, faltam: faltam(l) };
    if (l.metrica === "faixa_de") atual.de = faixaDe(l);
    else atual.ate = faixaDe(l);
    porGrupo.set(k, atual);
  }
  return { faixas: [...porGrupo.values()], pretensoes };
}

/** Crescimento usado em "em alta": só com 5+ vagas recentes, ordenado pelo aumento relativo. */
export const MIN_RECENTES_ALTA = 5;
export function emAlta(ds: Demanda[], max = 10): Demanda[] {
  return ds
    .filter((d) => d.recentes >= MIN_RECENTES_ALTA && d.empresas >= MIN_EMPRESAS && d.recentes > d.anteriores)
    .sort((a, b) => (b.recentes + 1) / (b.anteriores + 1) - (a.recentes + 1) / (a.anteriores + 1) || b.recentes - a.recentes)
    .slice(0, max);
}

/**
 * O que as telas mostram. Sem `skillId`: visão geral (todas as competências).
 * Com `skillId`: faixas e pretensões daquela competência por nível/regime/moeda (modo "" = todos os modos).
 */
export async function lerMercado(db: Pick<PrismaClient, "marketStat">, opts: { skillId?: string | null; modo?: string | null } = {}): Promise<VisaoMercado> {
  const ultima = await db.marketStat.findFirst({ orderBy: { semana: "desc" }, select: { semana: true } });
  const skillId = opts.skillId || null;
  if (!ultima) return { semana: null, skillId, faixas: [], pretensoes: [], maisPedidas: [], emAlta: [], demanda: null, respostaHoras: null };
  const semana = ultima.semana;
  const modo = opts.modo || "";
  const [grupos, dem, ofe, resp] = await Promise.all([
    db.marketStat.findMany({ where: { semana, skillId: skillId ?? "", modo, metrica: { in: ["faixa_de", "faixa_ate", "pretensao"] } } }),
    db.marketStat.findMany({ where: { semana, metrica: "demanda" } }),
    db.marketStat.findMany({ where: { semana, metrica: "oferta" }, select: { skillId: true, n: true } }),
    db.marketStat.findFirst({ where: { semana, metrica: "resposta_horas" } }),
  ]);
  const fichasPor = new Map(ofe.map((o) => [o.skillId, o.n]));
  const demandas: Demanda[] = dem.map((d) => ({
    skillId: d.skillId,
    vagas: d.n,
    empresas: d.nEmpresas ?? 0,
    recentes: d.nRecentes ?? 0,
    anteriores: d.nAnteriores ?? 0,
    fichas: fichasPor.get(d.skillId) ?? 0,
  }));

  const { faixas, pretensoes } = montarGrupos(grupos);
  const ordemNivel = (n: string) => (NIVEIS_MERCADO as readonly string[]).indexOf(n);
  const ordenar = <T extends Grupo>(xs: T[]) =>
    xs.sort((a, b) => ordemNivel(a.nivel) - ordemNivel(b.nivel) || a.regime.localeCompare(b.regime) || a.moeda.localeCompare(b.moeda));

  // Demanda e contagens de vagas são públicas (as vagas estão no site), mas seguem o mínimo de empresas.
  const visiveis = demandas.filter((d) => d.empresas >= MIN_EMPRESAS);
  return {
    semana: semana.toISOString().slice(0, 10),
    skillId,
    faixas: ordenar(faixas),
    pretensoes: ordenar(pretensoes),
    maisPedidas: [...visiveis].sort((a, b) => b.vagas - a.vagas || a.skillId.localeCompare(b.skillId)).slice(0, 15),
    emAlta: emAlta(visiveis),
    demanda: skillId ? (demandas.find((d) => d.skillId === skillId) ?? null) : null,
    respostaHoras: faixaDe(resp ?? undefined),
  };
}

// ---------- 3.2b: um grupo dentro das telas logadas ----------

/** Competência + nível + regime + moeda (o modo fica "" = todos os modos). */
export type GrupoChave = Pick<Grupo, "skillId" | "nivel" | "regime" | "moeda">;
export type MercadoDoGrupo = GrupoChave & { vagas: GrupoFaixa | null; pretensao: GrupoPretensao | null };

/** Mais grupos que isto por leitura não entram (o /rh lê até RH_MAX_VAGAS). */
export const MAX_GRUPOS_LEITURA = 300;
const chaveGrupo = (g: GrupoChave) => [g.skillId, g.nivel, g.regime, g.moeda].join("|");

/**
 * Lê da última semana calculada as linhas de vagas e de pretensão de cada grupo pedido (todos os modos).
 * Grupo sem linha volta com `vagas`/`pretensao` null. Os números só existem nos grupos publicáveis (D3):
 * abaixo do mínimo a linha tem só as contagens e `de`/`ate`/`valor` ficam null.
 */
export async function lerGrupos(db: Pick<PrismaClient, "marketStat">, pedidos: GrupoChave[]): Promise<{ semana: string | null; grupos: MercadoDoGrupo[] }> {
  const unicos = [...new Map(pedidos.filter((g) => g.skillId && g.nivel && g.regime && g.moeda).map((g) => [chaveGrupo(g), g])).values()].slice(0, MAX_GRUPOS_LEITURA);
  if (!unicos.length) return { semana: null, grupos: [] };
  const ultima = await db.marketStat.findFirst({ orderBy: { semana: "desc" }, select: { semana: true } });
  if (!ultima) return { semana: null, grupos: unicos.map((g) => ({ ...g, vagas: null, pretensao: null })) };
  const linhas = await db.marketStat.findMany({
    where: {
      semana: ultima.semana,
      modo: "",
      metrica: { in: ["faixa_de", "faixa_ate", "pretensao"] },
      OR: unicos.map((g) => ({ skillId: g.skillId, nivel: g.nivel, regime: g.regime, moeda: g.moeda })),
    },
  });
  const { faixas, pretensoes } = montarGrupos(linhas);
  const fx = new Map(faixas.map((f) => [chaveGrupo(f), f]));
  const pr = new Map(pretensoes.map((p) => [chaveGrupo(p), p]));
  return {
    semana: ultima.semana.toISOString().slice(0, 10),
    grupos: unicos.map((g) => ({ ...g, vagas: fx.get(chaveGrupo(g)) ?? null, pretensao: pr.get(chaveGrupo(g)) ?? null })),
  };
}

/** Grupo de mercado de uma vaga (ou rascunho): a primeira competência, o nível, o regime e a moeda. Sem algum deles, null. */
export function grupoDaVaga(v: { stack: unknown; nivel: string | null | undefined; regime: string | null | undefined; faixaMoeda?: string | null }): GrupoChave | null {
  const skillId = vacancySkillIds({ stack: v.stack } as any)[0];
  const nivel = nivelDaVaga(v.nivel);
  const regime = regimeMercado(v.regime);
  if (!skillId || !nivel || !regime) return null;
  return { skillId, nivel, regime, moeda: v.faixaMoeda || "BRL" };
}

/**
 * /publicar (3.2b, D5/D6): o mercado do rascunho, só informativo. Vagas: faixa típica do grupo
 * (`faixaDasVagas`); pretensão: só a faixa agregada de 10+ fichas, nunca a de alguém.
 */
export async function mercadoDoRascunho(
  db: Pick<PrismaClient, "marketStat">,
  r: { stack: unknown; nivel: string | null | undefined; regime: string | null | undefined; faixaMoeda?: string | null },
  rotulo: (skillId: string) => string = (s) => s,
): Promise<MercadoRascunho | null> {
  const g = grupoDaVaga(r);
  if (!g) return null;
  const lido = (await lerGrupos(db, [g])).grupos[0];
  if (!lido) return null;
  const vagas = faixaDasVagas(lido.vagas);
  const pretensao = faixaDaPretensao(lido.pretensao?.valor);
  return {
    ...g,
    label: rotulo(g.skillId),
    vagas: vagas && lido.vagas ? { ...vagas, n: lido.vagas.n } : null,
    pretensao: pretensao && lido.pretensao ? { ...pretensao, n: lido.pretensao.n } : null,
  };
}

/** /rh (3.2b): posição de cada vaga (meio da faixa, `valorDaVaga`) contra a faixa típica do grupo dela. */
export async function posicoesNoMercado(
  db: Pick<PrismaClient, "marketStat">,
  vagas: { id: string; stack: unknown; nivel: string | null; regime: string | null; faixaDe: number | null; faixaAte: number | null; faixaMoeda: string | null }[],
): Promise<Map<string, MercadoVagaRh>> {
  const out = new Map<string, MercadoVagaRh>();
  const comGrupo = vagas
    .map((v) => ({ v, g: grupoDaVaga(v), valor: valorDaVaga(v.faixaDe, v.faixaAte) }))
    .filter((x): x is { v: (typeof vagas)[number]; g: GrupoChave; valor: number } => !!x.g && x.valor != null);
  if (!comGrupo.length) return out;
  const { grupos } = await lerGrupos(db, comGrupo.map((x) => x.g));
  const porChave = new Map(grupos.map((g) => [chaveGrupo(g), g]));
  for (const { v, g, valor } of comGrupo) {
    const faixa = faixaDasVagas(porChave.get(chaveGrupo(g))?.vagas);
    const posicao = posicaoNaFaixa(valor, faixa);
    if (faixa && posicao) out.set(v.id, { posicao, faixa, moeda: g.moeda });
  }
  return out;
}
