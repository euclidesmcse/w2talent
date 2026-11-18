/**
 * 3.1 Ranking adaptativo (plano https://claude.ai/artifact/2rZ6JLB2nttLtaZxBXe4Bd, D1–D7).
 * - D1: só os 5 pesos do match aprendem (competências, nível, condições, atualização, completude).
 *   Nada de critério novo; nunca idade, gênero, foto, estado civil ou endereço.
 * - D2: positivo = a candidatura chegou a Entrevista, Proposta ou Contratada; negativo = "Não seguiu"
 *   sem nunca ter chegado lá. Ficha vista e exportar não entram. Exemplo, teste e empresa recusada ficam de fora.
 * - D3: para cada parte, média nos positivos menos média nos negativos; o peso sobe ou desce até ±50%,
 *   encolhido para o padrão com poucos sinais (n / (n + 30)); a soma volta a 100. Sem IA.
 * - D4: escopo global e por empresa; cada um só vale com 30 exemplos ou mais.
 * - D6: as partes vêm do sinal etapa_mudou (gravadas no momento da decisão); sinal antigo sem partes não entra.
 * - D7: o admin pode desligar um escopo (volta ao padrão).
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { MATCH_WEIGHTS, type MatchPartes, type PesosMatch } from "./match";
import { FICHA_REAL, VAGA_REAL } from "./mercado";

export const PARTES = ["skills", "nivel", "condicoes", "recencia", "completude"] as const satisfies readonly (keyof MatchPartes)[];
export const MIN_EXEMPLOS = 30;
export const LIMITE = 0.5;
export const ETAPAS_POSITIVAS = ["entrevista", "proposta", "contratada"] as const;
export const ETAPA_NEGATIVA = "nao_seguiu";

export type Exemplo = { partes: MatchPartes; positivo: boolean };
export type CalculoPesos = { pesos: PesosMatch; n: number; nPositivos: number; nNegativos: number };

const PADRAO: PesosMatch = { ...MATCH_WEIGHTS };

/** As partes gravadas num sinal, ou null se faltar alguma ou vier fora de 0..1. */
export function partesDoSinal(dados: unknown): MatchPartes | null {
  if (!dados || typeof dados !== "object") return null;
  const d = dados as Record<string, unknown>;
  const p = {} as MatchPartes;
  for (const k of PARTES) {
    const v = d[`p_${k}`];
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1) return null;
    p[k] = v;
  }
  return p;
}

/** As partes no formato do campo `dados` do sinal (números chatos, 3 casas). */
export function partesParaSinal(p: MatchPartes): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of PARTES) out[`p_${k}`] = Math.round(p[k] * 1000) / 1000;
  return out;
}

const media = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const limitar = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Soma 100, cada peso dentro de ±50% do padrão (algumas voltas de normalizar e cortar). */
function normalizar(raw: PesosMatch, base: PesosMatch): PesosMatch {
  let w = { ...raw };
  for (let volta = 0; volta < 20; volta++) {
    const soma = PARTES.reduce((a, k) => a + w[k], 0);
    const escalado = {} as PesosMatch;
    for (const k of PARTES) escalado[k] = (w[k] * 100) / soma;
    let mexeu = false;
    for (const k of PARTES) {
      const c = limitar(escalado[k], base[k] * (1 - LIMITE), base[k] * (1 + LIMITE));
      if (Math.abs(c - escalado[k]) > 1e-9) mexeu = true;
      escalado[k] = c;
    }
    w = escalado;
    if (!mexeu) break;
  }
  const out = {} as PesosMatch;
  for (const k of PARTES) out[k] = Math.round(w[k] * 10) / 10;
  return out;
}

/** D3: os pesos que os exemplos sustentam. Sem positivos ou sem negativos, o padrão. */
export function calcularPesos(exemplos: Exemplo[], base: PesosMatch = PADRAO): CalculoPesos {
  const pos = exemplos.filter((e) => e.positivo);
  const neg = exemplos.filter((e) => !e.positivo);
  const n = exemplos.length;
  const r = { n, nPositivos: pos.length, nNegativos: neg.length };
  if (!pos.length || !neg.length) return { pesos: { ...base }, ...r };
  const encolhe = n / (n + MIN_EXEMPLOS);
  const raw = {} as PesosMatch;
  for (const k of PARTES) {
    const d = media(pos.map((e) => e.partes[k])) - media(neg.map((e) => e.partes[k]));
    const mult = 1 + encolhe * limitar(d, -LIMITE, LIMITE);
    raw[k] = base[k] * mult;
  }
  return { pesos: normalizar(raw, base), ...r };
}

export type LinhaPesos = { escopo: string; escopoId: string; pesos: unknown; n: number; desligado: boolean };

