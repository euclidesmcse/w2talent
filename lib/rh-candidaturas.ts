/**
 * 2.4b Candidaturas da vaga (plano 2.4 aprovado pelo Euclides em 2026-11-18).
 * - D1/D2: o recrutador muda a etapa com 1 clique; a primeira saída de "nova" marca respondidaEm.
 * - D3: o candidato vê o status, derivado da etapa e que não volta para trás:
 *   abrir ou Em análise → visualizado; Entrevista, Proposta, Contratada → respondido;
 *   Não seguiu → arquivado ("Encerrada" na tela do candidato).
 * - D6: só a empresa da vaga; cada mudança grava o sinal "etapa_mudou" (de, para).
 * Contato continua mascarado aqui; o 2.4c libera na Entrevista (D4).
 */
import type { PrismaClient } from "@prisma/client";
import { withoutContacts } from "./search";
import { matchCandidato, type GapCandidato } from "./match-candidato";
import { gravarSinais } from "./sinais";
import { ETAPAS, type Etapa } from "./painel-rh";

export type StatusCandidatura = "enviado" | "visualizado" | "respondido" | "arquivado";

/** Máximo de candidaturas de uma vaga numa leitura (ordenadas por match). */
export const RH_MAX_CANDIDATURAS = 500;

const ORDEM: Record<Exclude<StatusCandidatura, "arquivado">, number> = { enviado: 0, visualizado: 1, respondido: 2 };

const DA_ETAPA: Record<Etapa, StatusCandidatura> = {
  nova: "enviado",
  em_analise: "visualizado",
  entrevista: "respondido",
  proposta: "respondido",
  contratada: "respondido",
  nao_seguiu: "arquivado",
};

export function ehEtapa(x: unknown): x is Etapa {
  return typeof x === "string" && (ETAPAS as readonly string[]).includes(x);
}

/** Status que o candidato vê depois de a etapa mudar (D3). Nunca volta para trás. */
export function statusDaEtapa(atual: StatusCandidatura, etapa: Etapa): StatusCandidatura {
  const novo = DA_ETAPA[etapa];
  if (novo === "arquivado") return "arquivado";
  // Saindo de "Não seguiu": a candidatura já tinha sido vista.
  const base = atual === "arquivado" ? "visualizado" : atual;
  return ORDEM[novo] > ORDEM[base] ? novo : base;
}

export type CandidaturaRh = {
  applicationId: string;
  etapa: Etapa;
  etapaEm: string | null;
  enviadaEm: string;
  /** false quando a ficha saiu do ar (arquivada ou vencida) depois da candidatura. */
  fichaAtiva: boolean;
  match: number;
  gaps: GapCandidato[];
  /** Perfil sem contato (emailMasked/celularMasked), no mesmo formato da busca de Candidatos. */
  candidato: Record<string, unknown>;
};

export type VagaDaPagina = { id: string; titulo: string; status: "ativa" | "arquivada"; expiresAt: string };

const PERFIL = {
  id: true, userId: true, nome: true, titulo: true, resumo3linhas: true, localidade: true, modo: true, regimePreferido: true,
  pretensaoDe: true, pretensaoAte: true, pretensaoMoeda: true, pretensoes: true, disponibilidade: true, objetivoCrescimento: true,
  stack: true, idiomas: true, senioridade: true, mudanca: true, experiencias: true, formacao: true, fichaW2: true,
  email: true, celular: true, status: true, expiresAt: true, createdAt: true, updatedAt: true,
} as const;

const VAGA = {
  id: true, titulo: true, status: true, expiresAt: true, stack: true, nivel: true, regime: true, localidade: true,
  faixaDe: true, faixaAte: true, faixaMoeda: true, descricaoBullets: true, createdAt: true, updatedAt: true,
} as const;

