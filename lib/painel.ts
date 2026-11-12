/**
 * Painel do candidato (ideia trazida do portal emagine, aprovada pelo Euclides em 2026-11-12).
 * Resume, a partir do rascunho da "Minha ficha" guardado neste navegador, quanto da ficha
 * mínima está pronto e o que falta para publicar. Funções puras: testadas sem navegador.
 */
import { CAMPOS_MINIMOS, camposFaltando, sanitizeFicha, sanitizeFichaW2, type CampoMinimo } from "./ficha";
import { normalizeSkill } from "./taxonomy";

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
  // A "Minha ficha" edita as competências em linhas (texto + anos) e só monta a ficha ao publicar:
  // as linhas valem mais que o stack guardado, como na tela (montarFicha).
  const bruta = (o.ficha && typeof o.ficha === "object" ? { ...(o.ficha as Record<string, unknown>) } : {}) as Record<string, unknown>;
  if (Array.isArray(o.skills)) {
    bruta.stack = (o.skills as unknown[])
      .map((r) => (r && typeof r === "object" ? (r as { texto?: unknown; anos?: unknown }) : {}))
      .map((r) => ({ skillId: typeof r.texto === "string" ? normalizeSkill(r.texto) : null, anos: r.anos }))
      .filter((r) => r.skillId);
  }
  const ficha = sanitizeFicha(bruta);
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
export type ContagemCandidaturas = { total: number; vistas: number; respondidas: number };

/** Números do painel a partir da contagem por status (respondida também foi vista pela empresa). */
export function contarPorStatus(grupos: { status?: string; n: number }[]): ContagemCandidaturas {
  let total = 0;
  let vistas = 0;
  let respondidas = 0;
  for (const g of grupos) {
    total += g.n;
    if (g.status === "respondido") respondidas += g.n;
    if (g.status === "respondido" || g.status === "visualizado") vistas += g.n;
  }
  return { total, vistas, respondidas };
}

export function contarCandidaturas(apps: { status?: string }[]): ContagemCandidaturas {
  return contarPorStatus(apps.map((a) => ({ status: a.status, n: 1 })));
}
