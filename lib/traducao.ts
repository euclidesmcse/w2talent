/**
 * 2.7 Tradução automática (plano https://claude.ai/artifact/B4uemTny9TbLz5zQrBo98T, D1–D6).
 * O texto que as pessoas escrevem (vaga; Ficha W2 no 2.7b) é traduzido pela IA para os outros
 * idiomas do site e guardado na tabela Traducao. Uma tradução só vale enquanto o hash do texto
 * original bate (editou, a antiga deixa de valer). Quem escreveu continua vendo só o original.
 * Nomes de tecnologia, números e contatos não mudam: a tradução que mexe neles é descartada.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import type { ChatRequest, ChatResult } from "./ai/types";
import { redactContacts } from "./ai/redact";
import { parseJsonObject } from "./ficha-ai";
import { getSkill } from "./taxonomy";
import { chaveUso, consumirUso } from "./uso-diario";

export type Idioma = "pt-BR" | "en" | "es";
export const IDIOMAS: Idioma[] = ["pt-BR", "en", "es"];
export function idiomaValido(v: unknown): v is Idioma {
  return typeof v === "string" && (IDIOMAS as string[]).includes(v);
}

/** Campos de texto de uma entidade: string ou lista de strings, na ordem em que aparecem. */
export type Campos = Record<string, string | string[]>;

export type ChatTraducaoFn = (task: "translate_content", req: ChatRequest) => Promise<ChatResult & { model?: string }>;

/** Chamadas de IA de tradução por dia, somando todas as entidades (segurança de custo, D5). */
export const LIMITE_TRADUCOES_DIA = 300;

const NOME: Record<Idioma, string> = { "pt-BR": "Brazilian Portuguese", en: "English", es: "Spanish" };

// ── regras puras ───────────────────────────────────────────────────────────

function ordenado(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(ordenado);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, ordenado((v as Record<string, unknown>)[k])]));
  return v;
}

/** sha-256 (hex) do texto original, com as chaves em ordem: a mesma vaga dá sempre o mesmo hash. */
export async function hashCampos(c: Campos): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(ordenado(c)));
  const d = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function textos(c: Campos): string[] {
  return Object.values(c).flatMap((v) => (Array.isArray(v) ? v : [v]));
}

/** Números do texto sem separadores ("8.000" e "8,000" contam igual). */
export function numeros(s: string): string[] {
  return (s.match(/\d+(?:[.,]\d+)*/g) ?? []).map((n) => n.replace(/[.,]/g, "")).sort();
}

/**
 * A tradução serve? Mesmos campos e mesmo número de itens, nada vazio onde havia texto,
 * os mesmos números, os termos protegidos (nomes de tecnologia) mantidos e tamanho razoável.
 */
export function traducaoValida(orig: Campos, trad: Campos, protegidos: string[] = []): boolean {
  for (const [k, v] of Object.entries(orig)) {
    const t = trad[k];
    if (Array.isArray(v)) {
      if (!Array.isArray(t) || t.length !== v.length) return false;
    } else if (typeof t !== "string") return false;
    const a = Array.isArray(v) ? v : [v];
    const b = (Array.isArray(t) ? t : [t]) as unknown[];
    for (let i = 0; i < a.length; i++) {
      const x = b[i];
      if (typeof x !== "string") return false;
      if (a[i].trim() && !x.trim()) return false;
      if (x.length > a[i].length * 3 + 40) return false;
      if (numeros(a[i]).join(",") !== numeros(x).join(",")) return false;
      for (const p of protegidos) {
        const re = new RegExp(`(^|[^\\p{L}\\p{N}])${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}\\p{N}])`, "iu");
        if (re.test(a[i]) && !re.test(x)) return false;
      }
    }
  }
  return true;
}

function limpar(v: unknown): string | string[] | null {
  if (typeof v === "string") return v.replace(/\s+/g, " ").trim();
  if (Array.isArray(v) && v.every((x) => typeof x === "string")) return v.map((x) => x.replace(/\s+/g, " ").trim());
  return null;
}

const SYSTEM = (alvo: Idioma) => `You translate text written by people on a recruiting site. Reply with one JSON object only.
First detect the language of the input ("pt-BR", "en", "es" or "outro"). Then translate every field into ${NOME[alvo]}.
Keep exactly: technology, product, company and certification names; numbers, money, dates and URLs; the markers [EMAIL] and [TELEFONE].
Keep the same fields, the same number of items in each list and the same order. Do not add, explain or summarize anything.
If the input is already in ${NOME[alvo]}, return "origem" accordingly and the fields unchanged.
Schema: {"origem": "pt-BR" | "en" | "es" | "outro", "campos": <same shape as the input fields>}`;

export type ResultadoTraducao = { origem: Idioma | "outro"; campos: Campos | null; modelo?: string };

