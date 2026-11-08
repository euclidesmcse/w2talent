/**
 * Formatação pura (sem banco): usada por componentes "use client" e por lib/search.ts.
 * Fica separada para o bundle do navegador não puxar o Prisma/pg.
 */
import { formatMoney } from "./locale";

// ── Helpers: mascaramento ─────────────────────────────────────────────
export function maskEmail(email: string): string {
  if (!email || typeof email !== "string") return "—";
  const at = email.indexOf("@");
  if (at <= 1) return "***" + (at !== -1 ? email.slice(at) : "");
  const local = email.slice(0, at);
  const domain = email.slice(at);
  // mostra 2 primeiros + ***
  const visible = local.slice(0, 2);
  return `${visible}***${domain} 🔒`;
}

export function maskPhone(phone: string): string {
  if (!phone || typeof phone !== "string") return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return "*** 🔒";
  // mostra DDD + *** + últimos 2
  const last2 = digits.slice(-2);
  const ddd = digits.slice(0, 4); // +55 + DDD? simplifica
  return `${ddd.slice(0, 4)}***${last2} 🔒`;
}

// ── Helpers: faixa / tempo (por idioma: pt-BR, en, es) ──────────────
const RANGE_WORDS: Record<string, { from: string; upTo: string }> = {
  "pt-BR": { from: "a partir de", upTo: "até" },
  en: { from: "from", upTo: "up to" },
  es: { from: "desde", upTo: "hasta" },
};

export function formatFaixa(
  faixaDe: number | null | undefined,
  faixaAte: number | null | undefined,
  moeda = "BRL",
  locale: string = "pt-BR"
): string {
  if (faixaDe == null && faixaAte == null) return "—";
  const fmt = (n: number) => formatMoney(n, locale, moeda);
  const words = RANGE_WORDS[locale] ?? RANGE_WORDS["pt-BR"];
  if (faixaDe != null && faixaAte != null) return `${fmt(faixaDe)} – ${fmt(faixaAte)}`;
  if (faixaDe != null) return `${words.from} ${fmt(faixaDe)}`;
  return `${words.upTo} ${fmt(faixaAte!)}`;
}

type TempoWords = { today: string; day: (n: number) => string; week: (n: number) => string; month: (n: number) => string };
const TEMPO_WORDS: Record<string, TempoWords> = {
  "pt-BR": {
    today: "hoje",
    day: (n) => (n === 1 ? "há 1 dia" : `há ${n} dias`),
    week: (n) => (n === 1 ? "há 1 semana" : `há ${n} semanas`),
    month: (n) => (n === 1 ? "há 1 mês" : `há ${n} meses`),
  },
  en: {
    today: "today",
    day: (n) => (n === 1 ? "1 day ago" : `${n} days ago`),
    week: (n) => (n === 1 ? "1 week ago" : `${n} weeks ago`),
    month: (n) => (n === 1 ? "1 month ago" : `${n} months ago`),
  },
  es: {
    today: "hoy",
    day: (n) => (n === 1 ? "hace 1 día" : `hace ${n} días`),
    week: (n) => (n === 1 ? "hace 1 semana" : `hace ${n} semanas`),
    month: (n) => (n === 1 ? "hace 1 mes" : `hace ${n} meses`),
  },
};

export function formatTempo(date: Date | string | null | undefined, locale: string = "pt-BR"): string {
  if (!date) return "—";
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "—";
  const w = TEMPO_WORDS[locale] ?? TEMPO_WORDS["pt-BR"];
  const diffDays = Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays <= 0) return w.today;
  if (diffDays < 7) return w.day(diffDays);
  if (diffDays < 30) return w.week(Math.floor(diffDays / 7));
  return w.month(Math.max(1, Math.floor(diffDays / 30)));
}

// ── Helpers: truncamento skills +2 ───────────────────────────────────
export function truncateSkills(skills: string[], limit = 3): { visible: string[]; hidden: string[]; label: string } {
  if (!Array.isArray(skills)) return { visible: [], hidden: [], label: "" };
  const visible = skills.slice(0, limit);
  const hidden = skills.slice(limit);
  const label = hidden.length > 0 ? `${visible.join(", ")} +${hidden.length}` : visible.join(", ");
  // UI will render `+N` badge
  return { visible, hidden, label: hidden.length ? `+${hidden.length}` : "" };
}

// Re-export for components: returns display string "+2"
export function skillsDisplay(skills: string[], limit = 3): string {
  if (!skills || skills.length <= limit) return skills.join(", ");
  return `${skills.slice(0, limit).join(", ")} +${skills.length - limit}`;
}