/** A vaga (da empresa) e as candidaturas que chegaram, por match. null quando a vaga não é da empresa. */
export async function candidaturasDaVaga(
  db: PrismaClient,
  companyId: string,
  vacancyId: string,
  now = new Date(),
): Promise<{ vaga: VagaDaPagina; itens: CandidaturaRh[]; total: number } | null> {
  const vaga = await db.vacancy.findFirst({ where: { id: vacancyId, companyId }, select: VAGA });
  if (!vaga) return null;
  const where = { vacancyId, companyId, origem: "candidaturaLote" as const };
  const [apps, total] = await Promise.all([
    db.application.findMany({
      where,
      select: { id: true, etapa: true, etapaEm: true, createdAt: true, candidate: { select: PERFIL } },
      orderBy: { createdAt: "asc" },
      take: RH_MAX_CANDIDATURAS,
    }),
    db.application.count({ where }),
  ]);
  const t = now.getTime();
  const itens = apps.map((a): CandidaturaRh => {
    const { expiresAt, ...perfil } = a.candidate;
    const m = matchCandidato(perfil as any, vaga as any, t);
    return {
      applicationId: a.id,
      etapa: a.etapa as Etapa,
      etapaEm: a.etapaEm?.toISOString() ?? null,
      enviadaEm: a.createdAt.toISOString(),
      fichaAtiva: perfil.status === "ativo" && expiresAt.getTime() > t,
      match: m.pct,
      gaps: m.gaps,
      candidato: withoutContacts(perfil),
    };
  });
  // Melhor match primeiro; empate, quem chegou antes.
  itens.sort((a, b) => b.match - a.match || a.enviadaEm.localeCompare(b.enviadaEm));
  return { vaga: { id: vaga.id, titulo: vaga.titulo, status: vaga.status, expiresAt: vaga.expiresAt.toISOString() }, itens, total };
}

export type ResultadoEtapa =
  | { ok: true; etapa: Etapa; status: StatusCandidatura; etapaEm: string }
  | { ok: false; erro: "nao_encontrada" | "mudou" };

/**
 * Muda a etapa. `de` é a etapa que a tela mostrava: se outra pessoa mudou antes, responde "mudou"
 * e nada é gravado. Mesma etapa não grava nada.
 */
export async function mudarEtapa(
  db: PrismaClient,
  companyId: string,
  applicationId: string,
  de: Etapa,
  para: Etapa,
  now = new Date(),
): Promise<ResultadoEtapa> {
  return db.$transaction(async (tx) => {
    const app = await tx.application.findFirst({
      where: { id: applicationId, companyId, origem: "candidaturaLote" },
      select: { id: true, etapa: true, etapaEm: true, status: true, respondidaEm: true, candidateId: true, vacancyId: true },
    });
    if (!app) return { ok: false, erro: "nao_encontrada" } as const;
    if (app.etapa !== de) return { ok: false, erro: "mudou" } as const;
    if (de === para) return { ok: true, etapa: para, status: app.status as StatusCandidatura, etapaEm: (app.etapaEm ?? now).toISOString() } as const;
    const status = statusDaEtapa(app.status as StatusCandidatura, para);
    const r = await tx.application.updateMany({
      where: { id: app.id, etapa: de },
      data: { etapa: para, etapaEm: now, status, ...(app.respondidaEm || para === "nova" ? {} : { respondidaEm: now }) },
    });
    if (r.count === 0) return { ok: false, erro: "mudou" } as const;
    await gravarSinais(tx, [
      { tipo: "etapa_mudou", ator: "recrutador", candidateId: app.candidateId, vacancyId: app.vacancyId, applicationId: app.id, dados: { de, para }, createdAt: now },
    ]);
    return { ok: true, etapa: para, status, etapaEm: now.toISOString() } as const;
  });
}

/** O recrutador abriu a ficha: "Enviada" vira "Vista" para o candidato (D3). Não conta como resposta. */
export async function marcarVista(db: PrismaClient, companyId: string, applicationId: string): Promise<boolean> {
  const r = await db.application.updateMany({
    where: { id: applicationId, companyId, origem: "candidaturaLote", status: "enviado" },
    data: { status: "visualizado" },
  });
  if (r.count > 0) return true;
  return (await db.application.count({ where: { id: applicationId, companyId, origem: "candidaturaLote" } })) > 0;
}
