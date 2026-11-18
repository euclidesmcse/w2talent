// Tema escuro (2026-11-18): escolha Sistema/Claro/Escuro e o script do <head> que põe data-theme antes da pintura.
import * as fs from "fs";
import * as path from "path";
import { COR_DO_TOPO, SCRIPT_TEMA, TEMA_CHAVE, normalizarTema, proximoTema, temaEfetivo } from "../lib/tema";
import { claro, escuro } from "../lib/design-tokens";

/** Roda o SCRIPT_TEMA com um document/window de mentira e devolve o data-theme que ele pôs. */
function rodarScript(opts: { guardado?: string | null; sistemaEscuro: boolean; storageQuebra?: boolean }) {
  const attrs: Record<string, string> = {};
  const ouvintes: Array<() => void> = [];
  const midia = { matches: opts.sistemaEscuro, addEventListener: (_e: string, f: () => void) => ouvintes.push(f) };
  const window = {
    matchMedia: () => midia,
    get localStorage() {
      if (opts.storageQuebra) throw new Error("SecurityError");
      return { getItem: (k: string) => (k === TEMA_CHAVE ? opts.guardado ?? null : null) };
    },
  };
  const metas = [{ content: COR_DO_TOPO.claro }, { content: COR_DO_TOPO.escuro }];
  const document = {
    documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) },
    querySelectorAll: () => metas.map((m) => ({ setAttribute: (_k: string, v: string) => (m.content = v) })),
  };
  new Function("window", "document", SCRIPT_TEMA)(window, document);
  return { tema: () => attrs["data-theme"], metas: () => metas.map((m) => m.content), midia, ouvintes };
}

describe("tema", () => {
  it("escolha: sistema → claro → escuro → sistema; valor desconhecido vira sistema", () => {
    expect(proximoTema("sistema")).toBe("claro");
    expect(proximoTema("claro")).toBe("escuro");
    expect(proximoTema("escuro")).toBe("sistema");
    expect(normalizarTema("dark")).toBe("sistema");
    expect(normalizarTema(null)).toBe("sistema");
    expect(normalizarTema("escuro")).toBe("escuro");
  });

  it("efetivo: escolha fixa vence o sistema; sistema segue prefers-color-scheme", () => {
    expect(temaEfetivo("sistema", true)).toBe("dark");
    expect(temaEfetivo("sistema", false)).toBe("light");
    expect(temaEfetivo("claro", true)).toBe("light");
    expect(temaEfetivo("escuro", false)).toBe("dark");
  });

  it("script do <head> aplica a mesma regra, sobrevive a storage bloqueado e acompanha o sistema", () => {
    expect(rodarScript({ sistemaEscuro: true }).tema()).toBe("dark");
    expect(rodarScript({ sistemaEscuro: false }).tema()).toBe("light");
    expect(rodarScript({ guardado: "claro", sistemaEscuro: true }).tema()).toBe("light");
    expect(rodarScript({ guardado: "escuro", sistemaEscuro: false }).tema()).toBe("dark");
    expect(rodarScript({ storageQuebra: true, sistemaEscuro: true }).tema()).toBe("dark");
    // metas theme-color: no "sistema" ficam como vieram (uma por mídia); com escolha fixa, as duas na cor dela
    expect(rodarScript({ sistemaEscuro: true }).metas()).toEqual([COR_DO_TOPO.claro, COR_DO_TOPO.escuro]);
    expect(rodarScript({ guardado: "escuro", sistemaEscuro: false }).metas()).toEqual([COR_DO_TOPO.escuro, COR_DO_TOPO.escuro]);
    expect(rodarScript({ guardado: "claro", sistemaEscuro: true }).metas()).toEqual([COR_DO_TOPO.claro, COR_DO_TOPO.claro]);
    const r = rodarScript({ sistemaEscuro: false });
    r.midia.matches = true;
    r.ouvintes.forEach((f) => f());
    expect(r.tema()).toBe("dark");
  });

  it("cor da barra (theme-color) é o fundo de cada tema e o layout põe o script no <head>", () => {
    expect(COR_DO_TOPO).toEqual({ claro: claro.canvas, escuro: escuro.canvas });
    const layout = fs.readFileSync(path.join(__dirname, "../app/layout.tsx"), "utf-8");
    expect(layout).toMatch(/<head>[\s\S]*SCRIPT_TEMA[\s\S]*<\/head>/);
    expect(layout).toContain("suppressHydrationWarning");
    expect(layout).toContain('media: "(prefers-color-scheme: dark)"');
  });
});
