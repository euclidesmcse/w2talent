import { AiProviderError, type CallContext, type ChatRequest, type ChatResult, type EmbedResult } from "../types";

/** Workers AI pelo binding `AI`, passando pelo AI Gateway quando AI_GATEWAY_ID existe. Sem chave de API. */
function binding(ctx: CallContext) {
  if (!ctx.ai) throw new AiProviderError("binding AI ausente (fora do Worker?)");
  return ctx.ai;
}

function gatewayOption(ctx: CallContext) {
  return ctx.gateway.id ? { gateway: { id: ctx.gateway.id } } : undefined;
}

export async function chat(ctx: CallContext, req: ChatRequest): Promise<ChatResult> {
  const inputs: Record<string, unknown> = { messages: req.messages };
  if (req.maxTokens) inputs.max_tokens = req.maxTokens;
  if (req.temperature !== undefined) inputs.temperature = req.temperature;
  if (req.json) inputs.response_format = { type: "json_object" };
  const out = (await binding(ctx).run(ctx.model, inputs, gatewayOption(ctx))) as {
    response?: unknown;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  if (out?.response === undefined || out.response === null) throw new AiProviderError("Workers AI respondeu sem texto");
  const text = typeof out.response === "string" ? out.response : JSON.stringify(out.response);
  return { text, tokensIn: out.usage?.prompt_tokens, tokensOut: out.usage?.completion_tokens };
}

export async function embed(ctx: CallContext, texts: string[]): Promise<EmbedResult> {
  const out = (await binding(ctx).run(ctx.model, { text: texts }, gatewayOption(ctx))) as {
    data?: number[][];
    usage?: { prompt_tokens?: number };
  };
  if (!Array.isArray(out?.data) || out.data.length !== texts.length) throw new AiProviderError("Workers AI respondeu sem vetores");
  return { vectors: out.data, tokensIn: out.usage?.prompt_tokens };
}
