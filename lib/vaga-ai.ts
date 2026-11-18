/**
 * Publicar vaga (2.1b, plano 2.1 aprovado em 2026-11-18): o recrutador cola o texto da vaga e a IA
 * (`extract_vacancy`) monta os campos. Se a IA falhar (fora do ar, orçamento do dia, JSON ruim),
 * as regras leem o que der e o recrutador completa. Nada é salvo aqui: a tela mostra para conferir.
 * E-mail e telefone saem do texto antes de qualquer chamada (a vaga não precisa deles).
 */
import type { ChatRequest, ChatResult } from "./ai/types";
import { redactContacts } from "./ai/redact";
import { extractSkillsFromText } from "./cv-extract";
import { parseJsonObject } from "./ficha-ai";
import { normalizeSkill } from "./taxonomy";
import { fold } from "./query-intent";
import { MODOS, MOEDAS, NIVEIS, REGIMES, rascunhoVazio, type ModoVaga, type Nivel, type RascunhoVaga, type RegimeVaga } from "./vaga-campos";

export * from "./vaga-campos";

export const MAX_TEXTO_VAGA = 20_000;
export const MIN_TEXTO_VAGA = 40;
const MAX_BULLETS = 12;
const MAX_SKILLS = 12;
const MAX_FAIXA = 1_000_000;

export type ChatVagaFn = (task: "extract_vacancy", req: ChatRequest) => Promise<ChatResult & { model?: string }>;
export type LeituraVaga = { vaga: RascunhoVaga; origem: "ia" | "regras" };

// ── Limpeza do que vem da IA ou da tela ─────────────────────────────────────

const NIVEL_POR_CHAVE: Record<string, Nivel> = {
  estagio: "Estágio", estagiario: "Estágio", intern: "Estágio", internship: "Estágio", trainee: "Estágio", pasantia: "Estágio", practicante: "Estágio",
  junior: "Júnior", jr: "Júnior",
  pleno: "Pleno", mid: "Pleno", "mid-level": "Pleno", "mid level": "Pleno", intermediate: "Pleno", semisenior: "Pleno", "semi senior": "Pleno", "semi-senior": "Pleno",
  senior: "Sênior", sr: "Sênior",
  especialista: "Especialista", specialist: "Especialista", staff: "Especialista", principal: "Especialista", lead: "Especialista", lider: "Especialista", lideranca: "Especialista",
};

const REGIME_POR_CHAVE: Record<string, RegimeVaga> = {
  clt: "CLT", efetivo: "CLT", "full-time employee": "CLT",
  pj: "PJ", "pessoa juridica": "PJ", contractor: "PJ",
  estagio: "Estágio", internship: "Estágio",
  freelancer: "Freelancer", freela: "Freelancer", freelance: "Freelancer",
};

const MODO_POR_CHAVE: Record<string, ModoVaga> = {
  remoto: "remoto", remote: "remoto", "home office": "remoto", teletrabajo: "remoto",
  hibrido: "hibrido", hybrid: "hibrido",
  presencial: "presencial", "on-site": "presencial", onsite: "presencial", "on site": "presencial",
};

function chave(v: unknown): string {
  return typeof v === "string" ? fold(v).replace(/[^a-z\s-]/g, "").trim() : "";
}

function texto(v: unknown, max: number): string {
  return typeof v === "string" ? redactContacts(v.replace(/\s+/g, " ").trim()).slice(0, max) : "";
}

function numero(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v.replace(/[^\d.,]/g, "").replace(/[.,](?=\d{3}\b)/g, "").replace(",", ".")) : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  const r = Math.round(n);
  return r > 0 && r <= MAX_FAIXA ? r : null;
}

