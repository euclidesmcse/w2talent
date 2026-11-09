/**
 * Rota automática de cada tarefa (1.5.8). Função pura.
 *
 * Decisão do Euclides em 2026-11-09: por padrão, cada tarefa usa os modelos que passaram nos testes
 * que ela exige, do mais barato para o mais caro; o Workers AI padrão fica no fim como reserva
 * (store.ts). Tarefa com dados pessoais só usa fornecedor marcado como "aceita dados pessoais".
 * Modelo sem preço só entra se o admin fixar. O admin pode fixar um modelo por tarefa.
 *
 * A tarefa de embeddings não muda sozinha: trocar o modelo exige reindexar tudo (lib/embeddings.ts).
 */
import { TASKS, type TaskName } from "./tasks";
import { blockers, type LatestTests } from "./compat";

export type RoutingModel = {
  id: string;
  modelo: string;
  providerNome: string;
  providerAtivo: boolean;
  aceitaDadosPessoais: boolean;
  ativo: boolean;
  embedding: boolean;
  contexto?: number | null;
  precoEntrada?: number | null;
  precoSaida?: number | null;
  tests: LatestTests;
};

/** Tarefas que a rota automática não mexe. */
export const LOCKED_TASKS: readonly TaskName[] = ["embed"];

export type TaskRouting = {
  tarefa: TaskName;
  modo: "automatico" | "fixo" | "travado";
  /** Ids dos modelos na ordem de uso (vazio = só o padrão do Workers AI). */
  modelos: string[];
  /** Por que essa escolha (código para a tela traduzir). */
  motivo: "mais_barato_aprovado" | "nenhum_aprovado" | "fixado" | "travado";
  /** Para cada modelo que ficou de fora: os códigos do motivo. */
  fora: Record<string, string[]>;
};

export function priceOf(m: Pick<RoutingModel, "precoEntrada" | "precoSaida">): number | null {
  if (m.precoEntrada == null && m.precoSaida == null) return null;
  return (m.precoEntrada ?? 0) + (m.precoSaida ?? 0);
}

/** Motivos para um modelo não entrar na rota automática de uma tarefa ([] = entra). */
export function exclusionReasons(task: TaskName, m: RoutingModel): string[] {
  const spec = TASKS[task];
  const out: string[] = [];
  if (!m.ativo || !m.providerAtivo) out.push("desligado");
  out.push(...blockers(task, { embedding: m.embedding, contexto: m.contexto, tests: m.tests }));
  if ("personalData" in spec && spec.personalData && !m.aceitaDadosPessoais) out.push("dados_pessoais");
  if (priceOf(m) == null) out.push("sem_preco");
  return out;
}

export function autoRoute(task: TaskName, models: RoutingModel[]): TaskRouting {
  const fora: Record<string, string[]> = {};
  const ok: RoutingModel[] = [];
  for (const m of models) {
    const r = exclusionReasons(task, m);
    if (r.length) fora[m.id] = r;
    else ok.push(m);
  }
  // sort estável: empate mantém a ordem recebida
  ok.sort((a, b) => (priceOf(a) ?? Infinity) - (priceOf(b) ?? Infinity));
  return {
    tarefa: task,
    modo: "automatico",
    modelos: ok.map((m) => m.id),
    motivo: ok.length ? "mais_barato_aprovado" : "nenhum_aprovado",
    fora,
  };
}

export type SavedRoute = { modo: string; modelos: string[] } | undefined;

/** Rota de todas as tarefas: as fixadas ficam como o admin deixou; as outras são recalculadas. */
export function computeRoutes(models: RoutingModel[], saved: Partial<Record<TaskName, SavedRoute>>): TaskRouting[] {
  return (Object.keys(TASKS) as TaskName[]).map((task) => {
    if (LOCKED_TASKS.includes(task)) return { tarefa: task, modo: "travado", modelos: saved[task]?.modelos ?? [], motivo: "travado", fora: {} };
    const s = saved[task];
    if (s?.modo === "fixo" && s.modelos.length) return { tarefa: task, modo: "fixo", modelos: s.modelos.slice(0, 1), motivo: "fixado", fora: {} };
    return autoRoute(task, models);
  });
}
