"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { buttonClasses } from "@/components/ui/button";

/**
 * EmptyState — empty state busca 0 mostra sugestão IA + CTA
 * - exibe emptyTitle/emptyBody
 * - se suggestion presente: "Você quis dizer ..." + botão ver sugestão
 * - CTA "Limpar filtros" / "Ver todas as vagas"
 * - a11y: role=status, aria-live polite
 * - radix vaul não necessário aqui; mas breakpoints 360/768/1024/1280 via tailwind
 */
export type EmptyStateProps = {
  query?: string;
  suggestion?: string | null;
  emptyCTA?: string | null;
  variant?: "vagas" | "candidatos";
  onClearFilters?: () => void;
  onUseSuggestion?: (suggestion: string) => void;
};

export function EmptyState({ query, suggestion, emptyCTA, variant = "vagas", onClearFilters, onUseSuggestion }: EmptyStateProps) {
  // next-intl com fallback pt-BR (i18n.ts junta o catálogo do idioma ao pt-BR)
  const t = useTranslations();
  const ns = variant === "candidatos" ? "candidatos" : "vagas";
  void emptyCTA; // o texto que vem da API é só em português; aqui usamos o catálogo do idioma

  return (
    <div role="status" aria-live="polite" data-testid="empty-state" className="empty-state mb-4 rounded-card border border-line bg-surface px-6 py-10 text-center">
      <h2 className="text-[17px] font-semibold">{t(`${ns}.emptyTitle`)}</h2>
      {query ? <p className="mt-2 text-sm text-muted">{t("empty.noResults", { query })}</p> : null}
      <p className="mt-1 text-sm text-muted">{t(`${ns}.emptyBody`)}</p>
      {suggestion ? (
        <div className="mt-3">
          {/* Sugestão IA: correção do termo buscado */}
          <p data-testid="sugestao" className="text-sm">{t("empty.didYouMean", { suggestion })}</p>
          <button type="button" onClick={() => onUseSuggestion?.(suggestion)} className={buttonClasses("secondary", "sm", "mt-2")}>
            {t("empty.useSuggestion", { suggestion })}
          </button>
        </div>
      ) : null}
      {/* CTA: limpar filtros */}
      <button type="button" data-action="limpar-filtros" onClick={() => onClearFilters?.()} className={buttonClasses("primary", "md", "mt-4")}>
        {t(`${ns}.emptyCta`)}
      </button>
      <style>{`@media (max-width: 360px) { .empty-state { padding: 1rem; } }`}</style>
    </div>
  );
}

export default EmptyState;
