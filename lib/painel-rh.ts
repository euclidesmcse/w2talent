/**
 * 2.4a Painel RH (plano 2.4 aprovado pelo Euclides em 2026-11-18).
 * D5: só números da própria empresa, sem gráficos. Vagas ativas, vencendo em até 3 dias,
 * candidaturas por vaga (novas e total), tempo médio até a primeira resposta e taxa de resposta.
 * "Resposta" é a primeira vez que a candidatura sai de "nova" (Application.respondidaEm).
 * Só contam candidaturas que o candidato enviou (origem candidaturaLote), não contatos do recrutador.
 */
import type { PrismaClient } from "@prisma/client";

export const ETAPAS = ["nova", "em_analise", "entrevista", "proposta", "contratada", "nao_seguiu"] as const;
export type Etapa = (typeof ETAPAS)[number];

export const VENCE_EM_DIAS = 3;
export const RH_MAX_VAGAS = 200;

export type SituacaoVaga = "ativa" | "vencendo" | "vencida" | "arquivada";

export type VagaRh = {
  id: string;
  titulo: string;
  situacao: SituacaoVaga;
  expiresAt: string;
  total: number;
  novas: number;
  porEtapa: Record<Etapa, number>;
};

export type MetricasRh = {
  vagasAtivas: number;
  vencendo: number;
  candidaturas: number;
  /** Na etapa Nova agora (pode incluir quem voltou para Nova depois de respondida). */
  novas: number;
  /** Já respondidas alguma vez (respondidaEm), na etapa que estiverem. */
  respondidas: number;
  /** Horas, em média, da candidatura até a primeira resposta; null sem nenhuma resposta. */
  tempoMedioHoras: number | null;
  /** 0 a 100; null sem candidaturas. */
  taxaResposta: number | null;
};

export type ResumoRh = { metricas: MetricasRh; vagas: VagaRh[] };

type VagaDb = { id: string; titulo: string; status: "ativa" | "arquivada"; expiresAt: Date };
type ContagemDb = { vacancyId: string | null; etapa: Etapa; n: number };

export function situacaoDaVaga(v: Pick<VagaDb, "status" | "expiresAt">, now: Date): SituacaoVaga {
  if (v.status === "arquivada") return "arquivada";
  const falta = v.expiresAt.getTime() - now.getTime();
  if (falta <= 0) return "vencida";
  return falta <= VENCE_EM_DIAS * 864e5 ? "vencendo" : "ativa";
}

const zeradas = (): Record<Etapa, number> => Object.fromEntries(ETAPAS.map((e) => [e, 0])) as Record<Etapa, number>;

const ORDEM_SITUACAO: Record<SituacaoVaga, number> = { vencendo: 0, ativa: 1, vencida: 2, arquivada: 3 };

/** Junta vagas e contagens. Ordem: vencendo, ativas, vencidas, arquivadas; dentro, a ordem que vier do banco (vencendo: a que vence antes primeiro). */
export function montarResumo(
  vagas: VagaDb[],
  contagens: ContagemDb[],
  respostas: { n: number; segundos: number | null },
  now: Date,
  /** Contagem de vagas da empresa toda; a lista pode estar cortada em RH_MAX_VAGAS. */
  totaisVagas?: { ativas: number; vencendo: number },
): ResumoRh {
  const porVaga = new Map<string, Record<Etapa, number>>();
  let candidaturas = 0;
  let novas = 0;
  for (const c of contagens) {
    candidaturas += c.n;
    if (c.etapa === "nova") novas += c.n;
    if (!c.vacancyId) continue;
    const m = porVaga.get(c.vacancyId) ?? zeradas();
    m[c.etapa] += c.n;
    porVaga.set(c.vacancyId, m);
  }
  const lista: VagaRh[] = vagas.map((v) => {
    const porEtapa = porVaga.get(v.id) ?? zeradas();
    const total = ETAPAS.reduce((s, e) => s + porEtapa[e], 0);
    return { id: v.id, titulo: v.titulo, situacao: situacaoDaVaga(v, now), expiresAt: v.expiresAt.toISOString(), total, novas: porEtapa.nova, porEtapa };
  });
  lista.sort((a, b) => ORDEM_SITUACAO[a.situacao] - ORDEM_SITUACAO[b.situacao] || (a.situacao === "vencendo" ? a.expiresAt.localeCompare(b.expiresAt) : 0));
  // Resposta = a candidatura já saiu de "nova" alguma vez (respondidaEm), mesmo que tenha voltado.
  const respondidas = Math.min(respostas.n, candidaturas);
  return {
    metricas: {
      vagasAtivas: totaisVagas?.ativas ?? lista.filter((v) => v.situacao === "ativa" || v.situacao === "vencendo").length,
      vencendo: totaisVagas?.vencendo ?? lista.filter((v) => v.situacao === "vencendo").length,
      candidaturas,
      novas,
      respondidas,
      tempoMedioHoras: respostas.n > 0 && respostas.segundos != null ? Math.round((respostas.segundos / 3600) * 10) / 10 : null,
      taxaResposta: candidaturas > 0 ? Math.round((respondidas / candidaturas) * 100) : null,
    },
    vagas: lista,
  };
}

/**
 * Tudo da empresa: vagas (lista cortada em RH_MAX_VAGAS, ativas antes das arquivadas), contagem de
 * vagas ativas e vencendo da empresa toda, contagem por vaga e etapa, média de tempo até a resposta.
 */
export async function resumoDaEmpresa(db: PrismaClient, companyId: string, now = new Date()): Promise<ResumoRh> {
  const limiteVence = new Date(now.getTime() + VENCE_EM_DIAS * 864e5);
  const [vagas, ativas, vencendo, grupos, media] = await Promise.all([
    db.vacancy.findMany({
      where: { companyId },
      select: { id: true, titulo: true, status: true, expiresAt: true },
      orderBy: [{ status: "asc" }, { expiresAt: "desc" }],
      take: RH_MAX_VAGAS,
    }),
    db.vacancy.count({ where: { companyId, status: "ativa", expiresAt: { gt: now } } }),
    db.vacancy.count({ where: { companyId, status: "ativa", expiresAt: { gt: now, lte: limiteVence } } }),
    db.application.groupBy({
      by: ["vacancyId", "etapa"],
      where: { companyId, origem: "candidaturaLote" },
      _count: { _all: true },
    }),
    db.$queryRaw<{ n: number; segundos: number | null }[]>`
      SELECT count(*)::int AS n, avg(extract(epoch FROM ("respondidaEm" - "createdAt")))::float8 AS segundos
      FROM "Application"
      WHERE "companyId" = ${companyId} AND "origem" = 'candidaturaLote' AND "respondidaEm" IS NOT NULL`,
  ]);
  return montarResumo(
    vagas,
    grupos.map((g) => ({ vacancyId: g.vacancyId, etapa: g.etapa as Etapa, n: g._count._all })),
    media[0] ?? { n: 0, segundos: null },
    now,
    { ativas, vencendo },
  );
}
