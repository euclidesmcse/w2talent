/**
 * Preços de referência (US$ por milhão de tokens) para preencher os modelos listados (1.5.8).
 * Os fornecedores não informam preço pela API. Decisão de 2026-11-09: a tabela vem preenchida e o
 * admin pode editar cada modelo na tela; modelo sem preço não entra na escolha automática.
 * Valores de referência de novembro de 2026: confira no site do fornecedor antes de confiar.
 */
import { WORKERS_AI_PRICES } from "./tasks";

export type KnownPrice = { in: number; out: number; context?: number; dim?: number };

/** Chave: id do modelo no fornecedor, sem prefixo "models/". Casa também com sufixos de data ("-2025-04-14"). */
export const KNOWN_PRICES: Record<string, KnownPrice> = {
  // OpenAI
  "gpt-4.1": { in: 2, out: 8, context: 1_047_576 },
  "gpt-4.1-mini": { in: 0.4, out: 1.6, context: 1_047_576 },
  "gpt-4.1-nano": { in: 0.1, out: 0.4, context: 1_047_576 },
  "gpt-4o": { in: 2.5, out: 10, context: 128_000 },
  "gpt-4o-mini": { in: 0.15, out: 0.6, context: 128_000 },
  "text-embedding-3-small": { in: 0.02, out: 0, dim: 1536 },
  "text-embedding-3-large": { in: 0.13, out: 0, dim: 3072 },
  // DeepSeek
  "deepseek-chat": { in: 0.27, out: 1.1, context: 64_000 },
  "deepseek-reasoner": { in: 0.55, out: 2.19, context: 64_000 },
  // Google
  "gemini-2.0-flash": { in: 0.1, out: 0.4, context: 1_048_576 },
  "gemini-2.5-flash": { in: 0.3, out: 2.5, context: 1_048_576 },
  "gemini-2.5-pro": { in: 1.25, out: 10, context: 1_048_576 },
  // Workers AI (os padrões do app ficam em tasks.ts)
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast": { in: 0.29, out: 2.25, context: 24_000 },
  "@cf/mistralai/mistral-small-3.1-24b-instruct": { in: 0.35, out: 0.56, context: 128_000 },
  // Anthropic
  "claude-3-5-haiku": { in: 0.8, out: 4, context: 200_000 },
  "claude-sonnet-4": { in: 3, out: 15, context: 200_000 },
};

/** Preço conhecido de um modelo (ou null). Workers AI usa a tabela do roteador. */
export function knownPrice(model: string): KnownPrice | null {
  const id = model.replace(/^models\//, "");
  const w = Object.prototype.hasOwnProperty.call(WORKERS_AI_PRICES, id) ? WORKERS_AI_PRICES[id] : undefined;
  if (w) return { in: w.in, out: w.out, dim: w.dim };
  if (Object.prototype.hasOwnProperty.call(KNOWN_PRICES, id)) return KNOWN_PRICES[id];
  // "gpt-4.1-mini-2025-04-14", "claude-3-5-haiku-20241022", "claude-3-5-haiku-latest"
  const base = id.replace(/-(?:\d{4}-\d{2}-\d{2}|\d{8}|latest)$/, "");
  return Object.prototype.hasOwnProperty.call(KNOWN_PRICES, base) ? KNOWN_PRICES[base] : null;
}
