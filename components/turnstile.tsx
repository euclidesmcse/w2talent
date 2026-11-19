"use client";
import * as React from "react";

type Api = {
  render: (el: HTMLElement, o: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  remove?: (id?: string) => void;
};

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let carregando: Promise<void> | null = null;

function carregarScript(): Promise<void> {
  const w = window as unknown as { turnstile?: Api };
  if (w.turnstile) return Promise.resolve();
  if (carregando) return carregando;
  carregando = new Promise<void>((ok, falha) => {
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => ok();
    s.onerror = () => { carregando = null; falha(new Error("turnstile")); };
    document.head.appendChild(s);
  });
  return carregando;
}

export type Captcha = {
  /** Precisa resolver o desafio (há chave do site). */
  ativo: boolean;
  /** Resolvido, ou não precisa. */
  pronto: boolean;
  /** Cabeçalhos para o pedido (inclui x-captcha-response quando houver). */
  headers: () => Record<string, string>;
  /** O token vale uma vez: chame depois de cada tentativa. */
  reset: () => void;
  /** Onde o desafio aparece (só renderize quando ativo). */
  caixa: React.ReactNode;
};

/**
 * Desafio da Cloudflare (Turnstile) das telas de entrar. Sem chave do site, não faz nada.
 * O mesmo token serve para um pedido só; depois de cada tentativa, `reset()`.
 */
export function useTurnstile(siteKey: string | null | undefined): Captcha {
  const [el, setEl] = React.useState<HTMLDivElement | null>(null);
  const [token, setToken] = React.useState<string | null>(null);
  const widget = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!siteKey || !el) return;
    let vivo = true;
    carregarScript()
      .then(() => {
        const w = window as unknown as { turnstile?: Api };
        if (!vivo || !w.turnstile || widget.current) return;
        widget.current = w.turnstile.render(el, {
          sitekey: siteKey,
          callback: (tk: string) => setToken(tk),
          "expired-callback": () => setToken(null),
          "error-callback": () => setToken(null),
        });
      })
      .catch(() => {});
    return () => {
      vivo = false;
      const w = window as unknown as { turnstile?: Api };
      try { if (widget.current) w.turnstile?.remove?.(widget.current); } catch {}
      widget.current = null;
      setToken(null);
    };
  }, [siteKey, el]);

  const reset = React.useCallback(() => {
    setToken(null);
    try { (window as unknown as { turnstile?: Api }).turnstile?.reset(widget.current ?? undefined); } catch {}
  }, []);

  const headers = React.useCallback(() => {
    const h: Record<string, string> = { "content-type": "application/json" };
    if (token) h["x-captcha-response"] = token;
    return h;
  }, [token]);

  const ativo = !!siteKey;
  return {
    ativo,
    pronto: !ativo || !!token,
    headers,
    reset,
    caixa: ativo ? <div ref={setEl} data-testid="turnstile" className="min-h-[65px]" /> : null,
  };
}
