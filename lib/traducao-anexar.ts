/**
 * 2.7a: anexa a tradução automática às vagas que as rotas públicas devolvem (busca e parecidas).
 * Os campos originais nunca mudam: a tradução vai num campo à parte (`traducao`), e a tela
 * mostra a tradução com o aviso "Tradução automática" e o botão "Ver original".
 * Banco fora do ar (dados de demonstração): todas ficam com `traducao: null`.
 */
import { runInBackground } from "./background";
import { idiomaValido, pedirTraducaoVagas, traducoesDasVagas, type Idioma } from "./traducao";

export type TraducaoAnexada = {
  idioma: Idioma;
  idiomaOrigem: string;
  titulo: string;
  descricaoBullets: string[];
  beneficios: string[];
};

/** Quantas vagas sem tradução uma busca pede para a IA traduzir em segundo plano. */
export const PEDIDOS_POR_BUSCA = 3;

export async function anexarTraducoes<T extends { id?: string | null }>(itens: T[], idioma: string): Promise<(T & { traducao: TraducaoAnexada | null })[]> {
  const nulas = itens.map((i) => ({ ...i, traducao: null }));
  if (!idiomaValido(idioma)) return nulas;
  const ids = [...new Set(itens.map((i) => i.id).filter((x): x is string => typeof x === "string" && !!x))];
  if (!ids.length) return nulas;
  try {
    const { prisma } = await import("./prisma");
    const mapa = await traducoesDasVagas(prisma, ids, idioma);
    // Pede as que faltam sem atrasar a resposta (a IA roda depois, com ctx.waitUntil no Worker).
    runInBackground("pedir tradução de vagas", () => pedirTraducaoVagas(prisma, ids, PEDIDOS_POR_BUSCA));
    return itens.map((i) => {
      const t = i.id ? mapa.get(i.id) : undefined;
      return { ...i, traducao: t ? { idioma, idiomaOrigem: t.idiomaOrigem, titulo: t.titulo, descricaoBullets: t.descricaoBullets, beneficios: t.beneficios } : null };
    });
  } catch (e) {
    console.warn("[traducao] anexar falhou:", e instanceof Error ? e.name : e);
    return nulas;
  }
}

/** Depois de criar ou editar o texto de uma vaga: pede a tradução nova (a antiga deixou de valer). */
export async function pedirTraducaoDaVaga(db: Parameters<typeof pedirTraducaoVagas>[0], id: string): Promise<void> {
  try {
    await pedirTraducaoVagas(db, [id], 1);
  } catch (e) {
    console.warn("[traducao] pedido falhou:", e instanceof Error ? e.name : e);
  }
}
