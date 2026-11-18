/**
 * 3.4a Integração com ATS (plano https://claude.ai/artifact/7u3uNYjxBkCxmisEdjBrAw).
 * - D1: webhook genérico. A empresa cadastra um endereço https; o W2Talent manda um POST com JSON.
 * - D2: neste PR só "candidatura.recebida" (quando o envio em lote chega à empresa) e "teste".
 *   O envelope já serve ao "candidatura.etapa" (3.4b).
 * - D3: a Ficha W2 vai como o candidato viu em "O que a empresa vai receber" (`fichaParaEmpresa`):
 *   sem e-mail, telefone nem links. Contato só depois de `contatoLiberadoEm` (regra do 2.4c).
 * - D4: só https em endereço público; cada pedido assinado com HMAC-SHA256 sobre `${t}.${corpo}`.
 *   O segredo aparece uma vez e fica cifrado com AI_KEYS_MASTER (lib/ai/keys.ts). Só o dono configura.
 * - D5: entrega pela fila `notificacoes` (lib/fila.ts); cada tentativa vira uma linha em WebhookEntrega,
 *   sem o corpo. Repete em erro de rede, 5xx e 429, até 10 vezes.
 */
import type { PrismaClient } from "@prisma/client";
import { decryptApiKey, encryptApiKey } from "./ai/keys";
import { fichaParaEmpresa } from "./envio";
import { sanitizeFicha, sanitizeFichaW2 } from "./ficha";
import { matchCandidato } from "./match-candidato";
import type { EventoWebhook, MensagemWebhook, ResultadoEntrega } from "./fila";

type Db = PrismaClient;

export const WEBHOOK_TIMEOUT_MS = 10_000;
export const WEBHOOK_URL_MAX = 500;
export const WEBHOOK_ENTREGAS_TELA = 20;
/** Linhas de entrega mais velhas que isto são apagadas a cada nova entrega do mesmo webhook. */
export const WEBHOOK_ENTREGAS_DIAS = 30;
export const WEBHOOK_VERSAO = 1;
/** "Enviar teste", por empresa e por dia (contado em UsoDiario). */
export const LIMITE_TESTES_WEBHOOK_DIA = 30;

// ---------------------------------------------------------------------------------------------
// Endereço (D4)
// ---------------------------------------------------------------------------------------------

export type MotivoUrl = "vazia" | "invalida" | "https" | "credenciais" | "porta" | "host_privado" | "longa";

function ipv4(host: string): number[] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return null;
  const p = m.slice(1).map(Number);
  return p.every((n) => n <= 255) ? p : null;
}

/** Faixas que não são internet pública (RFC 1918, loopback, link-local, CGNAT, documentação, multicast...). */
export function ipv4Privado([a, b, c]: number[]): boolean {
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

const SUFIXOS_INTERNOS = [".localhost", ".local", ".internal", ".intranet", ".lan", ".home", ".corp", ".home.arpa", ".test", ".invalid", ".example"];

/**
 * Confere o endereço do webhook: só https, sem usuário e senha, porta padrão e host público.
 * IPv6 escrito no endereço é recusado (não dá para conferir todas as faixas internas com segurança);
 * IPv4 só fora das faixas internas. O Worker ainda tem `global_fetch_strictly_public`.
 */
export function validarUrlWebhook(raw: unknown): { ok: true; url: string } | { ok: false; motivo: MotivoUrl } {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return { ok: false, motivo: "vazia" };
  if (s.length > WEBHOOK_URL_MAX) return { ok: false, motivo: "longa" };
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return { ok: false, motivo: "invalida" };
  }
  if (u.protocol !== "https:") return { ok: false, motivo: "https" };
  if (u.username || u.password) return { ok: false, motivo: "credenciais" };
  if (u.port && u.port !== "443") return { ok: false, motivo: "porta" };
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (!host) return { ok: false, motivo: "invalida" };
  if (host.startsWith("[") || host.includes(":")) return { ok: false, motivo: "host_privado" };
  const ip = ipv4(host);
  if (ip) {
    if (ipv4Privado(ip)) return { ok: false, motivo: "host_privado" };
  } else {
    if (host === "localhost" || !host.includes(".") || SUFIXOS_INTERNOS.some((x) => host.endsWith(x))) return { ok: false, motivo: "host_privado" };
    // Número puro que o URL não converteu (ex.: "1.2.3") também não é um nome público.
    if (/^[\d.]+$/.test(host)) return { ok: false, motivo: "host_privado" };
  }
  u.hash = "";
  return { ok: true, url: u.toString() };
}

