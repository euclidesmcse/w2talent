/**
 * Ajuste fino de modelo aberto (3.6a, plano https://claude.ai/artifact/B1kcRjUJ5emNK2W4Xu9WSW, D1–D3).
 *
 * Um exemplo = (entrada anonimizada, o que a IA escreveu, o que a pessoa salvou depois de corrigir).
 * Só duas tarefas por enquanto: `ficha_w2` (Ficha W2 a partir da ficha do CV) e `extract_vacancy`
 * (campos da vaga a partir do texto colado em Publicar vaga).
 *
 * Fluxo:
 * 1. a rota da IA devolve, junto com o resultado, um "recibo" assinado (`assinarRecibo`): a entrada e a
 *    saída da IA, para o servidor saber, na hora de salvar, o que a IA escreveu de verdade (a tela não
 *    consegue inventar a saída da IA). O recibo só leva dados da própria pessoa e volta para ela;
 * 2. ao publicar a ficha ou salvar a vaga, `capturarExemplo` confere o consentimento "treinoIA",
 *    anonimiza tudo (lib/ai/anonimizar.ts, com os valores conhecidos da conta) e só guarda se a rede de
 *    segurança não achar sobras. Nunca guarda o id da conta: só `donoHash` (HMAC) para apagar na revogação;
 * 3. desligar o consentimento apaga os exemplos daquela pessoa.
 *
 * Nada aqui chama IA nem manda os exemplos a nenhum fornecedor. A captura nunca derruba o salvar.
 * Chave do HMAC: derivada do BETTER_AUTH_SECRET (`segredoDoLogin`) com prefixo próprio, como
 * lib/comparar-link.ts. Trocar esse Secret desliga a ligação dos exemplos antigos com as contas: nesse
 * caso, apague todos os exemplos em Admin > Dados de treino.
 */
import type { PrismaClient } from "@prisma/client";
import { anonimizar, anonimizarValor, sobrasValor, type Conhecidos } from "./ai/anonimizar";
import { TREINO_IA_TIPO, TREINO_IA_VERSAO, textoTreinoIa } from "./consentimento";

export const TAREFAS_TREINO = ["ficha_w2", "extract_vacancy"] as const;
export type TarefaTreino = (typeof TAREFAS_TREINO)[number];
export const isTarefaTreino = (v: unknown): v is TarefaTreino => typeof v === "string" && (TAREFAS_TREINO as readonly string[]).includes(v);

/** D7: só se fala em treinar com pelo menos 500 exemplos aprovados de uma tarefa. */
export const MIN_APROVADOS_TREINO = 500;
/** D5: 1 em cada 10 exemplos fica na prova fixa (decidido pelo hash do conteúdo). */
export const PROVA_EM_CADA = 10;
/** O recibo da IA vale 7 dias (o rascunho da ficha fica no navegador). */
export const RECIBO_DIAS = 7;
export const RECIBO_MAX = 120_000;

