/**
 * 3.6b: contas puras do Admin > Dados de treino: linha JSONL (formato de chat) e a nota simples
 * da comparação de modelos na prova fixa (D5). Sem banco e sem IA.
 *
 * Nota de 0 a 1 por exemplo:
 * - `extract_vacancy`: média campo a campo (título e listas por sobreposição de palavras; nível, regime,
 *   modo, moeda, cidade e faixa iguais ou não; competências por Jaccard);
 * - `ficha_w2`: sobreposição de palavras (F1) entre resumo + destaques do modelo e os da pessoa.
 */

export type ExemploJsonl = { sistema: string; entrada: string; saidaFinal: string };

/** Uma linha do JSONL: messages system/user/assistant (o assistant é a versão corrigida pela pessoa). */
export function linhaJsonl(ex: ExemploJsonl): string {
  return JSON.stringify({
    messages: [
      { role: "system", content: ex.sistema },
      { role: "user", content: ex.entrada },
      { role: "assistant", content: ex.saidaFinal },
    ],
  });
}

export function jsonl(exs: ExemploJsonl[]): string {
  return exs.map(linhaJsonl).join("\n") + (exs.length ? "\n" : "");
}

const dobrar = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Palavras (sem acento, minúsculas, 2+ caracteres). */
export function palavras(s: unknown): string[] {
  if (typeof s !== "string") return [];
  return dobrar(s).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 2);
}

/** F1 da sobreposição de palavras (conta repetidas). Dois vazios = 1. */
export function f1(a: string[], b: string[]): number {
  if (!a.length && !b.length) return 1;
  if (!a.length || !b.length) return 0;
  const conta = new Map<string, number>();
  for (const w of b) conta.set(w, (conta.get(w) ?? 0) + 1);
  let comum = 0;
  for (const w of a) {
    const n = conta.get(w) ?? 0;
    if (n > 0) {
      comum++;
      conta.set(w, n - 1);
    }
  }
  if (!comum) return 0;
  const p = comum / a.length;
  const r = comum / b.length;
  return (2 * p * r) / (p + r);
}

export function jaccard(a: string[], b: string[]): number {
  const A = new Set(a);
  const B = new Set(b);
  if (!A.size && !B.size) return 1;
  let i = 0;
  for (const x of A) if (B.has(x)) i++;
  return i / (A.size + B.size - i);
}

type Obj = Record<string, unknown>;
const lista = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const igual = (a: unknown, b: unknown) => (typeof a === "string" && typeof b === "string" ? dobrar(a.trim()) === dobrar(b.trim()) : (a ?? null) === (b ?? null));

export const CAMPOS_VAGA = ["titulo", "nivel", "regime", "modo", "cidade", "faixaDe", "faixaAte", "faixaMoeda", "stack", "descricaoBullets", "beneficios"] as const;

/** Nota de cada campo da vaga (0..1). */
export function notaCamposVaga(previsto: Obj, esperado: Obj): Record<(typeof CAMPOS_VAGA)[number], number> {
  return {
    titulo: f1(palavras(previsto.titulo), palavras(esperado.titulo)),
    nivel: igual(previsto.nivel, esperado.nivel) ? 1 : 0,
    regime: igual(previsto.regime, esperado.regime) ? 1 : 0,
    modo: igual(previsto.modo, esperado.modo) ? 1 : 0,
    cidade: igual(previsto.cidade, esperado.cidade) ? 1 : 0,
    faixaDe: igual(previsto.faixaDe, esperado.faixaDe) ? 1 : 0,
    faixaAte: igual(previsto.faixaAte, esperado.faixaAte) ? 1 : 0,
    faixaMoeda: igual(previsto.faixaMoeda, esperado.faixaMoeda) ? 1 : 0,
    stack: jaccard(lista(previsto.stack), lista(esperado.stack)),
    descricaoBullets: f1(palavras(lista(previsto.descricaoBullets).join(" ")), palavras(lista(esperado.descricaoBullets).join(" "))),
    beneficios: f1(palavras(lista(previsto.beneficios).join(" ")), palavras(lista(esperado.beneficios).join(" "))),
  };
}

export function notaVaga(previsto: Obj, esperado: Obj): number {
  const n = Object.values(notaCamposVaga(previsto, esperado));
  return n.reduce((s, x) => s + x, 0) / n.length;
}

export function notaFicha(previsto: Obj, esperado: Obj): number {
  const texto = (o: Obj) => `${typeof o.resumo === "string" ? o.resumo : ""} ${lista(o.destaques).join(" ")}`;
  return f1(palavras(texto(previsto)), palavras(texto(esperado)));
}

export function notaDaTarefa(tarefa: string, previsto: Obj, esperado: Obj): number {
  return tarefa === "extract_vacancy" ? notaVaga(previsto, esperado) : notaFicha(previsto, esperado);
}