// ---------------------------------------------------------------------------------------------
// Segredo e assinatura (D4)
// ---------------------------------------------------------------------------------------------

const hex = (b: ArrayBuffer | Uint8Array) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");

/** "whsec_" + 32 bytes aleatórios em hex. A chave do HMAC é o texto inteiro (UTF-8). */
export function gerarSegredo(): string {
  return `whsec_${hex(crypto.getRandomValues(new Uint8Array(32)))}`;
}

/** HMAC-SHA256 em hex de `${timestamp}.${corpo}`. */
export async function assinar(segredo: string, timestamp: number, corpo: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, enc.encode(`${timestamp}.${corpo}`)));
}

/** Cabeçalhos do pedido. `t` em segundos (Unix). */
export async function cabecalhosAssinados(segredo: string, evento: string, deliveryId: string, corpo: string, agora: Date): Promise<Record<string, string>> {
  const t = Math.floor(agora.getTime() / 1000);
  return {
    "content-type": "application/json",
    "user-agent": "W2Talent-Webhook/1",
    "x-w2talent-event": evento,
    "x-w2talent-delivery": deliveryId,
    "x-w2talent-signature": `t=${t},v1=${await assinar(segredo, t, corpo)}`,
  };
}

export function novoIdEvento(): string {
  return `evt_${crypto.randomUUID().replace(/-/g, "")}`;
}

// ---------------------------------------------------------------------------------------------
// Corpo (D3)
// ---------------------------------------------------------------------------------------------

export type CorpoWebhook = {
  event: EventoWebhook;
  id: string;
  occurred_at: string;
  version: number;
  company: { id: string };
  data: Record<string, unknown>;
};

const VAGA = { id: true, titulo: true, nivel: true, regime: true, localidade: true, faixaDe: true, faixaAte: true, faixaMoeda: true, stack: true, updatedAt: true } as const;

type LinhaCandidatura = {
  id: string;
  proxyThreadId: string;
  createdAt: Date;
  etapa: string;
  contatoLiberadoEm: Date | null;
  vacancy: { id: string; titulo: string; nivel: string | null; regime: string | null; localidade: string | null; faixaDe: number | null; faixaAte: number | null; faixaMoeda: string | null; stack: unknown; updatedAt: Date } | null;
  candidate: Record<string, unknown> & { id: string; email: string; celular: string | null };
};

/** Monta o `data` de um evento de candidatura. Contato só com `contatoLiberadoEm` (2.4c). */
export function dadosDaCandidatura(a: LinhaCandidatura, now: number): Record<string, unknown> {
  const v = a.vacancy;
  const ficha = sanitizeFicha(a.candidate);
  const f = fichaParaEmpresa(ficha, v?.regime);
  const w2 = sanitizeFichaW2(a.candidate.fichaW2);
  const m = v ? matchCandidato(a.candidate, v as any, now) : null;
  const { email: _e, celular: _c, links: _l, ...semContato } = f;
  return {
    vaga: v
      ? {
          id: v.id,
          titulo: v.titulo,
          nivel: v.nivel,
          regime: v.regime,
          localidade: v.localidade,
          faixa: v.faixaDe == null && v.faixaAte == null ? null : { de: v.faixaDe, ate: v.faixaAte, moeda: v.faixaMoeda || "BRL" },
        }
      : null,
    candidatura: {
      id: a.id,
      referencia: a.proxyThreadId,
      enviada_em: a.createdAt.toISOString(),
      etapa: a.etapa,
      match: m ? { pct: m.pct, gaps: m.gaps } : null,
    },
    candidato: {
      id: a.candidate.id,
      ...semContato,
      ficha_w2: w2 ? { resumo: w2.resumo, destaques: w2.destaques, idioma: w2.idioma } : null,
      contato: a.contatoLiberadoEm ? { email: a.candidate.email, celular: a.candidate.celular ?? null } : null,
    },
  };
}

