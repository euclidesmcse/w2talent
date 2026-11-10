"use client";
/**
 * Login no navegador (1.5.5): lê /api/conta uma vez por página (e de novo quando pedido),
 * leva para /entrar com a volta e faz o Sair (apaga o que ficou guardado neste navegador).
 */
import * as React from "react";

export type EstadoConta = "carregando" | "anonimo" | "mfa" | "sem_perfil" | "mfa_obrigatorio" | "ok" | "erro";
export type PerfilConta = "candidato" | "recrutador";
export type InfoConta = {
  estado: EstadoConta;
  conta?: { nome: string; email?: string; perfil?: PerfilConta | null; mfaLigado?: boolean };
  config?: { provedores: { google: boolean; microsoft: boolean }; turnstileSiteKey: string | null };
};

/** O que o Sair apaga deste navegador (decisão do plano 1.5.5). */
export const CHAVES_LOCAIS = [
  "w2talent:ultima-busca",
  "w2talent:candidaturas-copia",
  "w2talent:ficha",
  "w2talent:selection",
  "w2talent:selectionLabels",
  "w2talent:loteId",
];

const CARREGANDO: InfoConta = { estado: "carregando" };
let atual: InfoConta = CARREGANDO;
let pedido: Promise<InfoConta> | null = null;
const ouvintes = new Set<() => void>();

export function recarregarConta(): Promise<InfoConta> {
  pedido = fetch("/api/conta", { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<InfoConta>) : { estado: "erro" as const }))
    .catch(() => ({ estado: "erro" as const }))
    .then((info) => {
      atual = info;
      ouvintes.forEach((f) => f());
      return info;
    });
  return pedido;
}

export function lerConta(): Promise<InfoConta> {
  return pedido ?? recarregarConta();
}

export function useConta(): InfoConta {
  const info = React.useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      return () => { ouvintes.delete(f); };
    },
    () => atual,
    () => CARREGANDO,
  );
  React.useEffect(() => { void lerConta(); }, []);
  return info;
}

/** Candidato pronto para selecionar, aprovar e enviar. */
export function ehCandidato(i: InfoConta): boolean {
  return i.estado === "ok" && i.conta?.perfil === "candidato";
}

/** Só caminhos internos ("/vagas", nunca "//site" ou "https://..."). */
export function voltaSegura(v: string | null | undefined, padrao = "/"): string {
  if (!v || !v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\")) return padrao;
  return v;
}

export function linkEntrar(volta?: string): string {
  const v = volta ?? (typeof window !== "undefined" ? window.location.pathname + window.location.search : "/");
  return `/entrar?volta=${encodeURIComponent(voltaSegura(v))}`;
}

/** Para onde mandar a pessoa conforme o estado do login (usado depois do Google/Microsoft). */
export function destinoDoEstado(estado: EstadoConta, volta: string): string | null {
  const v = encodeURIComponent(volta);
  if (estado === "mfa") return `/entrar/codigo?volta=${v}`;
  if (estado === "sem_perfil") return `/entrar/perfil?volta=${v}`;
  if (estado === "mfa_obrigatorio") return `/conta/seguranca?volta=${v}`;
  if (estado === "ok") return volta;
  return null;
}

export function limparDadosLocais(): void {
  try {
    for (const k of CHAVES_LOCAIS) window.localStorage.removeItem(k);
  } catch {}
}

export async function sair(): Promise<void> {
  try {
    await fetch("/api/auth/sign-out", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  } catch {}
  limparDadosLocais();
  window.location.href = "/";
}
