/**
 * Revisor de viés na Ficha W2 (depois do 2.1c): as mesmas regras do revisor da vaga
 * (`lib/vaga-vies.ts`, lista única) no texto livre que o candidato escreve ou confere:
 * cargo desejado, objetivo, resumo e destaques. Só avisa (o texto pode expor um dado
 * sensível, como idade, estado civil ou religião, e atrapalhar); nunca impede salvar,
 * gerar ou publicar. Sem IA: roda no navegador. Funções puras.
 */
import { achadosVies, aplicarTroca, type AchadoVies } from "./vaga-vies";

export type CampoFichaVies = "titulo" | "objetivo" | "resumo" | "destaque";

export type AvisoFichaVies = AchadoVies & {
  campo: CampoFichaVies;
  /** Qual destaque (0, 1, 2); 0 nos outros campos. */
  indice: number;
};

export type TextosFichaVies = { titulo?: string; objetivo?: string; resumo?: string; destaques?: string[] };

/** Avisos na ordem dos campos (cargo, objetivo, resumo, destaques) e do texto. No máximo `max`. */
export function revisarViesFicha(textos: TextosFichaVies, max = 20): AvisoFichaVies[] {
  const pares: [CampoFichaVies, number, string][] = [
    ["titulo", 0, textos.titulo ?? ""],
    ["objetivo", 0, textos.objetivo ?? ""],
    ["resumo", 0, textos.resumo ?? ""],
    ...(textos.destaques ?? []).map((d, i) => ["destaque", i, d] as [CampoFichaVies, number, string]),
  ];
  const out: AvisoFichaVies[] = [];
  for (const [campo, indice, texto] of pares) {
    out.push(...achadosVies(texto).map((a) => ({ ...a, campo, indice })));
    if (out.length >= max) break;
  }
  return out.slice(0, max);
}

/** Aplica a troca sugerida do aviso nos textos e devolve os textos novos (os outros ficam iguais). */
export function trocarViesFicha<T extends TextosFichaVies>(textos: T, aviso: AvisoFichaVies): T {
  if (aviso.campo === "destaque") {
    const lista = [...(textos.destaques ?? [])];
    if (lista[aviso.indice] === undefined) return textos;
    lista[aviso.indice] = aplicarTroca(lista[aviso.indice], aviso);
    return { ...textos, destaques: lista };
  }
  const atual = textos[aviso.campo];
  if (typeof atual !== "string") return textos;
  return { ...textos, [aviso.campo]: aplicarTroca(atual, aviso) };
}
