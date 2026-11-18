/**
 * 2.4b Candidaturas da vaga (plano 2.4 aprovado pelo Euclides em 2026-11-18).
 * - D1/D2: o recrutador muda a etapa com 1 clique; a primeira saída de "nova" marca respondidaEm.
 * - D3: o candidato vê o status, derivado da etapa e que não volta para trás:
 *   abrir ou Em análise → visualizado; Entrevista, Proposta, Contratada → respondido;
 *   Não seguiu → arquivado ("Encerrada" na tela do candidato).
 * - D6: só a empresa da vaga; cada mudança grava o sinal "etapa_mudou" (de, para).
 * - D4 (2.4c): ir para Entrevista (ou pular direto para Proposta/Contratada) libera o e-mail e o
 *   telefone da ficha só para a empresa daquela vaga (contatoLiberadoEm) e avisa o candidato por e-mail.
 *   Liberado uma vez, fica liberado, mesmo que a etapa volte. O aviso fica guardado em emailPendente na
 *   mesma transação; quem chama limpa depois de pôr na fila, e o Cron diário tenta de novo se a fila falhar.
 * - 3.4b: depois do commit, a mudança vira o evento "candidatura.etapa" do webhook da empresa (se ligado).
 *   Falha da fila nunca desfaz nem atrapalha a mudança.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { withoutContacts } from "./search";
import { matchCandidato, type GapCandidato } from "./match-candidato";
import { gravarSinais, registrarSinal } from "./sinais";
import { ordemDaEmpresa, partesParaSinal, type OrdemInfo, type OrdemPedida } from "./ranking";
import { notaComPesos } from "./match";
import { ETAPAS, type Etapa } from "./painel-rh";
import { emailLocale, renderEntrevistaEmail } from "./email-templates";
import { entrevistasDasCandidaturas, type ResumoEntrevista } from "./entrevista";
import type { EmailMessage } from "./email";
import type { MensagemWebhook } from "./fila";

/** Etapas que liberam o contato (D4): a partir da Entrevista. */
export const ETAPAS_COM_CONTATO: readonly Etapa[] = ["entrevista", "proposta", "contratada"];

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
  /** 2.4c: e-mail e telefone completos, só depois da Entrevista (D4); antes, null. */
  contato: { email: string; celular: string | null } | null;
  /** Perfil sem contato (emailMasked/celularMasked), no mesmo formato da busca de Candidatos. */
  candidato: Record<string, unknown>;
  /** 2.5a: a entrevista mais recente (oferta, marcada ou cancelada); null se nunca houve. */
  entrevista: ResumoEntrevista | null;
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
  opts: { ordem?: OrdemPedida } = {},
): Promise<{ vaga: VagaDaPagina; itens: CandidaturaRh[]; total: number; ordem: OrdemInfo } | null> {
  const vaga = await db.vacancy.findFirst({ where: { id: vacancyId, companyId }, select: VAGA });
  if (!vaga) return null;
  const where = { vacancyId, companyId, origem: "candidaturaLote" as const };
  const [apps, total] = await Promise.all([
    db.application.findMany({
      where,
      select: { id: true, etapa: true, etapaEm: true, createdAt: true, contatoLiberadoEm: true, candidate: { select: PERFIL } },
      orderBy: { createdAt: "asc" },
      take: RH_MAX_CANDIDATURAS,
    }),
    db.application.count({ where }),
  ]);
  const t = now.getTime();
  const entrevistas = await entrevistasDasCandidaturas(db, apps.map((a) => a.id), now);
  // 3.1b (D5): a ordem usa os pesos que a empresa sustenta; a % mostrada continua a conta fixa.
  const ordem = await ordemDaEmpresa(db, companyId, opts.ordem);
  const nota = new Map<string, number>();
  const itens = apps.map((a): CandidaturaRh => {
    const { expiresAt, ...perfil } = a.candidate;
    const m = matchCandidato(perfil as any, vaga as any, t);
    nota.set(a.id, ordem.pesos ? notaComPesos(m.partes, ordem.pesos) : m.pct);
    return {
      applicationId: a.id,
      etapa: a.etapa as Etapa,
      etapaEm: a.etapaEm?.toISOString() ?? null,
      enviadaEm: a.createdAt.toISOString(),
      fichaAtiva: perfil.status === "ativo" && expiresAt.getTime() > t,
      match: m.pct,
      gaps: m.gaps,
      contato: a.contatoLiberadoEm ? { email: perfil.email, celular: perfil.celular ?? null } : null,
      candidato: withoutContacts(perfil),
      entrevista: entrevistas.get(a.id) ?? null,
    };
  });
  // Melhor nota primeiro (ajustada ou padrão); empate, a % mostrada e depois quem chegou antes.
  itens.sort((a, b) => nota.get(b.applicationId)! - nota.get(a.applicationId)! || b.match - a.match || a.enviadaEm.localeCompare(b.enviadaEm));
  return { vaga: { id: vaga.id, titulo: vaga.titulo, status: vaga.status, expiresAt: vaga.expiresAt.toISOString() }, itens, total, ordem: ordem.info };
}

