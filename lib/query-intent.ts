/**
 * "A IA entendeu" (1.5.12): lê o texto da busca de vagas e separa o que é critério.
 *
 * Decisão do Euclides em 2026-11-09: regras, sem modelo de linguagem (custo zero, resposta na hora,
 * sempre igual para o mesmo texto). Usa a taxonomia de competências e listas fixas em PT/EN/ES.
 *
 * - Competências saem do texto e viram um grupo "qualquer uma destas" na busca; cada uma conta no match.
 * - Regime, modelo, nível e faixa saem do texto e só contam no match (não escondem vagas).
 * - Idioma vira chip, mas não filtra nem conta no match: a vaga não tem campo de idioma.
 * - Frases entre aspas, termos com "-" e buscas com "or" ficam como estão.
 */
import { getSkill, normalizeSkill } from "./taxonomy";

export type Regime = "CLT" | "PJ" | "Estágio";
export type Modo = "remoto" | "hibrido" | "presencial";
export type Nivel = "Júnior" | "Pleno" | "Sênior";
export type Idioma = "en" | "es";

/** Trecho do texto buscado (já normalizado) que gerou o chip: [start, end). */
type Span = { source: string; start: number; end: number };

export type IntentChip = Span &
  (
    | { kind: "skill"; value: string }
    | { kind: "regime"; value: Regime }
    | { kind: "modo"; value: Modo }
    | { kind: "nivel"; value: Nivel }
    | { kind: "faixa"; value: number }
    | { kind: "idioma"; value: Idioma }
    /** Palavra ou frase que segue como busca por texto. */
    | { kind: "texto"; value: string }
  );

/** Só as chaves declaradas (nunca "constructor", "__proto__"…). */
function own<T>(dict: Record<string, T>, key: string): T | undefined {
  return Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : undefined;
}

/** Trechos entre aspas: ficam exatamente como a pessoa escreveu. */
function quotedRanges(q: string): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const re = /"[^"]*"?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(q))) out.push([m.index, m.index + m[0].length]);
  return out;
}

export type QueryIntent = {
  skills: string[];
  regime?: Regime;
  modo?: Modo;
  nivel?: Nivel;
  /** Valor mínimo pedido (mensal, na moeda da vaga). */
  faixaMin?: number;
  idiomas: Idioma[];
  /** Texto que continua indo para a busca por texto. */
  rest: string;
  /** Na ordem em que aparecem no texto. */
  chips: IntentChip[];
};

/** Sem acento e em minúsculas, para comparar. */
export function fold(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

// Frases antes das palavras soltas. Chave sem acento.
const REGIME: Record<string, Regime> = {
  "pessoa juridica": "PJ", pj: "PJ", contractor: "PJ",
  clt: "CLT", efetivo: "CLT",
  estagio: "Estágio", estagiario: "Estágio", estagiaria: "Estágio", internship: "Estágio", intern: "Estágio",
  trainee: "Estágio", pasantia: "Estágio", pasante: "Estágio", practicas: "Estágio",
};
const MODO: Record<string, Modo> = {
  "home office": "remoto", remoto: "remoto", remota: "remoto", remote: "remoto", teletrabajo: "remoto",
  hibrido: "hibrido", hibrida: "hibrido", hybrid: "hibrido",
  presencial: "presencial", "on-site": "presencial", onsite: "presencial", "in-office": "presencial",
};
const NIVEL: Record<string, Nivel> = {
  junior: "Júnior", jr: "Júnior",
  pleno: "Pleno", "mid-level": "Pleno", "mid level": "Pleno", mid: "Pleno", "semi senior": "Pleno", "semi-senior": "Pleno", ssr: "Pleno",
  senior: "Sênior", sr: "Sênior",
};
const IDIOMA: Record<string, Idioma> = {
  ingles: "en", english: "en",
  espanhol: "es", spanish: "es", espanol: "es", castellano: "es",
};

/**
 * Competências cujo nome também é palavra comum ("go", "make", "chef"…). Só contam quando a pessoa
 * escreve como o nome da competência ("Go", "Chef") ou junto de outra competência ("aws go").
 */
const AMBIGUOUS_SKILLS = new Set(["go", "c", "r-lang", "make", "chef", "ant", "flux", "harness", "drone-ci", "puppet", "bamboo", "swift", "rust", "dart", "spring", "rest", "express", "next", "nest", "ember", "meteor", "sentry", "prefect", "arthas", "earthly", "yarn", "git"]);

/** Palavras de ligação: seguem no texto, mas não viram chip. */
const STOPWORDS = new Set(["de", "da", "do", "das", "dos", "e", "em", "com", "para", "por", "na", "no", "a", "o", "as", "os", "um", "uma", "the", "of", "and", "in", "for", "with", "an", "y", "en", "el", "la", "los", "las", "con", "del"]);

type Tok = { text: string; start: number; end: number; used: boolean; locked: boolean };

function tokenize(q: string): Tok[] {
  const out: Tok[] = [];
  // Frase entre aspas é um token só e travado; "-termo" também fica travado.
  const re = /"[^"]*"?|\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(q))) {
    const raw = m[0];
    // Pontuação no fim ("aws," "remoto.") não faz parte do termo; "c++", "c#" e "node.js" ficam.
    const trimmed = raw.startsWith('"') ? raw : raw.replace(/[,;:!?.)]+$/, "").replace(/^[(]+/, "");
    const lead = raw.indexOf(trimmed);
    out.push({
      text: trimmed,
      start: m.index + Math.max(0, lead),
      end: m.index + Math.max(0, lead) + trimmed.length,
      used: false,
      locked: raw.startsWith('"') || raw.startsWith("-"),
    });
  }
  return out.filter((t) => t.text.length > 0);
}

