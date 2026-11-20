/**
 * Linha do tempo, PR c (plano 2026-11-20, D4): resumo por IA do CV completo, para o recrutador.
 * Um resumo geral e um por cargo da ficha, gerados na primeira vez que alguém pede e guardados em
 * `CandidateCv.resumos` por idioma. Valem enquanto o texto do CV e os cargos não mudam (hash).
 * Só fatos do CV; nada de nota, idade, gênero ou qualquer dado sensível (ETICA). A tela avisa que é feito por IA.
 */
import type { PrismaClient } from "@prisma/client";
import type { ChatRequest, ChatResult } from "./ai/types";
import { redactContacts } from "./ai/redact";
import { sha256Hex } from "./admin-auth";
import { ETICA, parseJsonObject, W2_LANG } from "./ficha-ai";
import type { Experiencia } from "./ficha";

export type ResumoCv = { geral: string; cargos: string[]; geradoEm: string; modelo?: string };
type Guardados = { hash: string; porIdioma: Record<string, ResumoCv> };

export type ChatResumoFn = (task: "summarize_cv", req: ChatRequest) => Promise<ChatResult & { model?: string }>;

/** Quanto do CV vai para a IA (cabe com folga no contexto de 32 mil tokens). */
export const MAX_CV_RESUMO = 24_000;
const MAX_GERAL = 700;
const MAX_CARGO = 400;

type Cargo = Pick<Experiencia, "cargo" | "empresa" | "inicio" | "fim" | "atual">;

export function idiomaResumo(v: unknown): string {
  return typeof v === "string" && W2_LANG[v] ? v : "pt-BR";
}

export async function hashResumo(texto: string, cargos: Cargo[]): Promise<string> {
  const chave = cargos.map((c) => [c.cargo, c.empresa, c.inicio, c.atual ? "atual" : c.fim]);
  return sha256Hex(`${texto}\n${JSON.stringify(chave)}`);
}

export function promptResumo(texto: string, cargos: Cargo[], idioma: string): { sistema: string; entrada: string } {
  const lang = idiomaResumo(idioma);
  const sistema = `You summarize a résumé for a recruiter. Reply with one JSON object only: {"geral": string, "cargos": [string]}.
"geral": at most 4 short sentences (max 600 characters): the career path, the main areas and the strongest concrete results.
"cargos": one entry per job in the "cargos" list, in the same order. Each entry has at most 2 sentences (max 350 characters) about what the person did in that job according to the résumé text. If the text says nothing about a job, use an empty string.
Only use facts written in the résumé; never invent numbers, never judge or score the person, no adjectives like "excellent". Third person, no name.
${ETICA}
Write in ${W2_LANG[lang]}.`;
  const entrada = JSON.stringify({
    cargos: cargos.map((c, i) => ({ n: i + 1, cargo: c.cargo, empresa: c.empresa, periodo: `${c.inicio} – ${c.atual ? "atual" : c.fim}` })),
    curriculo: redactContacts(texto).slice(0, MAX_CV_RESUMO),
  });
  return { sistema, entrada };
}

function limpo(v: unknown, max: number): string {
  return typeof v === "string" ? redactContacts(v.replace(/\s+/g, " ").trim()).slice(0, max) : "";
}

/** Resposta da IA → resumo com exatamente um texto por cargo. Null sem resumo geral. */
export function sanitizarResumo(obj: Record<string, unknown> | null, nCargos: number): Omit<ResumoCv, "geradoEm" | "modelo"> | null {
  const geral = limpo(obj?.geral, MAX_GERAL);
  if (geral.length < 20) return null;
  const lista = Array.isArray(obj?.cargos) ? (obj!.cargos as unknown[]) : [];
  return { geral, cargos: Array.from({ length: nCargos }, (_, i) => limpo(lista[i], MAX_CARGO)) };
}

function guardadosDe(v: unknown, hash: string): Guardados {
  const o = (v && typeof v === "object" ? v : {}) as Partial<Guardados>;
  return o.hash === hash && o.porIdioma && typeof o.porIdioma === "object" ? { hash, porIdioma: { ...o.porIdioma } } : { hash, porIdioma: {} };
}

/**
 * O resumo guardado para o idioma, ou um novo (quando `chat` vem; sem `chat` devolve só o guardado).
 * `novo` diz se chamou a IA. Lança se a IA falhar ou responder sem resumo.
 */
export async function resumoDoCv(
  db: Pick<PrismaClient, "candidateCv">,
  opts: { profileId: string; texto: string; resumos: unknown; cargos: Cargo[]; idioma: string; chat: ChatResumoFn | null; now?: Date },
): Promise<{ resumo: ResumoCv | null; novo: boolean }> {
  const idioma = idiomaResumo(opts.idioma);
  const hash = await hashResumo(opts.texto, opts.cargos);
  const guardados = guardadosDe(opts.resumos, hash);
  const pronto = guardados.porIdioma[idioma];
  if (pronto) return { resumo: pronto, novo: false };
  if (!opts.chat) return { resumo: null, novo: false };
  const { sistema, entrada } = promptResumo(opts.texto, opts.cargos, idioma);
  const r = await opts.chat("summarize_cv", {
    json: true,
    temperature: 0.2,
    maxTokens: 2500,
    messages: [
      { role: "system", content: sistema },
      { role: "user", content: entrada },
    ],
  });
  const s = sanitizarResumo(parseJsonObject(r.text), opts.cargos.length);
  if (!s) throw new Error("resposta da IA sem resumo");
  const resumo: ResumoCv = { ...s, geradoEm: (opts.now ?? new Date()).toISOString(), ...(r.model ? { modelo: r.model } : {}) };
  guardados.porIdioma[idioma] = resumo;
  // updateMany: se o candidato apagou o CV enquanto a IA respondia, não recria nada.
  await db.candidateCv.updateMany({ where: { profileId: opts.profileId }, data: { resumos: guardados } });
  return { resumo, novo: true };
}
