"use client";
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { MatchBar } from "@/components/ui";
import { formatFaixa } from "@/lib/format";
import { getSkill } from "@/lib/taxonomy";
import type { MatchGap } from "@/lib/match";
import type { Nivel, Regime } from "@/lib/query-intent";

/** Chave de tradução (sem acento) do nível e do regime pedidos. */
export const nivelKey = (n: Nivel) => ({ Júnior: "junior", Pleno: "pleno", Sênior: "senior" })[n];
export const regimeKey = (r: Regime) => (r === "Estágio" ? "estagio" : r);

/** Texto de uma lacuna ("falta: Kubernetes", "híbrido, você pediu remoto"…). */
export function useGapText() {
  const t = useTranslations("match");
  const locale = useLocale();
  return React.useCallback(
    (g: MatchGap): string => {
      switch (g.kind) {
        case "skill":
          return t("gapSkill", { skill: getSkill(g.skill)?.label ?? g.skill });
        case "nivel":
          return g.have ? t("gapNivel", { want: t(`nivel.${nivelKey(g.want)}`), have: g.have }) : t("gapNivelNone");
        case "regime":
          return g.have ? t("gapRegime", { want: t(`regime.${regimeKey(g.want)}`), have: g.have }) : t("gapRegimeNone");
        case "modo":
          return g.have ? t("gapModo", { want: t(`modo.${g.want}`), have: t(`modo.${g.have}`) }) : t("gapModoNone");
        case "faixa":
          return g.have == null ? t("gapFaixaNone") : t("gapFaixa", { have: formatFaixa(null, g.have, g.moeda, locale) });
      }
    },
    [t, locale],
  );
}

/** Coluna Match: barra + o que falta (só a primeira lacuna, a de maior peso). */
export function MatchCell({ match, gaps }: { match?: number | null; gaps?: MatchGap[] }) {
  const t = useTranslations("match");
  const gapText = useGapText();
  if (match == null) return <span className="text-muted">—</span>;
  const first = gaps?.[0];
  return (
    <div className="flex flex-col gap-0.5">
      <MatchBar value={match} label={t("label")} />
      {first ? (
        <span className="text-xs text-muted" title={gaps!.map(gapText).join(" · ")}>
          {gapText(first)}
          {gaps!.length > 1 ? ` ${t("moreGaps", { count: gaps!.length - 1 })}` : ""}
        </span>
      ) : null}
    </div>
  );
}
