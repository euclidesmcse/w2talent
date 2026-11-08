import { AiProviderError, type CallContext, type ChatRequest, type ChatResult, type EmbedResult } from "../types";

/** Workers AI pelo binding `AI`, passando pelo AI Gateway quando AI_GATEWAY_ID existe. Sem chave de API. */
function binding(ctx: CallContext) {
  if (!ctx.ai) throw new AiProviderError("binding AI ausente (fora do Worker?)");
  return ctx.ai;
}

function gatewayOption(ctx: CallContext) {
  return ctx.gateway.id ? { gateway: { id: ctx.gateway.id } } : undefined;
}

/**
 * Chama o binding e, se falhar, troca o erro por um AiProviderError só com o código do
 * Workers AI (ex.: "Workers AI 5007"). A mensagem original pode ecoar o pedido e não sai daqui.
 */
async function runSafe(ctx: CallContext, inputs: Record<string, unknown>): Promise<unknown> {
  try {
    return await binding(ctx).run(ctx.model, inputs, gatewayOption(ctx));
  } catch (e) {
    if (e instanceof AiProviderError) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    const code = /(?:^|\s)(\d{4}):/.exec(msg)?.[1];
    throw new AiProviderError(`Workers AI ${code ?? "erro"}${e instanceof Error && e.name ? ` (${e.name})` : ""}`);
  }
}

export async function chat(ctx: CallContext, req: ChatRequest): Promise<ChatResult> {
  const inputs: Record<string, unknown> = { messages: req.messages };
  if (req.maxTokens) inputs.max_tokens = req.maxTokens;
  if (req.temperature !== undefined) inputs.temperature = req.temperature;
  if (req.json) inputs.response_format = { type: "json_object" };
  const out = (await runSafe(ctx, inputs)) as {
    response?: unknown;
    choices?: { message?: { content?: unknown } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  // Modelos antigos respondem { response }; os novos (GLM, Gemma 4…), no formato do OpenAI { choices }.
  const raw = out?.response ?? out?.choices?.[0]?.message?.content;
  if (raw === undefined || raw === null || raw === "") throw new AiProviderError("Workers AI respondeu sem texto");
  const text = typeof raw === "string" ? raw : JSON.stringify(raw);
  return { text, tokensIn: out.usage?.prompt_tokens, tokensOut: out.usage?.completion_tokens };
}

export async function embed(ctx: CallContext, texts: string[]): Promise<EmbedResult> {
  const out = (await runSafe(ctx, { text: texts })) as {
    data?: number[][];
    usage?: { prompt_tokens?: number };
  };
  if (!Array.isArray(out?.data) || out.data.length !== texts.length) throw new AiProviderError("Workers AI respondeu sem vetores");
  return { vectors: out.data, tokensIn: out.usage?.prompt_tokens };
}
