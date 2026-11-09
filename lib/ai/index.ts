/**
 * Ponto de entrada da IA no app: `getAiRouter().chat(...)` / `.embed(...)`.
 * Configuração (wrangler.jsonc / Worker Secrets):
 * - AI_GATEWAY_ACCOUNT_ID, AI_GATEWAY_ID: o AI Gateway por onde as chamadas passam;
 * - AI_DAILY_BUDGET_USD: limite geral do dia (padrão US$ 1);
 * - AI_KEYS_MASTER (secret): decifra as chaves de API cadastradas.
 */
import { getPrisma } from "@/lib/prisma";
import { createRouter } from "./router";
import { prismaAiStore } from "./store";
import type { WorkersAiBinding } from "./types";

export { TASKS, isTaskName, type TaskName } from "./tasks";
export { AiBudgetError, AiUnavailableError } from "./router";

function workerAi(): WorkersAiBinding | undefined {
  const cf = (globalThis as Record<symbol, unknown>)[Symbol.for("__cloudflare-context__")] as
    | { env?: { AI?: WorkersAiBinding } }
    | undefined;
  return cf?.env?.AI;
}

export function aiConfig() {
  const budget = Number(process.env.AI_DAILY_BUDGET_USD);
  return {
    gateway: { accountId: process.env.AI_GATEWAY_ACCOUNT_ID || undefined, id: process.env.AI_GATEWAY_ID || undefined },
    globalDailyBudgetUsd: Number.isFinite(budget) && budget > 0 ? budget : 1,
  };
}

/** Ambiente das operações do Admin de IA (1.5.8). */
export function aiAdminEnv() {
  const cfg = aiConfig();
  return {
    ai: workerAi(),
    fetch: ((...args: Parameters<typeof fetch>) => fetch(...args)) as typeof fetch,
    gateway: cfg.gateway,
    master: process.env.AI_KEYS_MASTER,
    globalDailyBudgetUsd: cfg.globalDailyBudgetUsd,
  };
}

export function getAiRouter() {
  const cfg = aiConfig();
  return createRouter(prismaAiStore(getPrisma()), {
    ai: workerAi(),
    fetch: (...args) => fetch(...args),
    gateway: cfg.gateway,
    master: process.env.AI_KEYS_MASTER,
    globalDailyBudgetUsd: cfg.globalDailyBudgetUsd,
  });
}
