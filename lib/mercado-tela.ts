/**
 * 3.2a Inteligência de mercado: o formato de `GET /api/mercado` e as contas pequenas da tela `/mercado`.
 * Arquivo puro e sem banco: a tela importa daqui sem levar o Prisma nem o cálculo (lib/mercado.ts) ao navegador.
 */
import type { Demanda, Faixa, GrupoFaixa, VisaoMercado } from "./mercado";

export const MODOS_MERCADO = ["remoto", "hibrido", "presencial"] as const;
export type ModoMercado = (typeof MODOS_MERCADO)[number];

export function modoValido(v: unknown): ModoMercado | null {
  return typeof v === "string" && (MODOS_MERCADO as readonly string[]).includes(v) ? (v as ModoMercado) : null;
}

/** O que a API devolve: a visão de `lerMercado` mais os nomes das competências. */
export type MercadoApi = Omit<VisaoMercado, "demanda"> & {
  modo: ModoMercado | null;
  /** Competência escolhida, com o nome da taxonomia. */
  skill: { id: string; label: string } | null;
  /** Vagas e fichas da competência escolhida; null abaixo do mínimo de empresas. */
  demanda: Demanda | null;
  /** Empresas que faltam para mostrar a demanda da competência escolhida (0 = nada falta). */
  demandaFaltamEmpresas: number;
  /** As fichas não guardam pretensão por modo: com `modo`, a pretensão é a de todos os modos. */
  pretensoesTodosModos: boolean;
  /** skillId → nome, para todas as competências da resposta. */
  nomes: Record<string, string>;
};

/** Horas → { unidade, valor }: abaixo de 48 h em horas (1 casa), a partir daí em dias inteiros. */
export function tempoLegivel(horas: number): { unidade: "horas" | "dias"; valor: number } {
  if (horas < 48) return { unidade: "horas", valor: Math.round(Math.max(horas, 0.1) * 10) / 10 };
  return { unidade: "dias", valor: Math.round(horas / 24) };
}

/** Vagas por ficha (2 casas); sem fichas = null. */
export function vagasPorFicha(d: Pick<Demanda, "vagas" | "fichas">): number | null {
  return d.fichas > 0 ? Math.round((d.vagas / d.fichas) * 100) / 100 : null;
}

/** Aumento dos últimos 30 dias sobre os 30 anteriores, em %; sem anteriores = null ("novo"). */
export function variacaoPct(d: Pick<Demanda, "recentes" | "anteriores">): number | null {
  return d.anteriores > 0 ? Math.round(((d.recentes - d.anteriores) / d.anteriores) * 100) : null;
}

// ---------- 3.2b: comparar um valor com o mercado (painel, Publicar, Painel RH) ----------

export type Posicao = "abaixo" | "dentro" | "acima";

/** Uma faixa de referência do mercado: de, até e o valor do meio. */
export type FaixaMercado = { de: number; ate: number; mediana: number };

/**
 * Onde `valor` fica na faixa: abaixo do "de", dentro (pontas incluídas) ou acima do "até".
 * Valor que não é número positivo, ou faixa invertida, = null.
 */
export function posicaoNaFaixa(valor: number | null | undefined, faixa: Pick<FaixaMercado, "de" | "ate"> | null | undefined): Posicao | null {
  if (!faixa || typeof valor !== "number" || !Number.isFinite(valor) || valor <= 0) return null;
  if (!(faixa.de <= faixa.ate)) return null;
  if (valor < faixa.de) return "abaixo";
  if (valor > faixa.ate) return "acima";
  return "dentro";
}

/**
 * Faixa típica das vagas de um grupo: do "de" mediano ao "até" mediano das vagas, e o meio entre os dois.
 * (A tabela guarda o "de" e o "até" separados; não existe o percentil do meio de cada vaga.)
 * Grupo abaixo do mínimo (sem números) = null.
 */
export function faixaDasVagas(g: Pick<GrupoFaixa, "de" | "ate"> | null | undefined): FaixaMercado | null {
  if (!g?.de || !g.ate) return null;
  const de = g.de.p50;
  const ate = Math.max(de, g.ate.p50);
  return { de, ate, mediana: Math.round(((de + ate) / 2) * 100) / 100 };
}

/** Pretensão agregada das fichas (D6): a metade do meio (25%–75%) e a mediana. Abaixo de 10 fichas = null. */
export function faixaDaPretensao(v: Faixa | null | undefined): FaixaMercado | null {
  return v ? { de: v.p25, ate: v.p75, mediana: v.p50 } : null;
}

/** Valor de uma vaga para comparar com o mercado: o meio da faixa; com só uma ponta, essa ponta. */
export function valorDaVaga(faixaDe: number | null | undefined, faixaAte: number | null | undefined): number | null {
  const de = typeof faixaDe === "number" && faixaDe > 0 ? faixaDe : null;
  const ate = typeof faixaAte === "number" && faixaAte > 0 ? faixaAte : null;
  if (de != null && ate != null) return ate >= de ? (de + ate) / 2 : null;
  return de ?? ate;
}

/** GET /api/painel/mercado: a pretensão da ficha publicada contra as vagas da competência principal. */
export type PainelMercado =
  | { estado: "sem_ficha" }
  | {
      estado: "ok";
      semana: string | null;
      /** Primeira competência da ficha com faixa publicável no nível e regime da ficha; null = poucos dados. */
      principal: {
        skillId: string;
        label: string;
        nivel: string;
        comparacoes: { regime: string; moeda: string; valor: number; faixa: FaixaMercado; posicao: Posicao }[];
      } | null;
      /** A ficha não tem pretensão mensal ou nível: não há o que comparar. */
      semPretensao: boolean;
      /** Até 5 competências em alta; `tem` = a ficha já tem. */
      emAlta: { skillId: string; label: string; tem: boolean }[];
    };

/** O mercado do rascunho em /publicar (só informativo; pretensão só agregada, D6). */
export type MercadoRascunho = {
  skillId: string;
  label: string;
  nivel: string;
  regime: string;
  moeda: string;
  vagas: (FaixaMercado & { n: number }) | null;
  pretensao: (FaixaMercado & { n: number }) | null;
};

/** No /rh: a faixa da vaga contra a faixa típica das vagas do mesmo grupo. */
export type MercadoVagaRh = { posicao: Posicao; faixa: FaixaMercado; moeda: string };
