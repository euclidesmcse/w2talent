/**
 * 2.8 Sinais de aprendizado (antecipado pelo plano "IA para RH (SAP)", aprovado em 2026-11-18).
 * Grava o que as pessoas fazem com as vagas sugeridas, para o ranking adaptativo (3.1) e o
 * "o que falta para as vagas" (B1). Nada de texto livre nem contatos: só ids, tipo e o match daquele momento.
 */
import type { Prisma, PrismaClient } from "@prisma/client";

export const TIPOS_SINAL = [
  "vaga_aprovada", // candidato aprovou a vaga para envio
  "aprovacao_desfeita", // candidato tirou a aprovação
  "aprovacao_caiu", // a vaga mudou depois da aprovação e ela caiu no envio
  "candidatura_enviada", // a candidatura saiu no lote
  "exportou", // 2.3b: o recrutador exportou a comparação com este candidato (formato em dados)
] as const;
export type TipoSinal = (typeof TIPOS_SINAL)[number];

export const ATORES_SINAL = ["candidato", "recrutador", "sistema"] as const;
export type AtorSinal = (typeof ATORES_SINAL)[number];

export type Sinal = {
  tipo: TipoSinal;
  ator: AtorSinal;
  candidateId?: string | null;
  vacancyId?: string | null;
  applicationId?: string | null;
  matchPct?: number | null;
  dados?: Record<string, string | number | boolean | null>;
  createdAt?: Date;
};

type Db = Pick<PrismaClient, "feedbackSignal"> | Prisma.TransactionClient;

export function dadosDoSinal(s: Sinal): Prisma.FeedbackSignalCreateManyInput {
  const pct = typeof s.matchPct === "number" && Number.isFinite(s.matchPct) ? Math.max(0, Math.min(100, Math.round(s.matchPct))) : null;
  return {
    tipo: s.tipo,
    ator: s.ator,
    candidateId: s.candidateId ?? null,
    vacancyId: s.vacancyId ?? null,
    applicationId: s.applicationId ?? null,
    matchPct: pct,
    ...(s.dados ? { dados: s.dados } : {}),
    ...(s.createdAt ? { createdAt: s.createdAt } : {}),
  };
}

/** Grava dentro de uma transação: se falhar, a transação falha junto (mesmo banco). */
export async function gravarSinais(db: Db, sinais: Sinal[]): Promise<void> {
  if (!sinais.length) return;
  await db.feedbackSignal.createMany({ data: sinais.map(dadosDoSinal) });
}

/** Fora de transação: um sinal perdido não pode quebrar a ação da pessoa. */
export async function registrarSinal(db: Db, s: Sinal): Promise<void> {
  try {
    await gravarSinais(db, [s]);
  } catch (err) {
    console.error(`[sinais] ${s.tipo} não gravado:`, err instanceof Error ? err.message : err);
  }
}
