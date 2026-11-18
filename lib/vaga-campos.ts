/**
 * Campos da vaga na tela Publicar vaga (2.1b). Arquivo leve, sem IA nem taxonomia,
 * para a tela usar sem levar o resto para o navegador.
 */
export const NIVEIS = ["Estágio", "Júnior", "Pleno", "Sênior", "Especialista"] as const;
export const REGIMES = ["CLT", "PJ", "Estágio", "Freelancer"] as const;
export const MODOS = ["remoto", "hibrido", "presencial"] as const;
export const MOEDAS = ["BRL", "USD", "EUR"] as const;

export type Nivel = (typeof NIVEIS)[number];
export type RegimeVaga = (typeof REGIMES)[number];
export type ModoVaga = (typeof MODOS)[number];

export type RascunhoVaga = {
  titulo: string;
  nivel: Nivel | "";
  regime: RegimeVaga | "";
  /** Cidade (ou "Cidade, UF"); vazio quando a vaga é só remota ou o texto não diz. */
  cidade: string;
  modo: ModoVaga | "";
  stack: string[];
  faixaDe: number | null;
  faixaAte: number | null;
  faixaMoeda: (typeof MOEDAS)[number];
  descricaoBullets: string[];
  beneficios: string[];
};

export function rascunhoVazio(): RascunhoVaga {
  return { titulo: "", nivel: "", regime: "", cidade: "", modo: "", stack: [], faixaDe: null, faixaAte: null, faixaMoeda: "BRL", descricaoBullets: [], beneficios: [] };
}

const MODO_ROTULO: Record<ModoVaga, string> = { remoto: "Remoto", hibrido: "Híbrido", presencial: "Presencial" };

/** Como a vaga guarda o local (igual aos exemplos): "Remoto", "São Paulo (Híbrido)", "Curitiba". */
export function localidadeDaVaga(cidade: string, modo: ModoVaga | ""): string | null {
  const c = cidade.trim();
  if (!c) return modo ? MODO_ROTULO[modo] : null;
  return modo ? `${c} (${MODO_ROTULO[modo]})` : c;
}

