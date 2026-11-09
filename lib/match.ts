/**
 * Match da vaga (1.5.12), com os pesos da spec §7.2:
 * competências 40%, nível 20%, regime/modelo/faixa 20%, recência 10%, completude da vaga 10%.
 *
 * Decisão do Euclides em 2026-11-09: enquanto não há login, o match mede quanto a vaga atende ao
 * que a pessoa buscou (QueryIntent). Critério não pedido conta como atendido. Depois do login
 * (1.5.5 + 1.5.10), o perfil do candidato entra no lugar da busca, com a mesma função.
 */
import { fold, type Modo, type Nivel, type QueryIntent, type Regime } from "./query-intent";

export const MATCH_WEIGHTS = { skills: 40, nivel: 20, condicoes: 20, recencia: 10, completude: 10 } as const;
/** Vaga atualizada até 7 dias atrás vale a recência inteira; com 60 dias ou mais, nada. */
export const RECENCIA_DIAS = { cheia: 7, zero: 60 } as const;

export type MatchCriteria = Pick<QueryIntent, "skills" | "regime" | "modo" | "nivel" | "faixaMin">;

export type MatchGap =
  | { kind: "skill"; skill: string }
  | { kind: "nivel"; want: Nivel; have: string | null }
  | { kind: "regime"; want: Regime; have: string | null }
  | { kind: "modo"; want: Modo; have: Modo | null }
  | { kind: "faixa"; want: number; have: number | null; moeda: string };

export type MatchResult = { pct: number; gaps: MatchGap[] };

export type MatchableVacancy = {
  stack?: unknown;
  nivel?: string | null;
  regime?: string | null;
  localidade?: string | null;
  faixaDe?: number | null;
  faixaAte?: number | null;
  faixaMoeda?: string | null;
  descricaoBullets?: unknown;
  updatedAt?: string | Date | null;
  createdAt?: string | Date | null;
};

/** Há algum critério para medir? Sem critério (só texto livre), não há match. */
export function hasCriteria(c: MatchCriteria): boolean {
  return c.skills.length > 0 || !!c.regime || !!c.modo || !!c.nivel || c.faixaMin != null;
}

export function vacancySkillIds(v: MatchableVacancy): string[] {
  if (!Array.isArray(v.stack)) return [];
  return v.stack
    .map((s: any) => (typeof s === "string" ? s : s?.skillId ?? s?.id ?? ""))
    .filter((s: unknown): s is string => typeof s === "string" && s.length > 0);
}

/** Modelo de trabalho a partir da localidade ("Remoto", "São Paulo (Híbrido)"…). Sem localidade = remoto. */
export function vacancyModo(localidade: string | null | undefined): Modo | null {
  if (localidade == null || localidade.trim() === "") return "remoto";
  const l = fold(localidade);
  if (/hibrid|hybrid|remoto parcial|parcialmente remoto/.test(l)) return "hibrido";
  if (/remot|home office|teletrabajo/.test(l)) return "remoto";
  if (/presencial|on-?site|in-office/.test(l)) return "presencial";
  return null;
}

function regimeOk(want: Regime, have: string | null | undefined): boolean {
  if (!have) return false;
  const h = fold(have);
  if (want === "Estágio") return /estagi|intern|trainee|pasant/.test(h);
  return new RegExp(`(^|[^a-z])${want.toLowerCase()}([^a-z]|$)`).test(h);
}

function nivelOk(want: Nivel, have: string | null | undefined): boolean {
  if (!have) return false;
  return fold(have).includes(fold(want));
}

function recencia(v: MatchableVacancy, now: number): number {
  const d = v.updatedAt ?? v.createdAt;
  const t = d ? new Date(d).getTime() : NaN;
  if (!Number.isFinite(t)) return 0;
  const dias = (now - t) / 86_400_000;
  if (dias <= RECENCIA_DIAS.cheia) return 1;
  if (dias >= RECENCIA_DIAS.zero) return 0;
  return 1 - (dias - RECENCIA_DIAS.cheia) / (RECENCIA_DIAS.zero - RECENCIA_DIAS.cheia);
}

function completude(v: MatchableVacancy): number {
  const partes = [
    v.faixaDe != null || v.faixaAte != null,
    !!v.nivel,
    !!v.regime,
    !!v.localidade,
    vacancySkillIds(v).length > 0,
    Array.isArray(v.descricaoBullets) && v.descricaoBullets.length > 0,
  ];
  return partes.filter(Boolean).length / partes.length;
}

/** Nota de 0 a 100 e o que falta, na ordem em que pesa mais. */
export function matchVacancy(v: MatchableVacancy, c: MatchCriteria, now: number = Date.now()): MatchResult {
  const gaps: MatchGap[] = [];

  // Competências (40)
  let skills = 1;
  if (c.skills.length) {
    const have = new Set(vacancySkillIds(v));
    const missing = c.skills.filter((s) => !have.has(s));
    skills = (c.skills.length - missing.length) / c.skills.length;
    for (const s of missing) gaps.push({ kind: "skill", skill: s });
  }

  // Nível (20)
  let nivel = 1;
  if (c.nivel && !nivelOk(c.nivel, v.nivel)) {
    nivel = 0;
    gaps.push({ kind: "nivel", want: c.nivel, have: v.nivel ?? null });
  }

  // Regime, modelo e faixa (20, divididos entre os que foram pedidos)
  const cond: number[] = [];
  if (c.regime) {
    const ok = regimeOk(c.regime, v.regime);
    cond.push(ok ? 1 : 0);
    if (!ok) gaps.push({ kind: "regime", want: c.regime, have: v.regime ?? null });
  }
  if (c.modo) {
    const have = vacancyModo(v.localidade);
    const ok = have === c.modo;
    cond.push(ok ? 1 : 0);
    if (!ok) gaps.push({ kind: "modo", want: c.modo, have });
  }
  if (c.faixaMin != null) {
    const teto = v.faixaAte ?? v.faixaDe ?? null;
    const ok = teto != null && teto >= c.faixaMin;
    cond.push(ok ? 1 : 0);
    if (!ok) gaps.push({ kind: "faixa", want: c.faixaMin, have: teto, moeda: v.faixaMoeda ?? "BRL" });
  }
  const condicoes = cond.length ? cond.reduce((a, b) => a + b, 0) / cond.length : 1;

  const W = MATCH_WEIGHTS;
  const pct = Math.round(
    W.skills * skills + W.nivel * nivel + W.condicoes * condicoes + W.recencia * recencia(v, now) + W.completude * completude(v),
  );
  return { pct: Math.max(0, Math.min(100, pct)), gaps };
}
