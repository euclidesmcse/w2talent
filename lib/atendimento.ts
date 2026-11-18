/**
 * 2.6b-1 Atendimento: "Falar com uma pessoa" na Ajuda (plano https://claude.ai/artifact/7u3uNYjxBkCxmisEdjBrAw).
 * A pessoa escreve (com ou sem login); a equipe responde em Admin > Atendimento. Sem IA em nenhum
 * ponto: o texto fica como foi escrito e nunca vai para um modelo (D4, D7).
 * Acesso da pessoa por link com código (/ajuda/conversa?c=<código>); o banco guarda só o hash.
 * Cada e-mail de resposta leva um código novo e os anteriores continuam valendo.
 * 2.6b-2: com login, "Minhas conversas" lista as conversas da conta e abre cada uma pelo id
 * (autorizado pelo userId da sessão, sem o código). Conversa encerrada é apagada 180 dias depois (Cron).
 */
import type { PrismaClient } from "@prisma/client";
import { emailLocale, renderAtendimentoEmail } from "./email-templates";
import { gerarCodigo, hashCodigo } from "./entrevista";
import type { EmailMessage } from "./email";
import { chaveUso, consumirUso } from "./uso-diario";

export { codigoValido } from "./entrevista";

export const TEXTO_MAX = 2000;
/** D4: mensagens da pessoa por conversa por dia (a primeira conta). */
export const LIMITE_MENSAGENS_CONVERSA_DIA = 30;
/** Quantas mensagens a tela mostra (as mais novas). */
export const MENSAGENS_NA_TELA = 200;
const POR_PAGINA = 50;
/** D4: a conversa é apagada (com mensagens e códigos) este número de dias depois de encerrada. */
export const PRAZO_GUARDA_DIAS = 180;
/** Quantas conversas "Minhas conversas" mostra (as de atividade mais recente). */
export const MINHAS_NA_TELA = 100;
const DIA_MS = 24 * 60 * 60 * 1000;

export type Autor = "pessoa" | "equipe";
export type StatusConversa = "aberta" | "encerrada";
export type Mensagem = { id: string; autor: Autor; texto: string; em: string };
export type VisaoConversa = { status: StatusConversa; encerradaEm: string | null; mensagens: Mensagem[] };
export type Enfileirar = (m: EmailMessage) => Promise<void>;
export type ContaAtendimento = { id: string; email: string; perfil: "candidato" | "recrutador" | null };
export type Opcoes = { appUrl: string; emailEquipe: string; enqueue: Enfileirar; now?: Date };

export function textoValido(t: unknown): t is string {
  return typeof t === "string" && t.trim().length >= 1 && t.trim().length <= TEXTO_MAX;
}

function base(appUrl: string): string {
  return appUrl.replace(/\/+$/, "");
}

