/**
 * Embeddings (1.5.9): vetores de verdade do `@cf/baai/bge-m3` (1024 dimensões),
 * pedidos pelo roteador de IA do 1.5.7 (Workers AI pelo AI Gateway).
 *
 * O bge-m3 é multilíngue e não precisa de prefixo por idioma: o mesmo vetor serve
 * para PT, EN e ES. O `lang` continua na assinatura para quem já o passa.
 */
import { TASKS } from "./ai/tasks";
import { redactContacts } from "./ai/redact";
import { getSkill } from "./taxonomy";

export const EMBEDDING_DIM = 1024;
export const EMBEDDING_MODEL: string = TASKS.embed.defaultWorkersModel;

/** Quem gera os vetores. Em produção é o roteador de IA; nos testes, um falso. */
export type Embedder = (texts: string[]) => Promise<number[][]>;

/** Embedder padrão: o roteador de IA (só carregado quando usado, para não puxar o Prisma nos testes). */
export const routerEmbedder: Embedder = async (texts) => {
  const { getAiRouter } = await import("./ai");
  const out = await getAiRouter().embed("embed", texts);
  // Os vetores guardados e o cache são do bge-m3; outro modelo (rota ou fallback) não é comparável.
  if (out.model !== EMBEDDING_MODEL) {
    throw new Error(`embedding veio de ${out.model}; a busca só aceita ${EMBEDDING_MODEL}`);
  }
  return out.vectors;
};

function checkVector(v: unknown): number[] {
  if (!Array.isArray(v) || v.length !== EMBEDDING_DIM || !v.every((x) => typeof x === "number" && Number.isFinite(x))) {
    throw new Error(`embedding inválido: esperado ${EMBEDDING_DIM} números`);
  }
  return v as number[];
}

/**
 * Gera o vetor de um texto.
 * @param opts.lang - aceito por compatibilidade (o bge-m3 é multilíngue, não usa).
 * @param opts.embed - quem gera (padrão: roteador de IA).
 */
export async function generateEmbedding(text: string, opts?: { lang?: string; embed?: Embedder }): Promise<number[]> {
  void opts?.lang;
  const [v] = await (opts?.embed ?? routerEmbedder)([text]);
  return checkVector(v);
}

/** Gera vetores em lote (uma chamada só ao modelo). */
export async function generateEmbeddings(texts: string[], opts?: { lang?: string; embed?: Embedder }): Promise<number[][]> {
  void opts?.lang;
  if (texts.length === 0) return [];
  const out = await (opts?.embed ?? routerEmbedder)(texts);
  if (out.length !== texts.length) throw new Error("embedding: quantidade de vetores diferente da de textos");
  return out.map(checkVector);
}

/** Similaridade cosseno entre dois vetores. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error("vetores com dimensões diferentes");
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Vetor no formato que o pgvector aceita: "[0.1,0.2,…]". */
export function toVectorLiteral(v: number[]): string {
  return `[${checkVector(v).join(",")}]`;
}

/** SHA-256 em hex (WebCrypto: funciona no Worker e no Node). */
export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Impressão do texto + modelo: se não mudou, o vetor guardado continua valendo. */
export function embeddingHash(text: string, model: string = EMBEDDING_MODEL): Promise<string> {
  return sha256Hex(`${model}\n${text}`);
}

// ── Texto que vira vetor (decisão 2: nunca nome, e-mail ou telefone) ──────────

const MAX_CHARS = 4000;

function skillWords(stack: unknown, withSynonyms: boolean): string[] {
  if (!Array.isArray(stack)) return [];
  const out: string[] = [];
  for (const item of stack) {
    const id = typeof item === "string" ? item : (item as any)?.skillId ?? (item as any)?.id ?? "";
    if (!id) continue;
    const def = getSkill(String(id));
    if (!def) {
      out.push(String(id));
      continue;
    }
    out.push(def.label);
    if (withSynonyms && def.synonyms.length) out.push(def.synonyms.join(", "));
  }
  return out;
}

function list(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((x) => (typeof x === "string" ? x : "")).filter(Boolean);
  return typeof value === "string" && value ? [value] : [];
}

function finish(lines: (string | null | undefined | false)[]): string {
  const text = lines.filter((l): l is string => typeof l === "string" && l.trim().length > 0).join("\n");
  // Rede de segurança: um resumo escrito à mão pode trazer e-mail ou telefone.
  return redactContacts(text).slice(0, MAX_CHARS);
}

type VacancyLike = {
  titulo?: string | null;
  nivel?: string | null;
  regime?: string | null;
  localidade?: string | null;
  tipoContrato?: string | null;
  stack?: unknown;
  descricaoBullets?: unknown;
};

/** Vaga → texto do vetor: título, nível, regime, local, competências (nome + sinônimos) e descrição. */
export function vacancyEmbeddingText(v: VacancyLike): string {
  const skills = skillWords(v.stack, true);
  return finish([
    v.titulo,
    [v.nivel, v.regime, v.tipoContrato].filter(Boolean).join(" · "),
    v.localidade,
    skills.length ? `Competências: ${skills.join("; ")}` : null,
    list(v.descricaoBullets).join("\n"),
  ]);
}

type CandidateLike = {
  titulo?: string | null;
  resumo3linhas?: string | null;
  objetivoCrescimento?: string | null;
  localidade?: string | null;
  modo?: string | null;
  stack?: unknown;
};

/** Perfil → texto do vetor: título, resumo, objetivo, competências e local. Sem nome nem contatos. */
export function candidateEmbeddingText(c: CandidateLike): string {
  const skills = skillWords(c.stack, true);
  return finish([
    c.titulo,
    c.resumo3linhas,
    c.objetivoCrescimento ? `Objetivo: ${c.objetivoCrescimento}` : null,
    skills.length ? `Competências: ${skills.join("; ")}` : null,
    [c.localidade, c.modo].filter(Boolean).join(" · "),
  ]);
}