// "15k", "15 mil", "R$ 15.000", "15.000", "acima de 15k", "≥ 15k", "$5000".
const MONEY_RE =
  /(?:(?:acima de|a partir de|mais de|pelo menos|minimo de|mínimo de|from|over|at least|desde|mas de|más de|minimo|mínimo|min\.?|>=|≥|>)\s*)?(?:(?:r\$|us\$|\$|€|£)\s*)?(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)\s*(k|mil|thousand)?(?![\p{L}\p{N}])/giu;

function parseMoney(q: string): { value: number; start: number; end: number } | null {
  MONEY_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MONEY_RE.exec(q))) {
    const full = m[0];
    const hasCurrency = /r\$|us\$|\$|€|£/i.test(full);
    const mult = m[2] ? 1000 : 1;
    const digits = m[1];
    const grouped = /^\d{1,3}(?:[.,]\d{3})+$/.test(digits);
    const n = grouped ? Number(digits.replace(/[.,]/g, "")) : Number(digits.replace(",", "."));
    // Número solto sem moeda nem "k/mil" só conta se já for um valor de salário (4 dígitos ou mais).
    if (!hasCurrency && !m[2] && (n < 1000 || (n >= 1900 && n <= 2100))) continue; // "2024" é ano
    const value = Math.round(n * mult);
    if (!Number.isFinite(value) || value <= 0) continue;
    const end = m.index + full.trimEnd().length;
    if (quotedRanges(q).some(([a, b]) => m!.index < b && end > a)) continue; // "ISO 27001"
    const before = q[m.index - 1];
    if (before && /[\p{L}\p{N}-]/u.test(before)) continue; // "-15k" ou parte de outra palavra
    return { value, start: m.index, end };
  }
  return null;
}

/** Procura frases de 1 a 3 tokens livres que estejam no dicionário. */
function matchPhrases<T>(toks: Tok[], dict: Record<string, T>, onHit: (value: T, span: Span) => void) {
  for (let n = 3; n >= 1; n--) {
    for (let i = 0; i + n <= toks.length; i++) {
      const span = toks.slice(i, i + n);
      if (span.some((t) => t.used || t.locked)) continue;
      const key = fold(span.map((t) => t.text).join(" "));
      const value = own(dict, key);
      if (value === undefined) continue;
      span.forEach((t) => (t.used = true));
      onHit(value, spanOf(span));
    }
  }
}

function spanOf(span: Tok[]): Span {
  return { source: span.map((t) => t.text).join(" "), start: span[0].start, end: span[span.length - 1].end };
}

/** Busca com "or": vale o texto inteiro, sem chips. */
export function hasOr(q: string): boolean {
  return /(^|\s)or(\s|$)/i.test(q);
}

