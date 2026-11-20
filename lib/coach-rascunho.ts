/**
 * Coach IA por vaga, lado da tela (sem a taxonomia, para não pesar no navegador):
 * o rascunho que a pessoa edita em Aprovar e o que vai junto ao aprovar.
 */
import type { Adaptacao } from "./coach-vaga";

export const MAX_RESUMO_TELA = 420;
export const MAX_DESTAQUE_TELA = 160;
export const MAX_CARTA_TELA = 800;
export const DESTAQUES_TELA = 3;

export type RascunhoCoach = {
  resumo: string;
  destaques: string[];
  carta: string;
  /** Alguma parte veio da IA. */
  ia: boolean;
  /** Mandar o resumo e os destaques desta versão no lugar da Ficha W2 de sempre. */
  usarVersao: boolean;
  /** Mandar a mensagem para a empresa. */
  enviarCarta: boolean;
  /** Frases que a trava tirou (só para mostrar). */
  removidos: string[];
};

const linhas = (xs: string[]): string[] => {
  const out = xs.slice(0, DESTAQUES_TELA);
  while (out.length < DESTAQUES_TELA) out.push("");
  return out;
};

/** Rascunho a partir do que já foi aprovado (ou null). */
export function rascunhoDe(a: Adaptacao | null | undefined): RascunhoCoach | null {
  if (!a) return null;
  return { resumo: a.resumo, destaques: linhas(a.destaques), carta: a.carta, ia: a.ia, usarVersao: !!a.resumo, enviarCarta: !!a.carta, removidos: [] };
}

/** "Escrever do meu jeito": começa da Ficha W2, sem IA e sem mensagem. */
export function rascunhoManual(w2: { resumo: string; destaques: string[] }): RascunhoCoach {
  return { resumo: w2.resumo, destaques: linhas(w2.destaques), carta: "", ia: false, usarVersao: true, enviarCarta: false, removidos: [] };
}

/** Sugestão da IA vira rascunho com as duas caixas marcadas (a pessoa confere antes de aprovar). */
export function rascunhoDaProposta(p: { resumo: string; destaques: string[]; carta: string; removidos?: string[] }): RascunhoCoach {
  return { resumo: p.resumo, destaques: linhas(p.destaques), carta: p.carta, ia: true, usarVersao: !!p.resumo, enviarCarta: !!p.carta, removidos: (p.removidos ?? []).slice(0, 10) };
}

/** O que vai em `adaptacao` ao aprovar; null = vai a Ficha W2 de sempre, sem mensagem. */
export function adaptacaoDoRascunho(r: RascunhoCoach | null | undefined): { resumo: string; destaques: string[]; carta: string; ia: boolean } | null {
  if (!r) return null;
  const resumo = r.usarVersao ? r.resumo.trim().slice(0, MAX_RESUMO_TELA) : "";
  const destaques = r.usarVersao && resumo ? r.destaques.map((d) => d.trim().slice(0, MAX_DESTAQUE_TELA)).filter(Boolean) : [];
  const carta = r.enviarCarta ? r.carta.trim().slice(0, MAX_CARTA_TELA) : "";
  if (!resumo && !carta) return null;
  return { resumo, destaques, carta, ia: r.ia };
}

/** Ficha W2 como a empresa vai ver (prévia ao lado). */
export function w2ComRascunho<T extends { resumo: string; destaques: string[] }>(w2: T, r: RascunhoCoach | null | undefined): T {
  const a = adaptacaoDoRascunho(r);
  return a?.resumo ? { ...w2, resumo: a.resumo, destaques: a.destaques.length ? a.destaques : w2.destaques } : w2;
}
