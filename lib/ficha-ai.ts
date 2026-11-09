/**
 * IA da ficha (1.5.10 + 1.5.11): lê o CV (`extract_cv`) e escreve a Ficha W2 (`ficha_w2`).
 *
 * - Contatos (e-mail, telefone, links) são lidos por regras aqui e tirados do texto ANTES de qualquer
 *   chamada, mesmo para o Workers AI (decisão D4). A IA não precisa deles.
 * - As instruções proíbem usar ou deduzir idade, gênero, raça, religião, estado civil, deficiência,
 *   foto ou endereço (spec v2 §6.3).
 * - Se a IA falhar (indisponível, orçamento do dia, JSON ruim), a leitura volta para as regras antigas.
 */
import type { ChatRequest, ChatResult } from "./ai/types";
import { redactContacts } from "./ai/redact";
import { extractToCanonical } from "./cv-extract";
import { anosExperiencia, fichaVazia, sanitizeFicha, topSkills, type Ficha, type FichaW2 } from "./ficha";
import { getSkill } from "./taxonomy";

export const MAX_CV_CHARS = 60_000;

export type ChatFn = (task: "extract_cv" | "ficha_w2", req: ChatRequest) => Promise<ChatResult & { model?: string }>;

/** E-mail, telefone e links do texto, lidos sem IA. */
export function contatosDoTexto(text: string): { email: string; celular: string; links: string[] } {
  const email = (text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/) ?? [""])[0].toLowerCase();
  const tel = text.match(/(?<!\d)(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,3}\)|\d{2,3})[\s.-]?\d{3,5}[\s.-]?\d{4}\b/);
  const links = [...new Set(text.match(/\b(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com\/in|github\.com)\/[A-Za-z0-9_-]+\/?/gi) ?? [])].slice(0, 5);
  return { email, celular: tel ? tel[0].trim() : "", links };
}

/** Tira o JSON da resposta (aceita ```json ... ``` e texto antes/depois). */
export function parseJsonObject(text: string): Record<string, unknown> | null {
  const t = (text ?? "").replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, "");
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try {
    const v = JSON.parse(t.slice(a, b + 1));
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const ETICA =
  "Never use, infer or mention age, date of birth, gender, race, ethnicity, religion, marital status, children, disability, health, photo, nationality or street address.";

const EXTRACT_SYSTEM = `You extract a résumé into JSON for a recruiting platform. Reply with one JSON object only.
${ETICA}
Unknown values: "" for text, null for numbers, [] for lists, false for booleans. Do not invent data.
Write text values in the language of the résumé.
Schema:
{"nome": string (the person's name),
 "titulo": string (desired or current job title),
 "senioridade": "estagio"|"junior"|"pleno"|"senior"|"especialista"|"lideranca"|"",
 "stack": [{"nome": string (technical skill or tool), "anos": number (years of use, estimated from the experience dates)}] (at most 10, most relevant first),
 "experiencias": [{"cargo": string, "empresa": string, "inicio": "YYYY-MM", "fim": "YYYY-MM" or "", "atual": boolean}] (most recent first, at most 8),
 "formacao": [{"curso": string, "instituicao": string, "ano": "YYYY"}],
 "localidade": string ("City, State" or "City, Country"; never the street),
 "modo": "remoto"|"hibrido"|"presencial"|"",
 "mudanca": boolean (says they accept relocating),
 "regimes": ["CLT"|"PJ"|"Estágio"|"Freelancer"|"Outro"],
 "pretensoes": [{"regime": "CLT"|"PJ"|"Estágio"|"Freelancer"|"Outro", "valor": number (the minimum they accept), "unidade": "mes"|"hora", "moeda": "BRL"|"USD"|"EUR"}] (salary expectation per employment type; only when the résumé states both the amount and which employment type it refers to, otherwise []; CLT is gross monthly salary, PJ is the monthly invoice amount),
 "idiomas": [{"idioma": string (language name in Portuguese, e.g. "Inglês"), "nivel": "basico"|"intermediario"|"avancado"|"fluente"|"nativo"}],
 "disponibilidade": "imediata"|"15d"|"30d"|"60d"|"90d"|"",
 "objetivo": string (one sentence about their career goal, or "")}`;

export type LeituraCv = { ficha: Ficha; origem: "ia" | "regras"; modelo?: string; aviso?: string };

/** CV em texto → ficha preenchida. Nunca lança: sem IA, volta para as regras. */
export async function lerCv(texto: string, chat: ChatFn | null): Promise<LeituraCv> {
  const bruto = (texto ?? "").slice(0, MAX_CV_CHARS);
  const contatos = contatosDoTexto(bruto);
  if (chat && bruto.trim().length >= 30) {
    try {
      const r = await chat("extract_cv", {
        json: true,
        temperature: 0,
        maxTokens: 4000,
        messages: [
          { role: "system", content: EXTRACT_SYSTEM },
          { role: "user", content: redactContacts(bruto) },
        ],
      });
      const obj = parseJsonObject(r.text);
      if (obj) {
        const ficha = sanitizeFicha({ ...obj, ...contatos });
        return { ficha, origem: "ia", modelo: r.model };
      }
    } catch (e) {
      console.warn("[ficha] leitura pela IA falhou:", e instanceof Error ? e.name : e);
    }
  }
  return { ficha: await lerPorRegras(bruto, contatos), origem: "regras", aviso: "confira_campos" };
}

/** Nome por regras: a primeira linha curta, só com letras (é como quase todo CV começa). */
export function nomeDoTexto(texto: string): string {
  const linha = (texto ?? "").split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? "";
  return /^[\p{L}][\p{L}'.-]*(?:\s+[\p{L}][\p{L}'.-]*){1,5}$/u.test(linha) && linha.length <= 60 ? linha : "";
}

