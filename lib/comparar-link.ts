/**
 * Link para compartilhar a comparação de candidatos (2.3, item aprovado em 2026-11-18).
 *
 * Token assinado (HMAC-SHA256), sem tabela nova: carrega a empresa de quem criou, os ids dos
 * candidatos (na ordem da tela), a vaga de referência (se houver), quando foi criado e até quando vale.
 * Vale 14 dias. Só abre para recrutador logado que é da MESMA empresa (a rota confere o vínculo).
 *
 * Formato: base64url(JSON) + "." + base64url(assinatura). O conteúdo não é cifrado (ids e empresa
 * não dizem nada sem acesso); a assinatura impede trocar qualquer campo.
 * Chave: derivada do BETTER_AUTH_SECRET (`segredoDoLogin`) com o prefixo "w2-comparar-link:", como
 * o "lembrar este aparelho" (lib/aparelho.ts). Nenhum Secret novo.
 * O link leva o token depois do "#" (não chega ao servidor nem aos logs); a tela manda no corpo do POST.
 * Web Crypto puro: roda igual no Worker e no Node (jest).
 */
import { COMPARAR_MAX } from "./comparar";

export const COMPARAR_LINK_DIAS = 14;
/** Tamanho máximo aceito (10 ids + vaga + empresa cabem com folga). */
export const COMPARAR_LINK_MAX = 2048;

const enc = new TextEncoder();

export type ConteudoLink = {
  /** Empresa de quem criou o link. */
  empresa: string;
  /** Candidatos, na ordem da comparação (1 a 10). */
  ids: string[];
  /** Vaga de referência (da mesma empresa), ou null. */
  vaga: string | null;
  /** Criado em (ms desde 1970). */
  criado: number;
  /** Vale até (ms desde 1970). */
  expira: number;
};

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function deB64url(s: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new Error("base64url");
  const pad = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  return Uint8Array.from(atob(pad), (c) => c.charCodeAt(0));
}

async function assinatura(segredo: string, dados: string): Promise<Uint8Array> {
  const chave = await crypto.subtle.importKey("raw", enc.encode(`w2-comparar-link:${segredo}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", chave, enc.encode(dados)));
}

const idOk = (x: unknown): x is string => typeof x === "string" && x.length > 0 && x.length <= 64;

export async function assinarLinkComparacao(
  dados: { empresa: string; ids: string[]; vaga?: string | null },
  segredo: string,
  agora = Date.now(),
): Promise<{ token: string; expira: Date }> {
  if (!segredo) throw new Error("segredo ausente");
  const ids = [...new Set(dados.ids)];
  if (!idOk(dados.empresa) || ids.length === 0 || ids.length > COMPARAR_MAX || !ids.every(idOk)) throw new Error("dados do link");
  const expira = agora + COMPARAR_LINK_DIAS * 86_400_000;
  const corpo: Record<string, unknown> = { v: 1, e: dados.empresa, i: ids, c: agora, x: expira };
  if (dados.vaga && idOk(dados.vaga)) corpo.g = dados.vaga;
  const parte = b64url(enc.encode(JSON.stringify(corpo)));
  return { token: `${parte}.${b64url(await assinatura(segredo, parte))}`, expira: new Date(expira) };
}

export type ChecagemLink = { ok: true; conteudo: ConteudoLink } | { ok: false; erro: "link_invalido" | "link_vencido" };

export async function lerLinkComparacao(token: unknown, segredo: string, agora = Date.now()): Promise<ChecagemLink> {
  const invalido = { ok: false, erro: "link_invalido" } as const;
  if (!segredo || typeof token !== "string" || !token || token.length > COMPARAR_LINK_MAX) return invalido;
  const partes = token.split(".");
  if (partes.length !== 2) return invalido;
  let recebida: Uint8Array;
  try {
    recebida = deB64url(partes[1]);
  } catch {
    return invalido;
  }
  const esperada = await assinatura(segredo, partes[0]);
  // Comparação em tempo constante.
  let d = recebida.length ^ esperada.length;
  for (let i = 0; i < esperada.length; i++) d |= (recebida[i] ?? 0) ^ esperada[i];
  if (d !== 0) return invalido;
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(deB64url(partes[0])));
  } catch {
    return invalido;
  }
  if (!o || typeof o !== "object" || o.v !== 1) return invalido;
  const ids = Array.isArray(o.i) ? o.i : [];
  if (!idOk(o.e) || ids.length === 0 || ids.length > COMPARAR_MAX || !ids.every(idOk)) return invalido;
  if (typeof o.c !== "number" || typeof o.x !== "number" || !Number.isFinite(o.x)) return invalido;
  if (o.g !== undefined && !idOk(o.g)) return invalido;
  if (o.x < agora) return { ok: false, erro: "link_vencido" };
  return { ok: true, conteudo: { empresa: o.e, ids: ids as string[], vaga: (o.g as string | undefined) ?? null, criado: o.c, expira: o.x } };
}
