/**
 * 2.5a Agenda (plano 2.5 aprovado pelo Euclides em 2026-11-18).
 * - D1: o recrutador oferece de 3 a 8 horários; o candidato escolhe um pelo link do e-mail, sem login
 *   (/agendar?c=<código>; guardamos só o SHA-256 do código). O link vale até o horário passar.
 * - D2: sem Google/Microsoft: horários digitados e convite .ics anexo nos e-mails.
 * - D5: ao escolher, conferimos de novo se o recrutador já tem outra entrevista marcada no horário
 *   (com trava por recrutador); um horário marcado some para as outras ofertas do mesmo recrutador.
 * - D6: sem lembrete próprio; o .ics tem alarme de 1 hora.
 * - Só candidaturas com o contato liberado (Entrevista em diante, 2.4c). Uma oferta nova da mesma
 *   candidatura cancela a anterior. O candidato troca ou cancela até 12 horas antes.
 * - Os e-mails são montados na transação e guardados em emailsPendentes; quem chama põe na fila depois do
 *   commit (enfileirarPendentes) e o Cron diário tenta de novo o que ficou (reenviarEmailsEntrevista).
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import type { EmailMessage } from "./email";
import { emailLocale, fusoValido, renderAgendaEmail, type AgendaTipo, type EmailLocale } from "./email-templates";
import { base64Utf8, gerarIcs } from "./ics";
import { gravarSinais } from "./sinais";

export const DURACOES = [30, 45, 60] as const;
export const MIN_HORARIOS = 3;
export const MAX_HORARIOS = 8;
/** Um horário oferecido precisa começar pelo menos 1 hora depois de agora e até 60 dias. */
export const ANTECEDENCIA_MS = 60 * 60_000;
export const LIMITE_DIAS = 60;
/** Até quando o candidato pode trocar ou cancelar uma entrevista marcada. */
export const PRAZO_ALTERAR_MS = 12 * 3600_000;

type Tx = Prisma.TransactionClient;

export type StatusVisivel = "aberta" | "marcada" | "cancelada" | "expirada";

export type ResumoEntrevista = {
  id: string;
  status: StatusVisivel;
  inicio: string | null;
  duracaoMin: number;
  horarios: string[];
  linkReuniao: string | null;
  canceladaPor: string | null;
};

type EntrevistaDb = {
  id: string;
  status: "aberta" | "marcada" | "cancelada";
  inicio: Date | null;
  duracaoMin: number;
  horarios: Date[];
  linkReuniao: string | null;
  canceladaPor: string | null;
};

export function statusVisivel(e: Pick<EntrevistaDb, "status" | "horarios">, now: Date): StatusVisivel {
  if (e.status === "aberta" && !e.horarios.some((h) => h.getTime() > now.getTime())) return "expirada";
  return e.status;
}

export function resumo(e: EntrevistaDb, now: Date): ResumoEntrevista {
  return {
    id: e.id,
    status: statusVisivel(e, now),
    inicio: e.inicio?.toISOString() ?? null,
    duracaoMin: e.duracaoMin,
    horarios: [...e.horarios].sort((a, b) => a.getTime() - b.getTime()).map((h) => h.toISOString()),
    linkReuniao: e.linkReuniao,
    canceladaPor: e.canceladaPor,
  };
}

// ── código do link ──

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function gerarCodigo(): string {
  return b64url(crypto.getRandomValues(new Uint8Array(24)));
}