function lista(v: unknown, max: number): string[] {
  const arr = Array.isArray(v) ? v : typeof v === "string" ? v.split(/\r?\n/) : [];
  const out: string[] = [];
  for (const item of arr) {
    const s = texto(item, 200).replace(/^[-•*·–—\d.)\s]+/, "").trim();
    if (s && !out.includes(s)) out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

function skills(v: unknown): string[] {
  const arr = Array.isArray(v) ? v : [];
  const out: string[] = [];
  for (const item of arr) {
    const nome = typeof item === "string" ? item : (item as { nome?: unknown; skillId?: unknown })?.skillId ?? (item as { nome?: unknown })?.nome;
    if (typeof nome !== "string" || !nome.trim()) continue;
    const id = normalizeSkill(nome.trim());
    if (id && !out.includes(id)) out.push(id);
    if (out.length >= MAX_SKILLS) break;
  }
  return out;
}

/** Confere e limpa um rascunho (da IA ou da tela). O que não serve vira vazio. */
export function sanitizarRascunho(input: unknown): RascunhoVaga {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  let faixaDe = numero(o.faixaDe);
  let faixaAte = numero(o.faixaAte);
  if (faixaDe !== null && faixaAte !== null && faixaDe > faixaAte) [faixaDe, faixaAte] = [faixaAte, faixaDe];
  const moeda = typeof o.faixaMoeda === "string" ? o.faixaMoeda.trim().toUpperCase() : "";
  return {
    titulo: texto(o.titulo, 120),
    nivel: NIVEIS.includes(o.nivel as Nivel) ? (o.nivel as Nivel) : NIVEL_POR_CHAVE[chave(o.nivel)] ?? "",
    regime: REGIMES.includes(o.regime as RegimeVaga) ? (o.regime as RegimeVaga) : REGIME_POR_CHAVE[chave(o.regime)] ?? "",
    cidade: texto(o.cidade, 80),
    modo: MODOS.includes(o.modo as ModoVaga) ? (o.modo as ModoVaga) : MODO_POR_CHAVE[chave(o.modo)] ?? "",
    stack: skills(o.stack),
    faixaDe,
    faixaAte,
    faixaMoeda: (MOEDAS as readonly string[]).includes(moeda) ? (moeda as RascunhoVaga["faixaMoeda"]) : "BRL",
    descricaoBullets: lista(o.descricaoBullets, MAX_BULLETS),
    beneficios: lista(o.beneficios, MAX_BULLETS),
  };
}

// ── Leitura pela IA ────────────────────────────────────────────────────────

const SYSTEM = `You extract a job posting into JSON for a recruiting platform. Reply with one JSON object only.
Copy facts from the posting; never invent requirements, salary or benefits. Unknown values: "" for text, null for numbers, [] for lists.
Write text values in the language of the posting.
Schema:
{"titulo": string (job title only, without company name, max 120 characters),
 "nivel": "Estágio"|"Júnior"|"Pleno"|"Sênior"|"Especialista"|"",
 "regime": "CLT"|"PJ"|"Estágio"|"Freelancer"|"",
 "cidade": string ("City" or "City, State"; "" when fully remote or not stated),
 "modo": "remoto"|"hibrido"|"presencial"|"",
 "stack": [string] (technical skills and tools the posting asks for, most important first, at most 12),
 "faixaDe": number|null, "faixaAte": number|null (monthly salary range as written; one value goes in both),
 "faixaMoeda": "BRL"|"USD"|"EUR",
 "descricaoBullets": [string] (responsibilities and requirements, one short sentence each, at most 12),
 "beneficios": [string] (benefits, at most 12)}`;

/** Texto colado → rascunho da vaga. Nunca lança: sem IA, volta para as regras. */
export async function lerVaga(textoBruto: string, chat: ChatVagaFn | null): Promise<LeituraVaga> {
  const bruto = redactContacts((textoBruto ?? "").slice(0, MAX_TEXTO_VAGA));
  if (chat && bruto.trim().length >= MIN_TEXTO_VAGA) {
    try {
      const r = await chat("extract_vacancy", {
        json: true,
        temperature: 0,
        maxTokens: 2500,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: bruto },
        ],
      });
      const obj = parseJsonObject(r.text);
      if (obj) {
        const vaga = sanitizarRascunho(obj);
        // Competência que a IA não trouxe, mas o texto cita pelo nome, entra pelas regras.
        if (!vaga.stack.length) vaga.stack = extractSkillsFromText(bruto).slice(0, MAX_SKILLS);
        if (vaga.titulo) return { vaga, origem: "ia" };
      }
    } catch (e) {
      console.warn("[vaga] leitura pela IA falhou:", e instanceof Error ? e.name : e);
    }
  }
  return { vaga: lerPorRegras(bruto), origem: "regras" };
}

// ── Regras (reserva) ───────────────────────────────────────────────────────

const CABECALHO = /^(?:requisitos|requirements|requisitos obrigat[oó]rios|responsabilidades|responsibilities|atividades|o que voc[eê] vai fazer|diferenciais|nice to have|qualifica[cç][oõ]es|descri[cç][aã]o|sobre a vaga|about the role|benef[ií]cios|benefits|beneficios|oferecemos|we offer)\s*:?\s*$/i;
const CABECALHO_BENEFICIOS = /^(?:benef[ií]cios|benefits|beneficios|oferecemos|we offer)\s*:?\s*$/i;
const ITEM = /^\s*(?:[-•*·–—]|\d+[.)])\s+/;

