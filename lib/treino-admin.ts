/**
 * 3.6b Admin > Dados de treino (plano https://claude.ai/artifact/B1kcRjUJ5emNK2W4Xu9WSW, D4–D7).
 *
 * - Resumo por tarefa e status, com o mínimo de 500 aprovados para falar em treino (D7).
 * - Revisão de um exemplo por vez (aprovar/descartar).
 * - Exportação JSONL só dos aprovados fora da prova fixa, com registro de quem/quando/quantos.
 * - Apagar tudo de uma tarefa.
 * - Comparação (D5): o modelo atual da tarefa contra outro modelo cadastrado, na prova fixa
 *   (aprovados com `prova` = 1 em cada 10 pelo hash), até 20 exemplos por vez, dentro do orçamento
 *   diário de IA, como o teste de compatibilidade do Admin > IA (mesmo contexto, custo gravado no
 *   AiInteraction como "admin_comparacao"). Nada troca sozinho (D6): o resultado só aparece na tela.
 */
import type { PrismaClient } from "@prisma/client";
import { contextFor, spentTodayUsd, AdminInputError, type AdminEnv } from "./ai/admin";
import { callChat } from "./ai/providers";
import { orderCandidates, RESERVE_PROVIDER_ID, safeErrorText, type RouteCandidate } from "./ai/router";
import { prismaAiStore } from "./ai/store";
import { TASKS } from "./ai/tasks";
import type { CallContext, ChatRequest, ChatResult } from "./ai/types";
import { MIN_APROVADOS_TREINO, TAREFAS_TREINO, isTarefaTreino, type TarefaTreino } from "./treino";
import { jsonl, notaDaTarefa } from "./treino-nota";

type Db = PrismaClient;

/** D5: exemplos da prova fixa por comparação (custo e tempo de resposta do Worker). */
export const MAX_COMPARACAO = 20;
/** Teto de uma exportação (memória do Worker). */
export const MAX_EXPORTACAO = 5000;
/** Saída máxima de cada tarefa na comparação (a mesma das telas). */
const MAX_TOKENS: Record<TarefaTreino, number> = { ficha_w2: 800, extract_vacancy: 2500 };

export function tarefaOuErro(v: unknown): TarefaTreino {
  if (!isTarefaTreino(v)) throw new AdminInputError("tarefa_invalida");
  return v;
}

// ── resumo ──

export async function resumoTreino(db: Db) {
  const grupos = await db.exemploTreino.groupBy({ by: ["tarefa", "status", "prova"], _count: { _all: true } });
  const tarefas = TAREFAS_TREINO.map((tarefa) => {
    const da = grupos.filter((g) => g.tarefa === tarefa);
    const soma = (f: (g: (typeof da)[number]) => boolean) => da.filter(f).reduce((n, g) => n + g._count._all, 0);
    const aprovados = soma((g) => g.status === "aprovado");
    const prova = soma((g) => g.status === "aprovado" && g.prova);
    return {
      tarefa,
      pendente: soma((g) => g.status === "pendente"),
      aprovado: aprovados,
      descartado: soma((g) => g.status === "descartado"),
      /** Aprovados que vão na exportação (fora da prova fixa). */
      paraTreino: aprovados - prova,
      prova,
      minimo: MIN_APROVADOS_TREINO,
      podeTreinar: aprovados >= MIN_APROVADOS_TREINO,
    };
  });
  const exportacoes = await db.exportacaoTreino.findMany({ orderBy: { createdAt: "desc" }, take: 10 });
  return { tarefas, exportacoes: exportacoes.map((e) => ({ tarefa: e.tarefa, quantidade: e.quantidade, quem: e.quem, em: e.createdAt.toISOString() })) };
}

// ── revisão ──

