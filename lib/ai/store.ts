/**
 * Onde o roteador lê as rotas e grava o histórico: o banco (Prisma).
 * Sem rota configurada (o painel de admin vem no 1.5.8), usa o modelo padrão do Workers AI da tarefa.
 */
import type { PrismaClient } from "@prisma/client";
import { TASKS, WORKERS_AI_PRICES, type TaskName } from "./tasks";
import type { AiStore, InteractionRecord, RouteCandidate, RouteConfig } from "./router";

export function defaultCandidate(task: TaskName): RouteCandidate {
  const model = TASKS[task].defaultWorkersModel;
  const price = WORKERS_AI_PRICES[model];
  return {
    providerId: "workers-ai-padrao",
    providerName: "Workers AI",
    kind: "WORKERS_AI",
    // Workers AI roda na própria Cloudflare, que já processa os dados do app.
    acceptsPersonalData: true,
    modelId: `padrao:${model}`,
    model,
    priceIn: price?.in ?? null,
    priceOut: price?.out ?? null,
  };
}

/** Início do dia em UTC. */
export function startOfUtcDay(now: number): Date {
  const d = new Date(now);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function prismaAiStore(db: PrismaClient, now: () => number = Date.now): AiStore {
  return {
    async route(task): Promise<RouteConfig> {
      const route = await db.taskRoute.findUnique({ where: { tarefa: task } });
      if (!route) return { mode: "automatico", candidates: [defaultCandidate(task)] };
      // Rota sem modelos escolhidos: usa o padrão, mas mantém o orçamento da tarefa.
      if (route.modelos.length === 0)
        return { mode: "automatico", candidates: [defaultCandidate(task)], dailyBudgetUsd: route.orcamentoDiarioUsd };
      const models = await db.aiModel.findMany({
        where: { id: { in: route.modelos }, ativo: true, provider: { ativo: true } },
        include: { provider: true },
      });
      const byId = new Map(models.map((m) => [m.id, m]));
      const candidates: RouteCandidate[] = route.modelos.flatMap((id) => {
        const m = byId.get(id);
        if (!m) return [];
        return [
          {
            providerId: m.provider.id,
            providerName: m.provider.nome,
            kind: m.provider.tipo,
            gatewayPath: m.provider.gatewayPath,
            baseUrl: m.provider.baseUrl,
            encryptedKey: m.provider.chaveCifrada,
            acceptsPersonalData: m.provider.aceitaDadosPessoais,
            modelId: m.id,
            model: m.modelo,
            priceIn: m.precoEntradaUsdMilhao,
            priceOut: m.precoSaidaUsdMilhao,
            context: m.contexto,
          },
        ];
      });
      // Rota apontando só para modelos desligados: volta ao padrão em vez de ficar sem IA.
      if (candidates.length === 0) candidates.push(defaultCandidate(task));
      return { mode: route.modo === "fixo" ? "fixo" : "automatico", candidates, dailyBudgetUsd: route.orcamentoDiarioUsd };
    },
    async spentTodayUsd(task) {
      const agg = await db.aiInteraction.aggregate({
        _sum: { custoUsd: true },
        where: { createdAt: { gte: startOfUtcDay(now()) }, ...(task ? { tarefa: task } : {}) },
      });
      return agg._sum.custoUsd ?? 0;
    },
    async record(rec: InteractionRecord) {
      await db.aiInteraction.create({ data: rec });
    },
  };
}
