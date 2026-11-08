/**
 * Formatação pura (sem banco): usada por componentes "use client" e por lib/search.ts.
 * Fica separada para o bundle do navegador não puxar o Prisma/pg.
 */

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

// ── Helpers: faixa / tempo ───────────────────────────────────────────
export function formatFaixa(faixaDe: number | null | undefined, faixaAte: number | null | undefined, moeda = "BRL"): string {
  if (faixaDe == null && faixaAte == null) return "—";
  const fmt = (n: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: moeda, maximumFractionDigits: 0 }).format(n);
  if (faixaDe != null && faixaAte != null) return `${fmt(faixaDe)} – ${fmt(faixaAte)}`;
  if (faixaDe != null) return `a partir de ${fmt(faixaDe)}`;
  return `até ${fmt(faixaAte!)}`;
}

export function formatTempo(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = date instanceof Date ? date : new Date(date);
  const diffMs = Date.now() - d.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays <= 0) return "hoje";
  if (diffDays === 1) return "há 1 dia";
  if (diffDays < 7) return `há ${diffDays} dias`;
  if (diffDays < 30) return `há ${Math.floor(diffDays / 7)} sem`;
  return `há ${Math.floor(diffDays / 30)} meses`;
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