/** O pendente mais antigo da tarefa (um por vez), ou null. */
export async function proximoPendente(db: Db, tarefa: TarefaTreino) {
  const ex = await db.exemploTreino.findFirst({ where: { tarefa, status: "pendente" }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  if (!ex) return null;
  return {
    id: ex.id,
    tarefa: ex.tarefa,
    idioma: ex.idioma,
    entrada: ex.entrada,
    saidaIa: ex.saidaIa,
    saidaFinal: ex.saidaFinal,
    corrigido: ex.corrigido,
    prova: ex.prova,
    criadoEm: ex.createdAt.toISOString(),
  };
}

export async function revisarExemplo(db: Db, id: unknown, acao: "aprovar" | "descartar", agora = new Date()) {
  if (typeof id !== "string" || !id || id.length > 64) throw new AdminInputError("id_invalido");
  const r = await db.exemploTreino.updateMany({ where: { id }, data: { status: acao === "aprovar" ? "aprovado" : "descartado", revisadoEm: agora } });
  if (!r.count) throw new AdminInputError("nao_encontrado");
}

// ── exportação ──

/**
 * JSONL dos aprovados fora da prova fixa, com o registro de quem exportou.
 * Até 5.000 por arquivo: com mais, sai em partes (`parte` 1, 2, ...), na mesma ordem fixa.
 */
export async function exportarTarefa(db: Db, tarefa: TarefaTreino, quem: string, parte = 1) {
  const where = { tarefa, status: "aprovado" as const, prova: false };
  const total = await db.exemploTreino.count({ where });
  const partes = Math.max(1, Math.ceil(total / MAX_EXPORTACAO));
  const p = Number.isInteger(parte) && parte >= 1 ? Math.min(parte, partes) : 1;
  const exs = await db.exemploTreino.findMany({
    where,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    skip: (p - 1) * MAX_EXPORTACAO,
    take: MAX_EXPORTACAO,
    select: { sistema: true, entrada: true, saidaFinal: true },
  });
  await db.exportacaoTreino.create({ data: { tarefa, quantidade: exs.length, quem: quem.slice(0, 120) } });
  return { conteudo: jsonl(exs), quantidade: exs.length, parte: p, partes };
}

export async function apagarTarefa(db: Db, tarefa: TarefaTreino): Promise<number> {
  return (await db.exemploTreino.deleteMany({ where: { tarefa } })).count;
}

/** Descartados há mais de 30 dias saem (Cron diário). */
export const DIAS_DESCARTADOS = 30;
export async function apagarDescartadosAntigos(db: Db, agora = new Date()): Promise<number> {
  const limite = new Date(agora.getTime() - DIAS_DESCARTADOS * 864e5);
  return (await db.exemploTreino.deleteMany({ where: { status: "descartado", revisadoEm: { lt: limite } } })).count;
}

// ── comparação (D5) ──

type Modelo = { id: string; rotulo: string; candidato: RouteCandidate };

/** Modelos de texto ligados que podem entrar na comparação (dado pessoal só em API marcada). */
function tarefaPessoal(tarefa: TarefaTreino): boolean {
  return "personalData" in TASKS[tarefa] && !!(TASKS[tarefa] as { personalData?: boolean }).personalData;
}

export async function modelosComparaveis(db: Db, tarefa: TarefaTreino) {
  const pessoal = tarefaPessoal(tarefa);
  const ms = await db.aiModel.findMany({
    where: { ativo: true, embeddingDim: null, provider: { ativo: true, ...(pessoal ? { aceitaDadosPessoais: true } : {}) } },
    include: { provider: true },
    orderBy: [{ providerId: "asc" }, { modelo: "asc" }],
  });
  return ms.map((m) => ({ id: m.id, rotulo: `${m.provider.nome} / ${m.modelo}` }));
}

function candidatoDe(m: { id: string; modelo: string; contexto: number | null; precoEntradaUsdMilhao: number | null; precoSaidaUsdMilhao: number | null; provider: { id: string; nome: string; tipo: RouteCandidate["kind"]; gatewayPath: string | null; baseUrl: string | null; chaveCifrada: string | null; aceitaDadosPessoais: boolean } }): RouteCandidate {
  return {
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
  };
}

/** O modelo que a tarefa usa agora (o primeiro da rota; sem rota, o padrão do Workers AI). */
export async function modeloAtual(db: Db, tarefa: TarefaTreino): Promise<Modelo> {
  const cfg = await prismaAiStore(db).route(tarefa);
  const c = orderCandidates(cfg)[0];
  return { id: c.modelId, rotulo: `${c.providerName} / ${c.model}`, candidato: c };
}

async function ctxDe(db: Db, c: RouteCandidate, env: AdminEnv): Promise<CallContext> {
  // O padrão do Workers AI (store.ts) não tem linha de fornecedor no banco.
  if (c.providerId === RESERVE_PROVIDER_ID) return { kind: "WORKERS_AI", model: c.model, gateway: env.gateway, ai: env.ai, fetch: env.fetch };
  return { ...(await contextFor(db, c.providerId, env)), model: c.model } as CallContext;
}

export type Chamar = (ctx: CallContext, req: ChatRequest) => Promise<ChatResult>;

const approx = (chars: number) => Math.ceil(chars / 4);
const custo = (c: RouteCandidate, tin: number, tout: number) => (tin * (c.priceIn ?? 0) + tout * (c.priceOut ?? 0)) / 1e6;

/** Prova fixa da tarefa: aprovados com `prova`, ordem fixa pelo hash (sempre os mesmos). */
export async function provaFixa(db: Db, tarefa: TarefaTreino, limite = MAX_COMPARACAO) {
  return db.exemploTreino.findMany({
    where: { tarefa, status: "aprovado", prova: true },
    orderBy: [{ conteudoHash: "asc" }],
    take: Math.max(1, Math.min(MAX_COMPARACAO, limite)),
    select: { id: true, sistema: true, entrada: true, saidaFinal: true },
  });
}

/**
 * Roda o modelo atual e o escolhido na prova fixa e devolve a nota média de cada um.
 * Custo estimado antes; passa do orçamento do dia → "orcamento_insuficiente".
 */
export async function compararModelos(db: Db, input: { tarefa: unknown; modelo: unknown; limite?: unknown }, env: AdminEnv, chamar: Chamar = callChat) {
  const tarefa = tarefaOuErro(input.tarefa);
  if (typeof input.modelo !== "string" || !input.modelo || input.modelo.length > 64) throw new AdminInputError("modelo_obrigatorio");
  const permitidos = await modelosComparaveis(db, tarefa);
  if (!permitidos.some((m) => m.id === input.modelo)) throw new AdminInputError("modelo_nao_serve");
  const m = await db.aiModel.findUnique({ where: { id: input.modelo }, include: { provider: true } });
  if (!m) throw new AdminInputError("modelo_nao_existe");
  const outro: Modelo = { id: m.id, rotulo: `${m.provider.nome} / ${m.modelo}`, candidato: candidatoDe(m) };
  const atual = await modeloAtual(db, tarefa);
  if (atual.id === outro.id) throw new AdminInputError("mesmo_modelo");
  // O modelo atual também precisa servir para a tarefa: com dado pessoal, só fornecedor que aceita
  // (a rota pode ter ficado presa num fornecedor que depois deixou de aceitar).
  if (tarefaPessoal(tarefa) && !atual.candidato.acceptsPersonalData) throw new AdminInputError("modelo_atual_nao_serve");

  const limite = typeof input.limite === "number" ? input.limite : MAX_COMPARACAO;
  const exs = await provaFixa(db, tarefa, limite);
  if (!exs.length) throw new AdminInputError("prova_vazia");

  const maxOut = MAX_TOKENS[tarefa];
  const tin = exs.reduce((n, e) => n + approx(e.sistema.length + e.entrada.length), 0);
  const estimado = custo(atual.candidato, tin, maxOut * exs.length) + custo(outro.candidato, tin, maxOut * exs.length);
  const now = (env.now ?? Date.now)();
  const gasto = await spentTodayUsd(db, now);
  if (gasto + estimado > env.globalDailyBudgetUsd) throw new AdminInputError("orcamento_insuficiente");

  const rodar = async (mod: Modelo) => {
    let notaSoma = 0;
    let falhas = 0;
    let tokensIn = 0;
    let tokensOut = 0;
    let erro: string | undefined;
    const t0 = (env.now ?? Date.now)();
    let ctx: CallContext | null = null;
    try {
      ctx = await ctxDe(db, mod.candidato, env);
    } catch (e) {
      erro = safeErrorText(e).slice(0, 200);
    }
    for (const ex of exs) {
      if (!ctx) {
        falhas++;
        continue;
      }
      try {
        const r = await chamar(ctx, {
          json: true,
          temperature: 0,
          maxTokens: maxOut,
          messages: [
            { role: "system", content: ex.sistema },
            { role: "user", content: ex.entrada },
          ],
        });
        tokensIn += r.tokensIn ?? approx(ex.sistema.length + ex.entrada.length);
        tokensOut += r.tokensOut ?? approx(r.text.length);
        const { parseJsonObject } = await import("./ficha-ai");
        const obj = parseJsonObject(r.text);
        if (!obj) {
          falhas++;
          continue;
        }
        let previsto: Record<string, unknown> = obj;
        if (tarefa === "extract_vacancy") {
          const { sanitizarRascunho } = await import("./vaga-ai");
          previsto = sanitizarRascunho(obj) as unknown as Record<string, unknown>;
        }
        notaSoma += notaDaTarefa(tarefa, previsto, JSON.parse(ex.saidaFinal) as Record<string, unknown>);
      } catch (e) {
        falhas++;
        erro ??= safeErrorText(e).slice(0, 200);
      }
    }
    await db.aiInteraction.create({
      data: {
        tarefa: "admin_comparacao",
        fornecedor: mod.candidato.providerName,
        modelo: mod.candidato.model,
        ok: falhas === 0,
        erro: erro ?? (falhas ? "json_invalido" : null),
        tokensEntrada: tokensIn,
        tokensSaida: tokensOut,
        custoUsd: custo(mod.candidato, tokensIn, tokensOut),
        latenciaMs: (env.now ?? Date.now)() - t0,
      },
    });
    // Falha conta como nota 0: um modelo que não responde JSON não serve para a tarefa.
    return { id: mod.id, rotulo: mod.rotulo, nota: notaSoma / exs.length, falhas, custoUsd: custo(mod.candidato, tokensIn, tokensOut), erro: erro ?? null };
  };

  const resAtual = await rodar(atual);
  const resOutro = await rodar(outro);
  return { tarefa, n: exs.length, estimadoUsd: estimado, atual: resAtual, outro: resOutro };
}
