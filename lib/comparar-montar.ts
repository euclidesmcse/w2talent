/**
 * 2.3 Monta a comparação no servidor: a mesma para a tela Comparar e para o link compartilhado.
 * Perfil sem contatos (`withoutContacts`), só os campos de `itemDaComparacao`; vaga só da empresa dada.
 */
import type { PrismaClient } from "@prisma/client";
import { withoutContacts } from "./search";
import { matchCandidato } from "./match-candidato";
import { itemDaComparacao, type ItemComparacao } from "./comparar";

type Db = PrismaClient;

const SELECT_VAGA = { id: true, titulo: true, stack: true, nivel: true, regime: true, localidade: true, faixaDe: true, faixaAte: true, faixaMoeda: true, descricaoBullets: true, updatedAt: true, createdAt: true } as const;

/** Mesmo critério da busca de Candidatos: vaga ativa, no prazo e da empresa. Sem empresa, nenhuma. */
export async function vagaDaEmpresa(db: Db, vagaId: string, companyId: string | null | undefined, agora = new Date()) {
  if (!companyId) return null;
  return db.vacancy.findFirst({ where: { id: vagaId, companyId, status: "ativa", expiresAt: { gt: agora } }, select: SELECT_VAGA });
}

export type VagaComparacao = NonNullable<Awaited<ReturnType<typeof vagaDaEmpresa>>>;

export async function montarComparacao(db: Db, ids: string[], vaga: VagaComparacao | null, agora = new Date()): Promise<{ itens: ItemComparacao[]; fora: string[] }> {
  // Como na busca: perfil vencido (antes da higiene arquivar) também fica de fora.
  const perfis = await db.candidateProfile.findMany({ where: { id: { in: ids }, status: "ativo", expiresAt: { gt: agora } } });
  const porId = new Map(perfis.map((p) => [p.id, p]));
  // Na ordem pedida; quem saiu do ar (arquivado, apagado) vem em "fora".
  const itens = ids
    .filter((id) => porId.has(id))
    .map((id) => {
      const p = porId.get(id)!;
      const m = vaga ? matchCandidato(p, vaga, agora.getTime()) : null;
      return itemDaComparacao(withoutContacts(p), m ? { match: m.pct, gaps: m.gaps } : null, agora);
    });
  return { itens, fora: ids.filter((id) => !porId.has(id)) };
}
