// Tema claro/escuro (2026-11-18). Padrão: segue o sistema (prefers-color-scheme). A pessoa pode fixar
// Claro ou Escuro no botão do topo (components/tema-switcher.tsx); a escolha fica só neste navegador
// (localStorage "w2-tema"). O <html> recebe data-theme="light|dark" antes da primeira pintura pelo
// SCRIPT_TEMA, que o app/layout.tsx põe inline no <head> (sem piscar o tema errado). As cores trocam
// pelas variáveis --cor-* (lib/design-tokens.js + tailwind.config.js).
import { claro, escuro } from "./design-tokens";

export type Tema = "sistema" | "claro" | "escuro";
export const TEMAS: Tema[] = ["sistema", "claro", "escuro"];
export const TEMA_CHAVE = "w2-tema";
/** Evento disparado na janela quando a escolha muda nesta aba. */
export const TEMA_EVENTO = "w2-tema";
/** Cor da barra do navegador/app instalado (meta theme-color): o fundo de cada tema. */
export const COR_DO_TOPO = { claro: claro.canvas, escuro: escuro.canvas } as const;

export function normalizarTema(v: unknown): Tema {
  return v === "claro" || v === "escuro" ? v : "sistema";
}

export function proximoTema(t: Tema): Tema {
  return TEMAS[(TEMAS.indexOf(t) + 1) % TEMAS.length];
}

/** "light" ou "dark" que vale de fato para a escolha e a preferência do sistema. */
export function temaEfetivo(t: Tema, sistemaEscuro: boolean): "light" | "dark" {
  return t === "escuro" || (t === "sistema" && sistemaEscuro) ? "dark" : "light";
}

export function lerTema(): Tema {
  try {
    return normalizarTema(window.localStorage.getItem(TEMA_CHAVE));
  } catch {
    return "sistema";
  }
}

/** Grava a escolha (sem "sistema" guardado: apaga a chave) e aplica na hora. */
export function escolherTema(t: Tema) {
  try {
    if (t === "sistema") window.localStorage.removeItem(TEMA_CHAVE);
    else window.localStorage.setItem(TEMA_CHAVE, t);
  } catch {
    // navegador sem armazenamento (modo privado restrito): vale só nesta página
  }
  aplicarTema(t);
  window.dispatchEvent(new CustomEvent(TEMA_EVENTO, { detail: t }));
}

/** Põe data-theme no <html> e acerta as metas theme-color. Mesma regra do SCRIPT_TEMA. */
export function aplicarTema(t: Tema) {
  const escuroSistema = typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const efetivo = temaEfetivo(t, escuroSistema);
  document.documentElement.setAttribute("data-theme", efetivo);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    const daMidia = (m.getAttribute("media") ?? "").includes("dark") ? COR_DO_TOPO.escuro : COR_DO_TOPO.claro;
    m.setAttribute("content", t === "sistema" ? daMidia : efetivo === "dark" ? COR_DO_TOPO.escuro : COR_DO_TOPO.claro);
  });
}

/**
 * Script inline do <head>: roda antes da primeira pintura. Lê a escolha (try/catch: storage pode estar
 * bloqueado), põe data-theme (e a cor das metas theme-color, se a escolha for fixa) e, no modo "sistema",
 * acompanha a troca do sistema com a página aberta.
 * Não há CSP no site hoje; se um dia houver, este script precisa de nonce ou hash.
 */
export const SCRIPT_TEMA =
  "(function(){var d=document.documentElement,k=" + JSON.stringify(TEMA_CHAVE) + ",m=window.matchMedia?window.matchMedia(\"(prefers-color-scheme: dark)\"):null;" +
  "function a(){var e=null;try{e=window.localStorage.getItem(k)}catch(_){}" +
  "var s=e===\"escuro\"||(e!==\"claro\"&&!!m&&m.matches);d.setAttribute(\"data-theme\",s?\"dark\":\"light\");" +
  // escolha fixa: as metas theme-color (que o Next põe antes deste script) ficam na cor do tema escolhido
  "if(e===\"claro\"||e===\"escuro\"){var l=document.querySelectorAll?document.querySelectorAll('meta[name=\"theme-color\"]'):[];" +
  "for(var i=0;i<l.length;i++)l[i].setAttribute(\"content\",s?" + JSON.stringify(COR_DO_TOPO.escuro) + ":" + JSON.stringify(COR_DO_TOPO.claro) + ")}}" +
  "a();if(m){if(m.addEventListener)m.addEventListener(\"change\",a);else if(m.addListener)m.addListener(a)}})();";
