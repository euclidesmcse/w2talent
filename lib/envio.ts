/**
 * Aprovar antes de enviar (1.5.13).
 *
 * - A seleção fica no navegador; cada aprovação fica no banco (ApplicationApproval) presa ao
 *   conteúdo da vaga (hash). Se a vaga mudar, a aprovação cai e a tela mostra o que mudou.
 *   Renovar a vaga ou mudar contadores (views, candidaturas) não muda o hash.
 * - Envio: no máximo 10 por vez e 30 nas últimas 24 h, contados no banco. A mesma vaga nunca
 *   é enviada duas vezes. Vaga vencida ou arquivada desde a aprovação não é enviada.
 * - Cada envio vira uma Application e, se a empresa tem e-mail de contato, um e-mail na fila
 *   `notificacoes` com a Ficha W2 e o match (sem e-mail nem telefone do candidato).
 */
import type { PrismaClient, Prisma } from "@prisma/client";
import { sha256Hex } from "./admin-auth";
import { matchVacancy, type MatchCriteria, type MatchResult } from "./match";
import { fold, type Nivel, type Regime } from "./query-intent";
import { anosExperiencia, nomeCurto, sanitizeFicha, sanitizeFichaW2, topSkills, type Ficha, type FichaW2 } from "./ficha";
import { formatPretensoes, nomeRegime } from "./format";
import { getSkill } from "./taxonomy";
import { emailLocale, renderCandidaturaEmail } from "./email-templates";
import type { EmailMessage } from "./email";

export const ENVIO_LIMITE_LOTE = 10;
export const ENVIO_LIMITE_24H = 30;

/** Campos da vaga que o candidato leu ao aprovar. */
export const CAMPOS_VAGA = ["titulo", "empresa", "regime", "faixa", "localidade", "nivel", "competencias", "descricao", "beneficios"] as const;
export type CampoVaga = (typeof CAMPOS_VAGA)[number];

export type SnapshotVaga = {
  titulo: string;
  empresa: string;
  regime: string;
  faixa: { de: number | null; ate: number | null; moeda: string };
  localidade: string;
  nivel: string;
  competencias: string[];
  descricao: string[];
  beneficios: string[];
};

/** Vaga como sai do banco, com o nome da empresa. */
export type VagaRow = {
  id: string;
  titulo: string;
  stack: unknown;
  nivel: string | null;
  regime: string | null;
  localidade: string | null;
  faixaDe: number | null;
  faixaAte: number | null;
  faixaMoeda: string | null;
  descricaoBullets: unknown;
  beneficios: unknown;
  status: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  companyId: string;
  company: { nome: string; emailContato: string | null };
};

const textos = (v: unknown): string[] =>
  (Array.isArray(v) ? v : []).map((x) => (typeof x === "string" ? x.replace(/\s+/g, " ").trim() : "")).filter(Boolean);

function skillIds(stack: unknown): string[] {
  const ids = (Array.isArray(stack) ? stack : [])
    .map((s: any) => (typeof s === "string" ? s : s?.skillId ?? s?.id ?? ""))
    .filter((s: unknown): s is string => typeof s === "string" && s.length > 0);
  // A ordem das competências não muda o que a vaga pede.
  return [...new Set(ids)].sort();
}

export function snapshotVaga(v: VagaRow): SnapshotVaga {
  const t = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
  return {
    titulo: t(v.titulo),
    empresa: t(v.company?.nome),
    regime: t(v.regime),
    faixa: { de: v.faixaDe ?? null, ate: v.faixaAte ?? null, moeda: v.faixaMoeda ?? "BRL" },
    localidade: t(v.localidade),
    nivel: t(v.nivel),
    competencias: skillIds(v.stack),
    descricao: textos(v.descricaoBullets),
    beneficios: textos(v.beneficios),
  };
}

