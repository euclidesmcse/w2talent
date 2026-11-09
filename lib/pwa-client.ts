"use client";
/**
 * PWA no navegador (1.5.14): registra o service worker, guarda o convite de instalação
 * do navegador (beforeinstallprompt) e diz se há internet.
 */
import * as React from "react";

type ConviteInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let convite: ConviteInstalar | null = null;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());
let iniciado = false;

/** Chamado uma vez no layout raiz. Em `next dev` só registra com localStorage "w2talent:sw-dev" = "1". */
export function iniciarPwa(): void {
  if (iniciado || typeof window === "undefined") return;
  iniciado = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // sem pop-up do navegador: o botão "Instalar app" usa este convite (D4)
    convite = e as ConviteInstalar;
    avisar();
  });
  window.addEventListener("appinstalled", () => { convite = null; avisar(); });
  let dev = false;
  try { dev = window.localStorage.getItem("w2talent:sw-dev") === "1"; } catch {}
  if (!("serviceWorker" in navigator)) return;
  if (process.env.NODE_ENV !== "production" && !dev) return;
  const registrar = () => navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  if (document.readyState === "complete") registrar();
  else window.addEventListener("load", registrar, { once: true });
}

export function conviteDeInstalar(): ConviteInstalar | null {
  return convite;
}

export async function instalar(): Promise<boolean> {
  const c = convite;
  if (!c) return false;
  await c.prompt();
  const { outcome } = await c.userChoice;
  convite = null;
  avisar();
  return outcome === "accepted";
}

export function useConviteInstalar(): boolean {
  return React.useSyncExternalStore(
    (f) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    () => convite !== null,
    () => false
  );
}

/** Já está aberto como app instalado? */
export function rodandoComoApp(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  } catch {}
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** iPhone/iPad no Safari: não há convite; a pessoa instala por Compartilhar › Adicionar à Tela de Início. */
export function ehIosSafari(ua: string = typeof navigator !== "undefined" ? navigator.userAgent : "", toque = typeof navigator !== "undefined" ? navigator.maxTouchPoints ?? 0 : 0): boolean {
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && toque > 1);
  const outro = /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return ios && !outro && /Safari/.test(ua);
}

/** true com internet. No servidor, sempre true. */
export function useOnline(): boolean {
  return React.useSyncExternalStore(
    (f) => {
      window.addEventListener("online", f);
      window.addEventListener("offline", f);
      return () => { window.removeEventListener("online", f); window.removeEventListener("offline", f); };
    },
    () => navigator.onLine,
    () => true
  );
}

/** Guarda e lê uma cópia local com a hora em que foi salva (ex.: a última lista de candidaturas). */
export function salvarCopia<T>(chave: string, dados: T): void {
  try { window.localStorage.setItem(chave, JSON.stringify({ salvoEm: new Date().toISOString(), dados })); } catch {}
}

export function lerCopia<T>(chave: string): { salvoEm: string; dados: T } | null {
  try {
    const raw = window.localStorage.getItem(chave);
    if (!raw) return null;
    const j = JSON.parse(raw);
    return j && typeof j.salvoEm === "string" && "dados" in j ? j : null;
  } catch {
    return null;
  }
}

/** "09/11 21:40" (data e hora curtas no idioma da tela) para dizer quando a cópia foi salva. */
export function dataHoraCurta(iso: string, locale: string): string {
  try {
    const d = new Date(iso);
    return `${new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit" }).format(d)} ${new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(d)}`;
  } catch {
    return iso.slice(0, 16).replace("T", " ");
  }
}
