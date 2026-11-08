/**
 * Roteador de IA (1.5.7). Toda chamada de IA do app passa por aqui:
 * 1. lê a rota da tarefa (modelos na ordem de preferência);
 * 2. confere o orçamento do dia (geral e por tarefa);
 * 3. pula fornecedor pausado (3 falhas em 5 min → pausa de 10 min, na memória do Worker);
 * 4. tira contatos do texto antes de ir a fornecedor externo em tarefa com dados pessoais;
 * 5. chama pelo AI Gateway e, se falhar, tenta o próximo modelo;
 * 6. grava cada tentativa no histórico (sem o texto).
 */
import { TASKS, type TaskName } from "./tasks";
import type { CallContext, ChatRequest, ChatResult, EmbedResult, ProviderKind, WorkersAiBinding } from "./types";
import { callChat, callEmbed, supportsEmbeddings } from "./providers";
import { decryptApiKey } from "./keys";
import { redactContacts } from "./redact";

export type RouteCandidate = {
  providerId: string;
  providerName: string;
  kind: ProviderKind;
  gatewayPath?: string | null;
  baseUrl?: string | null;
  encryptedKey?: string | null;
  acceptsPersonalData: boolean;
  modelId: string;
  model: string;
  priceIn?: number | null;
  priceOut?: number | null;
  context?: number | null;
};

export type RouteConfig = { mode: "automatico" | "fixo"; candidates: RouteCandidate[]; dailyBudgetUsd?: number | null };

export type InteractionRecord = {
  tarefa: TaskName;
  fornecedor: string;
  modelo: string;
  ok: boolean;
  erro?: string;
  tokensEntrada?: number;
  tokensSaida?: number;
  custoUsd: number;
  latenciaMs: number;
  userId?: string;
};

export interface AiStore {
  route(task: TaskName): Promise<RouteConfig>;
  /** Gasto do dia (UTC) em US$; sem tarefa = soma de todas. */
  spentTodayUsd(task?: TaskName): Promise<number>;
  record(rec: InteractionRecord): Promise<void>;
}

export type RouterEnv = {
  ai?: WorkersAiBinding;
  fetch: typeof fetch;
  gateway: { accountId?: string; id?: string };
  master?: string;
  globalDailyBudgetUsd: number;
  now?: () => number;
};

export type CallOptions = { userId?: string };

export class AiBudgetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiBudgetError";
  }
}

export class AiUnavailableError extends Error {
  constructor(message: string, readonly attempts: { model: string; error: string }[]) {
    super(message);
    this.name = "AiUnavailableError";
  }
}

// ── pausa de fornecedor que falha (memória do Worker; cada instância aprende sozinha) ──
const FAIL_WINDOW_MS = 5 * 60_000;
const FAIL_LIMIT = 3;
const PAUSE_MS = 10 * 60_000;
const breaker = new Map<string, { fails: number[]; pausedUntil: number }>();

export function resetBreaker(): void {
  breaker.clear();
}

function isPaused(providerId: string, now: number): boolean {
  return (breaker.get(providerId)?.pausedUntil ?? 0) > now;
}

function noteFailure(providerId: string, now: number): void {
  const st = breaker.get(providerId) ?? { fails: [], pausedUntil: 0 };
  st.fails = [...st.fails.filter((t) => now - t < FAIL_WINDOW_MS), now];
  if (st.fails.length >= FAIL_LIMIT) {
    st.pausedUntil = now + PAUSE_MS;
    st.fails = [];
  }
  breaker.set(providerId, st);
}

function noteSuccess(providerId: string): void {
  breaker.delete(providerId);
}

// ── custo ──
const approxTokens = (chars: number) => Math.ceil(chars / 4);

export function costUsd(c: RouteCandidate, tokensIn = 0, tokensOut = 0): number {
  return (tokensIn * (c.priceIn ?? 0) + tokensOut * (c.priceOut ?? 0)) / 1_000_000;
}

function orderCandidates(cfg: RouteConfig): RouteCandidate[] {
  if (cfg.mode === "fixo") return cfg.candidates.slice(0, 1);
  const price = (c: RouteCandidate) => (c.priceIn == null && c.priceOut == null ? Infinity : (c.priceIn ?? 0) + (c.priceOut ?? 0));
  // sort estável: empate mantém a ordem configurada
  return [...cfg.candidates].sort((a, b) => price(a) - price(b));
}

