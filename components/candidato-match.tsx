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

/** Linha "Para a vaga X: 87%" com todas as lacunas, no topo da Ficha W2 (2.2c). */
export function MatchDaVaga({ vaga, match, gaps }: { vaga?: string | null; match?: number | null; gaps?: GapCandidato[] }) {
  const t = useTranslations("candidatos.match");
  const gapText = useGapCandidatoText();
  if (match == null) return null;
  const pct = Math.round(match);
  return (
    <section data-testid="match-da-vaga" aria-label={t("col")} className="rounded-card border border-line bg-canvas px-4 py-3">
      <p className="font-medium text-ink">
        {vaga ? t("paraVaga", { vaga, pct }) : t("paraEstaVaga", { pct })}
      </p>
      {gaps?.length ? (
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[13px] text-ink-soft">
          {gaps.map((g, i) => <li key={i}>{gapText(g)}</li>)}
        </ul>
      ) : (
        <p className="mt-1 text-[13px] text-ink-soft">{t("semLacunas")}</p>
      )}
    </section>
  );
}
