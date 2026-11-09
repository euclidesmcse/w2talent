/**
 * Equivalências da busca por texto (PT/EN/ES).
 *
 * Medição em produção (2026-11-09): com textos curtos, o bge-m3 dá a "nuvem" e a
 * "cozinheiro de restaurante" a mesma similaridade com vagas de Cloud (0,3 a 0,4). Por isso o
 * significado só reordena, e é esta lista que faz "nuvem" achar "Cloud".
 *
 * Cada grupo lista termos que querem dizer a mesma coisa. Termos de várias palavras valem.
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

/** Máximo de variações da busca (evita explosão de combinações). */
export const MAX_QUERY_VARIANTS = 8;

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Termo como palavra inteira (letras com acento contam como letra). */
function termRe(term: string): RegExp {
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(term)}(?=$|[^\\p{L}\\p{N}])`, "u");
}

/**
 * Variações do texto buscado (já normalizado): o original e, para cada termo da lista
 * encontrado, o texto com o termo trocado por cada equivalente. O original vem primeiro.
 */
export function queryVariants(q: string): string[] {
  let variants = [q];
  for (const group of EQUIVALENCE_GROUPS) {
    // Termo mais longo primeiro: "banco de dados" antes de "dados".
    const found = [...group].sort((a, b) => b.length - a.length).find((t) => termRe(t).test(q));
    if (!found) continue;
    const re = termRe(found);
    const next = [...variants];
    for (const v of variants) {
      for (const alt of group) {
        if (alt === found || next.length >= MAX_QUERY_VARIANTS) continue;
        const swapped = v.replace(re, (_m, pre: string) => `${pre}${alt}`);
        if (!next.includes(swapped)) next.push(swapped);
      }
    }
    variants = next;
  }
  return variants;
}
