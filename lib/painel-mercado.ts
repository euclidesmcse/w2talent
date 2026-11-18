/**
 * 3.2b "Sua pretensão e o mercado" no /painel (plano 3.2, D5). Sem IA e sem guardar nada:
 * lê os números já calculados em MarketStat (lib/mercado.ts) e compara com a ficha publicada.
 * - Competência principal: a primeira do stack da ficha que tem faixa publicável no nível da ficha
 *   e no regime/moeda de alguma pretensão mensal dela.
 * - Cada pretensão mensal (regime + moeda) é comparada com a faixa típica das vagas do grupo
 *   (do "de" mediano ao "até" mediano; `faixaDasVagas`).
 * - Em alta: até 5 de `emAlta`, marcando as que a ficha já tem.
 */
import type { PrismaClient } from "@prisma/client";
import { lerGrupos, lerMercado, nivelDaFicha, pretensoesMensais, skillsDaFicha, type Demanda, type GrupoChave, type MercadoDoGrupo } from "./mercado";
import { faixaDasVagas, posicaoNaFaixa, type PainelMercado } from "./mercado-tela";

export const PAINEL_MAX_ALTA = 5;
/** Competências da ficha olhadas, na ordem do stack. */
export const PAINEL_MAX_SKILLS = 20;

type PerfilMercado = { stack: unknown; senioridade: string | null; pretensoes: unknown };
type PainelOk = Extract<PainelMercado, { estado: "ok" }>;

const skillsDoPerfil = (p: PerfilMercado) => [...new Set(skillsDaFicha(p.stack))].slice(0, PAINEL_MAX_SKILLS);

/** Os grupos a ler para a ficha: cada competência × cada pretensão mensal, no nível da ficha. */
export function gruposDaFicha(p: PerfilMercado): GrupoChave[] {
  const nivel = nivelDaFicha(p.senioridade);
  if (!nivel) return [];
  const pret = pretensoesMensais(p.pretensoes);
  return skillsDoPerfil(p).flatMap((skillId) => pret.map((x) => ({ skillId, nivel, regime: x.regime, moeda: x.moeda })));
}

/** Conta pura: monta a resposta a partir da ficha e dos grupos lidos. */
export function montarPainelMercado(
  p: PerfilMercado,
  semana: string | null,
  grupos: MercadoDoGrupo[],
  alta: Demanda[],
  rotulo: (skillId: string) => string = (s) => s,
): PainelOk {
  const nivel = nivelDaFicha(p.senioridade);
  const pret = pretensoesMensais(p.pretensoes);
  const skills = skillsDoPerfil(p);
  const porChave = new Map(grupos.map((g) => [[g.skillId, g.nivel, g.regime, g.moeda].join("|"), g]));
  let principal: PainelOk["principal"] = null;
  if (nivel) {
    for (const skillId of skills) {
      const comparacoes: NonNullable<PainelOk["principal"]>["comparacoes"] = [];
      const vistos = new Set<string>();
      for (const x of pret) {
        const k = `${x.regime}|${x.moeda}`;
        if (vistos.has(k)) continue;
        vistos.add(k);
        const faixa = faixaDasVagas(porChave.get([skillId, nivel, x.regime, x.moeda].join("|"))?.vagas);
        const posicao = posicaoNaFaixa(x.valor, faixa);
        if (faixa && posicao) comparacoes.push({ regime: x.regime, moeda: x.moeda, valor: x.valor, faixa, posicao });
      }
      if (comparacoes.length) {
        principal = { skillId, label: rotulo(skillId), nivel, comparacoes };
        break;
      }
    }
  }
  const tem = new Set(skillsDaFicha(p.stack));
  return {
    estado: "ok",
    semana,
    principal,
    semPretensao: !nivel || pret.length === 0,
    emAlta: alta.slice(0, PAINEL_MAX_ALTA).map((d) => ({ skillId: d.skillId, label: rotulo(d.skillId), tem: tem.has(d.skillId) })),
  };
}

export async function painelMercado(db: Pick<PrismaClient, "marketStat">, p: PerfilMercado, rotulo?: (skillId: string) => string): Promise<PainelMercado> {
  const [lidos, visao] = await Promise.all([lerGrupos(db, gruposDaFicha(p)), lerMercado(db)]);
  return montarPainelMercado(p, visao.semana ?? lidos.semana, lidos.grupos, visao.emAlta, rotulo);
}