export function linkDaConversa(appUrl: string, codigo: string): string {
  return `${base(appUrl)}/ajuda/conversa?c=${codigo}`;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

/** E-mail para a equipe (só em português, interno). D3: o texto, a tela e o tipo de conta; nunca o e-mail da pessoa. */
export function emailParaEquipe(
  d: { conversaId: string; mensagemId: string; nova: boolean; texto: string; tela: string | null; perfil: string | null; idioma: string },
  para: string,
  appUrl: string,
): EmailMessage {
  const url = `${base(appUrl)}/admin/atendimento?id=${encodeURIComponent(d.conversaId)}`;
  const quem = d.perfil === "candidato" ? "Candidato logado" : d.perfil === "recrutador" ? "Recrutador logado" : "Sem login";
  const linhas = [
    ["Tela", d.tela ?? "-"],
    ["Conta", quem],
    ["Idioma", d.idioma],
  ] as const;
  const titulo = d.nova ? "Conversa nova no Atendimento do W2Talent." : "Mensagem nova numa conversa do Atendimento do W2Talent.";
  const text = `${titulo}\n\n${d.texto}\n\n${linhas.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\nResponder: ${url}\n`;
  const html =
    `<p>${esc(titulo)}</p><blockquote style="white-space:pre-wrap">${esc(d.texto)}</blockquote>` +
    `<ul>${linhas.map(([k, v]) => `<li><strong>${k}:</strong> ${esc(v)}</li>`).join("")}</ul>` +
    `<p><a href="${esc(url)}">Responder em Admin › Atendimento</a></p>`;
  const resumo = d.texto.trim().replace(/\s+/g, " ");
  return {
    to: para,
    subject: `${d.nova ? "Atendimento" : "Atendimento (nova mensagem)"}: ${resumo.slice(0, 60)}${resumo.length > 60 ? "…" : ""}`,
    html,
    text,
    idempotencyKey: `atendimento:${d.mensagemId}`,
  };
}

/** Falha na fila não desfaz a mensagem (D5): registra e segue. */
async function avisar(enqueue: Enfileirar, msg: EmailMessage): Promise<boolean> {
  try {
    await enqueue(msg);
    return true;
  } catch (e) {
    console.error("[atendimento] fila:", e instanceof Error ? e.name : e);
    return false;
  }
}

function visao(c: { status: StatusConversa; encerradaEm: Date | null; mensagens: { id: string; autor: Autor; texto: string; createdAt: Date }[] }): VisaoConversa {
  return {
    status: c.status,
    encerradaEm: c.encerradaEm?.toISOString() ?? null,
    mensagens: [...c.mensagens].reverse().map((m) => ({ id: m.id, autor: m.autor, texto: m.texto, em: m.createdAt.toISOString() })),
  };
}

const SELECT_VISAO = {
  id: true,
  status: true,
  encerradaEm: true,
  tela: true,
  perfil: true,
  idioma: true,
  mensagens: { orderBy: { createdAt: "desc" as const }, take: MENSAGENS_NA_TELA, select: { id: true, autor: true, texto: true, createdAt: true } },
};

/** Como a pessoa chega à conversa: pelo código do link (com ou sem login) ou, com login, pelo id e a conta dona (2.6b-2). */
export type Acesso = { codigo: string } | { id: string; userId: string };

async function achar(db: PrismaClient, a: Acesso) {
  if ("codigo" in a) {
    const c = await db.conversaCodigo.findUnique({ where: { tokenHash: await hashCodigo(a.codigo) }, select: { conversa: { select: SELECT_VISAO } } });
    return c?.conversa ?? null;
  }
  // Conversa de outra conta (ou sem conta) fica igual a uma que não existe.
  return db.conversa.findFirst({ where: { id: a.id, userId: a.userId }, select: SELECT_VISAO });
}

const acesso = (a: string | Acesso): Acesso => (typeof a === "string" ? { codigo: a } : a);

/** Id de conversa como o Prisma gera (cuid); o resto nem vai ao banco. */
export function idValido(id: unknown): id is string {
  return typeof id === "string" && /^[a-z0-9]{20,40}$/.test(id);
}

// ── lado da pessoa ──

export type ErroAbrir = "texto_invalido" | "email_invalido";

/**
 * Abre a conversa com a primeira mensagem. Com login, liga à conta e usa o e-mail dela; sem login,
 * o e-mail digitado é obrigatório. O limite por IP (3 por dia) fica na rota.
 */
export async function abrirConversa(
  db: PrismaClient,
  d: { texto: unknown; email?: unknown; locale: string; tela: string | null; conta: ContaAtendimento | null; perguntaId?: string | null },
  opts: Opcoes,
): Promise<{ ok: true; codigo: string; id: string } | { ok: false; erro: ErroAbrir }> {
  if (!textoValido(d.texto)) return { ok: false, erro: "texto_invalido" };
  const email = d.conta ? d.conta.email : typeof d.email === "string" ? d.email.trim() : "";
  if (!d.conta && !emailValido(email)) return { ok: false, erro: "email_invalido" };
  const texto = d.texto.trim();
  const now = opts.now ?? new Date();
  const codigo = gerarCodigo();
  const tokenHash = await hashCodigo(codigo);
  const conversa = await db.conversa.create({
    data: {
      email,
      userId: d.conta?.id ?? null,
      perfil: d.conta?.perfil ?? null,
      idioma: d.locale,
      tela: d.tela,
      ultimaDe: "pessoa",
      ultimaEm: now,
      codigos: { create: { tokenHash } },
      mensagens: { create: { autor: "pessoa", texto, createdAt: now } },
    },
    select: { id: true, mensagens: { select: { id: true } } },
  });
  await consumirUso(db, await chaveUso("conversa-msg", conversa.id), LIMITE_MENSAGENS_CONVERSA_DIA, now);
  if (d.perguntaId) await db.perguntaSemResposta.updateMany({ where: { id: d.perguntaId }, data: { enviadaEquipe: true } }).catch(() => undefined);
  await avisar(
    opts.enqueue,
    emailParaEquipe(
      { conversaId: conversa.id, mensagemId: conversa.mensagens[0].id, nova: true, texto, tela: d.tela, perfil: d.conta?.perfil ?? null, idioma: d.locale },
      opts.emailEquipe,
      opts.appUrl,
    ),
  );
  return { ok: true, codigo, id: conversa.id };
}

export async function verConversa(db: PrismaClient, a: string | Acesso): Promise<VisaoConversa | null> {
  const c = await achar(db, acesso(a));
  return c ? visao(c) : null;
}

export type ErroEnviar = "nao_encontrada" | "encerrada" | "texto_invalido" | "limite_dia";

export async function enviarMensagem(
  db: PrismaClient,
  quem: string | Acesso,
  texto: unknown,
  opts: Opcoes,
): Promise<{ ok: true; visao: VisaoConversa } | { ok: false; erro: ErroEnviar; visao?: VisaoConversa }> {
  const a = acesso(quem);
  const c = await achar(db, a);
  if (!c) return { ok: false, erro: "nao_encontrada" };
  if (c.status === "encerrada") return { ok: false, erro: "encerrada", visao: visao(c) };
  if (!textoValido(texto)) return { ok: false, erro: "texto_invalido" };
  const now = opts.now ?? new Date();
  const uso = await consumirUso(db, await chaveUso("conversa-msg", c.id), LIMITE_MENSAGENS_CONVERSA_DIA, now);
  if (!uso.permitido) return { ok: false, erro: "limite_dia", visao: visao(c) };
  const limpo = texto.trim();
  // Só grava se a conversa ainda estiver aberta (o admin pode ter encerrado no meio).
  const m = await db.$transaction(async (tx) => {
    const n = await tx.conversa.updateMany({ where: { id: c.id, status: "aberta" }, data: { ultimaDe: "pessoa", ultimaEm: now } });
    if (!n.count) return null;
    return tx.conversaMensagem.create({ data: { conversaId: c.id, autor: "pessoa", texto: limpo, createdAt: now }, select: { id: true } });
  });
  const depois = (await achar(db, a))!;
  if (!m) return { ok: false, erro: "encerrada", visao: visao(depois) };
  await avisar(
    opts.enqueue,
    emailParaEquipe({ conversaId: c.id, mensagemId: m.id, nova: false, texto: limpo, tela: c.tela, perfil: c.perfil, idioma: c.idioma }, opts.emailEquipe, opts.appUrl),
  );
  return { ok: true, visao: visao(depois) };
}

export type LinhaMinha = {
  id: string;
  status: StatusConversa;
  /** Esperando a equipe: a última mensagem é da pessoa e a conversa está aberta. */
  aguardando: boolean;
  /** A equipe respondeu por último. */
  respondida: boolean;
  ultimaEm: string;
  criadaEm: string;
  /** Começo da primeira mensagem (o assunto), escrita pela própria pessoa. */
  assunto: string;
};

/** 2.6b-2 Minhas conversas: só as ligadas à conta (userId), atividade mais recente primeiro. */
export async function minhasConversas(db: PrismaClient, userId: string): Promise<LinhaMinha[]> {
  const rows = await db.conversa.findMany({
    where: { userId },
    orderBy: [{ ultimaEm: "desc" }, { id: "asc" }],
    take: MINHAS_NA_TELA,
    select: {
      id: true, status: true, ultimaDe: true, ultimaEm: true, createdAt: true,
      mensagens: { orderBy: { createdAt: "asc" }, take: 1, select: { texto: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    aguardando: r.status === "aberta" && r.ultimaDe === "pessoa",
    respondida: r.ultimaDe === "equipe",
    ultimaEm: r.ultimaEm.toISOString(),
    criadaEm: r.createdAt.toISOString(),
    assunto: (r.mensagens[0]?.texto ?? "").replace(/\s+/g, " ").trim().slice(0, 140),
  }));
}

/** Cron (D4): apaga as conversas encerradas há mais de 180 dias; mensagens e códigos vão junto (cascata). */
export async function apagarConversasAntigas(db: PrismaClient, now: Date = new Date()): Promise<number> {
  const limite = new Date(now.getTime() - PRAZO_GUARDA_DIAS * DIA_MS);
  const r = await db.conversa.deleteMany({ where: { status: "encerrada", encerradaEm: { lt: limite } } });
  return r.count;
}

const EMAIL_OK = /^[^\s@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,}$/;

/** E-mail de quem abre a conversa sem login (para avisar quando a equipe responder). */
export function emailValido(e: unknown): e is string {
  return typeof e === "string" && e.length <= 254 && EMAIL_OK.test(e.trim());
}

// ── lado da equipe (Admin > Atendimento) ──

export type FiltroAdmin = "aberta" | "encerrada" | "todas";
export type LinhaAdmin = {
  id: string;
  status: StatusConversa;
  perfil: string | null;
  logado: boolean;
  tela: string | null;
  idioma: string;
  aguardando: boolean;
  ultimaEm: string;
  criadaEm: string;
  previa: string;
};

/** Esperando a equipe primeiro (enum: pessoa < equipe), depois a mais recente. */
export async function listarConversas(db: PrismaClient, filtro: FiltroAdmin, pagina: number): Promise<{ conversas: LinhaAdmin[]; temMais: boolean }> {
  const rows = await db.conversa.findMany({
    where: filtro === "todas" ? {} : { status: filtro },
    orderBy: [{ ultimaDe: "asc" }, { ultimaEm: "desc" }, { id: "asc" }],
    skip: (pagina - 1) * POR_PAGINA,
    take: POR_PAGINA + 1,
    select: {
      id: true, status: true, perfil: true, userId: true, tela: true, idioma: true, ultimaDe: true, ultimaEm: true, createdAt: true,
      mensagens: { orderBy: { createdAt: "desc" }, take: 1, select: { texto: true } },
    },
  });
  return {
    conversas: rows.slice(0, POR_PAGINA).map((r) => ({
      id: r.id,
      status: r.status,
      perfil: r.perfil,
      logado: !!r.userId,
      tela: r.tela,
      idioma: r.idioma,
      aguardando: r.status === "aberta" && r.ultimaDe === "pessoa",
      ultimaEm: r.ultimaEm.toISOString(),
      criadaEm: r.createdAt.toISOString(),
      previa: (r.mensagens[0]?.texto ?? "").replace(/\s+/g, " ").slice(0, 140),
    })),
    temMais: rows.length > POR_PAGINA,
  };
}

export type ConversaAdmin = VisaoConversa & { id: string; perfil: string | null; logado: boolean; tela: string | null; idioma: string; criadaEm: string };

/** D3: o que a pessoa escreveu, a tela e o tipo de conta. Sem e-mail, ficha ou candidaturas. */
export async function conversaParaAdmin(db: PrismaClient, id: string): Promise<ConversaAdmin | null> {
  const c = await db.conversa.findUnique({ where: { id }, select: { ...SELECT_VISAO, userId: true, createdAt: true } });
  if (!c) return null;
  return { ...visao(c), id: c.id, perfil: c.perfil, logado: !!c.userId, tela: c.tela, idioma: c.idioma, criadaEm: c.createdAt.toISOString() };
}

export type ErroAdmin = "nao_encontrada" | "encerrada" | "texto_invalido";

/** Resposta da equipe (sem IA, D7). A pessoa recebe e-mail com um link novo para a conversa. */
export async function responderConversa(
  db: PrismaClient,
  id: string,
  texto: unknown,
  opts: Omit<Opcoes, "emailEquipe">,
): Promise<{ ok: true; emailEnviado: boolean } | { ok: false; erro: ErroAdmin }> {
  if (!textoValido(texto)) return { ok: false, erro: "texto_invalido" };
  const now = opts.now ?? new Date();
  const codigo = gerarCodigo();
  const tokenHash = await hashCodigo(codigo);
  const r = await db.$transaction(async (tx) => {
    // Trava a conversa com um update condicional antes de gravar: se outra pessoa da equipe encerrar
    // ao mesmo tempo, um dos dois espera o outro e a resposta não entra numa conversa já encerrada.
    const n = await tx.conversa.updateMany({ where: { id, status: "aberta" }, data: { ultimaDe: "equipe", ultimaEm: now } });
    if (n.count === 0) {
      const existe = await tx.conversa.findUnique({ where: { id }, select: { id: true } });
      return { erro: existe ? ("encerrada" as const) : ("nao_encontrada" as const) };
    }
    const c = await tx.conversa.findUniqueOrThrow({ where: { id }, select: { email: true, idioma: true } });
    const m = await tx.conversaMensagem.create({ data: { conversaId: id, autor: "equipe", texto: texto.trim(), createdAt: now }, select: { id: true } });
    await tx.conversaCodigo.create({ data: { tokenHash, conversaId: id, createdAt: now } });
    return { c, m };
  });
  if ("erro" in r) return { ok: false, erro: r.erro! };
  const locale = emailLocale(r.c.idioma);
  const e = renderAtendimentoEmail({ locale, url: linkDaConversa(opts.appUrl, codigo) });
  const emailEnviado = await avisar(opts.enqueue, { to: r.c.email, ...e, idempotencyKey: `atendimento:${r.m.id}` });
  return { ok: true, emailEnviado };
}

export async function encerrarConversa(db: PrismaClient, id: string, now: Date = new Date()): Promise<boolean> {
  const n = await db.conversa.updateMany({ where: { id, status: "aberta" }, data: { status: "encerrada", encerradaEm: now } });
  if (n.count > 0) return true;
  return !!(await db.conversa.findUnique({ where: { id }, select: { id: true } }));
}
