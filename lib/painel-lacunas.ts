/**
 * B1 "O que falta para as vagas" (plano B1, aprovado pelo Euclides em 2026-11-18).
 * Conta sem IA, com o mesmo match do recrutador (matchCandidato), olhando as vagas mais próximas
 * da ficha publicada. A faixa salarial nunca vira lacuna (D6): não empurra ninguém a pedir menos.
 * Fica fora de lib/painel.ts (que vai para o navegador) para não levar a taxonomia ao cliente.
 */
import { matchCandidato, senioridadesDoNivel, type VagaParaMatch } from "./match-candidato";
import { fold } from "./query-intent";

/** Só vagas com match a partir daqui contam como "próximas" (D2). */
export const LACUNAS_MIN_PCT = 40;
/** No máximo estas vagas, as de maior match (D2). */
export const LACUNAS_MAX_VAGAS = 30;
/** Com menos vagas próximas que isto, a tela não mostra contagens (D2). */
export const LACUNAS_MIN_VAGAS = 3;
/** Vagas ativas lidas por pedido (as mais recentes); o match escolhe as mais próximas entre elas. */
export const LACUNAS_LOTE_VAGAS = 500;
/** Competências mostradas em cada lista (D3). */
export const LACUNAS_MAX_SKILLS = 5;

export type CondicaoLacuna =
  | { kind: "nivel"; want: string; have: string | null; n: number }
  | { kind: "regime"; want: string; have: string[]; n: number }
  | { kind: "modo"; want: string; have: string | null; n: number };

export type LacunasVagas =
  | { estado: "sem_ficha" }
  | { estado: "poucas"; vagas: number }
  | {
      estado: "ok";
      vagas: number;
      /** Competências que a ficha não tem, da que falta em mais vagas para a que falta em menos. */
      faltam: { skill: string; label: string; n: number }[];
      /** Competências pedidas em que a ficha tem uma próxima (vale metade no match). */
      proximas: { skill: string; label: string; tem: string; temLabel: string; n: number }[];
      /** Nível, regime e modo que mais aparecem entre as vagas que a ficha não atende, quando pesam. */
      condicoes: CondicaoLacuna[];
    };

/** Uma condição só aparece quando falta em pelo menos 2 vagas e em 20% das próximas. */
function pesa(n: number, total: number): boolean {
  return n >= 2 && n >= total * 0.2;
}

function ordenar<T extends { n: number; label: string }>(xs: T[]): T[] {
  return xs.sort((a, b) => b.n - a.n || a.label.localeCompare(b.label, "pt-BR"));
}

/**
 * O que mais falta na ficha para as vagas próximas. `vagas` são as vagas ativas (qualquer ordem);
 * `rotulo` dá o nome de uma competência (o padrão é o id).
 */
export function lacunasDasVagas(
  perfil: unknown,
  vagas: VagaParaMatch[],
  opts: { now?: number; rotulo?: (skillId: string) => string } = {},
): LacunasVagas {
  const now = opts.now ?? Date.now();
  const rotulo = opts.rotulo ?? ((s: string) => s);
  const proximasVagas = vagas
    .map((v) => matchCandidato(perfil, v, now))
    .filter((m) => m.pct >= LACUNAS_MIN_PCT)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, LACUNAS_MAX_VAGAS);
  const total = proximasVagas.length;
  if (total < LACUNAS_MIN_VAGAS) return { estado: "poucas", vagas: total };

  const faltam = new Map<string, number>();
  const proximas = new Map<string, { tem: string; n: number }>();
  const nivel = new Map<string, { have: string | null; n: number }>();
  const regime = new Map<string, { want: string; have: string[]; n: number }>();
  const modo = new Map<string, { have: string | null; n: number }>();
  for (const m of proximasVagas) {
    // Uma vaga conta uma vez para cada competência, mesmo que a repita no stack.
    const vistas = new Set<string>();
    for (const g of m.gaps) {
      if (g.kind === "skill") {
        if (vistas.has(g.skill)) continue;
        vistas.add(g.skill);
        if (g.proxima) {
          const p = proximas.get(g.skill);
          proximas.set(g.skill, { tem: g.proxima, n: (p?.n ?? 0) + 1 });
        } else faltam.set(g.skill, (faltam.get(g.skill) ?? 0) + 1);
      } else if (g.kind === "nivel") {
        // "Sênior", "Senior" e "Sr" viram a mesma senioridade.
        const k = senioridadesDoNivel(g.want)?.[0];
        if (k) nivel.set(k, { have: g.have, n: (nivel.get(k)?.n ?? 0) + 1 });
      } else if (g.kind === "regime") {
        const k = fold(g.want);
        regime.set(k, { want: regime.get(k)?.want ?? g.want.trim(), have: g.have, n: (regime.get(k)?.n ?? 0) + 1 });
      } else if (g.kind === "modo") {
        modo.set(g.want, { have: g.have, n: (modo.get(g.want)?.n ?? 0) + 1 });
      }
      // kind "faixa": nunca vira lacuna (D6).
    }
  }

  const maior = <V extends { n: number }>(mapa: Map<string, V>): [string, V] | null =>
    [...mapa.entries()].sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0]))[0] ?? null;
  const condicoes: CondicaoLacuna[] = [];
  const nv = maior(nivel);
  if (nv && pesa(nv[1].n, total)) condicoes.push({ kind: "nivel", want: nv[0], have: nv[1].have, n: nv[1].n });
  const rg = maior(regime);
  if (rg && pesa(rg[1].n, total)) condicoes.push({ kind: "regime", want: rg[1].want, have: rg[1].have, n: rg[1].n });
  const md = maior(modo);
  if (md && pesa(md[1].n, total)) condicoes.push({ kind: "modo", want: md[0], have: md[1].have, n: md[1].n });

  return {
    estado: "ok",
    vagas: total,
    faltam: ordenar([...faltam].map(([skill, n]) => ({ skill, label: rotulo(skill), n }))).slice(0, LACUNAS_MAX_SKILLS),
    proximas: ordenar(
      [...proximas].map(([skill, p]) => ({ skill, label: rotulo(skill), tem: p.tem, temLabel: rotulo(p.tem), n: p.n })),
    ).slice(0, LACUNAS_MAX_SKILLS),
    condicoes,
  };
}
