/**
 * Operações do painel de Admin de IA (1.5.8): cadastrar API, listar modelos, testar, montar as rotas.
 * A chave de API entra uma vez, é cifrada (keys.ts) e nunca volta para a tela: só os 4 últimos caracteres.
 */
import type { PrismaClient } from "@prisma/client";
import { decryptApiKey, encryptApiKey, keyHint } from "./keys";
import { listModels, looksLikeEmbedding } from "./catalog";
import { knownPrice } from "./prices";
import { COMPAT_TESTS, estimateTestCost, runCompatTests, type CompatTest, type LatestTests, type TestResult } from "./compat";
import { computeRoutes, LOCKED_TASKS, type RoutingModel, type SavedRoute, type TaskRouting } from "./routing";
import { TASKS, isTaskName, type TaskName } from "./tasks";
import { startOfUtcDay } from "./store";
import { safeErrorText } from "./router";
import type { CallContext, ProviderKind, WorkersAiBinding } from "./types";

type Db = PrismaClient;

export type AdminEnv = {
  ai?: WorkersAiBinding;
  fetch: typeof fetch;
  gateway: { accountId?: string; id?: string };
  master?: string;
  globalDailyBudgetUsd: number;
  now?: () => number;
};

export class AdminInputError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "AdminInputError";
  }
}

export const PROVIDER_KINDS: readonly ProviderKind[] = ["OPENAI_COMPATIBLE", "ANTHROPIC", "GOOGLE", "WORKERS_AI"];
/** Modelos testados por vez (o Worker espera as respostas; mais que isso fica lento demais na tela). */
export const MAX_MODELS_PER_TEST = 10;

// ── leitura ──

function isEmbedding(m: { embeddingDim: number | null }): boolean {
  return m.embeddingDim != null;
}

async function latestTests(db: Db, modelIds: string[]): Promise<Map<string, { tests: LatestTests; at: Date | null }>> {
  const out = new Map<string, { tests: LatestTests; at: Date | null }>();
  if (!modelIds.length) return out;
  const rows = await db.aiModelTest.findMany({ where: { modelId: { in: modelIds } }, orderBy: { createdAt: "desc" } });
  for (const r of rows) {
    const cur = out.get(r.modelId) ?? { tests: {}, at: null };
    const t = r.teste as CompatTest;
    if ((COMPAT_TESTS as readonly string[]).includes(t) && !cur.tests[t]) cur.tests[t] = { ok: r.ok, detalhe: r.detalhe, latenciaMs: r.latenciaMs };
    if (!cur.at || r.createdAt > cur.at) cur.at = r.createdAt;
    out.set(r.modelId, cur);
  }
  return out;
}

async function routingModels(db: Db): Promise<RoutingModel[]> {
  const models = await db.aiModel.findMany({ include: { provider: true }, orderBy: [{ providerId: "asc" }, { modelo: "asc" }] });
  const tests = await latestTests(db, models.map((m) => m.id));
  return models.map((m) => ({
    id: m.id,
    modelo: m.modelo,
    providerNome: m.provider.nome,
    providerAtivo: m.provider.ativo,
    aceitaDadosPessoais: m.provider.aceitaDadosPessoais,
    ativo: m.ativo,
    embedding: isEmbedding(m),
    contexto: m.contexto,
    precoEntrada: m.precoEntradaUsdMilhao,
    precoSaida: m.precoSaidaUsdMilhao,
    tests: tests.get(m.id)?.tests ?? {},
  }));
}

async function savedRoutes(db: Db): Promise<Partial<Record<TaskName, SavedRoute>>> {
  const rows = await db.taskRoute.findMany();
  const out: Partial<Record<TaskName, SavedRoute>> = {};
  for (const r of rows) if (isTaskName(r.tarefa)) out[r.tarefa] = { modo: r.modo, modelos: r.modelos };
  return out;
}

export async function spentTodayUsd(db: Db, now: number): Promise<number> {
  const agg = await db.aiInteraction.aggregate({ _sum: { custoUsd: true }, where: { createdAt: { gte: startOfUtcDay(now) } } });
  return agg._sum.custoUsd ?? 0;
}