export async function hashVaga(s: SnapshotVaga): Promise<string> {
  // JSON com as chaves numa ordem fixa (a de CAMPOS_VAGA).
  return sha256Hex(`w2-vaga:${JSON.stringify(CAMPOS_VAGA.map((c) => s[c]))}`);
}

export function camposMudados(antes: unknown, agora: SnapshotVaga): CampoVaga[] {
  const a = (antes && typeof antes === "object" ? antes : {}) as Record<string, unknown>;
  return CAMPOS_VAGA.filter((c) => JSON.stringify(a[c] ?? null) !== JSON.stringify(agora[c]));
}

export function vagaDisponivel(v: Pick<VagaRow, "status" | "expiresAt">, now: Date): boolean {
  return v.status === "ativa" && v.expiresAt.getTime() > now.getTime();
}

// ── perfil do candidato (modo de teste do admin até o login) ─────────────

/** O mesmo userId que "Minha ficha" usa ao publicar (hash do e-mail). */
export async function userIdDoEmail(email: string): Promise<string> {
  return `teste:${(await sha256Hex(`w2-perfil:${email.trim().toLowerCase()}`)).slice(0, 24)}`;
}

export type PerfilEnvio = { id: string; ficha: Ficha; w2: FichaW2 | null; idioma: string };

export async function perfilDoEmail(db: PrismaClient, email: unknown): Promise<PerfilEnvio | null> {
  if (typeof email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return null;
  const row = await db.candidateProfile.findUnique({ where: { userId: await userIdDoEmail(email) } });
  if (!row) return null;
  return { id: row.id, ficha: sanitizeFicha(row), w2: sanitizeFichaW2(row.fichaW2), idioma: row.idiomaOriginal };
}

/** O que a empresa recebe: sem e-mail, telefone e links, e só a pretensão do regime da vaga. */
export function fichaParaEmpresa(f: Ficha, regimeVaga: string | null | undefined): Ficha {
  const regime = regimeDaVaga(f.regimes, regimeVaga);
  return {
    ...f,
    email: "",
    celular: "",
    links: [],
    regimes: regime ? [regime] : f.regimes,
    pretensoes: regime ? f.pretensoes.filter((p) => p.regime === regime && p.valor != null) : [],
  };
}

/** Qual dos regimes do candidato é o da vaga ("PJ", "CLT ou PJ", "Estágio"…). */
export function regimeDaVaga(regimes: string[], regimeVaga: string | null | undefined): string | null {
  if (!regimeVaga) return null;
  const v = fold(regimeVaga);
  return (
    regimes.find((r) => {
      if (r === "Estágio") return /estagi|intern|trainee|pasant/.test(v);
      return new RegExp(`(^|[^a-z])${fold(r)}([^a-z]|$)`).test(v);
    }) ?? null
  );
}

const NIVEL_DA_SENIORIDADE: Record<string, Nivel> = { junior: "Júnior", pleno: "Pleno", senior: "Sênior" };
const REGIMES_MATCH: Regime[] = ["CLT", "PJ", "Estágio"];

/** Critérios do match a partir do perfil (no lugar da busca, como previsto no 1.5.12). */
export function criteriosDoPerfil(f: Ficha, regimeVaga: string | null | undefined, moedaVaga: string | null | undefined = "BRL"): MatchCriteria {
  const regime = (regimeDaVaga(f.regimes, regimeVaga) ?? f.regimes.find((r) => (REGIMES_MATCH as string[]).includes(r)) ?? null) as Regime | null;
  // Moedas diferentes não se comparam (sem câmbio): a faixa fica fora do match.
  const moeda = moedaVaga || "BRL";
  const p = regime ? f.pretensoes.find((x) => x.regime === regime && x.unidade === "mes" && x.valor != null && x.moeda === moeda) : undefined;
  return {
    skills: [...f.stack].sort((a, b) => b.anos - a.anos).slice(0, 5).map((s) => s.skillId),
    regime: regime && (REGIMES_MATCH as string[]).includes(regime) ? regime : null,
    modo: f.modo || null,
    nivel: NIVEL_DA_SENIORIDADE[f.senioridade] ?? null,
    faixaMin: p?.valor ?? null,
  } as MatchCriteria;
}

export function matchDoPerfil(f: Ficha, v: VagaRow, now: Date): MatchResult {
  return matchVacancy(v, criteriosDoPerfil(f, v.regime, v.faixaMoeda), now.getTime());
}

// ── estado de cada vaga para o candidato ─────────────────────────────────

export type EstadoVaga =
  | { estado: "nova" }
  | { estado: "aprovada"; aprovadaEm: string }
  | { estado: "mudou"; campos: CampoVaga[] }
  | { estado: "enviada"; enviadaEm: string }
  | { estado: "indisponivel" }
  | { estado: "nao_encontrada" };

const VAGA_SELECT = {
  id: true,
  titulo: true,
  stack: true,
  nivel: true,
  regime: true,
  localidade: true,
  faixaDe: true,
  faixaAte: true,
  faixaMoeda: true,
  descricaoBullets: true,
  beneficios: true,
  status: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
  companyId: true,
  company: { select: { nome: true, emailContato: true } },
} satisfies Prisma.VacancySelect;

type Db = PrismaClient | Prisma.TransactionClient;

async function carregarVagas(db: Db, ids: string[]): Promise<Map<string, VagaRow>> {
  const rows = (await db.vacancy.findMany({ where: { id: { in: ids } }, select: VAGA_SELECT })) as unknown as VagaRow[];
  return new Map(rows.map((r) => [r.id, r]));
}

export function limparIds(ids: unknown, max = 50): string[] {
  return [...new Set((Array.isArray(ids) ? ids : []).filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 64))].slice(0, max);
}