/**
 * Traduz os campos para `alvo`. `campos` null quando o texto já está no idioma de destino.
 * Null quando a IA falha ou a tradução não passa nas conferências.
 * Campo com contato (e-mail, telefone) fica no original: a IA nunca vê o contato.
 */
export async function traduzirCampos(c: Campos, alvo: Idioma, chat: ChatTraducaoFn, protegidos: string[] = []): Promise<ResultadoTraducao | null> {
  const comContato = (s: string) => redactContacts(s) !== s;
  const entrada: Campos = {};
  for (const [k, v] of Object.entries(c)) {
    if (Array.isArray(v)) entrada[k] = v.map((s) => (comContato(s) ? "" : s));
    else entrada[k] = comContato(v) ? "" : v;
  }
  const letras = textos(c).reduce((n, s) => n + s.length, 0);
  if (!letras) return { origem: alvo, campos: null };
  try {
    const r = await chat("translate_content", {
      json: true,
      temperature: 0,
      maxTokens: Math.min(8000, Math.max(800, Math.ceil(letras / 2) + 400)),
      messages: [
        { role: "system", content: SYSTEM(alvo) },
        { role: "user", content: JSON.stringify(entrada) },
      ],
    });
    const obj = parseJsonObject(r.text);
    if (!obj) return null;
    const origem = idiomaValido(obj.origem) ? obj.origem : "outro";
    if (origem === alvo) return { origem, campos: null, modelo: r.model };
    const bruto = (obj.campos && typeof obj.campos === "object" ? obj.campos : {}) as Record<string, unknown>;
    const out: Campos = {};
    for (const [k, v] of Object.entries(c)) {
      const t = limpar(bruto[k]);
      if (t === null) return null;
      // Itens com contato não foram para a IA: voltam como estavam.
      if (Array.isArray(v)) out[k] = Array.isArray(t) ? t.map((s, i) => (comContato(v[i] ?? "") ? v[i] : s)) : t;
      else out[k] = comContato(v) ? v : t;
    }
    if (!traducaoValida(c, out, protegidos)) return null;
    return { origem, campos: out, modelo: r.model };
  } catch (e) {
    console.warn("[traducao] IA falhou:", e instanceof Error ? e.name : e);
    return null;
  }
}

// ── vagas ──────────────────────────────────────────────────────────────────

export type TextoVaga = { titulo: string; descricaoBullets: string[]; beneficios: string[] };

