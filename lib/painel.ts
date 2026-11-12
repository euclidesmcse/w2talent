/**
 * Painel do candidato (ideia trazida do portal emagine, aprovada pelo Euclides em 2026-11-12).
 * Resume, a partir do rascunho da "Minha ficha" guardado neste navegador, quanto da ficha
 * mínima está pronto e o que falta para publicar. Funções puras: testadas sem navegador.
 */
import { CAMPOS_MINIMOS, camposFaltando, sanitizeFicha, sanitizeFichaW2, type CampoMinimo } from "./ficha";

export type EtapaPainel = "cv" | "campos" | "w2" | "publicada";

export type ResumoFicha = {
  /** Há rascunho com algum dado (CV lido ou campo preenchido). */
  comecou: boolean;
  feitos: number;
  total: number;
  faltas: CampoMinimo[];
  etapas: Record<Exclude<EtapaPainel, "publicada">, boolean>;
};

/** O rascunho como a "Minha ficha" guarda em localStorage (w2talent:ficha). Aceita qualquer coisa. */
export function resumoDaFicha(rascunho: unknown): ResumoFicha {
  const o = (rascunho && typeof rascunho === "object" ? rascunho : {}) as Record<string, unknown>;
  const ficha = sanitizeFicha(o.ficha);
  const faltas = camposFaltando(ficha);
  const total = CAMPOS_MINIMOS.length;
  const passou = o.passo === "conferir" || o.passo === "w2";
  const comecou = passou || faltas.length < total;
  return {
    comecou,
    feitos: total - faltas.length,
    total,
    faltas,
    etapas: { cv: comecou, campos: faltas.length === 0, w2: faltas.length === 0 && sanitizeFichaW2(o.w2) !== null },
  };
}

/** Lê o rascunho do texto guardado no navegador; texto inválido vale como ficha vazia. */
export function resumoDoTexto(raw: string | null): ResumoFicha {
  if (!raw) return resumoDaFicha(null);
  try {
    return resumoDaFicha(JSON.parse(raw));
  } catch {
    return resumoDaFicha(null);
  }
}

/** Contagem das candidaturas por andamento (o que a tela mostra em números). */
export function contarCandidaturas(apps: { status?: string }[]): { total: number; vistas: number; respondidas: number } {
  let vistas = 0;
  let respondidas = 0;
  for (const a of apps) {
    // respondida também foi vista pela empresa
    if (a.status === "respondido") respondidas++;
    if (a.status === "respondido" || a.status === "visualizado") vistas++;
  }
  return { total: apps.length, vistas, respondidas };
}