/** D4: pesos da empresa (n ≥ 30), senão os globais (n ≥ 30), senão o padrão. Desligado = padrão. */
export function escolherPesos(linhas: LinhaPesos[], companyId: string | null): { pesos: PesosMatch; escopo: "empresa" | "global" | "padrao" } {
  const valida = (l: LinhaPesos | undefined) => !!l && !l.desligado && l.n >= MIN_EXEMPLOS && pesosValidos(l.pesos);
  const global = linhas.find((l) => l.escopo === "global");
  if (global?.desligado) return { pesos: { ...PADRAO }, escopo: "padrao" };
  const empresa = companyId ? linhas.find((l) => l.escopo === "empresa" && l.escopoId === companyId) : undefined;
  if (empresa?.desligado) return { pesos: { ...PADRAO }, escopo: "padrao" };
  if (valida(empresa)) return { pesos: empresa!.pesos as PesosMatch, escopo: "empresa" };
  if (valida(global)) return { pesos: global!.pesos as PesosMatch, escopo: "global" };
  return { pesos: { ...PADRAO }, escopo: "padrao" };
}

function pesosValidos(x: unknown): x is PesosMatch {
  if (!x || typeof x !== "object") return false;
  return PARTES.every((k) => typeof (x as Record<string, unknown>)[k] === "number");
}

type SinalEtapa = { applicationId: string | null; dados: unknown; createdAt: Date; vacancy: { companyId: string } | null };

/**
 * D2/D6: um exemplo por candidatura. Positivo se alguma mudança foi para Entrevista ou depois
 * (partes daquela primeira vez); senão negativo se foi para "Não seguiu" (partes daquela vez).
 */
export function exemplosDosSinais(sinais: SinalEtapa[]): Map<string, Exemplo & { companyId: string }> {
  const porApp = new Map<string, SinalEtapa[]>();
  for (const s of sinais) {
    if (!s.applicationId || !s.vacancy) continue;
    const l = porApp.get(s.applicationId) ?? [];
    l.push(s);
    porApp.set(s.applicationId, l);
  }
  const out = new Map<string, Exemplo & { companyId: string }>();
  for (const [app, lista] of porApp) {
    lista.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const para = (s: SinalEtapa) => (s.dados as { para?: unknown } | null)?.para;
    const pos = lista.find((s) => (ETAPAS_POSITIVAS as readonly unknown[]).includes(para(s)) && partesDoSinal(s.dados));
    const neg = lista.find((s) => para(s) === ETAPA_NEGATIVA && partesDoSinal(s.dados));
    const alcancouPositiva = lista.some((s) => (ETAPAS_POSITIVAS as readonly unknown[]).includes(para(s)));
    const escolhido = pos ?? (alcancouPositiva ? undefined : neg);
    if (!escolhido) continue;
    out.set(app, { partes: partesDoSinal(escolhido.dados)!, positivo: escolhido === pos, companyId: escolhido.vacancy!.companyId });
  }
  return out;
}

const WHERE_SINAIS: Prisma.FeedbackSignalWhereInput = {
  tipo: "etapa_mudou",
  applicationId: { not: null },
  candidate: FICHA_REAL,
  vacancy: VAGA_REAL,
};

/** Cron diário: recalcula o global e o de cada empresa com sinais. Mantém o "desligado" do admin. */
export async function atualizarPesos(db: PrismaClient, now = new Date()): Promise<{ global: number; empresas: number }> {
  const sinais: SinalEtapa[] = [];
  let cursor: string | undefined;
  for (;;) {
    const lote = await db.feedbackSignal.findMany({
      where: WHERE_SINAIS,
      select: { id: true, applicationId: true, dados: true, createdAt: true, vacancy: { select: { companyId: true } } },
      orderBy: { id: "asc" },
      take: 1000,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    sinais.push(...lote);
    if (lote.length < 1000) break;
    cursor = lote[lote.length - 1].id;
  }
  const exemplos = [...exemplosDosSinais(sinais).values()];
  const porEmpresa = new Map<string, Exemplo[]>();
  for (const e of exemplos) porEmpresa.set(e.companyId, [...(porEmpresa.get(e.companyId) ?? []), e]);

  const gravar = async (escopo: string, escopoId: string, c: CalculoPesos) => {
    const data = { pesos: c.pesos as unknown as Prisma.InputJsonValue, n: c.n, nPositivos: c.nPositivos, nNegativos: c.nNegativos, atualizadoEm: now };
    await db.rankingWeights.upsert({ where: { escopo_escopoId: { escopo, escopoId } }, create: { escopo, escopoId, ...data }, update: data });
  };
  const g = calcularPesos(exemplos);
  await gravar("global", "", g);
  for (const [companyId, lista] of porEmpresa) await gravar("empresa", companyId, calcularPesos(lista));
  // Empresa que perdeu todos os exemplos (ex.: foi recusada) não fica com pesos velhos.
  await db.rankingWeights.deleteMany({ where: { escopo: "empresa", escopoId: { notIn: [...porEmpresa.keys()] }, desligado: false } });
  return { global: g.n, empresas: porEmpresa.size };
}

/** Os pesos que valem para a empresa agora (3.1b usa na ordem dos candidatos). */
export async function pesosDaEmpresa(db: Pick<PrismaClient, "rankingWeights">, companyId: string | null) {
  const linhas = await db.rankingWeights.findMany({
    where: { OR: [{ escopo: "global" }, ...(companyId ? [{ escopo: "empresa", escopoId: companyId }] : [])] },
    select: { escopo: true, escopoId: true, pesos: true, n: true, desligado: true },
  });
  return escolherPesos(linhas, companyId);
}

export { PADRAO as PESOS_PADRAO };
