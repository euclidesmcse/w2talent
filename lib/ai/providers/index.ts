import type { CallContext, ChatRequest, ChatResult, EmbedResult, ProviderKind } from "../types";
import { AiProviderError } from "../types";
import * as workersAi from "./workers-ai";
import * as openaiCompatible from "./openai-compatible";
import * as anthropic from "./anthropic";
import * as google from "./google";

type Adapter = {
  chat: (ctx: CallContext, req: ChatRequest) => Promise<ChatResult>;
  embed?: (ctx: CallContext, texts: string[]) => Promise<EmbedResult>;
};

export const ADAPTERS: Record<ProviderKind, Adapter> = {
  WORKERS_AI: workersAi,
  OPENAI_COMPATIBLE: openaiCompatible,
  ANTHROPIC: anthropic,
  GOOGLE: google,
};

export function supportsEmbeddings(kind: ProviderKind): boolean {
  return typeof ADAPTERS[kind].embed === "function";
}

export function callChat(ctx: CallContext, req: ChatRequest): Promise<ChatResult> {
  return ADAPTERS[ctx.kind].chat(ctx, req);
}

export function callEmbed(ctx: CallContext, texts: string[]): Promise<EmbedResult> {
  const fn = ADAPTERS[ctx.kind].embed;
  if (!fn) throw new AiProviderError(`${ctx.kind} não gera embeddings`);
  return fn(ctx, texts);
}
