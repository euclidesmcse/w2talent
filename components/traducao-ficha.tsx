"use client";
/**
 * 2.7b Tradução automática da Ficha W2 (plano D1): o recrutador lê o título, o resumo, os destaques
 * e os cargos no idioma da tela, com o aviso "Traduzida automaticamente" e o botão "Ver original".
 * As rotas mandam `traducao` junto do item só quando a tradução está pronta e o original está em
 * outro idioma. Nome, empresas, cidades, números e competências não mudam.
 * Só para telas do recrutador: o candidato vê sempre o próprio texto, e os arquivos exportados
 * saem com o original.
 */
import * as React from "react";
import { useTranslations } from "next-intl";

export type TraducaoFichaTela = { titulo: string; resumo: string; destaques: string[]; cargos: string[]; idiomaOrigem: string };

function lida(v: unknown): TraducaoFichaTela | null {
  const o = (v && typeof v === "object" ? v : null) as Record<string, unknown> | null;
  if (!o) return null;
  const lista = (x: unknown) => (Array.isArray(x) ? x.filter((s): s is string => typeof s === "string") : []);
  return {
    titulo: typeof o.titulo === "string" ? o.titulo : "",
    resumo: typeof o.resumo === "string" ? o.resumo : "",
    destaques: lista(o.destaques),
    cargos: lista(o.cargos),
    idiomaOrigem: typeof o.idiomaOrigem === "string" ? o.idiomaOrigem : "outro",
  };
}

/** Título do candidato para listas: o traduzido quando há, senão o original. */
export function tituloDaFicha(item: { titulo?: unknown; traducao?: unknown } | null | undefined): string {
  const t = lida(item?.traducao);
  return t?.titulo || (typeof item?.titulo === "string" ? item.titulo : "");
}

/**
 * O item com os textos traduzidos no lugar dos originais. Lista com tamanho diferente do original
 * (a ficha mudou depois) fica no original.
 */
export function aplicarTraducaoFicha<T extends Record<string, any>>(item: T): T {
  const t = lida(item?.traducao);
  if (!t) return item;
  const out: Record<string, any> = { ...item };
  if (t.titulo) out.titulo = t.titulo;
  if (t.resumo && typeof item.resumo3linhas === "string") out.resumo3linhas = t.resumo;
  if (t.resumo && typeof item.resumo === "string") out.resumo = t.resumo;
  const w2 = item.fichaW2 && typeof item.fichaW2 === "object" ? (item.fichaW2 as Record<string, any>) : null;
  if (w2) {
    const destaques = Array.isArray(w2.destaques) && w2.destaques.length === t.destaques.length ? t.destaques : w2.destaques;
    out.fichaW2 = { ...w2, resumo: t.resumo || w2.resumo, destaques };
    // A tela não corta o texto traduzido no limite de entrada da ficha (sanitizeFichaW2).
    out.fichaTraduzida = true;
  }
  if (Array.isArray(item.destaques) && item.destaques.length === t.destaques.length) out.destaques = t.destaques;
  if (Array.isArray(item.experiencias) && item.experiencias.length === t.cargos.length) {
    out.experiencias = item.experiencias.map((e: any, i: number) => (e && typeof e === "object" && t.cargos[i] ? { ...e, cargo: t.cargos[i] } : e));
  }
  return out as T;
}

/** Aviso de tradução automática com o botão que alterna entre a tradução e o original. */
export function TraducaoFichaAviso({ idiomaOrigem, original, onAlternar, texto = "aviso" }: { idiomaOrigem: string; original: boolean; onAlternar: () => void; texto?: "aviso" | "avisoVarias" }) {
  const t = useTranslations("traducaoFicha");
  const lingua = t(["pt-BR", "en", "es"].includes(idiomaOrigem) ? `lingua_${idiomaOrigem.slice(0, 2)}` : "lingua_outro");
  return (
    <p data-traducao-ficha={original ? "original" : "traduzida"} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-control bg-canvas px-3 py-2 text-[13px] text-muted">
      <span>{original ? t(texto === "aviso" ? "avisoOriginal" : "avisoVariasOriginal", { lingua }) : t(texto, { lingua })}</span>
      <button type="button" data-action="ver-original-ficha" onClick={onAlternar} className="font-medium text-brand underline underline-offset-2 hover:text-ink">
        {original ? t("verTraducao") : t("verOriginal")}
      </button>
    </p>
  );
}

/**
 * Para o detalhe (painel ao lado ou janela): devolve o item a mostrar e o aviso.
 * Ao trocar de candidato, volta para a tradução.
 */
export function useTraducaoFicha<T extends Record<string, any> | null | undefined>(item: T): { item: T; aviso: React.ReactNode } {
  const [original, setOriginal] = React.useState(false);
  const chave = item ? String(item.id ?? item.userId ?? "") : "";
  React.useEffect(() => setOriginal(false), [chave]);
  const trad = item ? lida(item.traducao) : null;
  const mostrado = React.useMemo(() => (item && !original ? aplicarTraducaoFicha(item as Record<string, any>) : item) as T, [item, original]);
  if (!item || !trad) return { item, aviso: null };
  return { item: mostrado, aviso: <TraducaoFichaAviso idiomaOrigem={trad.idiomaOrigem} original={original} onAlternar={() => setOriginal((v) => !v)} /> };
}
