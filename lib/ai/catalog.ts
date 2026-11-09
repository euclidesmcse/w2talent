/**
 * Lista os modelos de uma API cadastrada (1.5.8), pelo AI Gateway quando o fornecedor tem caminho lá.
 * Devolve só o que a API informa (id, contexto, se é de embeddings); o preço vem de prices.ts.
 */
import { AiProviderError, type CallContext } from "./types";
import { getJson, providerUrl } from "./providers/http";
import { TEXT_MODEL } from "./tasks";

export type ListedModel = { modelo: string; contexto?: number | null; embedding: boolean };

/** Modelos do Workers AI que o app sabe usar. O binding não lista modelos; esta lista é a referência. */
export const WORKERS_AI_MODELS: ListedModel[] = [
  { modelo: TEXT_MODEL, contexto: 131_072, embedding: false },
  { modelo: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", contexto: 24_000, embedding: false },
  { modelo: "@cf/mistralai/mistral-small-3.1-24b-instruct", contexto: 128_000, embedding: false },
  { modelo: "@cf/baai/bge-m3", contexto: 8_192, embedding: true },
];

/** Nome sugere modelo de embeddings (quando a API não diz). */
export function looksLikeEmbedding(id: string): boolean {
  return /embed|bge-|e5-|gte-|nomic/i.test(id);
}

/** Modelos que não servem para texto nem embeddings (imagem, áudio, moderação…). */
function irrelevant(id: string): boolean {
  return /dall-e|whisper|tts|audio|realtime|image|moderation|transcribe|search-preview|computer-use|veo|imagen/i.test(id);
}

const MAX_MODELS = 300;

export async function listModels(ctx: Omit<CallContext, "model">): Promise<ListedModel[]> {
  const c = { ...ctx, model: "" } as CallContext;
  let out: ListedModel[];
  switch (ctx.kind) {
    case "WORKERS_AI":
      return WORKERS_AI_MODELS;
    case "OPENAI_COMPATIBLE": {
      if (!ctx.apiKey) throw new AiProviderError("fornecedor sem chave de API");
      const r = await getJson(c, providerUrl(c, "/models"), { authorization: `Bearer ${ctx.apiKey}` });
      const data: any[] = Array.isArray(r?.data) ? r.data : [];
      out = data
        .filter((m) => typeof m?.id === "string")
        .map((m) => ({
          modelo: m.id as string,
          // OpenRouter e outros informam o contexto; a OpenAI não.
          contexto: Number.isFinite(m.context_length) ? m.context_length : Number.isFinite(m.context_window) ? m.context_window : null,
          embedding: looksLikeEmbedding(m.id),
        }));
      break;
    }
    case "ANTHROPIC": {
      if (!ctx.apiKey) throw new AiProviderError("fornecedor sem chave de API");
      const r = await getJson(c, providerUrl(c, "/v1/models?limit=100"), { "x-api-key": ctx.apiKey, "anthropic-version": "2023-06-01" });
      const data: any[] = Array.isArray(r?.data) ? r.data : [];
      out = data.filter((m) => typeof m?.id === "string").map((m) => ({ modelo: m.id as string, contexto: null, embedding: false }));
      break;
    }
    case "GOOGLE": {
      if (!ctx.apiKey) throw new AiProviderError("fornecedor sem chave de API");
      const r = await getJson(c, providerUrl(c, "/v1beta/models?pageSize=1000"), { "x-goog-api-key": ctx.apiKey });
      const data: any[] = Array.isArray(r?.models) ? r.models : [];
      out = data
        .filter((m) => typeof m?.name === "string")
        .map((m) => {
          const methods: string[] = Array.isArray(m.supportedGenerationMethods) ? m.supportedGenerationMethods : [];
          return {
            modelo: (m.name as string).replace(/^models\//, ""),
            contexto: Number.isFinite(m.inputTokenLimit) ? m.inputTokenLimit : null,
            embedding: methods.includes("embedContent") && !methods.includes("generateContent"),
          };
        });
      break;
    }
    default:
      throw new AiProviderError("tipo de API desconhecido");
  }
  return out.filter((m) => !irrelevant(m.modelo)).sort((a, b) => a.modelo.localeCompare(b.modelo)).slice(0, MAX_MODELS);
}
