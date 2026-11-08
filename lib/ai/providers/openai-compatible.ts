import { AiProviderError, type CallContext, type ChatRequest, type ChatResult, type EmbedResult } from "../types";
import { postJson, providerUrl } from "./http";

/** Padrão "compatível com OpenAI": OpenAI, OpenRouter, DeepSeek, Kimi, Qwen, Groq, Mistral, Together… */
function auth(ctx: CallContext): Record<string, string> {
  if (!ctx.apiKey) throw new AiProviderError("fornecedor sem chave de API");
  return { authorization: `Bearer ${ctx.apiKey}` };
}

export async function chat(ctx: CallContext, req: ChatRequest): Promise<ChatResult> {
  const body: Record<string, unknown> = { model: ctx.model, messages: req.messages };
  if (req.maxTokens) body.max_tokens = req.maxTokens;
  if (req.temperature !== undefined) body.temperature = req.temperature;
  if (req.json) body.response_format = { type: "json_object" };
  const out = await postJson(ctx, providerUrl(ctx, "/chat/completions"), body, auth(ctx));
  const text = out?.choices?.[0]?.message?.content;
  if (typeof text !== "string") throw new AiProviderError("resposta sem texto");
  return { text, tokensIn: out.usage?.prompt_tokens, tokensOut: out.usage?.completion_tokens };
}

export async function embed(ctx: CallContext, texts: string[]): Promise<EmbedResult> {
  const out = await postJson(ctx, providerUrl(ctx, "/embeddings"), { model: ctx.model, input: texts }, auth(ctx));
  const vectors = Array.isArray(out?.data) ? out.data.map((d: { embedding: number[] }) => d.embedding) : null;
  if (!vectors || vectors.length !== texts.length) throw new AiProviderError("resposta sem vetores");
  return { vectors, tokensIn: out.usage?.prompt_tokens };
}