export function corpoDoEvento(evento: EventoWebhook, id: string, occurredAt: string, companyId: string, data: Record<string, unknown>): CorpoWebhook {
  return { event: evento, id, occurred_at: occurredAt, version: WEBHOOK_VERSAO, company: { id: companyId }, data };
}

/** Corpo montado na hora da entrega. null quando a candidatura não existe mais (ou não é desta empresa). */
export async function corpoDaMensagem(db: Db, m: MensagemWebhook, now = new Date()): Promise<CorpoWebhook | null> {
  if (m.evento === "teste") {
    return corpoDoEvento("teste", m.id, m.occurredAt, m.companyId, { mensagem: "Teste do W2Talent. Se chegou, a integração está funcionando." });
  }
  if (!m.applicationId) return null;
  const a = await db.application.findFirst({
    where: { id: m.applicationId, companyId: m.companyId, origem: "candidaturaLote" },
    select: { id: true, proxyThreadId: true, createdAt: true, etapa: true, contatoLiberadoEm: true, vacancy: { select: VAGA }, candidate: true },
  });
  if (!a) return null;
  return corpoDoEvento(m.evento, m.id, m.occurredAt, m.companyId, dadosDaCandidatura(a as unknown as LinhaCandidatura, now.getTime()));
}

// ---------------------------------------------------------------------------------------------
// Entrega (D5)
// ---------------------------------------------------------------------------------------------

/** Rede, 5xx e 429 voltam para a fila; o resto (2xx, 3xx, 4xx) não. */
export function deveRepetir(status: number | null): boolean {
  return status == null || status === 429 || status >= 500;
}

function atrasoDoRetryAfter(v: string | null): number | undefined {
  if (!v || !/^\d{1,5}$/.test(v.trim())) return undefined;
  return Math.min(3600, Math.max(30, Number(v.trim())));
}

export type OpcoesEntrega = { fetch?: typeof fetch; master?: string; now?: () => Date };

/**
 * Entrega um evento: monta o corpo, assina com o segredo atual, faz o POST (10 s, sem seguir
 * redirecionamento) e grava a tentativa. Webhook inexistente ou desligado: não envia nada
 * (o "teste" vai mesmo desligado, para conferir antes de ligar).
 */
