"use client";
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { LOCALES, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from "@/lib/locale";

const SHORT: Record<string, string> = { "pt-BR": "PT", en: "EN", es: "ES" };

/** Seletor PT · EN · ES no topo. Salva a escolha no cookie e recarrega o conteúdo no novo idioma (mesmo endereço). */
export function LanguageSwitcher() {
  const t = useTranslations("lang");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const choose = (next: string) => {
    if (next === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
    document.documentElement.lang = next;
    startTransition(() => router.refresh());
  };

  return (
    <>
      {/* Celular: seletor nativo compacto, para não espremer a navegação */}
      <select
        aria-label={t("label")}
        value={locale}
        onChange={(e) => choose(e.target.value)}
        aria-busy={pending}
        className="h-8 rounded-control border border-line bg-surface px-1.5 text-xs font-semibold text-ink md:hidden"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l} lang={l} aria-label={t(l)}>
            {SHORT[l]}
          </option>
        ))}
      </select>
      {/* Computador: três botões lado a lado */}
      <div role="group" aria-label={t("label")} className="hidden items-center rounded-control border border-line p-0.5 text-xs font-semibold md:flex" aria-busy={pending}>
        {LOCALES.map((l) => (
          <button
            key={l}
            type="button"
            lang={l}
            aria-pressed={l === locale}
            title={t(l)}
            onClick={() => choose(l)}
            className={`h-7 min-w-[34px] rounded-[4px] px-1.5 ${l === locale ? "bg-ink text-white" : "text-muted hover:bg-canvas hover:text-ink"}`}
          >
            <span aria-hidden>{SHORT[l]}</span>
            <span className="sr-only">{t(l)}</span>
          </button>
        ))}
      </div>
    </>
  );
}
