/**
 * lib/hygiene — higiene automática (1.5.15), no banco de verdade.
 *
 * Vaga: vale 14 dias; no D14 é arquivada (sem aviso até existir o login novo, 1.5.5).
 * Perfil do candidato: vale 180 dias desde a última renovação (`expiresAt`).
 *   Lembretes por e-mail no D150, D165 e D175; no D180 sai da busca (arquivado, `arquivadoEm`)
 *   e recebe o aviso; 30 dias depois de arquivado é apagado de vez (perfil, candidaturas,
 *   consentimentos e vetor, que é coluna da mesma linha).
 *
 * Cada e-mail é registrado em `HygieneEvent` (userId + marco + início do ciclo) antes de ir para a
 * fila: rodar duas vezes no mesmo dia não duplica, e um dia sem Cron é recuperado no dia seguinte
 * porque os marcos valem por faixa ("passou do D150"), não por dia exato.
 * Até `dailyCap` e-mails por dia (o Resend gratuito manda 100/dia); o resto fica para o dia seguinte.
 */
import type { PrismaClient } from "@prisma/client";
import { renderHygieneEmail, emailLocale, type HygieneMarco } from "./email-templates";
import type { EmailMessage } from "./email";
import { renewSecretOk, signRenewToken } from "./renew-token";

export const VACANCY_TTL_DAYS = 14;
export const CANDIDATE_TTL_DAYS = 180;
export const PURGE_AFTER_ARCHIVED_DAYS = 30;
export const CANDIDATE_NUDGE_DAYS = [150, 165, 175] as const;
export const CANDIDATE_ARCHIVE_DAY = 180;
/** Fica abaixo dos 100 por dia do Resend gratuito, com folga para outros e-mails. */
export const DAILY_EMAIL_CAP = 90;

export const NUDGE_MARCOS = { D150: "D150", D165: "D165", D175: "D175", D180: "D180" } as const;
export type Marco = HygieneMarco;
const EMAIL_MARCOS: Marco[] = ["D150", "D165", "D175", "D180"];

const DAY = 24 * 60 * 60 * 1000;

export function vacancyExpiresAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + VACANCY_TTL_DAYS * DAY);
}
export function candidateExpiresAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + CANDIDATE_TTL_DAYS * DAY);
}
export function isEligibleForPurge(status: string, arquivadoEm: Date | null, now: Date = new Date()): boolean {
  if (status !== "arquivado" || !arquivadoEm) return false;
  return (now.getTime() - arquivadoEm.getTime()) / DAY >= PURGE_AFTER_ARCHIVED_DAYS;
}
export function withVacancyExpiry<T extends { expiresAt?: Date; createdAt?: Date }>(data: T): T & { expiresAt: Date } {
  if (data.expiresAt) return data as T & { expiresAt: Date };
  return { ...data, expiresAt: vacancyExpiresAt(data.createdAt ?? new Date()) };
}
export function withCandidateExpiry<T extends { expiresAt?: Date; updatedAt?: Date; createdAt?: Date }>(data: T): T & { expiresAt: Date } {
  if (data.expiresAt) return data as T & { expiresAt: Date };
  return { ...data, expiresAt: candidateExpiresAt(data.updatedAt ?? data.createdAt ?? new Date()) };
}

export function todayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}
export function daysSince(origin: Date, now: Date): number {
  return Math.floor((now.getTime() - origin.getTime()) / DAY);
}
/** Início do ciclo atual do perfil (última renovação) = expiresAt − 180 dias. */
export function candidateCycleStart(expiresAt: Date): Date {
  return new Date(expiresAt.getTime() - CANDIDATE_TTL_DAYS * DAY);
}

/**
 * Lembrete devido para um perfil ativo, pela faixa de dias do ciclo:
 * 150–164 → D150, 165–174 → D165, 175–179 → D175. Fora disso, nenhum.
 * Se o Cron falhou na faixa do D150 e só rodou no D166, vai o D165 (o mais atual), não os dois.
 */
export function dueNudge(expiresAt: Date, now: Date): Marco | null {
  const d = daysSince(candidateCycleStart(expiresAt), now);
  if (d >= 175 && d < CANDIDATE_ARCHIVE_DAY) return "D175";
  if (d >= 165 && d < 175) return "D165";
  if (d >= 150 && d < 165) return "D150";
  return null;
}

/** Endereços de exemplo (dados de demonstração) nunca recebem e-mail. */
export function isPlaceholderEmail(email: string | null | undefined): boolean {
  if (!email || !email.includes("@")) return true;
  const domain = email.split("@").pop()!.toLowerCase();
  return /(^|\.)(example\.(com|org|net)|example|test|local|invalid|localhost)$/.test(domain);
}

