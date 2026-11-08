/**
 * Idiomas da interface (1.5.6). Arquivo puro: serve ao middleware, ao servidor e ao navegador.
 * Decisão de 08/11: o endereço é o mesmo nos três idiomas; vale a escolha salva no cookie
 * NEXT_LOCALE e, sem ela, o idioma do navegador.
 */
export const LOCALES = ["pt-BR", "en", "es"] as const;
export type AppLocale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = "pt-BR";
export const LOCALE_COOKIE = "NEXT_LOCALE";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Tag para Intl (moeda, data, número). */
export function intlTag(locale: string): string {
  if (locale === "en") return "en-US";
  // es-419 agrupa milhar também em 4 dígitos ("R$9,000"); "es" puro escreveria "9000 BRL".
  if (locale === "es") return "es-419";
  return "pt-BR";
}

/** Formata moeda sem casas decimais. Em espanhol usa o símbolo curto (R$), não o código BRL. */
export function formatMoney(value: number, locale: string, currency = "BRL"): string {
  return new Intl.NumberFormat(intlTag(locale), {
    style: "currency",
    currency: currency || "BRL",
    currencyDisplay: locale === "es" ? "narrowSymbol" : "symbol",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Normaliza "pt", "pt-PT", "en-GB", "es-AR"… para um dos idiomas da interface. */
export function normalizeLocale(value: string | null | undefined): AppLocale | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (v.startsWith("pt")) return "pt-BR";
  if (v.startsWith("en")) return "en";
  if (v.startsWith("es")) return "es";
  return null;
}

/** Primeiro idioma suportado do cabeçalho Accept-Language, respeitando os pesos (q=). */
export function localeFromAcceptLanguage(header: string | null | undefined): AppLocale | null {
  if (!header) return null;
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { tag, q: q ? Number(q.slice(2)) || 0 : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const { tag } of ranked) {
    const loc = normalizeLocale(tag);
    if (loc) return loc;
  }
  return null;
}

/** Ordem: escolha salva (cookie) → idioma do navegador → português. */
export function resolveLocale(cookieValue: string | null | undefined, acceptLanguage: string | null | undefined): AppLocale {
  if (isAppLocale(cookieValue)) return cookieValue;
  return localeFromAcceptLanguage(acceptLanguage) ?? DEFAULT_LOCALE;
}
