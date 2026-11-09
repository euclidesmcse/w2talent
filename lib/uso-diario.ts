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