export async function entregarWebhook(db: Db, m: MensagemWebhook, tentativa: number, opts: OpcoesEntrega = {}): Promise<ResultadoEntrega> {
  const agora = opts.now ?? (() => new Date());
  const wh = await db.webhook.findUnique({ where: { companyId: m.companyId } });
  if (!wh || (!wh.ativo && m.evento !== "teste")) return { resultado: "desistir", erro: "desligado" };

  const inicio = Date.now();
  const grava = async (r: ResultadoEntrega): Promise<ResultadoEntrega> => {
    const ok = r.resultado === "ok";
    await db.$transaction([
      db.webhookEntrega.create({
        data: { webhookId: wh.id, evento: m.evento, deliveryId: m.id, status: r.status ?? null, erro: r.erro ?? null, tentativa, duracaoMs: Math.max(0, Date.now() - inicio) },
      }),
      // O teste não conta na sequência de falhas (o 3.4b pausa o webhook com 50).
      ...(m.evento === "teste" ? [] : [db.webhook.update({ where: { id: wh.id }, data: { falhasSeguidas: ok ? 0 : { increment: 1 } } })]),
      db.webhookEntrega.deleteMany({ where: { webhookId: wh.id, createdAt: { lt: new Date(agora().getTime() - WEBHOOK_ENTREGAS_DIAS * 86_400_000) } } }),
    ]);
    return r;
  };

  const url = validarUrlWebhook(wh.url);
  if (!url.ok) return grava({ resultado: "desistir", erro: "url" });
  const corpo = await corpoDaMensagem(db, m, agora());
  if (!corpo) return grava({ resultado: "desistir", erro: "candidatura_apagada" });
  let segredo: string;
  try {
    segredo = await decryptApiKey(wh.segredoCifrado, opts.master ?? process.env.AI_KEYS_MASTER);
  } catch {
    // Chave mestra fora do ar: tenta de novo mais tarde.
    return grava({ resultado: "repetir", erro: "segredo" });
  }
  const texto = JSON.stringify(corpo);
  const headers = await cabecalhosAssinados(segredo, m.evento, m.id, texto, agora());
  const f = opts.fetch ?? fetch;
  try {
    const res = await f(url.url, { method: "POST", headers, body: texto, redirect: "manual", signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS) });
    // Não lemos a resposta: só o código importa.
    await res.body?.cancel().catch(() => undefined);
    const status = res.status;
    if (status >= 200 && status < 300) return grava({ resultado: "ok", status });
    if (status >= 300 && status < 400) return grava({ resultado: "desistir", status, erro: "redirecionamento" });
    if (deveRepetir(status)) return grava({ resultado: "repetir", status, atrasoSeg: status === 429 ? atrasoDoRetryAfter(res.headers.get("retry-after")) : undefined });
    return grava({ resultado: "desistir", status });
  } catch (e) {
    const nome = e instanceof Error ? e.name : "";
    return grava({ resultado: "repetir", erro: nome === "TimeoutError" || nome === "AbortError" ? "tempo" : "rede" });
  }
}

// ---------------------------------------------------------------------------------------------
// Fila: candidaturas recebidas (D2)
// ---------------------------------------------------------------------------------------------

/**
 * Depois do commit do envio em lote: uma mensagem por candidatura cuja empresa tem webhook ligado.
 * Nunca lança: falha aqui não desfaz nem atrapalha o envio.
 */
export async function enfileirarRecebidas(
  db: Db,
  criadas: { applicationId: string; companyId: string }[],
  enqueue: (m: MensagemWebhook) => Promise<void>,
  now = new Date(),
): Promise<number> {
  if (!criadas.length) return 0;
  let n = 0;
  try {
    const ativos = await db.webhook.findMany({ where: { companyId: { in: [...new Set(criadas.map((c) => c.companyId))] }, ativo: true }, select: { companyId: true } });
    const ligadas = new Set(ativos.map((w) => w.companyId));
    for (const c of criadas) {
      if (!ligadas.has(c.companyId)) continue;
      try {
        await enqueue({ tipo: "webhook", evento: "candidatura.recebida", id: novoIdEvento(), companyId: c.companyId, applicationId: c.applicationId, occurredAt: now.toISOString() });
        n++;
      } catch (e) {
        console.error(`[webhook] candidatura ${c.applicationId} não entrou na fila:`, e instanceof Error ? e.message : e);
      }
    }
  } catch (e) {
    console.error("[webhook] leitura dos webhooks falhou:", e instanceof Error ? e.name : e);
  }
  return n;
}

// ---------------------------------------------------------------------------------------------
// Configuração (só o dono da empresa)
// ---------------------------------------------------------------------------------------------

export class WebhookErro extends Error {
  constructor(public codigo: "sem_empresa" | "so_dono" | "rejeitada" | "sem_webhook" | "sem_chave" | "url") {
    super(codigo);
  }
}