function primeiro<T>(texto: string, mapa: Record<string, T>): T | "" {
  const f = ` ${fold(texto)} `;
  let melhor: { idx: number; v: T } | null = null;
  for (const [k, v] of Object.entries(mapa)) {
    const re = new RegExp(`[^a-z]${k.replace(/[-\s]/g, "[-\\s]")}[^a-z]`);
    const m = re.exec(f);
    if (m && (!melhor || m.index < melhor.idx)) melhor = { idx: m.index, v };
  }
  return melhor ? melhor.v : "";
}

const CIDADES = ["São Paulo", "Rio de Janeiro", "Belo Horizonte", "Brasília", "Curitiba", "Porto Alegre", "Recife", "Salvador", "Fortaleza", "Florianópolis", "Campinas", "Goiânia", "Manaus", "Belém", "Vitória", "Lisboa", "Porto"];

/** "R$ 8.000 a R$ 12.000", "8k - 12k", "até R$ 10 mil". */
export function faixaDoTexto(t: string): { de: number | null; ate: number | null } {
  const valor = (s: string, mil: boolean) => {
    const n = Number(s.replace(/[.,](?=\d{3}\b)/g, "").replace(",", "."));
    return numero(mil ? n * 1000 : n);
  };
  const NUM = String.raw`(\d{1,3}(?:[.,]\d{3})+|\d+(?:,\d{1,2})?)\s*(k|mil)?`;
  const par = new RegExp(String.raw`(?:R\$|US\$|\$|€)?\s*${NUM}\s*(?:a|at[eé]|-|–|to)\s*(?:R\$|US\$|\$|€)?\s*${NUM}`, "i");
  const linhas = t.split(/\r?\n/).filter((l) => /sal[aá]rio|salary|faixa|remunera|R\$|US\$|€|\bk\b|mil\b/i.test(l));
  for (const l of linhas) {
    const m = par.exec(l);
    if (m) {
      const de = valor(m[1], !!m[2] || !!m[4]);
      const ate = valor(m[3], !!m[4] || !!m[2]);
      if (de && ate && de >= 500) return de <= ate ? { de, ate } : { de: ate, ate: de };
    }
    const um = new RegExp(String.raw`(?:R\$|US\$|€)\s*${NUM}`, "i").exec(l);
    if (um) {
      const v = valor(um[1], !!um[2]);
      if (v && v >= 500) return /at[eé]|up to|hasta/i.test(l) ? { de: null, ate: v } : { de: v, ate: v };
    }
  }
  return { de: null, ate: null };
}

function lerPorRegras(t: string): RascunhoVaga {
  const v = rascunhoVazio();
  const linhas = t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const tituloLinha = linhas.find((l) => !CABECALHO.test(l) && l.length <= 140) ?? "";
  v.titulo = texto(tituloLinha.replace(/^(?:vaga|cargo|position|job title)\s*:\s*/i, ""), 120);
  v.nivel = primeiro(t, NIVEL_POR_CHAVE);
  v.regime = primeiro(t, REGIME_POR_CHAVE);
  v.modo = primeiro(t, MODO_POR_CHAVE);
  const cidade = CIDADES.find((c) => new RegExp(`\\b${c}\\b`, "i").test(t));
  v.cidade = cidade ?? "";
  v.stack = extractSkillsFromText(t).slice(0, MAX_SKILLS);
  const f = faixaDoTexto(t);
  v.faixaDe = f.de;
  v.faixaAte = f.ate;
  if (/US\$|USD/.test(t)) v.faixaMoeda = "USD";
  else if (/€|EUR/.test(t)) v.faixaMoeda = "EUR";
  let emBeneficios = false;
  const desc: string[] = [];
  const ben: string[] = [];
  for (const l of linhas) {
    if (CABECALHO.test(l)) {
      emBeneficios = CABECALHO_BENEFICIOS.test(l);
      continue;
    }
    if (!ITEM.test(l)) continue;
    (emBeneficios ? ben : desc).push(l);
  }
  v.descricaoBullets = lista(desc, MAX_BULLETS);
  v.beneficios = lista(ben, MAX_BULLETS);
  return v;
}