export async function hashCodigo(codigo: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codigo)));
  return Array.from(d, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function codigoValido(c: unknown): c is string {
  return typeof c === "string" && /^[A-Za-z0-9_-]{20,64}$/.test(c);
}

// ── validação da oferta ──

export type ErroOferta = "duracao" | "horarios_qtd" | "horario_invalido" | "horario_passado" | "horario_longe" | "horarios_sobrepostos" | "link_invalido";

export function validarOferta(
  x: { duracaoMin?: unknown; horarios?: unknown; linkReuniao?: unknown },
  now: Date,
): { ok: true; duracaoMin: number; horarios: Date[]; linkReuniao: string | null } | { ok: false; erro: ErroOferta } {
  const dur = Number(x.duracaoMin);
  if (!(DURACOES as readonly number[]).includes(dur)) return { ok: false, erro: "duracao" };
  if (!Array.isArray(x.horarios) || x.horarios.length < MIN_HORARIOS || x.horarios.length > MAX_HORARIOS) return { ok: false, erro: "horarios_qtd" };
  const hs: Date[] = [];
  for (const h of x.horarios) {
    const d = typeof h === "string" ? new Date(h) : null;
    if (!d || Number.isNaN(d.getTime()) || d.getUTCSeconds() !== 0 || d.getUTCMilliseconds() !== 0 || d.getUTCMinutes() % 5 !== 0) {
      return { ok: false, erro: "horario_invalido" };
    }
    if (d.getTime() < now.getTime() + ANTECEDENCIA_MS) return { ok: false, erro: "horario_passado" };
    if (d.getTime() > now.getTime() + LIMITE_DIAS * 864e5) return { ok: false, erro: "horario_longe" };
    hs.push(d);
  }
  hs.sort((a, b) => a.getTime() - b.getTime());
  for (let i = 1; i < hs.length; i++) {
    if (hs[i].getTime() - hs[i - 1].getTime() < dur * 60_000) return { ok: false, erro: "horarios_sobrepostos" };
  }
  let link: string | null = null;
  if (x.linkReuniao != null && x.linkReuniao !== "") {
    if (typeof x.linkReuniao !== "string" || x.linkReuniao.length > 500) return { ok: false, erro: "link_invalido" };
    try {
      const u = new URL(x.linkReuniao.trim());
      if (u.protocol !== "https:" || u.username || u.password) return { ok: false, erro: "link_invalido" };
      link = u.toString();
    } catch {
      return { ok: false, erro: "link_invalido" };
    }
  }
  return { ok: true, duracaoMin: dur, horarios: hs, linkReuniao: link };
}

function sobrepoe(a: Date, durA: number, b: Date, durB: number): boolean {
  return a.getTime() < b.getTime() + durB * 60_000 && b.getTime() < a.getTime() + durA * 60_000;
}

// ── contexto e e-mails ──

type Contexto = {
  entrevistaId: string;
  vacancyId: string | null;
  empresa: string;
  vaga: string;
  candidato: { nome: string; email: string; locale: EmailLocale };
  recrutador: { nome: string; email: string; locale: EmailLocale; fuso: string | null };
  fusoCandidato: string | null;
  duracaoMin: number;
  linkReuniao: string | null;
  appUrl: string;
};

type Evento =
  | { tipo: "convite"; urlEscolher: string }
  | { tipo: "marcada" | "trocada"; inicio: Date; sequencia: number; urlCandidato: string }
  | { tipo: "cancelada"; inicio: Date | null; sequencia: number; porCandidato: boolean };

function base(appUrl: string): string {
  return appUrl.replace(/\/$/, "");
}

/** Os e-mails de um acontecimento: para o candidato e, quando cabe, para o recrutador. */
export function emailsDoEvento(c: Contexto, ev: Evento, agora: Date): EmailMessage[] {
  const out: EmailMessage[] = [];
  const urlRh = c.vacancyId ? `${base(c.appUrl)}/rh/vagas/${encodeURIComponent(c.vacancyId)}` : `${base(c.appUrl)}/rh`;
  const urlMinhas = `${base(c.appUrl)}/minhas-candidaturas`;
  const chave = (dest: string, seq = 0) => `entrevista:${c.entrevistaId}:${ev.tipo}:${seq}:${dest}`;
  const titulo = (l: EmailLocale) => (l === "en" ? `Interview: ${c.vaga} (${c.empresa})` : `Entrevista: ${c.vaga} (${c.empresa})`);

  const anexo = (inicio: Date, seq: number, metodo: "REQUEST" | "CANCEL", l: EmailLocale) => [
    {
      filename: metodo === "CANCEL" ? "cancelamento.ics" : "entrevista.ics",
      contentType: `text/calendar; charset=utf-8; method=${metodo}`,
      content: base64Utf8(
        gerarIcs({
          uid: `entrevista-${c.entrevistaId}@w2talent.com`,
          sequencia: seq,
          metodo,
          inicio,
          fim: new Date(inicio.getTime() + c.duracaoMin * 60_000),
          titulo: titulo(l),
          link: c.linkReuniao,
          organizador: { nome: `${c.recrutador.nome} (${c.empresa})`, email: c.recrutador.email },
          convidado: { nome: c.candidato.nome, email: c.candidato.email },
          agora,
        }),
      ),
    },
  ];

  if (ev.tipo === "convite") {
    const m = renderAgendaEmail({
      tipo: "convite", locale: c.candidato.locale, nome: c.candidato.nome, empresa: c.empresa, vagaTitulo: c.vaga, com: c.empresa,
      duracaoMin: c.duracaoMin, url: ev.urlEscolher,
    });
    out.push({ to: c.candidato.email, ...m, idempotencyKey: chave("c") });
    return out;
  }
  if (ev.tipo !== "cancelada") {
    const mc = renderAgendaEmail({
      tipo: ev.tipo, locale: c.candidato.locale, nome: c.candidato.nome, empresa: c.empresa, vagaTitulo: c.vaga, com: c.empresa,
      duracaoMin: c.duracaoMin, inicio: ev.inicio, fuso: c.fusoCandidato, linkReuniao: c.linkReuniao, url: ev.urlCandidato, temAnexo: true,
    });
    out.push({ to: c.candidato.email, ...mc, idempotencyKey: chave("c", ev.sequencia), attachments: anexo(ev.inicio, ev.sequencia, "REQUEST", c.candidato.locale) });
    const mr = renderAgendaEmail({
      tipo: ev.tipo, locale: c.recrutador.locale, nome: c.recrutador.nome, empresa: c.empresa, vagaTitulo: c.vaga, com: c.candidato.nome,
      duracaoMin: c.duracaoMin, inicio: ev.inicio, fuso: c.recrutador.fuso, linkReuniao: c.linkReuniao, url: urlRh, paraRecrutador: true, temAnexo: true,
    });
    out.push({ to: c.recrutador.email, ...mr, idempotencyKey: chave("r", ev.sequencia), attachments: anexo(ev.inicio, ev.sequencia, "REQUEST", c.recrutador.locale) });
    return out;
  }
  // cancelada: avisa o outro lado; o .ics de cancelamento vai para os dois quando havia horário marcado.
  const paraCandidato = !ev.porCandidato || !!ev.inicio;
  const paraRecrutador = ev.porCandidato || !!ev.inicio;
  if (paraCandidato) {
    const m = renderAgendaEmail({
      tipo: "cancelada", locale: c.candidato.locale, nome: c.candidato.nome, empresa: c.empresa, vagaTitulo: c.vaga, com: c.empresa,
      duracaoMin: c.duracaoMin, inicio: ev.inicio, fuso: c.fusoCandidato, porCandidato: ev.porCandidato, url: urlMinhas, temAnexo: !!ev.inicio,
    });
    out.push({ to: c.candidato.email, ...m, idempotencyKey: chave("c", ev.sequencia), ...(ev.inicio ? { attachments: anexo(ev.inicio, ev.sequencia, "CANCEL", c.candidato.locale) } : {}) });
  }
  if (paraRecrutador) {
    const m = renderAgendaEmail({
      tipo: "cancelada", locale: c.recrutador.locale, nome: c.recrutador.nome, empresa: c.empresa, vagaTitulo: c.vaga, com: c.candidato.nome,
      duracaoMin: c.duracaoMin, inicio: ev.inicio, fuso: c.recrutador.fuso, porCandidato: ev.porCandidato, url: urlRh, paraRecrutador: true, temAnexo: !!ev.inicio,
    });
    out.push({ to: c.recrutador.email, ...m, idempotencyKey: chave("r", ev.sequencia), ...(ev.inicio ? { attachments: anexo(ev.inicio, ev.sequencia, "CANCEL", c.recrutador.locale) } : {}) });
  }
  return out;
}

const SELECT_ENTREVISTA = {
  id: true, applicationId: true, companyId: true, recrutadorId: true, duracaoMin: true, horarios: true, linkReuniao: true, status: true,
  inicio: true, canceladaPor: true, sequencia: true, fusoRecrutador: true, idiomaRecrutador: true, fusoCandidato: true, emailsPendentes: true,
  application: {
    select: {
      vacancyId: true,
      candidate: { select: { nome: true, email: true, idiomaOriginal: true } },
      vacancy: { select: { titulo: true } },
      company: { select: { nome: true } },
    },
  },
} as const;

type EntrevistaCompleta = Prisma.EntrevistaGetPayload<{ select: typeof SELECT_ENTREVISTA }>;

async function contexto(tx: Tx, e: EntrevistaCompleta, appUrl: string): Promise<Contexto | null> {
  const rec = await tx.user.findUnique({ where: { id: e.recrutadorId }, select: { name: true, email: true } });
  if (!rec || !e.application.candidate.email) return null;
  return {
    entrevistaId: e.id,
    vacancyId: e.application.vacancyId,
    empresa: e.application.company.nome,
    vaga: e.application.vacancy?.titulo ?? "",
    candidato: { nome: e.application.candidate.nome, email: e.application.candidate.email, locale: emailLocale(e.application.candidate.idiomaOriginal) },
    recrutador: { nome: rec.name, email: rec.email, locale: emailLocale(e.idiomaRecrutador), fuso: e.fusoRecrutador },
    fusoCandidato: e.fusoCandidato,
    duracaoMin: e.duracaoMin,
    linkReuniao: e.linkReuniao,
    appUrl,
  };
}

function pendentes(v: unknown): EmailMessage[] {
  return Array.isArray(v) ? (v as EmailMessage[]) : [];
}

async function guardarEmails(tx: Tx, e: { id: string; emailsPendentes: unknown }, novos: EmailMessage[]): Promise<void> {
  if (!novos.length) return;
  await tx.entrevista.update({
    where: { id: e.id },
    data: { emailsPendentes: [...pendentes(e.emailsPendentes), ...novos] as unknown as Prisma.InputJsonValue },
  });
}

// ── recrutador ──

export type ErroEntrevista = "nao_encontrada" | "sem_contato" | "sem_email" | ErroOferta;

/** Oferece horários a uma candidatura da empresa (cancela a oferta anterior, se houver). */
export async function oferecerEntrevista(
  db: PrismaClient,
  a: {
    companyId: string;
    recrutadorId: string;
    applicationId: string;
    duracaoMin: unknown;
    horarios: unknown;
    linkReuniao?: unknown;
    fuso?: unknown;
    idioma?: string | null;
  },
  now: Date,
  opts: { appUrl: string },
): Promise<{ ok: true; entrevista: ResumoEntrevista; ids: string[] } | { ok: false; erro: ErroEntrevista }> {
  const v = validarOferta(a, now);
  if (!v.ok) return v;
  const codigo = gerarCodigo();
  const tokenHash = await hashCodigo(codigo);
  return db.$transaction(async (tx) => {
    const app = await tx.application.findFirst({
      where: { id: a.applicationId, companyId: a.companyId, origem: "candidaturaLote" },
      select: { id: true, candidateId: true, vacancyId: true, contatoLiberadoEm: true, candidate: { select: { email: true } } },
    });
    if (!app) return { ok: false, erro: "nao_encontrada" } as const;
    if (!app.contatoLiberadoEm) return { ok: false, erro: "sem_contato" } as const;
    if (!app.candidate.email) return { ok: false, erro: "sem_email" } as const;

    const ids: string[] = [];
    const anteriores = await tx.entrevista.findMany({ where: { applicationId: app.id, status: { in: ["aberta", "marcada"] } }, select: SELECT_ENTREVISTA });
    for (const ant of anteriores) {
      const seq = ant.sequencia + 1;
      await tx.entrevista.update({ where: { id: ant.id }, data: { status: "cancelada", canceladaEm: now, canceladaPor: "recrutador", sequencia: seq } });
      // Só a entrevista marcada precisa sair das agendas; a oferta aberta é trocada pelo convite novo.
      if (ant.status === "marcada" && ant.inicio) {
        const c = await contexto(tx, ant, opts.appUrl);
        if (c) await guardarEmails(tx, ant, emailsDoEvento(c, { tipo: "cancelada", inicio: ant.inicio, sequencia: seq, porCandidato: false }, now));
        ids.push(ant.id);
      }
    }

    const nova = await tx.entrevista.create({
      data: {
        applicationId: app.id,
        companyId: a.companyId,
        recrutadorId: a.recrutadorId,
        duracaoMin: v.duracaoMin,
        horarios: v.horarios,
        linkReuniao: v.linkReuniao,
        tokenHash,
        fusoRecrutador: typeof a.fuso === "string" && fusoValido(a.fuso) ? a.fuso : null,
        idiomaRecrutador: a.idioma ?? null,
      },
      select: SELECT_ENTREVISTA,
    });
    const c = await contexto(tx, nova, opts.appUrl);
    if (c) await guardarEmails(tx, nova, emailsDoEvento(c, { tipo: "convite", urlEscolher: `${base(opts.appUrl)}/agendar?c=${codigo}` }, now));
    ids.push(nova.id);
    await gravarSinais(tx, [
      {
        tipo: "entrevista_oferecida", ator: "recrutador", candidateId: app.candidateId, vacancyId: app.vacancyId, applicationId: app.id,
        dados: { horarios: v.horarios.length, duracaoMin: v.duracaoMin, remarcou: anteriores.length > 0 }, createdAt: now,
      },
    ]);
    return { ok: true, entrevista: resumo(nova, now), ids } as const;
  });
}

/** O recrutador cancela a oferta ou a entrevista marcada da candidatura. */
export async function cancelarPeloRecrutador(
  db: PrismaClient,
  companyId: string,
  applicationId: string,
  now: Date,
  opts: { appUrl: string },
): Promise<{ ok: true; entrevista: ResumoEntrevista; ids: string[] } | { ok: false; erro: "nao_encontrada" }> {
  return db.$transaction(async (tx) => {
    const e = await tx.entrevista.findFirst({
      where: { applicationId, companyId, status: { in: ["aberta", "marcada"] } },
      orderBy: { createdAt: "desc" },
      select: SELECT_ENTREVISTA,
    });
    if (!e) return { ok: false, erro: "nao_encontrada" } as const;
    const seq = e.sequencia + 1;
    const nova = await tx.entrevista.update({
      where: { id: e.id },
      data: { status: "cancelada", canceladaEm: now, canceladaPor: "recrutador", sequencia: seq },
      select: SELECT_ENTREVISTA,
    });
    const c = await contexto(tx, e, opts.appUrl);
    const inicio = e.status === "marcada" ? e.inicio : null;
    if (c) await guardarEmails(tx, e, emailsDoEvento(c, { tipo: "cancelada", inicio, sequencia: seq, porCandidato: false }, now));
    await sinal(tx, e, "entrevista_cancelada", "recrutador", { por: "recrutador", estava: e.status }, now);
    return { ok: true, entrevista: resumo(nova, now), ids: [e.id] } as const;
  });
}

async function sinal(
  tx: Tx,
  e: { applicationId: string },
  tipo: "entrevista_marcada" | "entrevista_cancelada",
  ator: "candidato" | "recrutador",
  dados: Record<string, string | number | boolean | null>,
  now: Date,
) {
  const app = await tx.application.findUnique({ where: { id: e.applicationId }, select: { candidateId: true, vacancyId: true } });
  if (!app) return;
  await gravarSinais(tx, [{ tipo, ator, candidateId: app.candidateId, vacancyId: app.vacancyId, applicationId: e.applicationId, dados, createdAt: now }]);
}

/** A entrevista mais recente de cada candidatura (para a lista da vaga e Minhas candidaturas). */
export async function entrevistasDasCandidaturas(db: PrismaClient, applicationIds: string[], now: Date): Promise<Map<string, ResumoEntrevista>> {
  const m = new Map<string, ResumoEntrevista>();
  if (!applicationIds.length) return m;
  const rows = await db.entrevista.findMany({
    where: { applicationId: { in: applicationIds } },
    orderBy: { createdAt: "desc" },
    select: { id: true, applicationId: true, status: true, inicio: true, duracaoMin: true, horarios: true, linkReuniao: true, canceladaPor: true },
  });
  for (const r of rows) if (!m.has(r.applicationId)) m.set(r.applicationId, resumo(r, now));
  return m;
}

// ── candidato (pelo link) ──

export type VisaoAgendar = {
  empresa: string;
  vaga: string;
  duracaoMin: number;
  status: StatusVisivel;
  inicio: string | null;
  linkReuniao: string | null;
  /** Horários que ainda dá para escolher (futuros e sem conflito na agenda do recrutador). */
  disponiveis: string[];
  /** Pode trocar ou cancelar agora (aberta, ou marcada com mais de 12 horas de antecedência). */
  podeAlterar: boolean;
};

async function porCodigo(tx: Tx | PrismaClient, codigo: string) {
  return tx.entrevista.findUnique({ where: { tokenHash: await hashCodigo(codigo) }, select: SELECT_ENTREVISTA });
}

async function ocupados(tx: Tx | PrismaClient, e: { id: string; recrutadorId: string; horarios: Date[] }): Promise<{ inicio: Date; duracaoMin: number }[]> {
  if (!e.horarios.length) return [];
  const t = e.horarios.map((h) => h.getTime());
  const rows = await tx.entrevista.findMany({
    where: {
      recrutadorId: e.recrutadorId,
      status: "marcada",
      id: { not: e.id },
      inicio: { gte: new Date(Math.min(...t) - 4 * 3600_000), lte: new Date(Math.max(...t) + 4 * 3600_000) },
    },
    select: { inicio: true, duracaoMin: true },
  });
  return rows.filter((r): r is { inicio: Date; duracaoMin: number } => !!r.inicio);
}

function podeAlterar(e: { status: string; inicio: Date | null; horarios: Date[] }, now: Date): boolean {
  if (statusVisivel(e as EntrevistaDb, now) === "aberta") return true;
  return e.status === "marcada" && !!e.inicio && e.inicio.getTime() - now.getTime() > PRAZO_ALTERAR_MS;
}

export async function verPorCodigo(db: PrismaClient, codigo: string, now: Date): Promise<VisaoAgendar | null> {
  const e = await porCodigo(db, codigo);
  if (!e) return null;
  const st = statusVisivel(e, now);
  const pode = podeAlterar(e, now);
  let disponiveis: string[] = [];
  if (pode) {
    const occ = await ocupados(db, e);
    disponiveis = e.horarios
      .filter((h) => h.getTime() > now.getTime() && !occ.some((o) => sobrepoe(h, e.duracaoMin, o.inicio, o.duracaoMin)))
      .sort((a, b) => a.getTime() - b.getTime())
      .map((h) => h.toISOString());
  }
  return {
    empresa: e.application.company.nome,
    vaga: e.application.vacancy?.titulo ?? "",
    duracaoMin: e.duracaoMin,
    status: st,
    inicio: e.inicio?.toISOString() ?? null,
    linkReuniao: st === "marcada" ? e.linkReuniao : null,
    disponiveis,
    podeAlterar: pode,
  };
}

export type ErroAgendar = "nao_encontrada" | "nao_pode" | "horario_indisponivel";

/** O candidato escolhe (ou troca) o horário. */
export async function escolherHorario(
  db: PrismaClient,
  codigo: string,
  inicioIso: unknown,
  fuso: unknown,
  now: Date,
  opts: { appUrl: string },
): Promise<{ ok: true; id: string } | { ok: false; erro: ErroAgendar }> {
  const inicio = typeof inicioIso === "string" ? new Date(inicioIso) : null;
  if (!inicio || Number.isNaN(inicio.getTime())) return { ok: false, erro: "horario_indisponivel" };
  return db.$transaction(async (tx) => {
    const e0 = await porCodigo(tx, codigo);
    if (!e0) return { ok: false, erro: "nao_encontrada" } as const;
    // Trava por recrutador: duas escolhas ao mesmo tempo não marcam o mesmo horário.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${e0.recrutadorId}))`;
    const e = (await porCodigo(tx, codigo))!;
    if (!podeAlterar(e, now)) return { ok: false, erro: "nao_pode" } as const;
    if (!e.horarios.some((h) => h.getTime() === inicio.getTime()) || inicio.getTime() <= now.getTime()) {
      return { ok: false, erro: "horario_indisponivel" } as const;
    }
    if (e.status === "marcada" && e.inicio?.getTime() === inicio.getTime()) return { ok: true, id: e.id } as const;
    const occ = await ocupados(tx, e);
    if (occ.some((o) => sobrepoe(inicio, e.duracaoMin, o.inicio, o.duracaoMin))) return { ok: false, erro: "horario_indisponivel" } as const;
    const troca = e.status === "marcada";
    const seq = troca ? e.sequencia + 1 : e.sequencia;
    const fusoOk = typeof fuso === "string" && fusoValido(fuso) ? fuso : e.fusoCandidato;
    const nova = await tx.entrevista.update({
      where: { id: e.id },
      data: { status: "marcada", inicio, marcadaEm: now, sequencia: seq, fusoCandidato: fusoOk },
      select: SELECT_ENTREVISTA,
    });
    const c = await contexto(tx, nova, opts.appUrl);
    if (c) {
      const urlCandidato = `${base(opts.appUrl)}/agendar?c=${codigo}`;
      await guardarEmails(tx, nova, emailsDoEvento(c, { tipo: troca ? "trocada" : "marcada", inicio, sequencia: seq, urlCandidato }, now));
    }
    await sinal(tx, e, "entrevista_marcada", "candidato", { troca, duracaoMin: e.duracaoMin }, now);
    return { ok: true, id: e.id } as const;
  });
}

/** O candidato cancela (até 12 horas antes). */
export async function cancelarPeloCandidato(
  db: PrismaClient,
  codigo: string,
  now: Date,
  opts: { appUrl: string },
): Promise<{ ok: true; id: string } | { ok: false; erro: ErroAgendar }> {
  return db.$transaction(async (tx) => {
    const e = await porCodigo(tx, codigo);
    if (!e) return { ok: false, erro: "nao_encontrada" } as const;
    if (!podeAlterar(e, now)) return { ok: false, erro: "nao_pode" } as const;
    const seq = e.sequencia + 1;
    await tx.entrevista.update({ where: { id: e.id }, data: { status: "cancelada", canceladaEm: now, canceladaPor: "candidato", sequencia: seq } });
    const c = await contexto(tx, e, opts.appUrl);
    const inicio = e.status === "marcada" ? e.inicio : null;
    if (c) await guardarEmails(tx, e, emailsDoEvento(c, { tipo: "cancelada", inicio, sequencia: seq, porCandidato: true }, now));
    await sinal(tx, e, "entrevista_cancelada", "candidato", { por: "candidato", estava: e.status }, now);
    return { ok: true, id: e.id } as const;
  });
}

// ── fila ──

/** Põe na fila os e-mails guardados destas entrevistas e tira da lista os que entraram. */
export async function enfileirarPendentes(db: PrismaClient, ids: string[], enqueue: (m: EmailMessage) => Promise<void>): Promise<{ enviados: number; falhas: number }> {
  let enviados = 0;
  let falhas = 0;
  for (const id of ids) {
    const e = await db.entrevista.findUnique({ where: { id }, select: { emailsPendentes: true } });
    const lista = pendentes(e?.emailsPendentes);
    if (!lista.length) continue;
    const foram = new Set<string>();
    for (const m of lista) {
      try {
        await enqueue(m);
        foram.add(m.idempotencyKey);
        enviados++;
      } catch (err) {
        falhas++;
        console.error(`[agenda] e-mail ${m.idempotencyKey} não entrou na fila:`, err instanceof Error ? err.message : err);
      }
    }
    if (!foram.size) continue;
    // Relê dentro da transação: outra mudança pode ter guardado e-mails novos enquanto este laço rodava.
    await db.$transaction(async (tx) => {
      const atual = await tx.entrevista.findUnique({ where: { id }, select: { emailsPendentes: true } });
      const resto = pendentes(atual?.emailsPendentes).filter((m) => !foram.has(m.idempotencyKey));
      await tx.entrevista.update({ where: { id }, data: { emailsPendentes: resto as unknown as Prisma.InputJsonValue } });
    });
  }
  return { enviados, falhas };
}

/** Cron diário: e-mails de agenda que não entraram na fila (mudanças dos últimos 7 dias). */
export async function reenviarEmailsEntrevista(
  db: PrismaClient,
  enqueue: (m: EmailMessage) => Promise<void>,
  now = new Date(),
  limite = 50,
): Promise<{ enviados: number; falhas: number }> {
  const rows = await db.entrevista.findMany({
    where: { NOT: { emailsPendentes: { equals: [] } }, updatedAt: { gt: new Date(now.getTime() - 7 * 864e5) } },
    orderBy: { updatedAt: "asc" },
    take: limite,
    select: { id: true },
  });
  return enfileirarPendentes(db, rows.map((r) => r.id), enqueue);
}

export type { AgendaTipo };
