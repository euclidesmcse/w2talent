"use client";
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button, Chip } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import { formatMoney } from "@/lib/locale";
import { getSkill } from "@/lib/taxonomy";
import type { IntentChip } from "@/lib/query-intent";
import { nivelKey, regimeKey } from "@/components/vacancy-match";

/** Nome mostrado em cada chip "A IA entendeu". */
export function useRotuloDoChip(): (c: IntentChip) => string {
  const t = useTranslations("match");
  const locale = useLocale();
  return (c: IntentChip): string => {
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
}

/**
 * Caixa de busca com os chips dentro (ideia do portal emagine, aprovada em 2026-11-12).
 * O que a IA entendeu vira chip dentro do campo, cada um com ×; o campo fica livre para o próximo termo.
 * Apagar com o campo vazio tira o último chip. Quando o texto não vira chip (busca com "or"), ele fica no campo.
 */
export function CaixaDeBusca({
  chips,
  draft,
  onDraft,
  onSubmit,
  onRemove,
  disabled,
  disabledTitle,
}: {
  chips: IntentChip[];
  draft: string;
  onDraft: (v: string) => void;
  onSubmit: () => void;
  onRemove: (chip: IntentChip) => void;
  disabled?: boolean;
  disabledTitle?: string;
}) {
  const t = useTranslations("match");
  const tv = useTranslations("vagas");
  const tc = useTranslations("common");
  const rotulo = useRotuloDoChip();
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <form
      role="search"
      onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
      className="mt-4 flex flex-wrap items-start gap-3"
    >
      {/* Clicar no espaço vazio da caixa leva ao campo */}
      <div
        onClick={(e) => { if (e.target === e.currentTarget) inputRef.current?.focus(); }}
        className="flex min-h-11 min-w-0 max-w-[640px] flex-[1_1_260px] flex-wrap items-center gap-1.5 rounded-[22px] border border-white bg-surface px-2 py-1.5 text-ink focus-within:ring-2 focus-within:ring-white/70"
        data-testid="caixa-busca"
      >
        {chips.length ? (
          <ul aria-label={t("understood")} className="contents" data-testid="ia-entendeu">
            {chips.map((c, i) => {
              const text = rotulo(c);
              return (
                <li key={`${c.kind}-${c.source}-${i}`} className="flex">
                  <Chip tone={c.kind === "texto" ? "neutral" : "brand"} onRemove={() => onRemove(c)} removeLabel={t("removeChip", { chip: text })}>
                    {text}
                  </Chip>
                </li>
              );
            })}
          </ul>
        ) : null}
        <input
          ref={inputRef}
          type="search"
          aria-label={tv("searchLabel")}
          placeholder={chips.length ? tv("searchMore") : tv("searchPlaceholder")}
          value={draft}
          onChange={(e) => onDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !draft && chips.length) {
              e.preventDefault();
              onRemove(chips[chips.length - 1]);
            }
          }}
          className={cn("h-8 min-w-[140px] flex-1 bg-transparent px-2 text-[15px] text-ink placeholder:text-muted-soft focus:outline-none")}
        />
      </div>
      <Button type="submit" variant="inverse" size="md" className="md:!h-11" disabled={disabled} title={disabled ? disabledTitle : undefined}>
        {tc("search")}
      </Button>
    </form>
  );
}
