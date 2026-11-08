/**
 * i18n.ts — Task 10
 * next-intl provider, middleware locale, chaves por namespace, fallback PT-BR, formatação locale
 * Idiomas pt-BR, en, es no mesmo endereço (cookie NEXT_LOCALE ou idioma do navegador). fallback PT-BR quando chave falta.
 * Embeddings multilíngues já no MVP: lang passado para generateEmbedding.
 */
import { getRequestConfig } from "next-intl/server";
import type { AbstractIntlMessages } from "next-intl";
import { cookies, headers } from "next/headers";
import { LOCALES, DEFAULT_LOCALE, LOCALE_COOKIE, intlTag, formatMoney, resolveLocale, isAppLocale } from "./lib/locale";
import { formatFaixa, formatTempo } from "./lib/format";

export const locales = LOCALES;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = DEFAULT_LOCALE;
/** Mesmo endereço nos três idiomas (decisão de 08/11): sem prefixo /en ou /es. */
export const localePrefix = "never" as const;

// ── next-intl request config (App Router) ─────────────────────────────
// Idioma: escolha salva (cookie NEXT_LOCALE) → idioma do navegador → pt-BR.
// Mensagens: catálogo do idioma com fallback pt-BR para chave que faltar.
export default getRequestConfig(async () => {
  let resolved: Locale = defaultLocale;
  try {
    const [c, h] = await Promise.all([cookies(), headers()]);
    const fromHeader = h.get("x-next-intl-locale");
    resolved = isAppLocale(fromHeader) ? fromHeader : resolveLocale(c.get(LOCALE_COOKIE)?.value, h.get("accept-language"));
  } catch {
    resolved = defaultLocale;
  }
  const base = (await import("./messages/pt-BR.json")).default as Record<string, unknown>;
  let messages: Record<string, unknown> = base;
  if (resolved !== defaultLocale) {
    try {
      const own = (await import(`./messages/${resolved}.json`)).default as Record<string, unknown>;
      messages = deepMerge(base, own);
    } catch {
      messages = base;
    }
  }
  return { locale: resolved, messages: messages as AbstractIntlMessages };
});

function deepMerge(base: Record<string, unknown>, over: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(over)) {
    const b = out[k];
    out[k] = v && typeof v === "object" && b && typeof b === "object" ? deepMerge(b as Record<string, unknown>, v as Record<string, unknown>) : v;
  }
  return out;
}

// ── helpers usados por testes e por lib/search ───────────────────────
export function isValidLocale(loc: string | null | undefined): loc is Locale {
  return !!loc && (locales as readonly string[]).includes(loc);
}

export function getLocaleFromPath(pathname: string): Locale {
  if (!pathname) return defaultLocale;
  const seg = pathname.split("/").filter(Boolean)[0];
  if (seg === "en" || seg === "en-US") return "en";
  if (seg === "es") return "es";
  if (seg === "pt-BR" || seg === "pt") return "pt-BR";
  return defaultLocale;
}

export function stripLocale(pathname: string): string {
  const seg = pathname.split("/").filter(Boolean)[0];
  if (seg === "en" || seg === "es" || seg === "pt-BR") {
    const rest = "/" + pathname.split("/").filter(Boolean).slice(1).join("/");
    return rest === "/" ? "/" : rest;
  }
  return pathname;
}

// mensagens carregadas sync para testes (Node, sem import dinâmico async)
const _cache: Partial<Record<Locale, Record<string, unknown>>> = {};
function loadSync(locale: Locale): Record<string, unknown> {
  if (!_cache[locale]) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      _cache[locale] = locale === "en" ? require("./messages/en.json") : locale === "es" ? require("./messages/es.json") : require("./messages/pt-BR.json");
    } catch {
      _cache[locale] = {};
    }
  }
  return _cache[locale]!;
}

function getNested(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

/**
 * t — tradução com fallback PT-BR quando chave falta.
 * Uso: t('pt-BR', 'vagas.title') | t('en','vagas.title')
 */
export function t(locale: string, keyPath: string, vars?: Record<string, string | number>): string {
  const loc = isValidLocale(locale) ? (locale as Locale) : defaultLocale;
  const primary = loadSync(loc);
  let val = getNested(primary, keyPath);
  if (val === undefined && loc !== defaultLocale) {
    val = getNested(loadSync(defaultLocale), keyPath);
  }
  if (val === undefined) return keyPath;
  if (typeof val !== "string") return String(val);
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      val = (val as string).replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return val as string;
}

export function hasKey(locale: string, keyPath: string): boolean {
  const loc = isValidLocale(locale) ? (locale as Locale) : defaultLocale;
  return getNested(loadSync(loc), keyPath) !== undefined;
}

/**
 * hasFallback — true se en não tem chave mas pt-BR tem (fallback funciona)
 */
export function hasFallback(keyPath: string): boolean {
  return getNested(loadSync("en"), keyPath) === undefined && getNested(loadSync("pt-BR"), keyPath) !== undefined;
}

// ── formatação moeda/data por locale ─────────────────────────────────
export function formatCurrency(value: number, locale: string = defaultLocale, currency = "BRL"): string {
  return formatMoney(value, locale, currency);
}

export function formatCurrencyWithLocale(
  faixaDe: number | null | undefined,
  faixaAte: number | null | undefined,
  locale: string = defaultLocale,
  currency = "BRL"
): string {
  return formatFaixa(faixaDe, faixaAte, currency, locale);
}

export function formatDateByLocale(date: Date | string | null | undefined, locale: string = defaultLocale): string {
  if (!date) return "—";
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "—";
  // pt-BR e es: dd/mm/aaaa; en: mm/dd/aaaa
  return new Intl.DateTimeFormat(intlTag(locale), { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

export function formatTempoByLocale(date: Date | string | null | undefined, locale: string = defaultLocale): string {
  return formatTempo(date, locale);
}

// next-intl routing config export for middleware
export const routing = {
  locales: [...locales],
  defaultLocale,
  localePrefix,
};

// embedding lang passthrough helper
export function getEmbeddingLang(locale: string): string {
  return isValidLocale(locale) ? locale : defaultLocale;
}