export type ResultadoEtapa =
  | {
      ok: true;
      etapa: Etapa;
      status: StatusCandidatura;
      etapaEm: string;
      /** Contato liberado (agora ou antes): e-mail e telefone para a tela. */
      contato: { email: string; celular: string | null } | null;
      /** Aviso ao candidato, só na primeira liberação; quem chama põe na fila depois do commit. */
      aviso: EmailMessage | null;
    }
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
  opts: { appUrl?: string; enviarWebhook?: (m: MensagemWebhook) => Promise<void> } = {},
): Promise<ResultadoEtapa> {
  const res = await mudarEtapaNoBanco(db, companyId, applicationId, de, para, now, opts);
  // 3.4b: o sistema da empresa (ATS) fica sabendo. Depois do commit; enfileirarEtapa não lança.
  if (res.ok && de !== para && opts.enviarWebhook) {
    const enviarWebhook = opts.enviarWebhook;
    await import("./webhook")
      .then(({ enfileirarEtapa }) => enfileirarEtapa(db, { applicationId, companyId, de, para }, enviarWebhook, now))
      .catch((err) => console.error("[rh/candidaturas] webhook da etapa não entrou na fila:", err instanceof Error ? err.message : err));
  }
  return res;
}

function mudarEtapaNoBanco(
  db: PrismaClient,
  companyId: string,
  applicationId: string,
  de: Etapa,
  para: Etapa,
  now: Date,
  opts: { appUrl?: string },
): Promise<ResultadoEtapa> {
  return db.$transaction(async (tx) => {
    const app = await tx.application.findFirst({
      where: { id: applicationId, companyId, origem: "candidaturaLote" },
      select: {
        id: true, etapa: true, etapaEm: true, status: true, respondidaEm: true, contatoLiberadoEm: true, emailPendente: true, candidateId: true, vacancyId: true,
        candidate: { select: { ...PERFIL, idiomaOriginal: true } },
        vacancy: { select: VAGA },
        company: { select: { nome: true } },
      },
    });
    if (!app) return { ok: false, erro: "nao_encontrada" } as const;
    if (app.etapa !== de) return { ok: false, erro: "mudou" } as const;
    const contatoDe = { email: app.candidate.email, celular: app.candidate.celular ?? null };
    if (de === para) {
      return { ok: true, etapa: para, status: app.status as StatusCandidatura, etapaEm: (app.etapaEm ?? now).toISOString(), contato: app.contatoLiberadoEm ? contatoDe : null, aviso: null } as const;
    }
    const status = statusDaEtapa(app.status as StatusCandidatura, para);
    const libera = !app.contatoLiberadoEm && ETAPAS_COM_CONTATO.includes(para);
    let aviso: EmailMessage | null = null;
    if (libera && app.candidate.email) {
      const m = renderEntrevistaEmail({
        locale: emailLocale(app.candidate.idiomaOriginal),
        nome: app.candidate.nome,
        empresa: app.company.nome,
        vagaTitulo: app.vacancy?.titulo ?? "",
        url: `${(opts.appUrl ?? "").replace(/\/$/, "")}/minhas-candidaturas`,
      });
      aviso = { to: app.candidate.email, ...m, idempotencyKey: `entrevista:${app.id}` };
    }
    // Guarda o aviso para o Cron reenviar se a fila falhar; não sobrescreve outro e-mail ainda pendente.
    const guarda = aviso && app.emailPendente == null;
    const r = await tx.application.updateMany({
      where: { id: app.id, etapa: de },
      data: {
        etapa: para,
        etapaEm: now,
        status,
        ...(app.respondidaEm || para === "nova" ? {} : { respondidaEm: now }),
        ...(libera ? { contatoLiberadoEm: now } : {}),
        ...(guarda ? { emailPendente: aviso as unknown as Prisma.InputJsonValue } : {}),
      },
    });
    if (r.count === 0) return { ok: false, erro: "mudou" } as const;
    // 3.1 (D6): as 5 partes do match deste momento, para o ranking adaptativo aprender.
    const m = app.vacancy ? matchCandidato(app.candidate as any, app.vacancy as any, now.getTime()) : null;
    await gravarSinais(tx, [
      {
        tipo: "etapa_mudou", ator: "recrutador", candidateId: app.candidateId, vacancyId: app.vacancyId, applicationId: app.id,
        matchPct: m?.pct ?? null,
        dados: { de, para, ...(libera ? { contatoLiberado: true } : {}), ...(m ? partesParaSinal(m.partes) : {}) },
        createdAt: now,
      },
    ]);
    const liberado = libera || !!app.contatoLiberadoEm;
    return { ok: true, etapa: para, status, etapaEm: now.toISOString(), contato: liberado ? contatoDe : null, aviso } as const;
  });
}

/** O recrutador abriu a ficha: "Enviada" vira "Vista" para o candidato (D3). Não conta como resposta. */
/** O aviso entrou na fila: limpa o emailPendente, só se ainda for este aviso. */
export async function avisoEnfileirado(db: PrismaClient, applicationId: string, aviso: EmailMessage): Promise<void> {
  await db.application.updateMany({
    where: { id: applicationId, emailPendente: { path: ["idempotencyKey"], equals: aviso.idempotencyKey } },
    data: { emailPendente: Prisma.DbNull },
  });
}

export async function marcarVista(db: PrismaClient, companyId: string, applicationId: string): Promise<boolean> {
  const a = await db.application.findFirst({
    where: { id: applicationId, companyId, origem: "candidaturaLote" },
    select: { candidateId: true, vacancyId: true, status: true },
  });
  if (!a) return false;
  if (a.status === "enviado") {
    await db.application.updateMany({ where: { id: applicationId, status: "enviado" }, data: { status: "visualizado" } });
  }
  // 2.8: a primeira vez que o recrutador abre a ficha, mesmo que a etapa já tenha mudado antes.
  // Conta pelo próprio sinal, não pelo status que o candidato vê.
  const jaVista = await db.feedbackSignal.count({ where: { applicationId, tipo: "ficha_vista" } });
  if (jaVista === 0) {
    await registrarSinal(db, { tipo: "ficha_vista", ator: "recrutador", candidateId: a.candidateId, vacancyId: a.vacancyId, applicationId });
  }
  return true;
}
