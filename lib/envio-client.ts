/**
 * Lado do navegador do envio (1.5.13). Desde o login (1.5.5) o perfil é o da conta logada:
 * o servidor lê a sessão e nunca aceita e-mail ou id no corpo.
 */
import { ehCandidato, lerConta } from "./conta-client";

/** Selecionar, aprovar e enviar: só candidato logado (com o código do autenticador, se ligado). */
export async function podeEnviar(): Promise<boolean> {
  return ehCandidato(await lerConta());
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

/** Vagas já enviadas pela conta: id → data do envio. Vazio sem login de candidato. */
export async function enviadasDoPerfil(): Promise<Record<string, string>> {
  try {
    const r = await postEnvio("enviadas", {});
    if (!r.ok) return {};
    const j = (await r.json()) as { applications?: { vacancyId: string | null; createdAt: string }[] };
    const out: Record<string, string> = {};
    for (const a of j.applications ?? []) if (a.vacancyId) out[a.vacancyId] = a.createdAt;
    return out;
  } catch {
    return {};
  }
}
