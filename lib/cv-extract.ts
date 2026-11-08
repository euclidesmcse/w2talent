/**
 * lib/cv-extract — ingestão CV canônico (Task 3)
 * - parse texto bruto (PDF/DOCX/LinkedIn -> raw string já extraído)
 * - normalização via taxonomy + heuristics
 * - validação objetivoCrescimento, estado draft→ativo, embedding + tsvector no publish
 * Obs: leitura de PDF/DOCX (Workers AI toMarkdown, lib/doc-to-text) fica no ingest — aqui recebe raw text.
 */
import { normalizeSkill, getSkill, SKILLS } from "./taxonomy";
import { generateEmbedding, EMBEDDING_DIM } from "./embeddings";
import { normalizeCelular, isValidCelularBR } from "./auth";

export const FALLBACK_WARNING = "não foi possível extrair, preencha manual";
export const MIN_TEXT_LENGTH = 30;

export type CvStackItem = { skillId: string; nivel?: string; anos?: number };
export type CvDraft = {
  titulo: string;
  resumo3linhas?: string;
  localidade?: string;
  modo?: string;
  regimePreferido?: string[];
  pretensaoDe?: number | null;
  pretensaoAte?: number | null;
  objetivoCrescimento: string;
  stack: CvStackItem[];
  experiencias?: any[];
  formacao?: any[];
  idiomas?: any[];
  links?: any[];
  /** Celular obrigatório E.164 BR (+55...), extraído do CV ou preenchido no preview. */
  celular: string;
  contato?: { celular?: string; email?: string };
  email?: string;
  idiomaOriginal?: string;
};

export type ExtractResult = {
  draft: CvDraft;
  fallback: boolean;
  warning?: string;
};

function httpError(message: string, status: number): Error & { status: number; statusCode: number } {
  const e: any = new Error(message);
  e.status = status;
  e.statusCode = status;
  return e;
}

export function emptyDraft(): CvDraft {
  return {
    titulo: "",
    resumo3linhas: "",
    localidade: "",
    objetivoCrescimento: "",
    celular: "",
    stack: [],
    experiencias: [],
    formacao: [],
    idiomas: [],
    links: [],
  };
}

/**
 * Extrai skillIds normalizados a partir de texto livre.
 * Estratégia: para cada skill, verifica se label/id/sinônimo aparece como substring case-insensitive.
 * Ordena por ordem de aparição no texto para top3 relevante.
 */
