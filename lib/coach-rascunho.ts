/**
 * Coach IA por vaga, lado da tela (sem a taxonomia, para não pesar no navegador):
 * o rascunho que a pessoa edita em Aprovar e o que vai junto ao aprovar.
 */
import type { Adaptacao, CvVaga } from "./coach-vaga";

export const MAX_RESUMO_TELA = 420;
export const MAX_DESTAQUE_TELA = 160;
export const MAX_CARTA_TELA = 800;
export const DESTAQUES_TELA = 3;
export const MAX_POR_QUE_TELA = 240;
export const MAX_TITULO_TELA = 100;
export const MAX_PONTOS_TELA = 5;
export const MAX_PONTO_TELA = 200;

/** Um cargo no editor do CV: pontos como texto, um por linha. */
export type RascunhoCargo = { i: number; cargo: string; empresa: string; inicio: string; fim: string; atual: boolean; texto: string; incluir: boolean };

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
  /** CV por vaga: "por que se destaca" (vai com a candidatura quando preenchido). */
  porQue: string;
  /** CV por vaga: título e cargos editáveis; null sem CV (ficha sem cargos). */
  cv: { titulo: string; cargos: RascunhoCargo[] } | null;
  /** Mandar o CV desta versão para a empresa. */
  usarCv: boolean;
  /** CV já aprovado: a base é o que foi guardado, não a ficha de agora (que pode ter mudado de ordem). */
  base?: CvVaga | null;
};

const linhas = (xs: string[]): string[] => {
  const out = xs.slice(0, DESTAQUES_TELA);
  while (out.length < DESTAQUES_TELA) out.push("");
  return out;
};

const cargosDe = (base: CvVaga | null | undefined, escolhidos?: CvVaga | null): RascunhoCoach["cv"] => {
  if (!base?.cargos.length) return null;
  const doCv = new Map((escolhidos?.cargos ?? []).map((c) => [c.i, c]));
  return {
    titulo: escolhidos?.titulo || base.titulo,
    cargos: base.cargos.map((c) => {
      const e = doCv.get(c.i);
      return { i: c.i, cargo: c.cargo, empresa: c.empresa, inicio: c.inicio, fim: c.fim, atual: c.atual, texto: (e ?? c).pontos.join("\n"), incluir: escolhidos ? !!e : true };
    }),
  };
};

/** Rascunho a partir do que já foi aprovado (ou null). `base`: o CV da ficha para esta vaga. */
export function rascunhoDe(a: Adaptacao | null | undefined, base?: CvVaga | null): RascunhoCoach | null {
  if (!a) return null;
  return {
    resumo: a.resumo,
    destaques: linhas(a.destaques),
    carta: a.carta,
    ia: a.ia,
    usarVersao: !!a.resumo,
    enviarCarta: !!a.carta,
    removidos: [],
    porQue: a.porQue ?? "",
    cv: a.cv ? cargosDe(a.cv, a.cv) : cargosDe(base),
    usarCv: !!a.cv,
    base: a.cv ?? null,
  };
}

/** "Escrever do meu jeito": começa da Ficha W2 e do CV da ficha, sem IA e sem mensagem. */
export function rascunhoManual(w2: { resumo: string; destaques: string[] }, base?: CvVaga | null): RascunhoCoach {
  const cv = cargosDe(base);
  return { resumo: w2.resumo, destaques: linhas(w2.destaques), carta: "", ia: false, usarVersao: true, enviarCarta: false, removidos: [], porQue: "", cv, usarCv: !!cv };
}

/** Sugestão da IA vira rascunho com as caixas marcadas (a pessoa confere antes de aprovar). */
export function rascunhoDaProposta(p: { resumo: string; destaques: string[]; carta: string; removidos?: string[]; porQue?: string; cv?: CvVaga | null }): RascunhoCoach {
  const cv = cargosDe(p.cv ?? null, p.cv ?? null);
  return {
    resumo: p.resumo,
    destaques: linhas(p.destaques),
    carta: p.carta,
    ia: true,
    usarVersao: !!p.resumo,
    enviarCarta: !!p.carta,
    removidos: (p.removidos ?? []).slice(0, 15),
    porQue: p.porQue ?? "",
    cv,
    usarCv: !!cv,
  };
}