/** `hash`: versão da vaga mostrada na tela; a aprovação só vale para essa versão. */
export type ItemEstado = { vacancyId: string; vaga: VagaRow | null; match: MatchResult | null; hash: string | null } & EstadoVaga;

export async function estadoDasVagas(db: PrismaClient, perfil: PerfilEnvio, vacancyIds: string[], now = new Date()): Promise<ItemEstado[]> {
  const [vagas, aprovacoes, enviadas] = await Promise.all([
    carregarVagas(db, vacancyIds),
    db.applicationApproval.findMany({ where: { candidateId: perfil.id, vacancyId: { in: vacancyIds } } }),
    db.application.findMany({ where: { candidateId: perfil.id, vacancyId: { in: vacancyIds } }, select: { vacancyId: true, createdAt: true } }),
  ]);
  const out: ItemEstado[] = [];
  for (const id of vacancyIds) {
    const v = vagas.get(id) ?? null;
    const base = { vacancyId: id, vaga: v, match: v ? matchDoPerfil(perfil.ficha, v, now) : null, hash: v ? await hashVaga(snapshotVaga(v)) : null };
    const env = enviadas.find((a) => a.vacancyId === id);
    if (env) {
      out.push({ ...base, estado: "enviada", enviadaEm: env.createdAt.toISOString() });
      continue;
    }
    if (!v) {
      out.push({ ...base, estado: "nao_encontrada" });
      continue;
    }
    if (!vagaDisponivel(v, now)) {
      out.push({ ...base, estado: "indisponivel" });
      continue;
    }
    const ap = aprovacoes.find((a) => a.vacancyId === id);
    if (!ap) {
      out.push({ ...base, estado: "nova" });
      continue;
    }
    const snap = snapshotVaga(v);
    if (ap.vacancyHash !== (await hashVaga(snap))) out.push({ ...base, estado: "mudou", campos: camposMudados(ap.snapshot, snap) });
    else out.push({ ...base, estado: "aprovada", aprovadaEm: ap.aprovadaEm.toISOString() });
  }
  return out;
}

export type ResultadoAprovar = { ok: true; aprovadaEm: string } | { ok: false; motivo: "nao_encontrada" | "indisponivel" | "ja_enviada" | "mudou" };