export function parseQueryIntent(input: string | undefined | null): QueryIntent {
  const q = (input ?? "").trim().replace(/\s+/g, " ");
  const out: QueryIntent = { skills: [], idiomas: [], rest: q, chips: [] };
  if (!q || hasOr(q)) return out;

  const found: IntentChip[] = [];
  let text = q;

  // 1. Faixa (no texto inteiro, antes de quebrar em palavras)
  const money = parseMoney(text);
  if (money) {
    const source = text.slice(money.start, money.end);
    found.push({ kind: "faixa", value: money.value, source, start: money.start, end: money.end });
    out.faixaMin = money.value;
    text = text.slice(0, money.start) + " ".repeat(money.end - money.start) + text.slice(money.end);
  }

  const toks = tokenize(text);

  // 2. Regime, modelo, nível, idioma (frases primeiro)
  matchPhrases(toks, REGIME, (v, sp) => {
    if (out.regime) return;
    out.regime = v;
    found.push({ kind: "regime", value: v, ...sp });
  });
  matchPhrases(toks, MODO, (v, sp) => {
    if (out.modo) return;
    out.modo = v;
    found.push({ kind: "modo", value: v, ...sp });
  });
  matchPhrases(toks, NIVEL, (v, sp) => {
    if (out.nivel) return;
    out.nivel = v;
    found.push({ kind: "nivel", value: v, ...sp });
  });
  const idiomaToks: Tok[] = [];
  matchPhrases(toks, IDIOMA, (v, sp) => {
    if (!out.idiomas.includes(v)) out.idiomas.push(v);
    found.push({ kind: "idioma", value: v, ...sp });
  });
  // Idioma sai do texto obrigatório: a vaga não tem campo de idioma, e exigir a palavra "inglês"
  // escondia quase todas. Ele continua no texto do vetor (q inteiro), que só reordena.
  for (const t of toks) if (t.used && own(IDIOMA, fold(t.text))) idiomaToks.push(t);
  const idiomaSet = new Set(idiomaToks);

  // 3. Competências (frases de até 3 palavras, a mais longa primeiro)
  const hits: Array<{ id: string; span: Tok[]; source: string; ambiguousOk: boolean }> = [];
  for (let n = 3; n >= 1; n--) {
    for (let i = 0; i + n <= toks.length; i++) {
      const span = toks.slice(i, i + n);
      if (span.some((t) => t.used || t.locked || idiomaSet.has(t))) continue;
      const source = span.map((t) => t.text).join(" ");
      const id = normalizeSkill(source);
      if (!id) continue;
      const label = getSkill(id)?.label ?? "";
      hits.push({ id, span, source, ambiguousOk: source === label });
      span.forEach((t) => (t.used = true));
    }
  }
  const clear = hits.filter((h) => !AMBIGUOUS_SKILLS.has(h.id));
  for (const h of hits) {
    const ok = !AMBIGUOUS_SKILLS.has(h.id) || h.ambiguousOk || clear.length > 0;
    if (!ok) {
      h.span.forEach((t) => (t.used = false));
      continue;
    }
    if (out.skills.includes(h.id)) continue;
    out.skills.push(h.id);
    found.push({ kind: "skill", value: h.id, ...spanOf(h.span) });
  }

  const free = toks.filter((t) => !t.used);
  // Só palavras de ligação sobrando ("remoto de PJ"): não há texto para buscar.
  out.rest = free.every((t) => STOPWORDS.has(fold(t.text))) ? "" : free.map((t) => t.text).join(" ").trim();
  // Posição vem do próprio token: a mesma palavra pode aparecer duas vezes.
  for (const t of free) if (!idiomaSet.has(t) && !STOPWORDS.has(fold(t.text))) found.push({ kind: "texto", value: t.text, source: t.text, start: t.start, end: t.end });
  out.chips = found.sort((a, b) => a.start - b.start);
  return out;
}

/** Tira o trecho de um chip do texto buscado (o × do chip). */
export function removeChipFromQuery(q: string, chip: Pick<IntentChip, "source" | "start" | "end">): string {
  // O trecho exato do chip ("javascript java": tirar Java não pode mexer em JavaScript).
  const norm = q.trim().replace(/\s+/g, " ");
  if (norm.slice(chip.start, chip.end) === chip.source) {
    return (norm.slice(0, chip.start) + " " + norm.slice(chip.end)).replace(/\s+/g, " ").trim();
  }
  const i = q.indexOf(chip.source);
  if (i < 0) return q;
  return (q.slice(0, i) + " " + q.slice(i + chip.source.length)).replace(/\s+/g, " ").trim();
}

/** Termos de texto de uma competência (id e nome), para achar a vaga pelo texto. */
export function skillTextTerms(id: string): string[] {
  const s = getSkill(id);
  const terms = new Set<string>([id.replace(/-/g, " ")]);
  if (s) {
    terms.add(s.label);
    for (const syn of s.synonyms) if (syn.length > 2) terms.add(syn);
  }
  return [...terms];
}
