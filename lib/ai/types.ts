/** Tipos comuns da camada de IA (1.5.7). */

export type ProviderKind = "WORKERS_AI" | "OPENAI_COMPATIBLE" | "ANTHROPIC" | "GOOGLE";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ChatRequest = {
  messages: ChatMessage[];
  /** Pede resposta em JSON. */
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
};

export type Usage = { tokensIn?: number; tokensOut?: number };
export type ChatResult = Usage & { text: string };
export type EmbedResult = Usage & { vectors: number[][] };

/** Binding `AI` do Workers AI (só o que usamos). */
export type WorkersAiBinding = {
  run: (model: string, inputs: Record<string, unknown>, options?: { gateway?: { id: string; skipCache?: boolean } }) => Promise<unknown>;
};

/** Onde e como chamar um fornecedor. */
export type CallContext = {
  kind: ProviderKind;
  model: string;
  apiKey?: string;
  /** Caminho do fornecedor no AI Gateway (ex.: "openai"). Vazio = chamada direta para baseUrl. */
  gatewayPath?: string | null;
  baseUrl?: string | null;
  gateway: { accountId?: string; id?: string };
  ai?: WorkersAiBinding;
  fetch: typeof fetch;
};

export class AiProviderError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "AiProviderError";
  }
}
