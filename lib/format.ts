/**
 * Formatação pura (sem banco): usada por componentes "use client" e por lib/search.ts.
 * Fica separada para o bundle do navegador não puxar o Prisma/pg.
 */
import { formatMoney } from "./locale";

// ── Helpers: mascaramento ─────────────────────────────────────────────
// Valem para qualquer idioma e país: não interpretam o formato, só escondem.

/** E-mail: 1ª letra + *** @ 1ª letra do domínio + *** + final (ex.: a***@g***.com). */
export function maskEmail(email: string): string {
  if (!email || typeof email !== "string") return "—";
  const at = email.lastIndexOf("@");
  if (at < 1) return "*** 🔒";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const dot = domain.lastIndexOf(".");
  const host = dot > 0 ? domain.slice(0, dot) : domain;
  const tld = dot > 0 ? domain.slice(dot) : "";
  return `${local[0]}***@${host ? host[0] : ""}***${tld} 🔒`;
}

/**
 * Telefone de qualquer país: troca todos os dígitos por • menos os 2 últimos, mantendo
 * "+", espaços, parênteses e traços (ex.: +55 (11) 98765-4321 → +•• (••) •••••-••21).
 * Não tenta adivinhar código de país ou de área, que mudam de um país para outro.
 */
export function maskPhone(phone: string): string {
  if (!phone || typeof phone !== "string") return "—";
  const total = (phone.match(/\d/g) ?? []).length;
  if (total < 6) return "*** 🔒";
  let seen = 0;
  const masked = phone.trim().replace(/\d/g, (d) => (++seen > total - 2 ? d : "•"));
  return `${masked} 🔒`;
}

/** Contatos que podem sair na busca: só mascarados. O completo só pelo contato aprovado. */
export function maskedContact(row: { email?: string | null; celular?: string | null; telefone?: string | null }) {
  const tel = row.celular ?? row.telefone ?? "";
  return { emailMasked: row.email ? maskEmail(row.email) : "", celularMasked: tel ? maskPhone(tel) : "" };
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

/** Iniciais para o avatar: primeira letra do nome e do último sobrenome ("Ana Silva" → "AS"). */
export function initials(nome: string | null | undefined): string {
  const parts = String(nome ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : parts[0][1] ?? "";
  return (first + last).toUpperCase();
}
