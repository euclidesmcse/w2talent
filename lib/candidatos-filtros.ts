/**
 * Filtros da tela Candidatos (2.2b, plano 2.2 D6). Ficam na URL, para o recrutador mandar o link
 * a um colega da empresa. Funções puras (navegador e servidor). O SQL dos mesmos filtros fica em
 * lib/search-db.ts; `passaNosFiltros` é a versão em memória (demonstração e testes).
 * Nenhum filtro usa idade, gênero, foto, estado civil ou endereço exato.
 */
import { DISPONIBILIDADES, MODOS, NIVEIS_IDIOMA, SENIORIDADES } from "./ficha";
import { fold } from "./query-intent";
import { getSkill } from "./taxonomy";
import { atendemPorInteiro } from "./taxonomia-proximas";

export const IDIOMAS_FILTRO = ["en", "es", "pt", "fr", "de", "it"] as const;
export const ATUALIZADA_DIAS = [7, 30, 90] as const;
export const REGIMES_FILTRO = ["CLT", "PJ", "Estágio", "Freelancer"] as const;
export const MAX_SKILLS_FILTRO = 5;

export type FiltrosCandidatos = {
  /** Vaga de referência (só da empresa de quem busca). */
  vaga?: string;
  skills: string[];
  senioridade?: (typeof SENIORIDADES)[number];
  modo?: (typeof MODOS)[number];
  regime?: (typeof REGIMES_FILTRO)[number];
  /** Pretensão mensal até este valor (quem não informou continua aparecendo). */
  faixaAte?: number;
  idioma?: (typeof IDIOMAS_FILTRO)[number];
  /** Nível mínimo no idioma escolhido. */
  idiomaNivel?: (typeof NIVEIS_IDIOMA)[number];
  /** Começa em até (quem não informou continua aparecendo). */
  disponibilidade?: (typeof DISPONIBILIDADES)[number];
  atualizadaDias?: (typeof ATUALIZADA_DIAS)[number];
  /** 3.1b: com vaga de referência, "padrao" pede a ordem pela % de match (sem os pesos aprendidos). Não é filtro. */
  ordem?: "padrao";
};

/** Nome do idioma como as pessoas escrevem na ficha, em PT, EN e ES (já sem acento). */
export const PADRAO_IDIOMA: Record<(typeof IDIOMAS_FILTRO)[number], string> = {
  en: "ingl|english",
  es: "espanh|spanish|espa[nñ]ol|castelhano|castellano",
  pt: "portug",
  fr: "franc|french|frances",
  de: "alem|german|deutsch",
  it: "italian",
};

function umDe<T extends readonly (string | number)[]>(lista: T, v: string | null | undefined): T[number] | undefined {
  if (v == null || v === "") return undefined;
  return lista.find((x) => String(x) === v);
}

/** Lê os filtros de uma URL (ou do corpo da busca). Valor que não existe é ignorado. */
export function lerFiltros(sp: URLSearchParams): FiltrosCandidatos {
  const skills = (sp.get("skills") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => !!getSkill(s));
  const faixa = Number(sp.get("faixaAte"));
  const vaga = (sp.get("vaga") ?? "").trim().slice(0, 64);
  return {
    vaga: vaga || undefined,
    skills: [...new Set(skills)].slice(0, MAX_SKILLS_FILTRO),
    senioridade: umDe(SENIORIDADES, sp.get("senioridade")),
    modo: umDe(MODOS, sp.get("modo")),
    regime: umDe(REGIMES_FILTRO, sp.get("regime")),
    faixaAte: Number.isFinite(faixa) && faixa > 0 ? Math.round(faixa) : undefined,
    idioma: umDe(IDIOMAS_FILTRO, sp.get("idioma")),
    idiomaNivel: sp.get("idioma") ? umDe(NIVEIS_IDIOMA, sp.get("idiomaNivel")) : undefined,
    disponibilidade: umDe(DISPONIBILIDADES, sp.get("disponibilidade")),
    atualizadaDias: umDe(ATUALIZADA_DIAS, sp.get("atualizada")),
    ordem: sp.get("ordem") === "padrao" ? "padrao" : undefined,
  };
}

