"use client";
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Chip } from "@/components/ui";
import { formatMoney } from "@/lib/locale";
import { getSkill } from "@/lib/taxonomy";
import type { IntentChip } from "@/lib/query-intent";
import { nivelKey, regimeKey } from "@/components/vacancy-match";

/** Linha "A IA entendeu": um chip por critério lido do texto, cada um com × para tirar da busca. */
export function IntentChips({
  chips,
  total,
  byMatch,
  onRemove,
}: {
  chips: IntentChip[];
  total: number;
  byMatch: boolean;
  onRemove: (chip: IntentChip) => void;
}) {
  const t = useTranslations("match");
  const locale = useLocale();
  if (!chips.length) return null;

  const label = (c: IntentChip): string => {
    switch (c.kind) {
      case "skill":
        return getSkill(c.value)?.label ?? c.value;
      case "modo": {
        const m = t(`modo.${c.value}`);
        return m.charAt(0).toLocaleUpperCase(locale) + m.slice(1);
      }
      case "nivel":
        return t(`nivel.${nivelKey(c.value)}`);
      case "regime":
        return t(`regime.${regimeKey(c.value)}`);
      case "faixa":
        return `≥ ${formatMoney(c.value, locale, "BRL")}`;
      case "idioma":
        return t(`idioma.${c.value}`);
      default:
        return c.value;
    }
  };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2" data-testid="ia-entendeu">
      <span className="text-[13px] text-muted">{t("understood")}</span>
      {chips.map((c, i) => {
        const text = label(c);
        return (
          <Chip key={`${c.kind}-${c.source}-${i}`} tone={c.kind === "texto" ? "neutral" : "brand"} onRemove={() => onRemove(c)} removeLabel={t("removeChip", { chip: text })}>
            {text}
          </Chip>
        );
      })}
      <span className="text-[13px] text-muted">· {byMatch ? t("countByMatch", { count: total }) : t("countByRelevance", { count: total })}</span>
    </div>
  );
}
