/**
 * Catálogo das tarefas de IA (arquitetura v2, §5.2) e do que cada uma exige do modelo.
 * O roteador (router.ts) só usa um modelo numa tarefa se ele atende a estes requisitos.
 */

export type TaskKind = "chat" | "embed";

export type TaskSpec = {
  kind: TaskKind;
  /** Precisa responder JSON estruturado. */
  json?: boolean;
  /** Contexto mínimo em tokens. */
  minContext?: number;
  /** O texto pode ter dados pessoais (CV, perfil): só vai a fornecedor marcado e, se externo, sem contatos. */
  personalData?: boolean;
  /** Modelo padrão do Workers AI enquanto o admin não configurar uma rota (1.5.8). */
  defaultWorkersModel: string;
};

/**
 * Modelo padrão de texto do Workers AI. O llama-3.1-8b-instruct foi desativado pela Cloudflare
 * em 30/05/2026; o GLM-4.7 Flash é o substituto recomendado (multilíngue, 131k de contexto).
 */
export const TEXT_MODEL = "@cf/zai-org/glm-4.7-flash";

export const TASKS = {
  extract_cv: { kind: "chat", json: true, minContext: 32_000, personalData: true, defaultWorkersModel: TEXT_MODEL },
  extract_vacancy: { kind: "chat", json: true, minContext: 16_000, defaultWorkersModel: TEXT_MODEL },
  ficha_w2: { kind: "chat", json: true, minContext: 32_000, personalData: true, defaultWorkersModel: TEXT_MODEL },
  match_explain: { kind: "chat", json: true, minContext: 16_000, personalData: true, defaultWorkersModel: TEXT_MODEL },
  coach_candidate: { kind: "chat", minContext: 32_000, personalData: true, defaultWorkersModel: TEXT_MODEL },
  coach_recruiter: { kind: "chat", minContext: 32_000, defaultWorkersModel: TEXT_MODEL },
  support_chat: { kind: "chat", minContext: 32_000, defaultWorkersModel: TEXT_MODEL },
  compose_message: { kind: "chat", minContext: 8_000, personalData: true, defaultWorkersModel: TEXT_MODEL },
  translate_ui: { kind: "chat", minContext: 8_000, defaultWorkersModel: TEXT_MODEL },
  translate_content: { kind: "chat", minContext: 8_000, defaultWorkersModel: TEXT_MODEL },
  embed: { kind: "embed", defaultWorkersModel: "@cf/baai/bge-m3" },
} as const satisfies Record<string, TaskSpec>;

export type TaskName = keyof typeof TASKS;

export function isTaskName(v: unknown): v is TaskName {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(TASKS, v);
}

/**
 * Preço aproximado (US$ por milhão de tokens) dos modelos padrão do Workers AI, para o
 * orçamento diário. Valores de referência; a cota diária grátis do Workers AI não é descontada,
 * então o orçamento fica do lado seguro.
 */
export const WORKERS_AI_PRICES: Record<string, { in: number; out: number; dim?: number }> = {
  [TEXT_MODEL]: { in: 0.0605, out: 0.4 },
  "@cf/baai/bge-m3": { in: 0.012, out: 0, dim: 1024 },
};