/** `hashLido`: o hash que a tela mostrou. Se a vaga mudou depois disso, não aprova (a tela recarrega). */
export async function aprovarVaga(db: PrismaClient, candidateId: string, vacancyId: string, hashLido: string, now = new Date()): Promise<ResultadoAprovar> {
  const v = (await carregarVagas(db, [vacancyId])).get(vacancyId);
  if (!v) return { ok: false, motivo: "nao_encontrada" };
  if (await db.application.findFirst({ where: { candidateId, vacancyId }, select: { id: true } })) return { ok: false, motivo: "ja_enviada" };
  if (!vagaDisponivel(v, now)) return { ok: false, motivo: "indisponivel" };
  const snap = snapshotVaga(v);
  const hash = await hashVaga(snap);
  if (hash !== hashLido) return { ok: false, motivo: "mudou" };
  const dados = { vacancyHash: hash, snapshot: snap as unknown as Prisma.InputJsonValue, aprovadaEm: now };
  await db.applicationApproval.upsert({
    where: { candidateId_vacancyId: { candidateId, vacancyId } },
    create: { candidateId, vacancyId, ...dados },
    update: dados,
  });
  return { ok: true, aprovadaEm: now.toISOString() };
}

export async function desfazerAprovacao(db: PrismaClient, candidateId: string, vacancyId: string): Promise<void> {
  await db.applicationApproval.deleteMany({ where: { candidateId, vacancyId } });
}

// ── envio ────────────────────────────────────────────────────────────────

export type ResultadoItem =
  | { vacancyId: string; status: "enviada"; applicationId: string; email: boolean }
  | { vacancyId: string; status: "ja_enviada" | "sem_aprovacao" | "indisponivel" | "nao_encontrada" }
  | { vacancyId: string; status: "mudou"; campos: CampoVaga[] };

export type ResultadoEnvio =
  | { ok: true; loteId: string; itens: ResultadoItem[]; usadas24h: number }
  | { ok: false; erro: "limite_lote"; max: number }
  | { ok: false; erro: "limite_dia"; max: number; usadas24h: number; restantes: number }
  | { ok: false; erro: "nada_para_enviar" };

export type EmailCandidatura = { applicationId: string; referencia: string; vaga: VagaRow; match: MatchResult };

export async function usadasNas24h(db: Db, candidateId: string, now: Date): Promise<number> {
  // Só o que o candidato enviou; contatos de recrutadores não contam.
  return db.application.count({ where: { candidateId, origem: "candidaturaLote", createdAt: { gt: new Date(now.getTime() - 86_400_000) } } });
}

function novoProxyThreadId(): string {
  return `w2c_${crypto.randomUUID().replace(/-/g, "")}`;
}

/**
 * Envia as vagas aprovadas. Tudo numa transação com trava por candidato, para dois envios ao
 * mesmo tempo não passarem do limite nem enviarem a mesma vaga duas vezes.
 * Os e-mails saem depois do commit, pelo `enviarEmail` (fila `notificacoes`).
 */
