/**
 * 2.3 Resumos em tabela (plano https://claude.ai/artifact/TyS3xB9BxT8c19yBEBiLV2, aprovado pelo Euclides em 2026-11-18).
 * Comparar até 10 candidatos selecionados lado a lado, com os campos da Ficha W2 e o match com uma vaga
 * da empresa. Só sai o que a busca já mostra ao recrutador: contato mascarado, sem foto (D3).
 * As linhas montadas aqui servem à tela (2.3a) e aos arquivos exportados (2.3b).
 */
import { anosExperiencia, sanitizeFicha, sanitizeFichaW2, topSkills } from "./ficha";
import type { GapCandidato } from "./match-candidato";

/** Máximo de candidatos comparados de uma vez (o mesmo limite da seleção). */
export const COMPARAR_MAX = 10;

/** O que a rota devolve de cada candidato (sem e-mail, celular ou foto). */
export type ItemComparacao = {
  id: string;
  nome: string;
  titulo: string;
  senioridade: string;
  anos: number;
  stack: { skillId: string; anos: number }[];
  localidade: string;
  modo: string;
  mudanca: boolean;
  regimes: string[];
  pretensoes: unknown;
  pretensaoDe: number | null;
  pretensaoAte: number | null;
  pretensaoMoeda: string | null;
  idiomas: { idioma: string; nivel: string }[];
  disponibilidade: string;
  resumo: string;
  destaques: string[];
  emailMasked: string;
  celularMasked: string;
  updatedAt: string | null;
  match: number | null;
  gaps: GapCandidato[];
};

/** Lê os ids pedidos: texto, sem repetição, de 1 a 10. Fora disso, null. */
export function idsDoPedido(input: unknown): string[] | null {
  if (!Array.isArray(input)) return null;
  const ids = [...new Set(input.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 64))];
  if (ids.length === 0 || ids.length > COMPARAR_MAX || ids.length !== input.length) return null;
  return ids;
}

/**
 * Do registro do perfil (já sem contatos, com emailMasked/celularMasked) ao item da comparação.
 * Campos que não estão aqui (e-mail, celular, foto, links, experiências) não saem.
 */
export function itemDaComparacao(row: Record<string, any>, m: { match: number | null; gaps: GapCandidato[] } | null, now: Date = new Date()): ItemComparacao {
  const f = sanitizeFicha(row);
  const w2 = sanitizeFichaW2(row.fichaW2);
  const updated = row.updatedAt ?? row.createdAt ?? null;
  return {
    id: String(row.id),
    nome: f.nome,
    titulo: f.titulo,
    senioridade: f.senioridade,
    anos: anosExperiencia(f, now),
    stack: topSkills(f, 10),
    localidade: f.localidade,
    modo: f.modo,
    mudanca: f.mudanca,
    regimes: f.regimes,
    pretensoes: row.pretensoes ?? [],
    pretensaoDe: row.pretensaoDe ?? null,
    pretensaoAte: row.pretensaoAte ?? null,
    pretensaoMoeda: row.pretensaoMoeda ?? null,
    idiomas: f.idiomas.filter((i) => i.idioma).map((i) => ({ idioma: i.idioma, nivel: i.nivel || "" })),
    disponibilidade: f.disponibilidade,
    resumo: w2?.resumo ?? (typeof row.resumo3linhas === "string" ? row.resumo3linhas : ""),
    destaques: w2?.destaques ?? [],
    emailMasked: typeof row.emailMasked === "string" ? row.emailMasked : "",
    celularMasked: typeof row.celularMasked === "string" ? row.celularMasked : "",
    updatedAt: updated ? new Date(updated).toISOString() : null,
    match: m?.match ?? null,
    gaps: m?.gaps ?? [],
  };
}