export type HygieneDeps = {
  now?: Date;
  /** Põe o e-mail na fila `notificacoes` (ou envia direto, fora do Worker). */
  enqueue: (msg: EmailMessage) => Promise<void>;
  /** Endereço do site para o link "Continuo procurando". */
  appUrl: string;
  renewSecret: string | undefined;
  dailyCap?: number;
};

export type HygieneSummary = {
  data: string;
  vagasArquivadas: number;
  perfisArquivados: number;
  perfisApagados: number;
  emails: { enfileirados: number; porMarco: Record<string, number>; ficamParaAmanha: number; falhas: number; aviso?: string };
};

export async function runHygiene(db: PrismaClient, deps: HygieneDeps): Promise<HygieneSummary> {
  const now = deps.now ?? new Date();
  const cap = deps.dailyCap ?? DAILY_EMAIL_CAP;
  const summary: HygieneSummary = {
    data: todayKey(now),
    vagasArquivadas: 0,
    perfisArquivados: 0,
    perfisApagados: 0,
    emails: { enfileirados: 0, porMarco: {}, ficamParaAmanha: 0, falhas: 0 },
  };

  // 1) Vagas vencidas saem da busca.
  const vagas = await db.vacancy.updateMany({ where: { status: "ativa", expiresAt: { lte: now } }, data: { status: "arquivada" } });
  summary.vagasArquivadas = vagas.count;

  // 2) Perfis vencidos saem da busca, com a data do arquivamento.
  const arq = await db.candidateProfile.updateMany({ where: { status: "ativo", expiresAt: { lte: now } }, data: { status: "arquivado", arquivadoEm: now } });
  summary.perfisArquivados = arq.count;
  // Segurança: arquivado sem data (não deveria existir após a migração) começa a contar agora.
  await db.candidateProfile.updateMany({ where: { status: "arquivado", arquivadoEm: null }, data: { arquivadoEm: now } });

  // 3) Arquivados há 30 dias ou mais: apaga de vez (candidaturas e consentimentos vão em cascata).
  const limite = new Date(now.getTime() - PURGE_AFTER_ARCHIVED_DAYS * DAY);
  // A condição é conferida no próprio DELETE: quem renovou pelo link um instante antes não é apagado.
  const apagados = await db.$queryRaw<{ userId: string }[]>`
    DELETE FROM "CandidateProfile"
    WHERE "id" IN (
      SELECT "id" FROM "CandidateProfile"
      WHERE "status" = 'arquivado' AND "arquivadoEm" <= ${limite}
      LIMIT 500
    ) AND "status" = 'arquivado' AND "arquivadoEm" <= ${limite}
    RETURNING "userId"`;
  if (apagados.length) {
    await db.hygieneEvent.deleteMany({ where: { userId: { in: apagados.map((a) => a.userId) } } });
    summary.perfisApagados = apagados.length;
  }

  // 4) E-mails: lembretes D150/D165/D175 e aviso D180.
  if (!renewSecretOk(deps.renewSecret)) {
    summary.emails.aviso = "RENEW_LINK_SECRET não configurado: nenhum e-mail enfileirado.";
    return summary;
  }
  const inicioDoDia = new Date(`${todayKey(now)}T00:00:00.000Z`);
  const jaHoje = await db.hygieneEvent.count({ where: { marco: { in: EMAIL_MARCOS }, createdAt: { gte: inicioDoDia } } });
  let restante = Math.max(0, cap - jaHoje);

  // Percorre em páginas: quem já foi avisado ou tem e-mail de exemplo não pode tomar o lugar dos pendentes.
  type Perfil = { userId: string; nome: string; email: string; idiomaOriginal: string; expiresAt: Date; status: string; arquivadoEm: Date | null; id: string };
  const pendentes: { p: Perfil; marco: Marco; ciclo: string }[] = [];
  let cursor: string | undefined;
  for (let pagina = 0; pagina < 40; pagina++) {
    const perfis: Perfil[] = await db.candidateProfile.findMany({
      where: {
        OR: [
          { status: "ativo", expiresAt: { gt: now, lte: new Date(now.getTime() + (CANDIDATE_TTL_DAYS - CANDIDATE_NUDGE_DAYS[0]) * DAY) } },
          { status: "arquivado" },
        ],
      },
      select: { id: true, userId: true, nome: true, email: true, idiomaOriginal: true, expiresAt: true, status: true, arquivadoEm: true },
      orderBy: { id: "asc" },
      take: 500,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (!perfis.length) break;
    cursor = perfis[perfis.length - 1].id;
    let devidos = perfis
      .map((p) => {
        const marco: Marco | null = p.status === "arquivado" ? "D180" : dueNudge(p.expiresAt, now);
        return marco ? { p, marco, ciclo: todayKey(candidateCycleStart(p.expiresAt)) } : null;
      })
      .filter((x): x is NonNullable<typeof x> => !!x && !isPlaceholderEmail(x.p.email));
    // 1.5.5: os lembretes D150/D165/D175 só vão para quem aceitou "e-mails sobre a minha ficha" (nudges).
    // O aviso D180 (ficha arquivada, será apagada em 30 dias) é aviso sobre os dados e vai sempre.
    const pedemAceite = devidos.filter((d) => d.marco !== "D180").map((d) => d.p.userId);
    const aceitaram = new Set(
      pedemAceite.length
        ? (await db.consentLog.findMany({ where: { userId: { in: pedemAceite }, tipo: "nudges" }, select: { userId: true } })).map((c) => c.userId)
        : [],
    );
    devidos = devidos.filter((d) => d.marco === "D180" || aceitaram.has(d.p.userId));
    if (devidos.length) {
      const feitos = await db.hygieneEvent.findMany({
        where: { userId: { in: devidos.map((d) => d.p.userId) }, marco: { in: EMAIL_MARCOS } },
        select: { userId: true, marco: true, date: true },
      });
      const feito = new Set(feitos.map((e) => `${e.userId}|${e.marco}|${e.date}`));
      pendentes.push(...devidos.filter((d) => !feito.has(`${d.p.userId}|${d.marco}|${d.ciclo}`)));
    }
    if (perfis.length < 500) break;
  }
  if (!pendentes.length) return summary;
  // Mais urgente primeiro: quem sai da busca antes.
  pendentes.sort((a, b) => a.p.expiresAt.getTime() - b.p.expiresAt.getTime());

  const base = deps.appUrl.replace(/\/+$/, "");
  for (const { p, marco, ciclo } of pendentes) {
    if (restante <= 0) {
      summary.emails.ficamParaAmanha++;
      continue;
    }
    // Reserva o envio (o índice único impede duplicar se dois Crons rodarem juntos).
    const reservado = await db.hygieneEvent.createMany({ data: [{ userId: p.userId, marco, date: ciclo, createdAt: now }], skipDuplicates: true });
    if (reservado.count === 0) continue;
    // Confere o total do dia depois de reservar: se outra execução rodou junto e o limite estourou, devolve a vaga.
    const totalHoje = await db.hygieneEvent.count({ where: { marco: { in: EMAIL_MARCOS }, createdAt: { gte: inicioDoDia } } });
    if (totalHoje > cap) {
      await db.hygieneEvent.deleteMany({ where: { userId: p.userId, marco, date: ciclo } });
      restante = 0;
      summary.emails.ficamParaAmanha++;
      continue;
    }
    const dias =
      marco === "D180"
        ? PURGE_AFTER_ARCHIVED_DAYS - daysSince(p.arquivadoEm ?? now, now)
        : Math.ceil((p.expiresAt.getTime() - now.getTime()) / DAY);
    const token = await signRenewToken(p.userId, deps.renewSecret, now);
    const mail = renderHygieneEmail({ marco, locale: emailLocale(p.idiomaOriginal), nome: p.nome, renewUrl: `${base}/renovar?t=${encodeURIComponent(token)}`, dias });
    try {
      await deps.enqueue({ to: p.email, ...mail, idempotencyKey: `higiene:${p.userId}:${marco}:${ciclo}` });
      restante--;
      summary.emails.enfileirados++;
      summary.emails.porMarco[marco] = (summary.emails.porMarco[marco] ?? 0) + 1;
    } catch (e) {
      // Não entrou na fila: libera a reserva para tentar no próximo Cron.
      await db.hygieneEvent.deleteMany({ where: { userId: p.userId, marco, date: ciclo } });
      summary.emails.falhas++;
      console.error("[higiene] falha ao enfileirar:", e instanceof Error ? e.message : e);
    }
  }
  return summary;
}

/** Renova o perfil por mais 180 dias (link "Continuo procurando"); volta para a busca se estava arquivado. */
export async function renewCandidate(db: PrismaClient, userId: string, now: Date = new Date()): Promise<{ ok: true; ate: Date } | { ok: false }> {
  const expiresAt = candidateExpiresAt(now);
  const r = await db.candidateProfile.updateMany({
    where: { userId, status: { in: ["ativo", "arquivado"] } },
    data: { expiresAt, status: "ativo", arquivadoEm: null },
  });
  return r.count ? { ok: true, ate: expiresAt } : { ok: false };
}
