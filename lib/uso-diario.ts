/**
 * Limite de uso por dia (1.5.10): a tela "Minha ficha" funciona sem login, então cada IP pode
 * pedir poucas leituras de CV e Fichas W2 por dia. O IP fica só como hash. Contagem atômica
 * (INSERT ... ON CONFLICT DO UPDATE), então pedidos em paralelo não passam do limite.
 */
import type { PrismaClient } from "@prisma/client";
import type { NextRequest } from "next/server";
import { sha256Hex } from "./admin-auth";

export const LIMITE_LEITURAS_DIA = 10;
export const LIMITE_FICHAS_W2_DIA = 20;
/** 2.1b: leituras de texto de vaga pela IA, por conta de recrutador. */
export const LIMITE_LEITURAS_VAGA_DIA = 30;
/** 2.1c: reescritas sem viés e listas de perguntas de entrevista pela IA, por conta. */
export const LIMITE_REVISOES_VAGA_DIA = 30;
export const LIMITE_PERGUNTAS_VAGA_DIA = 30;
/** 2.6a: perguntas na Ajuda (sem login), por IP. */
export const LIMITE_PERGUNTAS_AJUDA_DIA = 20;
/** 2.6b-1: conversas novas com a equipe (Falar com uma pessoa), por IP (D4). */
export const LIMITE_CONVERSAS_DIA = 3;

export function ipDaRequisicao(req: NextRequest | Request): string {
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "sem-ip";
}

export async function chaveUso(tipo: string, ip: string): Promise<string> {
  return sha256Hex(`w2-uso:${tipo}:${ip}`);
}

/** Soma 1 ao uso do dia e diz se ainda está dentro do limite. */
export async function consumirUso(db: PrismaClient, chave: string, limite: number, now: Date = new Date()): Promise<{ permitido: boolean; total: number }> {
  const dia = now.toISOString().slice(0, 10);
  const rows = await db.$queryRaw<{ total: number }[]>`
    INSERT INTO "UsoDiario" ("chave", "dia", "total") VALUES (${chave}, ${dia}, 1)
    ON CONFLICT ("chave", "dia") DO UPDATE SET "total" = "UsoDiario"."total" + 1
    RETURNING "total"`;
  const total = Number(rows[0]?.total ?? 1);
  return { permitido: total <= limite, total };
}
