/**
 * Equivalências da busca por texto (PT/EN/ES).
 *
 * Medição em produção (2026-11-09): com textos curtos, o bge-m3 dá a "nuvem" e a
 * "cozinheiro de restaurante" a mesma similaridade com vagas de Cloud (0,3 a 0,4). Por isso o
 * significado só reordena, e é esta lista que faz "nuvem" achar "Cloud".
 *
 * Cada grupo lista termos que querem dizer a mesma coisa. Termos de várias palavras valem.
 * Não há limite de combinações: cada termo vira um grupo "qualquer um destes" na consulta.
 */
export const EQUIVALENCE_GROUPS: readonly (readonly string[])[] = [
  ["nuvem", "cloud", "nube"],
  ["desenvolvedor", "desenvolvedora", "developer", "desarrollador", "programador", "programadora"],
  ["banco de dados", "database", "base de datos"],
  ["engenheiro", "engenheira", "engineer", "ingeniero"],
  ["analista", "analyst"],
  ["dados", "data", "datos"],
  ["segurança", "seguranca", "security", "seguridad"],
  ["infraestrutura", "infrastructure", "infraestructura"],
  ["suporte", "support", "soporte"],
  ["estágio", "estagio", "estagiário", "estagiario", "internship", "trainee", "pasantía"],
  ["remoto", "remote", "home office"],
  ["liderança", "lideranca", "leadership", "liderazgo"],
  ["arquiteto", "arquiteta", "architect", "arquitecto"],
  ["observabilidade", "observability", "monitoramento", "monitoring"],
];

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Termo como palavra inteira (letras com acento contam como letra); captura um "-" antes dele. */
function termRe(term: string): RegExp {
  return new RegExp(`(^|[^\\p{L}\\p{N}-])(-?)${escapeRe(term)}(?=$|[^\\p{L}\\p{N}])`, "u");
}

export type ExpandedQuery = {
  /** O texto buscado sem os termos que viraram grupo (vai para websearch_to_tsquery). */
  rest: string;
  /** Um grupo por termo encontrado: basta um dos equivalentes aparecer (E entre os grupos). */
  anyOf: string[][];
  /** Equivalentes de termos excluídos com "-": nenhum deles pode aparecer. */
  noneOf: string[];
};

/**
 * Separa os termos da lista de equivalências: cada um vira "qualquer um destes" (E entre si),
 * e um termo excluído ("-cloud") exclui também os equivalentes. Frases entre aspas e "or"
 * ficam como estão, sem expansão.
 */
export function expandQuery(q: string): ExpandedQuery {
  const out: ExpandedQuery = { rest: q, anyOf: [], noneOf: [] };
  if (q.includes('"') || /(^|\s)or(\s|$)/.test(q)) return out;
  for (const group of EQUIVALENCE_GROUPS) {
    // Termo mais longo primeiro: "banco de dados" antes de "dados".
    for (const term of [...group].sort((a, b) => b.length - a.length)) {
      const re = termRe(term);
      const m = re.exec(out.rest);
      if (!m) continue;
      if (m[2] === "-") out.noneOf.push(...group.filter((t) => t !== term));
      else out.anyOf.push([...group]);
      // Exclusão continua no texto (o websearch já trata "-cloud"); termo positivo sai do texto.
      if (m[2] !== "-") out.rest = out.rest.replace(re, (_x, pre: string) => `${pre} `).replace(/\s+/g, " ").trim();
      break;
    }
  }
  return out;
}
