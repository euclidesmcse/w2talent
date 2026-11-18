"use client";
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { MatchBar } from "@/components/ui";
import { formatFaixa } from "@/lib/format";
import { getSkill } from "@/lib/taxonomy";
import type { GapCandidato } from "@/lib/match-candidato";

const label = (id: string) => getSkill(id)?.label ?? id;

/** Texto de uma lacuna do lado do recrutador ("falta: Kubernetes", "Kubernetes: tem OpenShift (próxima)"…). */
export function useGapCandidatoText() {
  const t = useTranslations("candidatos.match");
  const tf = useTranslations("ficha");
  const locale = useLocale();
  return React.useCallback(
    (g: GapCandidato): string => {
      switch (g.kind) {
        case "skill":
          return g.proxima ? t("gapSkillProxima", { skill: label(g.skill), proxima: label(g.proxima) }) : t("gapSkill", { skill: label(g.skill) });
        case "nivel":
          return g.have ? t("gapNivel", { want: g.want, have: tf(`sen_${g.have}` as any) }) : t("gapNivelNone");
        case "regime":
          return g.have.length ? t("gapRegime", { want: g.want, have: g.have.join(", ") }) : t("gapRegimeNone");
        case "modo":
          return g.have ? t("gapModo", { want: tf(`modo_${g.want}` as any), have: tf(`modo_${g.have}` as any) }) : t("gapModoNone");
        case "faixa":
          return t("gapFaixa", { have: formatFaixa(null, g.have, g.moeda, locale) });
      }
    },
    [t, tf, locale],
  );
}

/** Coluna Match da tela Candidatos: barra + a primeira lacuna (a de maior peso). */
export function MatchCandidatoCell({ match, gaps }: { match?: number | null; gaps?: GapCandidato[] }) {
  const t = useTranslations("candidatos.match");
  const gapText = useGapCandidatoText();
  if (match == null) return <span className="text-muted">—</span>;
  const first = gaps?.[0];
  return (
    <div className="flex flex-col gap-0.5">
      <MatchBar value={match} label={t("label")} />
      {first ? (
        <span className="text-xs text-muted" title={gaps!.map(gapText).join(" · ")}>
          {gapText(first)}
          {gaps!.length > 1 ? ` (+${gaps!.length - 1})` : ""}
        </span>
      ) : null}
    </div>
  );
}
