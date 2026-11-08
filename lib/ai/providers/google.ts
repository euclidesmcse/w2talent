import { AiProviderError, type CallContext, type ChatRequest, type ChatResult, type EmbedResult } from "../types";
import { postJson, providerUrl } from "./http";

/** Google Gemini (AI Studio), API generateContent. */
function auth(ctx: CallContext): Record<string, string> {
  if (!ctx.apiKey) throw new AiProviderError("fornecedor sem chave de API");
  return { "x-goog-api-key": ctx.apiKey };
}

export async function chat(ctx: CallContext, req: ChatRequest): Promise<ChatResult> {
  const system = req.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const body: Record<string, unknown> = {
    contents: req.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
  };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  const cfg: Record<string, unknown> = {};
  if (req.maxTokens) cfg.maxOutputTokens = req.maxTokens;
  if (req.temperature !== undefined) cfg.temperature = req.temperature;
  if (req.json) cfg.responseMimeType = "application/json";
  if (Object.keys(cfg).length) body.generationConfig = cfg;
  const out = await postJson(ctx, providerUrl(ctx, `/v1beta/models/${encodeURIComponent(ctx.model)}:generateContent`), body, auth(ctx));
  const parts = out?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts) ? parts.map((p: { text?: string }) => p.text ?? "").join("") : "";
  if (!text) throw new AiProviderError("resposta sem texto");
  return { text, tokensIn: out.usageMetadata?.promptTokenCount, tokensOut: out.usageMetadata?.candidatesTokenCount };
}

export async function embed(ctx: CallContext, texts: string[]): Promise<EmbedResult> {
  const body = { requests: texts.map((t) => ({ model: `models/${ctx.model}`, content: { parts: [{ text: t }] } })) };
  const out = await postJson(ctx, providerUrl(ctx, `/v1beta/models/${encodeURIComponent(ctx.model)}:batchEmbedContents`), body, auth(ctx));
  const vectors = Array.isArray(out?.embeddings) ? out.embeddings.map((e: { values: number[] }) => e.values) : null;
  if (!vectors || vectors.length !== texts.length) throw new AiProviderError("resposta sem vetores");
  return { vectors };
}