/** As regras às vezes levam a linha inteira ("Analista Cloud, AWS, ...") ou, sem achar cargo, o nome. */
function tituloPorRegras(titulo: string, nome: string): string {
  const t = titulo.split(/\s*[,|;•–—]\s*/)[0].trim();
  if (!t || t === "Profissional de TI" || t.toLowerCase() === nome.trim().toLowerCase()) return "";
  return t;
}

async function lerPorRegras(texto: string, contatos: ReturnType<typeof contatosDoTexto>): Promise<Ficha> {
  const base = { ...fichaVazia(), nome: nomeDoTexto(texto) };
  try {
    const { draft, fallback } = await extractToCanonical(texto, { consent: { iaReescritaV: true } });
    if (!fallback) {
      return sanitizeFicha({
        ...base,
        titulo: tituloPorRegras(draft.titulo, base.nome),
        localidade: draft.localidade,
        modo: draft.modo,
        stack: draft.stack.map((s) => ({ skillId: s.skillId, anos: 0 })),
        ...contatos,
      });
    }
  } catch {
    /* sem texto útil */
  }
  return sanitizeFicha({ ...base, ...contatos });
}

const W2_LANG: Record<string, string> = { "pt-BR": "Brazilian Portuguese", en: "English", es: "Spanish" };

/** Ficha conferida → resumo de 3 linhas + até 3 destaques, no idioma pedido. Lança se a IA falhar. */
export async function gerarFichaW2(ficha: Ficha, idioma: string, chat: ChatFn, now: Date = new Date()): Promise<FichaW2> {
  const lang = W2_LANG[idioma] ? idioma : "pt-BR";
  // Sem nome nem contatos: a IA escreve sobre "o profissional".
  const dados = {
    titulo: ficha.titulo,
    senioridade: ficha.senioridade,
    anosExperiencia: anosExperiencia(ficha, now),
    competencias: topSkills(ficha, 10).map((s) => ({ nome: getSkill(s.skillId)?.label ?? s.skillId, anos: s.anos })),
    experiencias: ficha.experiencias,
    formacao: ficha.formacao,
    idiomas: ficha.idiomas,
    objetivo: ficha.objetivo,
  };
  const r = await chat("ficha_w2", {
    json: true,
    temperature: 0.2,
    maxTokens: 800,
    messages: [
      {
        role: "system",
        content: `You write the standard profile card a recruiter reads in 10 seconds. Reply with one JSON object only: {"resumo": string, "destaques": [string]}.
"resumo": at most 3 short sentences (max 380 characters), objective, third person, no name, no adjectives like "passionate".
"destaques": up to 3 concrete achievements or strengths backed by the data (a number or scope when available), each under 140 characters. Only use facts present in the data; never invent numbers.
${ETICA}
Write in ${W2_LANG[lang]}.`,
      },
      { role: "user", content: JSON.stringify(dados) },
    ],
  });
  const obj = parseJsonObject(r.text);
  const resumo = typeof obj?.resumo === "string" ? obj.resumo.trim() : "";
  if (!resumo) throw new Error("resposta da IA sem resumo");
  const destaques = Array.isArray(obj?.destaques) ? obj!.destaques : [];
  return {
    resumo: resumo.slice(0, 420),
    destaques: destaques.filter((d): d is string => typeof d === "string" && !!d.trim()).map((d) => d.trim().slice(0, 160)).slice(0, 3),
    idioma: lang,
    geradaEm: now.toISOString(),
    modelo: r.model,
    editada: false,
  };
}