export async function adminState(db: Db, env: Pick<AdminEnv, "globalDailyBudgetUsd" | "now">) {
  const now = (env.now ?? Date.now)();
  const providers = await db.aiProvider.findMany({ orderBy: { createdAt: "asc" }, include: { modelos: { orderBy: { modelo: "asc" } } } });
  const allIds = providers.flatMap((p) => p.modelos.map((m) => m.id));
  const tests = await latestTests(db, allIds);
  const models = await routingModels(db);
  const routes = computeRoutes(models, await savedRoutes(db));
  return {
    providers: providers.map((p) => ({
      id: p.id,
      nome: p.nome,
      tipo: p.tipo,
      baseUrl: p.baseUrl,
      gatewayPath: p.gatewayPath,
      chaveFinal: p.chaveFinal,
      temChave: !!p.chaveCifrada,
      ativo: p.ativo,
      aceitaDadosPessoais: p.aceitaDadosPessoais,
      modelos: p.modelos.map((m) => ({
        id: m.id,
        modelo: m.modelo,
        contexto: m.contexto,
        precoEntrada: m.precoEntradaUsdMilhao,
        precoSaida: m.precoSaidaUsdMilhao,
        embedding: isEmbedding(m),
        embeddingDim: m.embeddingDim,
        ativo: m.ativo,
        tests: tests.get(m.id)?.tests ?? {},
        testadoEm: tests.get(m.id)?.at ?? null,
      })),
    })),
    routes,
    tasks: (Object.keys(TASKS) as TaskName[]).map((t) => ({
      tarefa: t,
      kind: TASKS[t].kind,
      json: "json" in TASKS[t] ? !!(TASKS[t] as { json?: boolean }).json : false,
      minContext: "minContext" in TASKS[t] ? (TASKS[t] as { minContext?: number }).minContext ?? null : null,
      personalData: "personalData" in TASKS[t] ? !!(TASKS[t] as { personalData?: boolean }).personalData : false,
      padrao: TASKS[t].defaultWorkersModel,
      travada: LOCKED_TASKS.includes(t),
    })),
    gastoHojeUsd: await spentTodayUsd(db, now),
    orcamentoDiarioUsd: env.globalDailyBudgetUsd,
  };
}

// ── fornecedores ──

function str(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? t.slice(0, max) : undefined;
}

function httpsUrl(v: unknown): string | undefined {
  const s = str(v, 300);
  if (!s) return undefined;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    throw new AdminInputError("url_invalida");
  }
  if (u.protocol !== "https:" || u.username || u.password) throw new AdminInputError("url_invalida");
  return u.toString().replace(/\/$/, "");
}

function gatewayPathOf(v: unknown): string | undefined {
  const s = str(v, 60);
  if (!s) return undefined;
  if (!/^[a-z0-9][a-z0-9-]*$/.test(s)) throw new AdminInputError("caminho_gateway_invalido");
  return s;
}

export async function addProvider(db: Db, input: Record<string, unknown>, master: string | undefined) {
  const tipo = input.tipo as ProviderKind;
  if (!PROVIDER_KINDS.includes(tipo)) throw new AdminInputError("tipo_invalido");
  const nome = str(input.nome, 60);
  if (!nome) throw new AdminInputError("nome_obrigatorio");
  const baseUrl = httpsUrl(input.baseUrl);
  const gatewayPath = gatewayPathOf(input.gatewayPath);
  const chave = str(input.chave, 500);
  if (tipo !== "WORKERS_AI") {
    if (!chave) throw new AdminInputError("chave_obrigatoria");
    if (!baseUrl && !gatewayPath) throw new AdminInputError("endereco_obrigatorio");
  }
  if (await db.aiProvider.findUnique({ where: { nome } })) throw new AdminInputError("nome_repetido");
  const p = await db.aiProvider.create({
    data: {
      nome,
      tipo,
      baseUrl: baseUrl ?? null,
      gatewayPath: gatewayPath ?? null,
      chaveCifrada: chave ? await encryptApiKey(chave, master) : null,
      chaveFinal: chave ? keyHint(chave) : null,
      ativo: true,
      // Workers AI roda na própria Cloudflare, que já processa os dados do app.
      aceitaDadosPessoais: tipo === "WORKERS_AI" ? true : input.aceitaDadosPessoais === true,
    },
  });
  return { id: p.id };
}

export async function updateProvider(db: Db, id: string, input: Record<string, unknown>, master: string | undefined) {
  const data: Record<string, unknown> = {};
  if (typeof input.ativo === "boolean") data.ativo = input.ativo;
  if (typeof input.aceitaDadosPessoais === "boolean") data.aceitaDadosPessoais = input.aceitaDadosPessoais;
  const chave = str(input.chave, 500);
  if (chave) {
    data.chaveCifrada = await encryptApiKey(chave, master);
    data.chaveFinal = keyHint(chave);
  }
  if (!Object.keys(data).length) throw new AdminInputError("nada_para_mudar");
  await db.aiProvider.update({ where: { id }, data });
  await recomputeRoutes(db);
}

