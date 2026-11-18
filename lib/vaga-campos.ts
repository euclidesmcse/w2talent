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


/**
 * Valor digitado na faixa → número inteiro. Aceita "8000", "8.000", "8,000", "8.000,00", "8,000.00" e "8k".
 * Vírgula ou ponto com 1 ou 2 dígitos no fim são centavos (descartados). Null quando não dá para ler.
 */
export function valorFaixa(raw: string): number | null {
  let s = raw.trim().replace(/^(?:R\$|US\$|\$|€)\s*/i, "").replace(/\s+/g, "");
  if (!s) return null;
  let mult = 1;
  if (/k$/i.test(s)) {
    mult = 1000;
    s = s.slice(0, -1);
  }
  s = s.replace(/[.,]\d{1,2}$/, "");
  if (!/^\d{1,3}(?:([.,])\d{3}(?:\1\d{3})*)?$|^\d+$/.test(s)) return null;
  const n = Number(s.replace(/[.,]/g, "")) * mult;
  return Number.isFinite(n) && n > 0 && n <= 1_000_000 ? Math.round(n) : null;
}
