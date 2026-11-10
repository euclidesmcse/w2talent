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
/** Quanto tempo uma leitura de /api/conta vale entre telas (a sessão pode acabar ou ser revogada). */
const VALIDADE_MS = 30_000;
let atual: InfoConta = CARREGANDO;
let pedido: Promise<InfoConta> | null = null;
let lidoEm = 0;
let ouvindo = false;
const ouvintes = new Set<() => void>();

function avisar(info: InfoConta) {
  atual = info;
  ouvintes.forEach((f) => f());
}

export function recarregarConta(): Promise<InfoConta> {
  const p = fetch("/api/conta", { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<InfoConta>) : { estado: "erro" as const }))
    .catch(() => ({ estado: "erro" as const }))
    .then((info) => {
      // Só a leitura mais nova vale (duas telas podem pedir ao mesmo tempo).
      if (pedido === p) {
        lidoEm = Date.now();
        avisar(info);
      }
      return info;
    });
  pedido = p;
  return p;
}

/** Usa a última leitura se for recente e não tiver falhado; senão lê de novo. */
export function lerConta(): Promise<InfoConta> {
  if (pedido && atual.estado !== "erro" && (atual.estado === "carregando" || Date.now() - lidoEm < VALIDADE_MS)) return pedido;
  return recarregarConta();
}

/** O servidor recusou por login (401/403): a sessão pode ter acabado. Lê de novo. */
export function contaRecusada(): void {
  void recarregarConta();
}

function ouvirMudancas() {
  if (ouvindo || typeof window === "undefined") return;
  ouvindo = true;
  // Voltou a internet ou a aba voltou a aparecer: confere se a sessão ainda vale.
  window.addEventListener("online", () => { void recarregarConta(); });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && Date.now() - lidoEm >= VALIDADE_MS) void recarregarConta();
  });
}

/**
 * Estado do login para a tela. `fresco`: as telas de entrar leem sempre de novo e mostram
 * "carregando" até lá, para não seguir uma sessão que já acabou.
 */
export function useConta(opcoes: { fresco?: boolean } = {}): InfoConta {
  const fresco = !!opcoes.fresco;
  const info = React.useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      return () => { ouvintes.delete(f); };
    },
    () => atual,
    () => CARREGANDO,
  );
  React.useEffect(() => {
    ouvirMudancas();
    if (fresco) {
      avisar(CARREGANDO);
      void recarregarConta();
    } else void lerConta();
  }, [fresco]);
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

/**
 * Sair: só apaga os dados do navegador e vai para o início depois que o servidor encerrou a sessão.
 * Sem internet ou com erro, devolve false e a tela avisa (a sessão continuaria valendo).
 */
export async function sair(): Promise<boolean> {
  try {
    const r = await fetch("/api/auth/sign-out", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    if (!r.ok) return false;
  } catch {
    return false;
  }
  limparDadosLocais();
  window.location.href = "/";
  return true;
}
