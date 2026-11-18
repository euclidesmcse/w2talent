/**
 * 2.6a Ajuda (plano https://claude.ai/artifact/6rdLK68qJGL4gWHTXucY2G, OK do Euclides em 2026-11-18).
 * Artigos curtos em content/ajuda/<idioma>/*.md, juntados em lib/ajuda-conteudo.ts pelo
 * scripts/ajuda-gerar.js. Aqui ficam a leitura do Markdown (só o pedaço que os artigos usam)
 * e a ordem da lista. O 2.6a-2 usa os mesmos artigos como base das respostas da IA.
 */
import { ARTIGOS } from "./ajuda-conteudo";
import { DEFAULT_LOCALE, isAppLocale, type AppLocale } from "./locale";

export type AreaAjuda = "publico" | "candidato" | "recrutador";
export type ArtigoBruto = { slug: string; titulo: string; resumo: string; areas: string[]; telas: string[]; ordem: number; corpo: string };

/** Pedaço de texto: simples, negrito, código ou link. */
export type Trecho = { t: "txt" | "b" | "code"; v: string } | { t: "a"; v: string; href: string };
export type Bloco =
  | { t: "h2"; texto: string }
  | { t: "p"; trechos: Trecho[] }
  | { t: "ul" | "ol"; itens: Trecho[][] }
  | { t: "table"; cabeca: Trecho[][]; linhas: Trecho[][][] };

export function idiomaAjuda(locale: string | null | undefined): AppLocale {
  return isAppLocale(locale) ? locale : DEFAULT_LOCALE;
}

export function artigosDe(locale: string | null | undefined): ArtigoBruto[] {
  return ARTIGOS[idiomaAjuda(locale)];
}

export function artigo(locale: string | null | undefined, slug: string): ArtigoBruto | null {
  return artigosDe(locale).find((a) => a.slug === slug) ?? null;
}

/** Link interno seguro: só caminhos do próprio site ("/vagas", "/ia#match"). Outros viram texto. */
export function hrefSeguro(href: string): string | null {
  return /^\/(?!\/)[A-Za-z0-9\-_/#?=&.]*$/.test(href) ? href : null;
}

export function lerTrechos(s: string): Trecho[] {
  const out: Trecho[] = [];
  const re = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let i = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > i) out.push({ t: "txt", v: s.slice(i, m.index) });
    if (m[1] != null) out.push({ t: "b", v: m[1] });
    else if (m[2] != null) out.push({ t: "code", v: m[2] });
    else {
      const href = hrefSeguro(m[4]);
      out.push(href ? { t: "a", v: m[3], href } : { t: "txt", v: m[3] });
    }
    i = m.index + m[0].length;
  }
  if (i < s.length) out.push({ t: "txt", v: s.slice(i) });
  return out;
}

const celulas = (linha: string) => linha.trim().replace(/^\||\|$/g, "").split("|").map((c) => lerTrechos(c.trim()));

/** Markdown dos artigos → blocos: ## títulos, parágrafos, listas (- e 1.) e tabelas simples. */
export function lerMarkdown(corpo: string): Bloco[] {
  const blocos: Bloco[] = [];
  const grupos = corpo.replace(/\r\n/g, "\n").trim().split(/\n\s*\n/);
  for (const g of grupos) {
    const linhas = g.split("\n").map((l) => l.trimEnd()).filter((l) => l.trim());
    if (!linhas.length) continue;
    if (linhas.length === 1 && linhas[0].startsWith("## ")) {
      blocos.push({ t: "h2", texto: linhas[0].slice(3).trim() });
    } else if (linhas.every((l) => /^-\s+/.test(l))) {
      blocos.push({ t: "ul", itens: linhas.map((l) => lerTrechos(l.replace(/^-\s+/, ""))) });
    } else if (linhas.every((l) => /^\d+\.\s+/.test(l))) {
      blocos.push({ t: "ol", itens: linhas.map((l) => lerTrechos(l.replace(/^\d+\.\s+/, ""))) });
    } else if (linhas.length >= 2 && linhas.every((l) => l.trim().startsWith("|")) && /^\|?\s*-{3,}/.test(linhas[1].trim())) {
      blocos.push({ t: "table", cabeca: celulas(linhas[0]), linhas: linhas.slice(2).map(celulas) });
    } else {
      blocos.push({ t: "p", trechos: lerTrechos(linhas.join(" ")) });
    }
  }
  return blocos;
}

/** Caminho de origem do link "Ajuda" (?de=/candidatos): só aceita caminho interno curto. */
export function telaDeOrigem(de: unknown): string | null {
  if (typeof de !== "string" || de.length > 80) return null;
  const caminho = de.split(/[?#]/)[0];
  return hrefSeguro(caminho) ? caminho : null;
}

/** O artigo fala desta tela? "/vagas" vale para "/vagas" e "/vagas/aprovar"; "/" só para o início. */
export function falaDaTela(a: ArtigoBruto, tela: string): boolean {
  return a.telas.some((t) => (t === "/" ? tela === "/" : tela === t || tela.startsWith(t + "/")));
}

function paraTodos(a: ArtigoBruto): boolean {
  return a.areas.includes("publico") || (a.areas.includes("candidato") && a.areas.includes("recrutador"));
}

/** Artigos desta tela primeiro (na ordem dos artigos), depois o resto separado por área. */
export function organizarAjuda(locale: string | null | undefined, de?: string | null) {
  const todos = artigosDe(locale);
  const tela = telaDeOrigem(de);
  const destaque = tela ? todos.filter((a) => falaDaTela(a, tela)) : [];
  const usados = new Set(destaque.map((a) => a.slug));
  const resto = todos.filter((a) => !usados.has(a.slug));
  const grupo = (area: AreaAjuda) =>
    // Artigo de candidato e de recrutador ao mesmo tempo fica em "Para todos", para não aparecer duas vezes.
    resto.filter((a) => (area === "publico" ? paraTodos(a) : a.areas.includes(area) && !paraTodos(a)));
  return { tela, destaque, comecar: grupo("publico"), candidato: grupo("candidato"), recrutador: grupo("recrutador") };
}
