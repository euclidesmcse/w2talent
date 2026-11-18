/**
 * 3.2a Inteligência de mercado: o formato de `GET /api/mercado` e as contas pequenas da tela `/mercado`.
 * Arquivo puro e sem banco: a tela importa daqui sem levar o Prisma nem o cálculo (lib/mercado.ts) ao navegador.
 */
import type { Demanda, VisaoMercado } from "./mercado";

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
