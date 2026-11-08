import { AiProviderError, type CallContext, type ChatRequest, type ChatResult } from "../types";
import { postJson, providerUrl } from "./http";

/** Anthropic (Claude), API Messages. Não tem embeddings. */
export async function chat(ctx: CallContext, req: ChatRequest): Promise<ChatResult> {
  if (!ctx.apiKey) throw new AiProviderError("fornecedor sem chave de API");
  const system = req.messages.filter((m) => m.role === "system").map((m) => m.content);
  if (req.json) system.push("Responda apenas com um objeto JSON válido, sem texto antes ou depois.");
  const body: Record<string, unknown> = {
    model: ctx.model,
    max_tokens: req.maxTokens ?? 1024,
    messages: req.messages.filter((m) => m.role !== "system"),
  };
  if (system.length) body.system = system.join("\n\n");
  if (req.temperature !== undefined) body.temperature = req.temperature;
  const out = await postJson(ctx, providerUrl(ctx, "/v1/messages"), body, {
    "x-api-key": ctx.apiKey,
    "anthropic-version": "2023-06-01",
  });
  const text = Array.isArray(out?.content)
    ? out.content.filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("")
    : null;
  if (!text) throw new AiProviderError("resposta sem texto");
  return { text, tokensIn: out.usage?.input_tokens, tokensOut: out.usage?.output_tokens };
}