export async function deleteProvider(db: Db, id: string) {
  await db.aiProvider.delete({ where: { id } });
  await recomputeRoutes(db);
}

async function contextFor(db: Db, providerId: string, env: AdminEnv): Promise<Omit<CallContext, "model"> & { kind: ProviderKind }> {
  const p = await db.aiProvider.findUnique({ where: { id: providerId } });
  if (!p) throw new AdminInputError("fornecedor_nao_existe");
  return {
    kind: p.tipo,
    apiKey: p.chaveCifrada ? await decryptApiKey(p.chaveCifrada, env.master) : undefined,
    gatewayPath: p.gatewayPath,
    baseUrl: p.baseUrl,
    gateway: env.gateway,
    ai: env.ai,
    fetch: env.fetch,
  };
}

/** Lista os modelos da API e grava os novos, com preço e contexto conhecidos. Não sobrescreve o que o admin editou. */
export async function refreshModels(db: Db, providerId: string, env: AdminEnv) {
  const ctx = await contextFor(db, providerId, env);
  const listed = await listModels(ctx);
  const existing = new Map((await db.aiModel.findMany({ where: { providerId } })).map((m) => [m.modelo, m]));
  let novos = 0;
  for (const l of listed) {
    const known = knownPrice(l.modelo);
    const embedding = l.embedding || known?.dim != null || looksLikeEmbedding(l.modelo);
    const cur = existing.get(l.modelo);
    if (!cur) {
      await db.aiModel.create({
        data: {
          providerId,
          modelo: l.modelo,
          contexto: l.contexto ?? known?.context ?? null,
          precoEntradaUsdMilhao: known?.in ?? null,
          precoSaidaUsdMilhao: known?.out ?? null,
          embeddingDim: embedding ? known?.dim ?? 0 : null,
          ativo: true,
        },
      });
      novos++;
    } else {
      const fill: Record<string, unknown> = {};
      if (cur.contexto == null && (l.contexto ?? known?.context)) fill.contexto = l.contexto ?? known?.context;
      if (cur.precoEntradaUsdMilhao == null && known) fill.precoEntradaUsdMilhao = known.in;
      if (cur.precoSaidaUsdMilhao == null && known) fill.precoSaidaUsdMilhao = known.out;
      if (Object.keys(fill).length) await db.aiModel.update({ where: { id: cur.id }, data: fill });
    }
  }
  return { listados: listed.length, novos };
}

function num(v: unknown, min: number, max: number): number | null | undefined {
  if (v === null || v === "") return null;
  if (v === undefined) return undefined;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  if (!Number.isFinite(n) || n < min || n > max) throw new AdminInputError("numero_invalido");
  return n;
}

export async function updateModel(db: Db, id: string, input: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  const ctx = num(input.contexto, 1, 100_000_000);
  if (ctx !== undefined) data.contexto = ctx == null ? null : Math.round(ctx);
  const pin = num(input.precoEntrada, 0, 10_000);
  if (pin !== undefined) data.precoEntradaUsdMilhao = pin;
  const pout = num(input.precoSaida, 0, 10_000);
  if (pout !== undefined) data.precoSaidaUsdMilhao = pout;
  if (typeof input.ativo === "boolean") data.ativo = input.ativo;
  if (!Object.keys(data).length) throw new AdminInputError("nada_para_mudar");
  await db.aiModel.update({ where: { id }, data });
  await recomputeRoutes(db);
}

// ── testes ──

function ids(v: unknown): string[] {
  if (!Array.isArray(v)) throw new AdminInputError("modelos_obrigatorios");
  const out = [...new Set(v.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length < 64))];
  if (!out.length) throw new AdminInputError("modelos_obrigatorios");
  if (out.length > MAX_MODELS_PER_TEST) throw new AdminInputError("modelos_demais");
  return out;
}

export async function estimateTests(db: Db, input: Record<string, unknown>, env: Pick<AdminEnv, "globalDailyBudgetUsd" | "now">) {
  const modelIds = ids(input.modelos);
  const long = input.contextoLongo === true;
  const models = await db.aiModel.findMany({ where: { id: { in: modelIds } } });
  let total = 0;
  let semPreco = 0;
  const itens = models.map((m) => {
    const c = estimateTestCost(isEmbedding(m), { in: m.precoEntradaUsdMilhao, out: m.precoSaidaUsdMilhao }, long);
    if (c == null) semPreco++;
    else total += c;
    return { id: m.id, custoUsd: c };
  });
  const gasto = await spentTodayUsd(db, (env.now ?? Date.now)());
  return { itens, totalUsd: total, semPreco, gastoHojeUsd: gasto, orcamentoDiarioUsd: env.globalDailyBudgetUsd, cabeNoOrcamento: gasto + total <= env.globalDailyBudgetUsd };
}