/** Pontos de um cargo a partir do texto do editor (um por linha, sem marcador). */
export function pontosDoTexto(texto: string): string[] {
  return texto
    .split("\n")
    .map((l) => l.replace(/^\s*[-•*–]\s*/, "").trim().slice(0, MAX_PONTO_TELA))
    .filter(Boolean)
    .slice(0, MAX_PONTOS_TELA);
}

/** CV como vai sair (prévia, PDF): a base da ficha com o título e os cargos escolhidos. null sem CV marcado. */
export function cvDoRascunho(r: RascunhoCoach | null | undefined, baseFicha: CvVaga | null | undefined): CvVaga | null {
  const base = r?.base ?? baseFicha;
  if (!r?.cv || !r.usarCv || !base) return null;
  const cargos = r.cv.cargos.filter((c) => c.incluir).map((c) => ({ i: c.i, cargo: c.cargo, empresa: c.empresa, inicio: c.inicio, fim: c.fim, atual: c.atual, pontos: pontosDoTexto(c.texto) }));
  if (!cargos.length) return null;
  return { ...base, titulo: r.cv.titulo.trim().slice(0, MAX_TITULO_TELA) || base.titulo, cargos };
}

/** O que vai em `adaptacao` ao aprovar; null = vai a Ficha W2 de sempre, sem mensagem. */
export type AdaptacaoTela = {
  resumo: string;
  destaques: string[];
  carta: string;
  ia: boolean;
  porQue: string;
  /** Só o que o candidato escolhe: título e pontos de cada cargo. O resto o servidor tira da ficha. */
  cv: { titulo: string; cargos: { i: number; pontos: string[] }[] } | null;
};

export function adaptacaoDoRascunho(r: RascunhoCoach | null | undefined): AdaptacaoTela | null {
  if (!r) return null;
  const resumo = r.usarVersao ? r.resumo.trim().slice(0, MAX_RESUMO_TELA) : "";
  const destaques = r.usarVersao && resumo ? r.destaques.map((d) => d.trim().slice(0, MAX_DESTAQUE_TELA)).filter(Boolean) : [];
  const carta = r.enviarCarta ? r.carta.trim().slice(0, MAX_CARTA_TELA) : "";
  const cargos = r.usarCv && r.cv ? r.cv.cargos.filter((c) => c.incluir).map((c) => ({ i: c.i, pontos: pontosDoTexto(c.texto) })) : [];
  const cv = cargos.length ? { titulo: r.cv!.titulo.trim().slice(0, MAX_TITULO_TELA), cargos } : null;
  if (!resumo && !carta && !cv) return null;
  // A frase vai com o resto; sozinha não justifica mandar uma versão.
  return { resumo, destaques, carta, ia: r.ia, porQue: r.porQue.trim().slice(0, MAX_POR_QUE_TELA), cv };
}

/** Ficha W2 como a empresa vai ver (prévia ao lado). */
export function w2ComRascunho<T extends { resumo: string; destaques: string[] }>(w2: T, r: RascunhoCoach | null | undefined): T {
  const a = adaptacaoDoRascunho(r);
  return a?.resumo ? { ...w2, resumo: a.resumo, destaques: a.destaques.length ? a.destaques : w2.destaques } : w2;
}

// ── CV por vaga (plano 2026-11-20 "CV por vaga") ─────────────────────────

/** "03/2019 – atual" no idioma da tela (ou do e-mail). */
export function periodoCargo(c: { inicio: string; fim: string; atual: boolean }, locale: string): string {
  const mes = (v: string) => (/^\d{4}-\d{2}/.test(v) ? `${v.slice(5, 7)}/${v.slice(0, 4)}` : v.slice(0, 4));
  const atual = locale.startsWith("en") ? "present" : locale.startsWith("es") ? "actual" : "atual";
  const ini = mes(c.inicio);
  const fim = c.atual ? atual : mes(c.fim);
  return ini || fim ? [ini, fim].filter(Boolean).join(" – ") : "";
}
