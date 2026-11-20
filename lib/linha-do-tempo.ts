/**
 * Linha do tempo da carreira (plano 2026-11-20, D5–D7). Funções puras: rodam no navegador e nos testes.
 *
 * - Meses contados como número inteiro (ano * 12 + mês - 1). Um cargo de mar/2022 até hoje vai do mês
 *   de início ao mês atual, inclusive.
 * - Raias: cargos ao mesmo tempo descem uma raia (o primeiro que couber, do mais antigo para o mais novo).
 * - "Bate com a vaga" é por regra (D5): alguma competência do cargo atende uma da vaga, valendo as
 *   próximas do 2.2 (`pesoCompetencia` > 0). Sem vaga, nenhum cargo é marcado.
 * - Períodos sem trabalho não são contados nem destacados (D6, viés).
 */
import type { Experiencia, Formacao } from "./ficha";
import { pesoCompetencia } from "./taxonomia-proximas";

export type CargoNaLinha = Experiencia & { indice: number; ini: number; fim: number; raia: number; casa: boolean; paralelo: boolean };

export function mesDe(v: string): number | null {
  const m = /^(\d{4})-(\d{2})$/.exec(v ?? "");
  if (!m) return null;
  const mes = Number(m[2]);
  return mes >= 1 && mes <= 12 ? Number(m[1]) * 12 + (mes - 1) : null;
}

export function mesAtual(now: Date = new Date()): number {
  return now.getUTCFullYear() * 12 + now.getUTCMonth();
}

/** Algum cargo com competência que atende a vaga (exata, que cobre ou próxima). */
export function bateComVaga(skills: string[], vagaSkills: string[]): boolean {
  if (!skills.length || !vagaSkills.length) return false;
  return vagaSkills.some((v) => skills.some((s) => pesoCompetencia(s, v) > 0));
}

/** Cargos com início conhecido, em meses, distribuídos em raias. Sem fim e sem "atual" vira um mês só. */
export function montarCargos(experiencias: Experiencia[], vagaSkills: string[] = [], now: Date = new Date()): { cargos: CargoNaLinha[]; raias: number } {
  const hoje = mesAtual(now);
  const base = experiencias
    .map((e, indice) => {
      const ini = mesDe(e.inicio);
      if (ini == null || ini > hoje) return null;
      const fimLido = e.atual ? hoje : mesDe(e.fim);
      const fim = Math.min(hoje, Math.max(ini, fimLido ?? ini));
      return { ...e, indice, ini, fim, raia: 0, casa: bateComVaga(e.skills ?? [], vagaSkills), paralelo: !!e.tipo && e.tipo !== "integral" };
    })
    .filter((x): x is CargoNaLinha => !!x)
    // Integral primeiro no mesmo mês de início, para o emprego principal ficar na raia de cima.
    .sort((a, b) => a.ini - b.ini || Number(a.paralelo) - Number(b.paralelo) || b.fim - a.fim);
  const fins: number[] = [];
  for (const c of base) {
    let r = fins.findIndex((f) => f < c.ini);
    if (r < 0) {
      r = fins.length;
      fins.push(0);
    }
    fins[r] = c.fim;
    c.raia = r;
  }
  return { cargos: base, raias: fins.length };
}

/** Meses distintos cobertos por uma lista de cargos (sobreposições contam uma vez). */
function mesesCobertos(cargos: { ini: number; fim: number }[]): number {
  const ord = [...cargos].sort((a, b) => a.ini - b.ini);
  let total = 0;
  let ini = -1;
  let fim = -2;
  for (const c of ord) {
    if (c.ini > fim + 1) {
      if (fim >= ini && ini >= 0) total += fim - ini + 1;
      ini = c.ini;
      fim = c.fim;
    } else fim = Math.max(fim, c.fim);
  }
  if (ini >= 0) total += fim - ini + 1;
  return total;
}

export type NumerosCarreira = {
  /** Meses com algum trabalho (sobreposições uma vez). */
  mesesCarreira: number;
  /** Meses em cargos que batem com a vaga; null sem vaga. */
  mesesNaVaga: number | null;
  empresas: number;
  /** Meses em cada empresa, em média (empresas ao mesmo tempo contam cada uma inteira). */
  mediaPorEmpresa: number;
  /** Máximo de trabalhos no mesmo mês e o ano em que aconteceu pela primeira vez. */
  simultaneos: { n: number; ano: number | null };
};

export function numerosCarreira(cargos: CargoNaLinha[], comVaga: boolean): NumerosCarreira {
  const mesesCarreira = mesesCobertos(cargos);
  // Tempo em cada empresa (cargos da mesma empresa ao mesmo tempo contam uma vez), depois a média.
  const porEmpresa = new Map<string, CargoNaLinha[]>();
  for (const c of cargos) {
    const k = c.empresa.trim().toLowerCase();
    if (k) porEmpresa.set(k, [...(porEmpresa.get(k) ?? []), c]);
  }
  const empresas = porEmpresa.size;
  const somaEmpresas = [...porEmpresa.values()].reduce((s, l) => s + mesesCobertos(l), 0);
  let n = 0;
  let ano: number | null = null;
  const pontos = cargos.flatMap((c) => [c.ini, c.fim]);
  for (const m of [...new Set(pontos)].sort((a, b) => a - b)) {
    const k = cargos.filter((c) => c.ini <= m && m <= c.fim).length;
    if (k > n) {
      n = k;
      ano = Math.floor(m / 12);
    }
  }
  return {
    mesesCarreira,
    mesesNaVaga: comVaga ? mesesCobertos(cargos.filter((c) => c.casa)) : null,
    empresas,
    mediaPorEmpresa: empresas ? somaEmpresas / empresas : 0,
    simultaneos: { n, ano },
  };
}

/** Duração de um cargo em meses (inclui o mês de início e o de fim). */
export function duracaoMeses(c: { ini: number; fim: number }): number {
  return c.fim - c.ini + 1;
}

/** Janela visível: a carreira inteira (com folga de meio ano) ou os últimos 10 anos. */
export function janela(cargos: { ini: number }[], formacao: Formacao[], modo: "tudo" | "10", now: Date = new Date()): { ini: number; fim: number } {
  const fim = mesAtual(now) + 6;
  if (modo === "10") return { ini: fim - 6 - 10 * 12, fim };
  const anosForm = formacao.map((f) => Number(f.ano)).filter((a) => a > 1950).map((a) => a * 12);
  const ini = Math.min(...cargos.map((c) => c.ini), ...anosForm, mesAtual(now) - 24) - 6;
  return { ini, fim };
}

/** Ids das competências de uma vaga (campo `stack` em JSON: [{ skillId }] ou ["id"]). */
export function skillsDaVaga(stack: unknown): string[] {
  const out: string[] = [];
  for (const x of Array.isArray(stack) ? stack : []) {
    const id = typeof x === "string" ? x : typeof x?.skillId === "string" ? x.skillId : null;
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}