/** A empresa da conta, só se a conta for a dona e a empresa não estiver recusada. */
export async function empresaDoDono(db: Db, userId: string): Promise<string> {
  const m = await db.companyMember.findUnique({ where: { userId }, select: { papel: true, companyId: true, company: { select: { validacaoStatus: true } } } });
  if (!m) throw new WebhookErro("sem_empresa");
  if (m.papel !== "dono") throw new WebhookErro("so_dono");
  if (m.company.validacaoStatus === "rejeitado") throw new WebhookErro("rejeitada");
  return m.companyId;
}

export type EntregaTela = { id: string; createdAt: string; evento: string; status: number | null; erro: string | null; tentativa: number; ok: boolean };
export type ConfigWebhook = { url: string; ativo: boolean; falhasSeguidas: number; createdAt: string; entregas: EntregaTela[] } | null;

export async function lerConfig(db: Db, companyId: string): Promise<ConfigWebhook> {
  const wh = await db.webhook.findUnique({ where: { companyId }, select: { id: true, url: true, ativo: true, falhasSeguidas: true, createdAt: true } });
  if (!wh) return null;
  const entregas = await db.webhookEntrega.findMany({
    where: { webhookId: wh.id },
    orderBy: { createdAt: "desc" },
    take: WEBHOOK_ENTREGAS_TELA,
    select: { id: true, createdAt: true, evento: true, status: true, erro: true, tentativa: true },
  });
  return {
    url: wh.url,
    ativo: wh.ativo,
    falhasSeguidas: wh.falhasSeguidas,
    createdAt: wh.createdAt.toISOString(),
    entregas: entregas.map((e) => ({ ...e, createdAt: e.createdAt.toISOString(), ok: e.status != null && e.status >= 200 && e.status < 300 })),
  };
}

async function cifrar(segredo: string, master: string | undefined): Promise<string> {
  try {
    return await encryptApiKey(segredo, master);
  } catch {
    throw new WebhookErro("sem_chave");
  }
}

/**
 * Grava o endereço e/ou liga/desliga. Sem webhook ainda, cria (ligado, salvo `ativo:false`) e devolve
 * o segredo novo, que só aparece nesta resposta.
 */
export async function salvarWebhook(
  db: Db,
  companyId: string,
  input: { url?: unknown; ativo?: unknown },
  master = process.env.AI_KEYS_MASTER,
): Promise<{ segredo: string | null }> {
  const atual = await db.webhook.findUnique({ where: { companyId }, select: { id: true } });
  let url: string | undefined;
  if (input.url !== undefined || !atual) {
    const v = validarUrlWebhook(input.url);
    if (!v.ok) throw Object.assign(new WebhookErro("url"), { motivo: v.motivo });
    url = v.url;
  }
  const ativo = typeof input.ativo === "boolean" ? input.ativo : undefined;
  if (!atual) {
    const segredo = gerarSegredo();
    const segredoCifrado = await cifrar(segredo, master);
    await db.webhook.create({ data: { companyId, url: url!, segredoCifrado, ativo: ativo ?? true } });
    return { segredo };
  }
  // Ligar de novo zera a sequência de falhas.
  await db.webhook.update({ where: { companyId }, data: { ...(url ? { url } : {}), ...(ativo !== undefined ? { ativo, ...(ativo ? { falhasSeguidas: 0 } : {}) } : {}) } });
  return { segredo: null };
}

/** Troca o segredo. O antigo deixa de valer na hora; o novo só aparece nesta resposta. */
export async function novoSegredo(db: Db, companyId: string, master = process.env.AI_KEYS_MASTER): Promise<string> {
  const atual = await db.webhook.findUnique({ where: { companyId }, select: { id: true } });
  if (!atual) throw new WebhookErro("sem_webhook");
  const segredo = gerarSegredo();
  await db.webhook.update({ where: { companyId }, data: { segredoCifrado: await cifrar(segredo, master) } });
  return segredo;
}

export function mensagemDeTeste(companyId: string, now = new Date()): MensagemWebhook {
  return { tipo: "webhook", evento: "teste", id: novoIdEvento(), companyId, occurredAt: now.toISOString() };
}
