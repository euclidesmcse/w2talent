/** Celular brasileiro em E.164 (+55...). Era do lib/auth antigo (login por SMS, removido no 1.5.5). */
export function normalizeCelular(raw: string): string {
  if (!raw || typeof raw !== "string") return raw;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return raw;
  // já com DDI 55
  if (digits.startsWith("55") && digits.length >= 12) {
    return "+" + digits;
  }
  // 11 digitos (DDD+9+8) ou 10 digitos sem DDI
  if (digits.length === 11 || digits.length === 10) {
    return "+55" + digits;
  }
  // fallback: se tiver + já
  if (raw.trim().startsWith("+")) return "+" + digits;
  return "+" + digits;
}

export function isValidCelularBR(raw: string): boolean {
  if (!raw || typeof raw !== "string") return false;
  const norm = normalizeCelular(raw);
  return /^\+55\d{10,11}$/.test(norm);
}