export function createRouter(store: AiStore, env: RouterEnv) {
  const now = env.now ?? Date.now;

  async function attempt<T extends { tokensIn?: number; tokensOut?: number }>(
    task: TaskName,
    opts: CallOptions,
    inputChars: number,
    run: (ctx: CallContext, external: boolean) => Promise<T>,
    outputChars: (r: T) => number,
    canUse: (c: RouteCandidate) => boolean,
  ): Promise<T & { model: string; provider: string }> {
    const spec = TASKS[task];
    const cfg = await store.route(task);
    const spentAll = await store.spentTodayUsd();
    if (spentAll >= env.globalDailyBudgetUsd) {
      throw new AiBudgetError(`orçamento diário de IA esgotado (US$ ${spentAll.toFixed(4)} de US$ ${env.globalDailyBudgetUsd})`);
    }
    if (cfg.dailyBudgetUsd != null) {
      const spentTask = await store.spentTodayUsd(task);
      if (spentTask >= cfg.dailyBudgetUsd) throw new AiBudgetError(`orçamento diário da tarefa ${task} esgotado`);
    }

    const attempts: { model: string; error: string }[] = [];
    for (const c of orderCandidates(cfg)) {
      const label = `${c.providerName}/${c.model}`;
      if (!canUse(c)) continue;
      if ("personalData" in spec && spec.personalData && !c.acceptsPersonalData) {
        attempts.push({ model: label, error: "fornecedor não aceita dados pessoais" });
        continue;
      }
      if ("minContext" in spec && c.context != null && c.context < spec.minContext) {
        attempts.push({ model: label, error: `contexto ${c.context} menor que ${spec.minContext}` });
        continue;
      }
      if (isPaused(c.providerId, now())) {
        attempts.push({ model: label, error: "fornecedor pausado após falhas seguidas" });
        continue;
      }
      const started = now();
      try {
        const apiKey = c.encryptedKey ? await decryptApiKey(c.encryptedKey, env.master) : undefined;
        const ctx: CallContext = {
          kind: c.kind,
          model: c.model,
          apiKey,
          gatewayPath: c.gatewayPath,
          baseUrl: c.baseUrl,
          gateway: env.gateway,
          ai: env.ai,
          fetch: env.fetch,
        };
        const external = c.kind !== "WORKERS_AI";
        const result = await run(ctx, external);
        const tokensIn = result.tokensIn ?? approxTokens(inputChars);
        const tokensOut = result.tokensOut ?? approxTokens(outputChars(result));
        noteSuccess(c.providerId);
        await safeRecord(store, {
          tarefa: task,
          fornecedor: c.providerName,
          modelo: c.model,
          ok: true,
          tokensEntrada: tokensIn,
          tokensSaida: tokensOut,
          custoUsd: costUsd(c, tokensIn, tokensOut),
          latenciaMs: now() - started,
          userId: opts.userId,
        });
        return { ...result, model: c.model, provider: c.providerName };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        noteFailure(c.providerId, now());
        attempts.push({ model: label, error: msg });
        await safeRecord(store, {
          tarefa: task,
          fornecedor: c.providerName,
          modelo: c.model,
          ok: false,
          erro: msg.slice(0, 300),
          custoUsd: 0,
          latenciaMs: now() - started,
          userId: opts.userId,
        });
      }
    }
    throw new AiUnavailableError(`nenhum modelo disponível para ${task}`, attempts);
  }

  return {
    chat(task: TaskName, req: ChatRequest, opts: CallOptions = {}) {
      if (TASKS[task].kind !== "chat") throw new Error(`${task} não é tarefa de texto`);
      const spec = TASKS[task];
      const chars = req.messages.reduce((n, m) => n + m.content.length, 0);
      return attempt<ChatResult>(
        task,
        opts,
        chars,
        (ctx, external) => {
          const messages =
            external && "personalData" in spec && spec.personalData
              ? req.messages.map((m) => ({ ...m, content: redactContacts(m.content) }))
              : req.messages;
          return callChat(ctx, { ...req, json: req.json ?? ("json" in spec && spec.json) ?? false, messages });
        },
        (r) => r.text.length,
        () => true,
      );
    },
    embed(task: TaskName, texts: string[], opts: CallOptions = {}) {
      if (TASKS[task].kind !== "embed") throw new Error(`${task} não é tarefa de embeddings`);
      const chars = texts.reduce((n, t) => n + t.length, 0);
      return attempt<EmbedResult>(task, opts, chars, (ctx) => callEmbed(ctx, texts), () => 0, (c) => supportsEmbeddings(c.kind));
    },
  };
}

async function safeRecord(store: AiStore, rec: InteractionRecord): Promise<void> {
  try {
    await store.record(rec);
  } catch (e) {
    // O histórico não pode derrubar a chamada.
    // eslint-disable-next-line no-console
    console.error("[ai] falha ao gravar AiInteraction:", e instanceof Error ? e.message : e);
  }
}