function lista(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

export function textoDaVaga(v: { titulo: string; descricaoBullets: unknown; beneficios: unknown }): TextoVaga {
  return { titulo: v.titulo, descricaoBullets: lista(v.descricaoBullets), beneficios: lista(v.beneficios) };
}

export function protegidosDaVaga(stack: unknown): string[] {
  const ids = Array.isArray(stack) ? stack.map((s) => (typeof s === "string" ? s : (s as { skillId?: string })?.skillId)).filter(Boolean) : [];
  return [...new Set(ids.map((id) => getSkill(id as string)?.label).filter((x): x is string => !!x && x.length > 1))];
}

type DbTx = Pick<PrismaClient, "traducao" | "vacancy" | "$queryRaw">;

/**
 * Traduções válidas das vagas no idioma de quem vê. Só leitura (sem IA): a vaga sem tradução
 * pronta, ou já escrita nesse idioma, fica fora do mapa e aparece no original.
 * O texto original vem do banco (a lista da busca pode não trazer todos os campos).
 */
export async function traducoesDasVagas(db: Pick<PrismaClient, "vacancy">, ids: string[], idioma: Idioma): Promise<Map<string, TextoVaga & { idiomaOrigem: string }>> {
  const out = new Map<string, TextoVaga & { idiomaOrigem: string }>();
  if (!ids.length) return out;
  const vagas = await db.vacancy.findMany({
    where: { id: { in: ids } },
    select: { id: true, titulo: true, descricaoBullets: true, beneficios: true, traducoes: { where: { idioma }, select: { hashOrigem: true, idiomaOrigem: true, conteudo: true } } },
  });
  for (const v of vagas) {
    const r = v.traducoes[0];
    if (!r?.conteudo || r.hashOrigem !== (await hashCampos(textoDaVaga(v)))) continue;
    out.set(v.id, { ...textoDaVaga(r.conteudo as { titulo: string; descricaoBullets: unknown; beneficios: unknown }), idiomaOrigem: r.idiomaOrigem });
  }
  return out;
}

/** Vagas cujas traduções faltam ou ficaram velhas (algum idioma sem linha com o hash atual). */
export async function vagasSemTraducao(db: DbTx, ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const vagas = await db.vacancy.findMany({ where: { id: { in: ids } }, select: { id: true, titulo: true, descricaoBullets: true, beneficios: true, traducoes: { select: { idioma: true, hashOrigem: true } } } });
  const faltam: string[] = [];
  for (const v of vagas) {
    const h = await hashCampos(textoDaVaga(v));
    const ok = new Set(v.traducoes.filter((t) => t.hashOrigem === h).map((t) => t.idioma));
    if (IDIOMAS.some((i) => !ok.has(i))) faltam.push(v.id);
  }
  return faltam;
}

export type ResumoTraducao = { traduzidas: number; mesmoIdioma: number; falhas: number; semLimite: boolean };

/**
 * Traduz uma vaga para os idiomas que faltam. O primeiro pedido revela o idioma original;
 * o idioma igual ao original vira uma linha sem conteúdo (não gasta IA de novo).
 */
export async function traduzirVaga(db: DbTx, vacancyId: string, chat: ChatTraducaoFn, now: Date = new Date()): Promise<ResumoTraducao> {
  const res: ResumoTraducao = { traduzidas: 0, mesmoIdioma: 0, falhas: 0, semLimite: false };
  const v = await db.vacancy.findUnique({ where: { id: vacancyId }, select: { titulo: true, descricaoBullets: true, beneficios: true, stack: true, traducoes: { select: { idioma: true, hashOrigem: true, idiomaOrigem: true } } } });
  if (!v) return res;
  const texto = textoDaVaga(v);
  const hash = await hashCampos(texto);
  const atuais = v.traducoes.filter((t) => t.hashOrigem === hash);
  const feitos = new Set(atuais.map((t) => t.idioma));
  let origem: string | undefined = atuais[0]?.idiomaOrigem;
  const protegidos = protegidosDaVaga(v.stack);
  // Primeiro o inglês: o mais comum como idioma diferente do original.
  for (const idioma of (["en", "es", "pt-BR"] as Idioma[]).filter((i) => !feitos.has(i))) {
    const gravar = (idiomaOrigem: string, conteudo: TextoVaga | null, modelo?: string) =>
      db.traducao.upsert({
        where: { vacancyId_idioma: { vacancyId, idioma } },
        create: { vacancyId, idioma, idiomaOrigem, hashOrigem: hash, conteudo: conteudo ?? Prisma.DbNull, modelo: modelo ?? null },
        update: { idiomaOrigem, hashOrigem: hash, conteudo: conteudo ?? Prisma.DbNull, modelo: modelo ?? null },
      });
    if (origem === idioma) {
      await gravar(origem, null);
      res.mesmoIdioma++;
      continue;
    }
    const uso = await consumirUso(db as unknown as PrismaClient, await chaveUso("traducao", "geral"), LIMITE_TRADUCOES_DIA, now).catch(() => ({ permitido: false, total: 0 }));
    if (!uso.permitido) {
      res.semLimite = true;
      break;
    }
    const r = await traduzirCampos(texto, idioma, chat, protegidos);
    if (!r) {
      res.falhas++;
      continue;
    }
    if (r.origem !== "outro") origem = r.origem;
    await gravar(r.origem, r.campos as TextoVaga | null, r.modelo);
    if (r.campos) res.traduzidas++;
    else res.mesmoIdioma++;
  }
  return res;
}

/** Chat de tradução pelo roteador de IA; null quando a IA não está configurada. */
export async function chatDeTraducao(): Promise<ChatTraducaoFn | null> {
  try {
    const { getAiRouter } = await import("./ai");
    const router = getAiRouter();
    return (task, q) => router.chat(task, q);
  } catch {
    return null;
  }
}

/** Pede em segundo plano a tradução das vagas indicadas (no máximo `max` por chamada). */
export async function pedirTraducaoVagas(db: DbTx, ids: string[], max = 3): Promise<void> {
  const { runInBackground } = await import("./background");
  const faltam = (await vagasSemTraducao(db, ids)).slice(0, max);
  if (!faltam.length) return;
  const chat = await chatDeTraducao();
  if (!chat) return;
  runInBackground("traducao-vagas", async () => {
    for (const id of faltam) await traduzirVaga(db, id, chat);
  });
}

/** Cron diário: vagas ativas sem tradução atual (inclui as que já existiam antes do 2.7). */
export async function traduzirPendentes(db: DbTx, chat: ChatTraducaoFn, limite = 30, now: Date = new Date()): Promise<ResumoTraducao & { vagas: number }> {
  const total: ResumoTraducao & { vagas: number } = { traduzidas: 0, mesmoIdioma: 0, falhas: 0, semLimite: false, vagas: 0 };
  const ativas = await db.vacancy.findMany({ where: { status: "ativa", expiresAt: { gt: now } }, select: { id: true }, orderBy: { updatedAt: "desc" }, take: 500 });
  const faltam = (await vagasSemTraducao(db, ativas.map((a) => a.id))).slice(0, limite);
  for (const id of faltam) {
    const r = await traduzirVaga(db, id, chat, now);
    total.vagas++;
    total.traduzidas += r.traduzidas;
    total.mesmoIdioma += r.mesmoIdioma;
    total.falhas += r.falhas;
    if (r.semLimite) {
      total.semLimite = true;
      break;
    }
  }
  return total;
}
