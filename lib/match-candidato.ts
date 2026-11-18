/**
 * Match do lado do recrutador (2.2b, plano 2.2 D4): a mesma conta do match do candidato
 * (lib/match.ts, pesos fixos), invertida. A vaga é o pedido e a ficha é quem atende.
 * Competências: todas as da vaga, cada uma com a melhor da ficha (exata, que cobre ou próxima, 2.2a).
 * Atualização e completude passam a ser da ficha. Não é IA e nada aqui usa idade, gênero, foto,
 * estado civil ou endereço exato.
 */
import { notaComPesos, recencia, type MatchPartes, regimeDaVaga, vacancyModo, vacancySkillIds, type MatchableVacancy } from "./match";
import { CAMPOS_MINIMOS, camposFaltando, sanitizeFicha, type Ficha } from "./ficha";
import { fold } from "./query-intent";
import { melhorCompetencia } from "./taxonomia-proximas";

export type GapCandidato =
  /** `proxima`: a ficha não tem a competência, mas tem uma próxima, que vale metade. */
  | { kind: "skill"; skill: string; proxima?: string }
  | { kind: "nivel"; want: string; have: string | null }
  | { kind: "regime"; want: string; have: string[] }
  | { kind: "modo"; want: string; have: string | null }
  | { kind: "faixa"; want: number; have: number; moeda: string };

export type MatchCandidato = { pct: number; gaps: GapCandidato[]; partes: MatchPartes };

/** Senioridade da ficha que atende o nível escrito na vaga. Nível que não dá para ler não conta. */
export function senioridadesDoNivel(nivel: string | null | undefined): string[] | null {
  if (!nivel) return null;
  const n = fold(nivel);
  if (/estagi|intern|trainee|pasant/.test(n)) return ["estagio"];
  if (/junior|jr\b/.test(n)) return ["junior"];
  if (/pleno|mid|semi ?senior|\bssr\b/.test(n)) return ["pleno"];
  if (/senior|sr\b/.test(n)) return ["senior", "especialista", "lideranca"];
  if (/especialista|specialist|staff|principal/.test(n)) return ["especialista", "lideranca"];
  if (/lider|lead|gerente|manager|head|coordena/.test(n)) return ["lideranca"];
  return null;
}

export type VagaParaMatch = MatchableVacancy & { id?: string; titulo?: string };

/** Nota de 0 a 100 da ficha para a vaga e o que falta, na ordem em que pesa mais. */
export function matchCandidato(perfil: unknown, v: VagaParaMatch, now: number = Date.now()): MatchCandidato {
  const f: Ficha = sanitizeFicha(perfil);
  const gaps: GapCandidato[] = [];

  // Competências (40): as da vaga, cada uma com a melhor da ficha.
  let skills = 1;
  const pedidas = vacancySkillIds(v);
  if (pedidas.length) {
    const daFicha = f.stack.map((s) => s.skillId);
    const faltam: GapCandidato[] = [];
    const proximas: GapCandidato[] = [];
    let soma = 0;
    for (const p of pedidas) {
      const m = melhorCompetencia(daFicha, p);
      soma += m?.peso ?? 0;
      if (!m) faltam.push({ kind: "skill", skill: p });
      else if (m.peso < 1) proximas.push({ kind: "skill", skill: p, proxima: m.skill });
    }
    skills = soma / pedidas.length;
    gaps.push(...faltam, ...proximas);
  }

  // Nível (20)
  let nivel = 1;
  const aceitas = senioridadesDoNivel(v.nivel);
  if (aceitas && !aceitas.includes(f.senioridade)) {
    nivel = 0;
    gaps.push({ kind: "nivel", want: v.nivel!, have: f.senioridade || null });
  }

  // Regime, modelo e faixa (20, divididos entre os que a vaga informa)
  const cond: number[] = [];
  const regime = regimeDaVaga(f.regimes, v.regime);
  if (v.regime) {
    cond.push(regime ? 1 : 0);
    if (!regime) gaps.push({ kind: "regime", want: v.regime, have: f.regimes });
  }
  // Vaga sem local não pede modelo: o critério não conta (no lado do candidato, sem local = remoto).
  const modoVaga = v.localidade?.trim() ? vacancyModo(v.localidade) : null;
  if (modoVaga) {
    const ok = f.modo === modoVaga;
    cond.push(ok ? 1 : 0);
    if (!ok) gaps.push({ kind: "modo", want: modoVaga, have: f.modo || null });
  }
  const teto = v.faixaAte ?? v.faixaDe ?? null;
  const moeda = v.faixaMoeda || "BRL";
  // Pretensão mensal do regime da vaga, na mesma moeda (sem câmbio). Sem ela, a faixa não conta.
  const p = regime ? f.pretensoes.find((x) => x.regime === regime && x.unidade === "mes" && x.valor != null && x.moeda === moeda) : undefined;
  if (teto != null && p?.valor != null) {
    const ok = p.valor <= teto;
    cond.push(ok ? 1 : 0);
    if (!ok) gaps.push({ kind: "faixa", want: teto, have: p.valor, moeda });
  }
  const condicoes = cond.length ? cond.reduce((a, b) => a + b, 0) / cond.length : 1;

  const o = (perfil ?? {}) as { updatedAt?: string | Date | null; createdAt?: string | Date | null };
  const completude = 1 - camposFaltando(f).length / CAMPOS_MINIMOS.length;
  const partes: MatchPartes = { skills, nivel, condicoes, recencia: recencia({ updatedAt: o.updatedAt, createdAt: o.createdAt }, now), completude };
  return { pct: notaComPesos(partes), gaps, partes };
}