type Db = PrismaClient;
const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function deB64url(s: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new Error("base64url");
  const pad = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  return Uint8Array.from(atob(pad), (c) => c.charCodeAt(0));
}
function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmac(prefixo: string, segredo: string, dados: string): Promise<Uint8Array> {
  if (!segredo) throw new Error("segredo ausente");
  const chave = await crypto.subtle.importKey("raw", enc.encode(`${prefixo}:${segredo}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", chave, enc.encode(dados)));
}

/** Código que liga os exemplos à conta sem guardar o id (HMAC-SHA256 do id). */
export async function donoHash(userId: string, segredo: string): Promise<string> {
  return hex((await hmac("w2-treino-dono", segredo, userId)).buffer as ArrayBuffer);
}

export async function sha256(s: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
}

/** D5: o exemplo fica na prova fixa? Determinístico: só depende do hash do conteúdo. */
export function naProva(conteudoHash: string): boolean {
  const n = parseInt(conteudoHash.slice(0, 8), 16);
  return Number.isFinite(n) && n % PROVA_EM_CADA === 0;
}

// ── recibo da IA ──

export type Recibo = {
  tarefa: TarefaTreino;
  /** Instruções (system) mandadas à IA: texto fixo, sem dado de ninguém. */
  sistema: string;
  /** Mensagem do usuário mandada à IA (texto colado ou JSON da ficha). */
  entrada: string;
  /** O que a IA devolveu, já limpo (o que a pessoa viu na tela). */
  saidaIa: unknown;
  idioma?: string;
};

export async function assinarRecibo(r: Recibo, segredo: string, agora = Date.now()): Promise<string> {
  const corpo = b64url(enc.encode(JSON.stringify({ ...r, x: agora + RECIBO_DIAS * 864e5 })));
  return `${corpo}.${b64url(await hmac("w2-treino-recibo", segredo, corpo))}`;
}

/** Recibo válido e dentro do prazo, ou null. */
export async function lerRecibo(token: unknown, segredo: string, agora = Date.now()): Promise<Recibo | null> {
  if (typeof token !== "string" || token.length > RECIBO_MAX) return null;
  const [corpo, assinatura, sobra] = token.split(".");
  if (!corpo || !assinatura || sobra !== undefined) return null;
  try {
    const esperada = b64url(await hmac("w2-treino-recibo", segredo, corpo));
    if (esperada.length !== assinatura.length) return null;
    let dif = 0;
    for (let i = 0; i < esperada.length; i++) dif |= esperada.charCodeAt(i) ^ assinatura.charCodeAt(i);
    if (dif) return null;
    const o = JSON.parse(new TextDecoder().decode(deB64url(corpo))) as Recibo & { x?: number };
    if (typeof o.x !== "number" || o.x < agora) return null;
    if (!isTarefaTreino(o.tarefa) || typeof o.sistema !== "string" || typeof o.entrada !== "string") return null;
    return { tarefa: o.tarefa, sistema: o.sistema, entrada: o.entrada, saidaIa: o.saidaIa, idioma: typeof o.idioma === "string" ? o.idioma : undefined };
  } catch {
    return null;
  }
}

// ── consentimento ──

/** Consentimento "treinoIA" ligado? Vale a linha mais recente do tipo. */
export async function treinoLigado(db: Db, userId: string): Promise<boolean> {
  const ultimo = await db.consentLog.findFirst({ where: { userId, tipo: TREINO_IA_TIPO }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { baseLegal: true } });
  return ultimo?.baseLegal === "consentimento";
}

/** Liga ou desliga. Desligar apaga os exemplos da pessoa. Não grava linha repetida. */
export async function mudarTreino(db: Db, userId: string, ligar: boolean, idioma: string, segredo: string): Promise<{ ligado: boolean; apagados: number }> {
  const atual = await treinoLigado(db, userId);
  if (atual !== ligar) {
    await db.consentLog.create({
      data: { userId, tipo: TREINO_IA_TIPO, versao: TREINO_IA_VERSAO, texto: textoTreinoIa(idioma, !ligar), baseLegal: ligar ? "consentimento" : "revogacao" },
    });
  }
  let apagados = 0;
  // Apaga também quando já estava desligado: um pedido de "desligar" sempre limpa.
  if (!ligar) apagados = (await db.exemploTreino.deleteMany({ where: { donoHash: await donoHash(userId, segredo) } })).count;
  return { ligado: ligar, apagados };
}

// ── valores conhecidos da conta ──

/** Nome, e-mail e celular da conta e da ficha; empresas das experiências. */
export async function conhecidosDoCandidato(db: Db, userId: string, ficha?: { nome?: string; email?: string; celular?: string; links?: string[]; experiencias?: { empresa?: string }[] }): Promise<Conhecidos> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
  return {
    nomes: [u?.name, ficha?.nome],
    emails: [u?.email, ficha?.email],
    telefones: [ficha?.celular],
    links: ficha?.links ?? [],
    empresas: (ficha?.experiencias ?? []).map((e) => e.empresa),
  };
}

/** Nome e e-mail da conta; nome, CNPJ, site e e-mail da empresa. */
export async function conhecidosDoRecrutador(db: Db, userId: string, companyId: string): Promise<Conhecidos> {
  const [u, c] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
    db.companyProfile.findUnique({ where: { id: companyId }, select: { nome: true, cnpj: true, site: true, emailContato: true } }),
  ]);
  return {
    nomes: [u?.name],
    emails: [u?.email, c?.emailContato],
    empresas: [c?.nome],
    documentos: [c?.cnpj],
    links: [c?.site],
  };
}

// ── captura ──

export type ResultadoCaptura = "sem_consentimento" | "recibo_invalido" | "tarefa_errada" | "recusado_anonimizacao" | "repetido" | "guardado" | "erro";

/** Entrada anonimizada: o JSON da ficha campo a campo; o texto da vaga inteiro. */
function entradaAnonima(r: Recibo, c: Conhecidos): { texto: string; valor: unknown } {
  if (r.tarefa === "ficha_w2") {
    try {
      const v = anonimizarValor(JSON.parse(r.entrada) as unknown, c);
      return { texto: JSON.stringify(v), valor: v };
    } catch {
      // JSON ruim: trata como texto.
    }
  }
  const t = anonimizar(r.entrada, c);
  return { texto: t, valor: t };
}

/**
 * Guarda um exemplo se a pessoa aceitou o treino. Nunca lança: qualquer erro vira "nada guardado".
 * `final` é o que a pessoa salvou (o mesmo formato de `saidaIa`).
 */
export async function capturarExemplo(
  db: Db,
  args: { userId: string; tarefa: TarefaTreino; recibo: unknown; final: unknown; conhecidos: Conhecidos; segredo: string; agora?: number },
): Promise<ResultadoCaptura> {
  try {
    if (!(await treinoLigado(db, args.userId))) return "sem_consentimento";
    const r = await lerRecibo(args.recibo, args.segredo, args.agora);
    if (!r) return "recibo_invalido";
    if (r.tarefa !== args.tarefa) return "tarefa_errada";
    const entrada = entradaAnonima(r, args.conhecidos);
    const saidaIa = anonimizarValor(r.saidaIa ?? null, args.conhecidos);
    const saidaFinal = anonimizarValor(args.final ?? null, args.conhecidos);
    // Rede de segurança (D3): qualquer sobra recusa o exemplo inteiro.
    const sobra = [...sobrasValor(entrada.valor, args.conhecidos), ...sobrasValor(saidaIa, args.conhecidos), ...sobrasValor(saidaFinal, args.conhecidos)];
    if (sobra.length) return "recusado_anonimizacao";
    const ia = JSON.stringify(saidaIa);
    const fim = JSON.stringify(saidaFinal);
    const conteudoHash = await sha256(`${r.tarefa}\n${entrada.texto}\n${ia}\n${fim}`);
    const criado = await db.exemploTreino.createMany({
      data: [
        {
          tarefa: r.tarefa,
          donoHash: await donoHash(args.userId, args.segredo),
          conteudoHash,
          idioma: r.idioma ?? null,
          sistema: r.sistema,
          entrada: entrada.texto,
          saidaIa: ia,
          saidaFinal: fim,
          corrigido: ia !== fim,
          prova: naProva(conteudoHash),
        },
      ],
      skipDuplicates: true,
    });
    return criado.count ? "guardado" : "repetido";
  } catch (e) {
    console.warn("[treino] exemplo não guardado:", e instanceof Error ? e.name : e);
    return "erro";
  }
}