export function extractSkillsFromText(text: string): string[] {
  if (!text || typeof text !== "string") return [];
  const lower = text.toLowerCase();
  const found: Array<{ id: string; idx: number }> = [];
  const seen = new Set<string>();

  for (const skill of SKILLS) {
    const keys = [skill.label.toLowerCase(), skill.id.toLowerCase(), ...skill.synonyms.map((s) => s.toLowerCase())];
    let bestIdx = Infinity;
    for (const k of keys) {
      if (!k || k.length < 2) continue;
      // precisa ser substring; para curtos (ex "r", "c") exige word boundary — já filtramos <=1
      // para skills de 2 chars como "go", "r" etc, exige separador
      let idx = -1;
      if (k.length <= 2) {
        // procura com word boundary simples
        const re = new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(k)}(?:[^a-z0-9]|$)`, "i");
        const m = lower.match(re);
        if (m && m.index != null) idx = m.index;
      } else {
        idx = lower.indexOf(k);
      }
      if (idx !== -1 && idx < bestIdx) bestIdx = idx;
    }
    if (bestIdx !== Infinity && !seen.has(skill.id)) {
      seen.add(skill.id);
      found.push({ id: skill.id, idx: bestIdx });
    }
  }
  found.sort((a, b) => a.idx - b.idx);
  return found.map((f) => f.id);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractTitulo(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return "";
  const cargoRe = /engenheiro|analista|desenvolvedor|developer|tech lead|arquiteto|cloud|devops|sre|full.?stack|backend|frontend/i;
  for (const line of lines.slice(0, 5)) {
    if (cargoRe.test(line)) {
      // Se linha tem "Nome — Cargo", prioriza parte com cargo
      const parts = line.split(/[—\-•|]/).map((p) => p.trim()).filter(Boolean);
      for (const part of parts) {
        if (cargoRe.test(part)) return part.slice(0, 80);
      }
      // senão tenta após primeiro separador se existir
      if (parts.length > 1) return parts.slice(1).join(" — ").slice(0, 80);
      return line.slice(0, 80);
    }
  }
  return lines[0].slice(0, 80);
}

function extractObjetivo(text: string): string {
  // procura "Objetivo:" até quebra dupla ou fim da seção
  const m = text.match(/objetivo\s*:?\s*([^\n]+(?:\n[^\n]+){0,2})/i);
  if (m) return m[1].replace(/\s+/g, " ").trim().slice(0, 500);
  // heurística: linha com "quero crescer" / "objetivo"
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (/quero crescer|objetivo|meta de carreira/i.test(line)) {
      return line.replace(/.*objetivo\s*:?\s*/i, "").trim().slice(0, 500) || line.trim().slice(0, 300);
    }
  }
  return "";
}

function extractLocalidade(text: string): string {
  const m = text.match(/São Paulo|Rio de Janeiro|Belo Horizonte|Brasília|Curitiba|Porto Alegre|Recife|remoto/i);
  return m ? m[0] : "";
}

export function extractCelular(text: string): string {
  if (!text) return "";
  // Regex E.164 BR flexível: +55 (11) 9 9999-9999, 11 99999-9999, etc. Normaliza via auth helper
  // Prioriza matches que contenham +55 ou 11 dígitos BR
  const candidates: string[] = [];
  // E.164 explícito
  const e164 = text.match(/\+55\s?\(?\d{2}\)?\s?\d{4,5}[-.\s]?\d{4}/g);
  if (e164) candidates.push(...e164);
  // formato nacional (11) 9xxxx-xxxx ou 9xxxx-xxxx
  if (candidates.length === 0) {
    const nacional = text.match(/\(?\d{2}\)?\s?9\d{4}[-.\s]?\d{4}/g);
    if (nacional) candidates.push(...nacional);
  }
  for (const raw of candidates) {
    const norm = normalizeCelular(raw);
    if (isValidCelularBR(norm)) return norm;
  }
  // último fallback: procura qualquer sequência de 10-11 dígitos com 9 no início do número
  const digitsOnly = text.match(/\d{10,13}/g);
  if (digitsOnly) {
    for (const d of digitsOnly) {
      const norm = normalizeCelular(d);
      if (isValidCelularBR(norm)) return norm;
    }
  }
  return "";
}

/**
 * Core: transforma raw text em draft canônico.
 * LGPD: iaReescritaV obrigatório true, senão 400/403.
 */
export async function extractToCanonical(
  rawText: string,
  opts: { consent?: { iaReescritaV?: boolean } } = {}
): Promise<ExtractResult> {
  const consent = opts?.consent as any;
  if (!consent || consent.iaReescritaV !== true) {
    throw httpError("consentimento iaReescritaV obrigatório para extração por IA (LGPD)", 400);
  }

  const text = (rawText ?? "").toString();
  const trimmed = text.trim();

  if (!trimmed || trimmed.length < MIN_TEXT_LENGTH) {
    return { draft: emptyDraft(), fallback: true, warning: FALLBACK_WARNING };
  }

  // Heurística normal; em produção chamaria OmniRoute LLM para mapear schema
  const titulo = extractTitulo(trimmed);
  const objetivoCrescimento = extractObjetivo(trimmed);
  const localidade = extractLocalidade(trimmed);
  const skillIds = extractSkillsFromText(trimmed);

  const stack: CvStackItem[] = skillIds.map((skillId) => ({
    skillId,
    nivel: "pleno",
    anos: 3,
  }));

  const resumoMatch = trimmed.match(/resumo\s*:?\s*([^\n]+)/i);
  const resumo3linhas = resumoMatch ? resumoMatch[1].trim().slice(0, 300) : trimmed.slice(0, 300).replace(/\s+/g, " ").trim();
  const celular = extractCelular(trimmed);

  const draft: CvDraft = {
    titulo: titulo || "Profissional de TI",
    resumo3linhas,
    localidade,
    modo: /remoto/i.test(trimmed) ? "remoto" : undefined,
    objetivoCrescimento, // pode ficar vazio — validateForPublish exigirá
    celular,
    stack,
    experiencias: [],
    formacao: [],
    idiomas: [],
    links: [],
    idiomaOriginal: "pt-BR",
  };

  return { draft, fallback: false };
}

export function validateForPublish(draft: CvDraft): void {
  if (!draft || typeof draft !== "object") {
    throw httpError("draft inválido", 400);
  }
  const obj = (draft.objetivoCrescimento ?? "").toString().trim();
  if (!obj) {
    throw httpError("objetivoCrescimento obrigatório para publicar CV canônico", 400);
  }
  if (obj.length < 10) {
    throw httpError("objetivoCrescimento muito curto (mín 10 caracteres)", 400);
  }
  // C1: celular obrigatório E.164 BR
  const rawCelular = (draft.celular ?? draft.contato?.celular ?? "").toString().trim();
  if (!rawCelular) {
    throw httpError("celular obrigatório (E.164 BR) para publicar CV canônico", 400);
  }
  const norm = normalizeCelular(rawCelular);
  if (!isValidCelularBR(norm)) {
    throw httpError("celular inválido, use formato E.164 BR (+55...)", 400);
  }
  // normaliza in-place para downstream
  (draft as any).celular = norm;
  if (draft.contato) draft.contato.celular = norm;
}

/**
 * Gera texto para tsvector: concatena campos relevantes.
 */
export function buildTsvectorText(draft: CvDraft): string {
  const parts: string[] = [];
  if (draft.titulo) parts.push(draft.titulo);
  if (draft.resumo3linhas) parts.push(draft.resumo3linhas);
  if (draft.objetivoCrescimento) parts.push(draft.objetivoCrescimento);
  if (draft.localidade) parts.push(draft.localidade);
  if (Array.isArray(draft.stack)) {
    for (const item of draft.stack) {
      const def = getSkill(item.skillId);
      parts.push(def ? def.label : item.skillId);
      parts.push(item.skillId);
    }
  }
  if (Array.isArray(draft.experiencias)) {
    for (const exp of draft.experiencias) {
      if (exp?.cargo) parts.push(exp.cargo);
      if (exp?.empresa) parts.push(exp.empresa);
    }
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Publica draft -> gera embedding + tsvector.
 * Valida objetivoCrescimento; em produção persistiria no Postgres (pgvector + tsvector).
 */
export async function publishDraft(draft: CvDraft): Promise<{
  draft: CvDraft;
  embedding: number[];
  tsvector: string;
  status: "ativo";
}> {
  validateForPublish(draft);
  const tsvector = buildTsvectorText(draft);
  const embedding = await generateEmbedding(tsvector || draft.titulo || "cv");
  if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIM) {
    throw httpError(`embedding inválido: esperado ${EMBEDDING_DIM} dims`, 500);
  }
  return { draft, embedding, tsvector, status: "ativo" };
}
