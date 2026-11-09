/**
 * Lado do navegador do envio (1.5.13), no modo de teste do admin: o perfil é o publicado em
 * "Minha ficha" com o e-mail do rascunho guardado neste navegador. Sai quando entrar o login.
 */
export const FICHA_KEY = "w2talent:ficha";

export function emailDaFichaLocal(): string {
  try {
    const raw = window.localStorage.getItem(FICHA_KEY);
    const email = raw ? (JSON.parse(raw) as { ficha?: { email?: unknown } })?.ficha?.email : "";
    return typeof email === "string" ? email.trim().toLowerCase() : "";
  } catch {
    return "";
  }
}

/** O botão de envio só aparece para o admin, até o login. */
export async function podeEnviar(): Promise<boolean> {
  try {
    const r = await fetch("/api/ficha/publicar");
    const j = (await r.json()) as { podePublicar?: boolean };
    return j.podePublicar === true;
  } catch {
    return false;
  }
}

export function postEnvio(path: "estado" | "aprovar" | "enviar" | "enviadas", body: Record<string, unknown>): Promise<Response> {
  return fetch(`/api/envio/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

/** "09/11" no idioma da tela. */
export function diaMes(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit" }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

/** Vagas já enviadas por este perfil: id → data do envio. Vazio fora do modo de teste. */
export async function enviadasDoPerfil(email: string): Promise<Record<string, string>> {
  if (!email) return {};
  try {
    const r = await postEnvio("enviadas", { email });
    if (!r.ok) return {};
    const j = (await r.json()) as { applications?: { vacancyId: string | null; createdAt: string }[] };
    const out: Record<string, string> = {};
    for (const a of j.applications ?? []) if (a.vacancyId) out[a.vacancyId] = a.createdAt;
    return out;
  } catch {
    return {};
  }
}
