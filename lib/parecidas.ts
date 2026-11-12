/**
 * Vagas parecidas no detalhe da vaga (ideia do portal emagine, aprovada pelo Euclides em 2026-11-12).
 * Com banco: as mais próximas pelo vetor bge-m3 que a indexação já guarda (sem IA nova na hora).
 * Vaga sem vetor, banco vazio ou fora do ar: as que mais dividem competências com ela.
 */
export const MAX_PARECIDAS = 5;

export type VagaResumo = {
  id: string;
  titulo: string;
  nivel: string | null;
  localidade: string | null;
  regime: string | null;
  faixaDe: number | null;
  faixaAte: number | null;
  faixaMoeda: string | null;
  stack: { skillId: string }[];
};

type VagaQualquer = Record<string, any>;

function skillsDe(v: VagaQualquer): string[] {
  const s = Array.isArray(v?.stack) ? v.stack : [];
  return s.map((x: any) => (typeof x === "string" ? x : x?.skillId)).filter((x: unknown): x is string => typeof x === "string");
}

export function resumoDaVaga(v: VagaQualquer): VagaResumo {
  return {
    id: String(v.id),
    titulo: String(v.titulo ?? ""),
    nivel: v.nivel ?? null,
    localidade: v.localidade ?? null,
    regime: v.regime ?? null,
    faixaDe: typeof v.faixaDe === "number" ? v.faixaDe : null,
    faixaAte: typeof v.faixaAte === "number" ? v.faixaAte : null,
    faixaMoeda: v.faixaMoeda ?? null,
    stack: skillsDe(v).map((skillId) => ({ skillId })),
  };
}

function ativa(v: VagaQualquer, agora: Date): boolean {
  if (v.status && v.status !== "ativa") return false;
  if (v.expiresAt && new Date(v.expiresAt).getTime() <= agora.getTime()) return false;
  return true;
}

/**
 * As vagas ativas que mais dividem competências com a vaga dada (Jaccard).
 * Sem nenhuma competência em comum, não entra. Empate: a mais recente primeiro.
 */
export function parecidasPorCompetencia(alvo: VagaQualquer, todas: VagaQualquer[], n = MAX_PARECIDAS, agora = new Date()): VagaResumo[] {
  const a = new Set(skillsDe(alvo));
  if (!a.size) return [];
  const quando = (v: VagaQualquer) => new Date(v.updatedAt ?? v.createdAt ?? 0).getTime() || 0;
  return todas
    .filter((v) => v && String(v.id) !== String(alvo.id) && ativa(v, agora))
    .map((v) => {
      const b = new Set(skillsDe(v));
      let comum = 0;
      for (const s of b) if (a.has(s)) comum++;
      const uniao = a.size + b.size - comum;
      return { v, nota: uniao ? comum / uniao : 0 };
    })
    .filter((x) => x.nota > 0)
    .sort((x, y) => y.nota - x.nota || quando(y.v) - quando(x.v))
    .slice(0, n)
    .map((x) => resumoDaVaga(x.v));
}
