/**
 * Menu por área (decisão do Euclides em 2026-11-09).
 * Cada tela pertence a uma área e a área decide o menu do topo. Até o login (1.5.5)
 * a área vem do endereço da tela; com o login, passa a vir do papel da conta.
 * Os textos ficam em messages/*.json, grupo "nav".
 */
export type Area = "publico" | "candidato" | "recrutador" | "admin";

export type NavLink = { href: string; key: string; shortKey?: string };

export const NAV: Record<Area, NavLink[]> = {
  publico: [
    { href: "/vagas", key: "vagas" },
    { href: "/candidatos", key: "recrutadores", shortKey: "recrutadoresCurto" },
    // 3.2a: números de mercado, públicos
    { href: "/mercado", key: "mercado" },
  ],
  candidato: [
    { href: "/painel", key: "painel" },
    { href: "/vagas", key: "vagas" },
    { href: "/minha-ficha", key: "minhaFicha", shortKey: "minhaFichaCurto" },
    { href: "/minhas-candidaturas", key: "minhasCandidaturas", shortKey: "minhasCandidaturasCurto" },
  ],
  recrutador: [
    { href: "/rh", key: "painelRh", shortKey: "painelRhCurto" },
    { href: "/candidatos", key: "candidatos" },
    { href: "/publicar", key: "publicar", shortKey: "publicarCurto" },
    { href: "/empresa", key: "empresa", shortKey: "empresaCurto" },
  ],
  admin: [
    { href: "/admin/ia", key: "ia" },
    { href: "/admin/empresas", key: "empresas" },
    // 3.1a: pesos do ranking adaptativo (D7)
    { href: "/admin/ranking", key: "ranking" },
    // 2.6b-1: conversas "Falar com uma pessoa" da Ajuda
    { href: "/admin/atendimento", key: "atendimento" },
  ],
};

/**
 * Itens do menu da conta (o nome no topo), por perfil da conta logada. Ficam fora de NAV porque são
 * da conta e não de uma área: a mesma tela serve candidato e recrutador.
 * 2.6b-2: Minhas conversas (as do "Falar com uma pessoa" ligadas à conta).
 */
export const MENU_CONTA: Record<"candidato" | "recrutador", NavLink[]> = {
  candidato: [{ href: "/ajuda/minhas-conversas", key: "minhasConversas" }],
  recrutador: [{ href: "/ajuda/minhas-conversas", key: "minhasConversas" }],
};

/** Nome ao lado do logo. Candidato é a área padrão e não leva nome. */
export const AREA_NAME: Partial<Record<Area, string>> = { recrutador: "areaRecrutadores", admin: "areaAdmin" };

/** Link discreto para a outra área (só no computador; no celular a troca fica no início). */
export const AREA_SWITCH: Partial<Record<Area, NavLink>> = {
  candidato: { href: "/candidatos", key: "recrutadores" },
  recrutador: { href: "/vagas", key: "paraCandidatos" },
};

const PREFIXES: [string, Area][] = [
  ["/admin", "admin"],
  ["/candidatos", "recrutador"],
  ["/empresa", "recrutador"],
  ["/publicar", "recrutador"],
  ["/rh", "recrutador"],
  ["/painel", "candidato"],
  ["/vagas", "candidato"],
  ["/minha-ficha", "candidato"],
  ["/minhas-candidaturas", "candidato"],
];

/** Área de um endereço. O que não estiver na lista é público. */
export function areaOf(pathname: string): Area {
  for (const [p, a] of PREFIXES) if (pathname === p || pathname.startsWith(p + "/")) return a;
  return "publico";
}
