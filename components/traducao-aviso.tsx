"use client";
/**
 * 2.7a Tradução automática: o texto da vaga aparece no idioma de quem vê, com o aviso
 * "Tradução automática" (link para a linha da página /ia) e o botão "Ver original".
 * A tradução vem num campo à parte (`traducao`); os campos originais da vaga nunca mudam.
 */
import * as React from "react";
import { useTranslations } from "next-intl";
import { IaLink } from "@/components/ia-link";
import { cn } from "@/components/ui/cn";
import type { TraducaoAnexada } from "@/lib/traducao-anexar";

export type { TraducaoAnexada };

const IDIOMAS_DO_SITE = ["pt-BR", "en", "es"];

export type TextoExibido = {
  titulo: string;
  descricaoBullets: string[];
  beneficios: string[];
  /** Há tradução para mostrar (com ou sem o original escolhido). */
  traduzida: boolean;
  /** Idioma do texto quando é o original escrito noutro idioma (para leitores de tela). */
  lang?: string;
};

function lista(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  return typeof v === "string" && v ? [v] : [];
}

/** O texto da vaga a mostrar: a tradução, ou o original quando a pessoa pediu "Ver original". */
export function textoExibido(
  item: { titulo?: string | null; descricaoBullets?: unknown; beneficios?: unknown; traducao?: TraducaoAnexada | null } | null | undefined,
  verOriginal: boolean,
): TextoExibido {
  const original = { titulo: item?.titulo ?? "", descricaoBullets: lista(item?.descricaoBullets), beneficios: lista(item?.beneficios) };
  const t = item?.traducao;
  if (!t) return { ...original, traduzida: false };
  if (verOriginal) return { ...original, traduzida: true, lang: IDIOMAS_DO_SITE.includes(t.idiomaOrigem) ? t.idiomaOrigem : undefined };
  return { titulo: t.titulo || original.titulo, descricaoBullets: t.descricaoBullets, beneficios: t.beneficios, traduzida: true };
}

/** No detalhe da vaga, a escolha vale também para as vagas parecidas listadas dentro dele. */
export const VerOriginalContext = React.createContext(false);

export function TraducaoAviso({ verOriginal, onAlternar, className }: { verOriginal: boolean; onAlternar: () => void; className?: string }) {
  const t = useTranslations("traducao");
  return (
    <span data-traducao-aviso className={cn("inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted", className)}>
      <IaLink ancora="traducao" texto="traducaoTarefa" className="font-normal" />
      <span aria-hidden>·</span>
      <button
        type="button"
        data-action="ver-original"
        aria-pressed={verOriginal}
        onClick={onAlternar}
        className="rounded-control font-medium text-brand underline-offset-2 hover:underline"
      >
        {verOriginal ? t("verTraducao") : t("verOriginal")}
      </button>
    </span>
  );
}

export default TraducaoAviso;