export async function enviarCandidaturas(
  db: PrismaClient,
  perfil: PerfilEnvio,
  vacancyIdsBrutos: unknown,
  opts: { now?: Date; loteId?: string; enviarEmail?: (e: EmailCandidatura) => Promise<void> } = {},
): Promise<ResultadoEnvio> {
  const now = opts.now ?? new Date();
  const todos = limparIds(vacancyIdsBrutos, 100);
  if (todos.length > ENVIO_LIMITE_LOTE) return { ok: false, erro: "limite_lote", max: ENVIO_LIMITE_LOTE };
  if (!todos.length) return { ok: false, erro: "nada_para_enviar" };
  const loteId = typeof opts.loteId === "string" && /^[\w-]{1,64}$/.test(opts.loteId) ? opts.loteId : crypto.randomUUID();

  const r = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`w2-envio:${perfil.id}`}))`;
    const [vagas, aprovacoes, enviadas, usadas] = await Promise.all([
      carregarVagas(tx, todos),
      tx.applicationApproval.findMany({ where: { candidateId: perfil.id, vacancyId: { in: todos } } }),
      tx.application.findMany({ where: { candidateId: perfil.id, vacancyId: { in: todos } }, select: { vacancyId: true } }),
      usadasNas24h(tx, perfil.id, now),
    ]);
    const itens: ResultadoItem[] = [];
    const prontas: VagaRow[] = [];
    for (const id of todos) {
      const v = vagas.get(id);
      if (enviadas.some((a) => a.vacancyId === id)) itens.push({ vacancyId: id, status: "ja_enviada" });
      else if (!v) itens.push({ vacancyId: id, status: "nao_encontrada" });
      else if (!vagaDisponivel(v, now)) itens.push({ vacancyId: id, status: "indisponivel" });
      else {
        const ap = aprovacoes.find((a) => a.vacancyId === id);
        const snap = snapshotVaga(v);
        if (!ap) itens.push({ vacancyId: id, status: "sem_aprovacao" });
        else if (ap.vacancyHash !== (await hashVaga(snap))) {
          // A vaga mudou depois da aprovação: a aprovação cai e a pessoa revisa de novo.
          await tx.applicationApproval.delete({ where: { id: ap.id } });
          itens.push({ vacancyId: id, status: "mudou", campos: camposMudados(ap.snapshot, snap) });
        } else prontas.push(v);
      }
    }
    if (prontas.length && usadas + prontas.length > ENVIO_LIMITE_24H) {
      return { ok: false as const, erro: "limite_dia" as const, max: ENVIO_LIMITE_24H, usadas24h: usadas, restantes: Math.max(0, ENVIO_LIMITE_24H - usadas) };
    }
    const emails: EmailCandidatura[] = [];
    for (const v of prontas) {
      const app = await tx.application.create({
        data: { vacancyId: v.id, candidateId: perfil.id, companyId: v.companyId, origem: "candidaturaLote", proxyThreadId: novoProxyThreadId(), loteId, createdAt: now, emailPendente: !!v.company.emailContato },
        select: { id: true, proxyThreadId: true },
      });
      await tx.applicationApproval.deleteMany({ where: { candidateId: perfil.id, vacancyId: v.id } });
      await tx.vacancy.update({ where: { id: v.id }, data: { candidaturasCount: { increment: 1 } } });
      itens.push({ vacancyId: v.id, status: "enviada", applicationId: app.id, email: !!v.company.emailContato });
      if (v.company.emailContato) emails.push({ applicationId: app.id, referencia: app.proxyThreadId, vaga: v, match: matchDoPerfil(perfil.ficha, v, now) });
    }
    return { ok: true as const, itens, usadas24h: usadas + prontas.length, emails };
  });

  if (!r.ok) return r;
  for (const e of r.emails) {
    try {
      await opts.enviarEmail?.(e);
      await db.application.update({ where: { id: e.applicationId }, data: { emailPendente: false } });
    } catch (err) {
      // A candidatura já está registrada com emailPendente = true; o Cron diário tenta de novo
      // (reenviarEmailsPendentes).
      console.error(`[envio] e-mail da candidatura ${e.applicationId} não entrou na fila:`, err instanceof Error ? err.message : err);
    }
  }
  // Na ordem em que a pessoa mandou.
  const ordem = new Map(todos.map((id, i) => [id, i]));
  const itens = r.itens.sort((a, b) => (ordem.get(a.vacancyId) ?? 0) - (ordem.get(b.vacancyId) ?? 0));
  return { ok: true, loteId, itens, usadas24h: r.usadas24h };
}

export type Enviada = { id: string; vacancyId: string | null; titulo: string; empresa: string; status: string; createdAt: string; proxyThreadId: string };

export async function listarEnviadas(db: PrismaClient, candidateId: string): Promise<Enviada[]> {
  const rows = await db.application.findMany({
    where: { candidateId, origem: "candidaturaLote" },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, vacancyId: true, status: true, createdAt: true, proxyThreadId: true, vacancy: { select: { titulo: true } }, company: { select: { nome: true } } },
  });
  return rows.map((a) => ({
    id: a.id,
    vacancyId: a.vacancyId,
    titulo: a.vacancy?.titulo ?? "",
    empresa: a.company?.nome ?? "",
    status: a.status,
    createdAt: a.createdAt.toISOString(),
    proxyThreadId: a.proxyThreadId,
  }));
}

/** Monta o e-mail da candidatura para a empresa (só o que a Ficha W2 mostra; sem contato). */
export function mensagemCandidatura(perfil: PerfilEnvio, e: EmailCandidatura): EmailMessage | null {
  const to = e.vaga.company.emailContato;
  if (!to) return null;
  const locale = emailLocale(perfil.w2?.idioma ?? perfil.idioma);
  const f = fichaParaEmpresa(perfil.ficha, e.vaga.regime);
  const { subject, html, text } = renderCandidaturaEmail({
    locale,
    vagaTitulo: e.vaga.titulo,
    nomeCurto: nomeCurto(f.nome),
    cargo: [f.titulo, f.localidade].filter(Boolean).join(" · "),
    anos: anosExperiencia(f),
    pretensao: formatPretensoes(f.pretensoes, locale) || f.regimes.map((r) => nomeRegime(r, locale)).join("/"),
    resumo: perfil.w2?.resumo ?? "",
    competencias: topSkills(f).map((s) => `${getSkill(s.skillId)?.label ?? s.skillId}${s.anos > 0 ? ` (${s.anos}a)` : ""}`),
    destaques: perfil.w2?.destaques ?? [],
    idiomas: f.idiomas.filter((i) => i.idioma).map((i) => i.idioma),
    matchPct: e.match.pct,
    referencia: e.referencia,
  });
  return { to, subject, html, text, idempotencyKey: `candidatura:${e.applicationId}` };
}

/**
 * E-mails de candidatura que não entraram na fila no envio (fila fora do ar, por exemplo).
 * Roda no Cron diário; tenta os dos últimos 7 dias. A chave de idempotência evita e-mail repetido.
 */
export async function reenviarEmailsPendentes(
  db: PrismaClient,
  enqueue: (m: EmailMessage) => Promise<void>,
  now = new Date(),
  limite = 50,
): Promise<{ enviados: number; falhas: number }> {
  const apps = await db.application.findMany({
    where: { emailPendente: true, vacancyId: { not: null }, createdAt: { gt: new Date(now.getTime() - 7 * 86_400_000) } },
    orderBy: { createdAt: "asc" },
    take: limite,
    select: { id: true, proxyThreadId: true, vacancyId: true, candidate: { select: { userId: true } } },
  });
  let enviados = 0;
  let falhas = 0;
  for (const a of apps) {
    try {
      const row = await db.candidateProfile.findUnique({ where: { userId: a.candidate.userId } });
      const v = row ? (await carregarVagas(db, [a.vacancyId!])).get(a.vacancyId!) : undefined;
      const msg =
        row && v
          ? mensagemCandidatura(
              { id: row.id, ficha: sanitizeFicha(row), w2: sanitizeFichaW2(row.fichaW2), idioma: row.idiomaOriginal },
              { applicationId: a.id, referencia: a.proxyThreadId, vaga: v, match: matchDoPerfil(sanitizeFicha(row), v, now) },
            )
          : null;
      if (msg) await enqueue(msg);
      await db.application.update({ where: { id: a.id }, data: { emailPendente: false } });
      if (msg) enviados++;
    } catch (err) {
      falhas++;
      console.error(`[envio] reenvio do e-mail ${a.id} falhou:`, err instanceof Error ? err.message : err);
    }
  }
  return { enviados, falhas };
}