/** Filtros → parâmetros de URL (só os preenchidos, sempre na mesma ordem). */
export function filtrosParaUrl(f: FiltrosCandidatos): [string, string][] {
  const out: [string, string][] = [];
  if (f.vaga) out.push(["vaga", f.vaga]);
  if (f.skills.length) out.push(["skills", f.skills.join(",")]);
  if (f.senioridade) out.push(["senioridade", f.senioridade]);
  if (f.modo) out.push(["modo", f.modo]);
  if (f.regime) out.push(["regime", f.regime]);
  if (f.faixaAte != null) out.push(["faixaAte", String(f.faixaAte)]);
  if (f.idioma) out.push(["idioma", f.idioma]);
  if (f.idioma && f.idiomaNivel) out.push(["idiomaNivel", f.idiomaNivel]);
  if (f.disponibilidade) out.push(["disponibilidade", f.disponibilidade]);
  if (f.atualizadaDias) out.push(["atualizada", String(f.atualizadaDias)]);
  if (f.ordem) out.push(["ordem", f.ordem]);
  return out;
}

/** Quantos filtros estão ligados (a vaga de referência e a ordem não filtram, só ordenam). */
export function contarFiltros(f: FiltrosCandidatos): number {
  return filtrosParaUrl({ ...f, vaga: undefined, ordem: undefined }).filter(([k]) => k !== "idiomaNivel").length;
}

/** Para cada competência pedida, os ids que a atendem por inteiro (exata, igual ou que cobre). */
export function idsDasSkills(skills: string[]): string[][] {
  return skills.map(atendemPorInteiro);
}

/** Disponibilidades que cabem no "começa em até". */
export function disponibilidadesAte(d: (typeof DISPONIBILIDADES)[number]): string[] {
  return DISPONIBILIDADES.slice(0, DISPONIBILIDADES.indexOf(d) + 1) as unknown as string[];
}

/** Níveis de idioma iguais ou acima do mínimo. */
export function niveisIdiomaDesde(n: (typeof NIVEIS_IDIOMA)[number]): string[] {
  return NIVEIS_IDIOMA.slice(NIVEIS_IDIOMA.indexOf(n)) as unknown as string[];
}

const skillIdsDaLinha = (stack: unknown): string[] =>
  Array.isArray(stack) ? stack.map((s: any) => (typeof s === "string" ? s : s?.skillId ?? s?.id ?? "")).filter(Boolean) : [];

/** Mesmo critério do SQL, em memória. `perfil` é a linha do CandidateProfile. */
export function passaNosFiltros(perfil: any, f: FiltrosCandidatos, now: number = Date.now()): boolean {
  const stack = new Set(skillIdsDaLinha(perfil.stack));
  for (const ids of idsDasSkills(f.skills)) if (!ids.some((id) => stack.has(id))) return false;
  if (f.senioridade && perfil.senioridade !== f.senioridade) return false;
  if (f.idioma) {
    const re = new RegExp(PADRAO_IDIOMA[f.idioma]);
    const niveis = f.idiomaNivel ? niveisIdiomaDesde(f.idiomaNivel) : null;
    const tem = (Array.isArray(perfil.idiomas) ? perfil.idiomas : []).some(
      (i: any) => re.test(fold(String(i?.idioma ?? ""))) && (!niveis || niveis.includes(String(i?.nivel ?? ""))),
    );
    if (!tem) return false;
  }
  if (f.disponibilidade && perfil.disponibilidade && !disponibilidadesAte(f.disponibilidade).includes(perfil.disponibilidade)) return false;
  if (f.atualizadaDias) {
    const t = new Date(perfil.updatedAt ?? perfil.createdAt ?? 0).getTime();
    if (!(t >= now - f.atualizadaDias * 86_400_000)) return false;
  }
  return true;
}