export async function runTests(db: Db, input: Record<string, unknown>, env: AdminEnv) {
  const est = await estimateTests(db, input, env);
  if (!est.cabeNoOrcamento) throw new AdminInputError("orcamento_insuficiente");
  const long = input.contextoLongo === true;
  const models = await db.aiModel.findMany({ where: { id: { in: est.itens.map((i) => i.id) } }, include: { provider: true } });
  const now = env.now ?? Date.now;
  const resultados: Record<string, TestResult[]> = {};
  for (const m of models) {
    let results: TestResult[];
    try {
      const ctx = { ...(await contextFor(db, m.providerId, env)), model: m.modelo } as CallContext;
      results = await runCompatTests(ctx, { embedding: isEmbedding(m), longContext: long, now });
    } catch (e) {
      // Chave que não decifra, fornecedor apagado no meio…: vira um resultado, não derruba os outros.
      results = [{ teste: isEmbedding(m) ? "embeddings" : "texto", ok: false, detalhe: safeErrorText(e).slice(0, 200), latenciaMs: 0 }];
    }
    resultados[m.id] = results;
    await db.aiModelTest.createMany({
      data: results.map((r) => ({ modelId: m.id, teste: r.teste, ok: r.ok, detalhe: r.detalhe?.slice(0, 200) ?? null, latenciaMs: r.latenciaMs })),
    });
    const dim = results.find((r) => r.teste === "embeddings" && r.ok)?.detalhe?.match(/^dim:(\d+)$/)?.[1];
    if (dim) await db.aiModel.update({ where: { id: m.id }, data: { embeddingDim: Number(dim) } });
    // Custo dos testes entra no gasto do dia (o orçamento geral vale para eles também).
    const tin = results.reduce((n, r) => n + (r.tokensIn ?? 0), 0);
    const tout = results.reduce((n, r) => n + (r.tokensOut ?? 0), 0);
    await db.aiInteraction.create({
      data: {
        tarefa: "admin_teste",
        fornecedor: m.provider.nome,
        modelo: m.modelo,
        ok: results.every((r) => r.ok),
        erro: results.find((r) => !r.ok)?.detalhe?.slice(0, 300) ?? null,
        tokensEntrada: tin,
        tokensSaida: tout,
        custoUsd: (tin * (m.precoEntradaUsdMilhao ?? 0) + tout * (m.precoSaidaUsdMilhao ?? 0)) / 1e6,
        latenciaMs: results.reduce((n, r) => n + r.latenciaMs, 0),
      },
    });
  }
  await recomputeRoutes(db);
  return { resultados };
}

// ── rotas ──

/** Grava a rota automática de cada tarefa que não está fixada (mantém o orçamento de cada uma). */
export async function recomputeRoutes(db: Db): Promise<TaskRouting[]> {
  const routes = computeRoutes(await routingModels(db), await savedRoutes(db));
  for (const r of routes) {
    if (r.modo !== "automatico") continue;
    await db.taskRoute.upsert({
      where: { tarefa: r.tarefa },
      create: { tarefa: r.tarefa, modo: "automatico", modelos: r.modelos },
      update: { modo: "automatico", modelos: r.modelos },
    });
  }
  return routes;
}

export async function setRoute(db: Db, input: Record<string, unknown>) {
  const tarefa = input.tarefa;
  if (!isTaskName(tarefa) || LOCKED_TASKS.includes(tarefa)) throw new AdminInputError("tarefa_invalida");
  if (input.modo === "fixo") {
    const modelId = str(input.modelo, 64);
    if (!modelId) throw new AdminInputError("modelo_obrigatorio");
    const m = await db.aiModel.findUnique({ where: { id: modelId } });
    if (!m) throw new AdminInputError("modelo_nao_existe");
    const embed = TASKS[tarefa].kind === "embed";
    if (isEmbedding(m) !== embed) throw new AdminInputError("modelo_tipo_errado");
    await db.taskRoute.upsert({ where: { tarefa }, create: { tarefa, modo: "fixo", modelos: [modelId] }, update: { modo: "fixo", modelos: [modelId] } });
  } else {
    await db.taskRoute.upsert({ where: { tarefa }, create: { tarefa, modo: "automatico", modelos: [] }, update: { modo: "automatico" } });
  }
  return recomputeRoutes(db);
}
