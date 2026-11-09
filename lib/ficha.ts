/**
 * Ficha do candidato (1.5.10) e Ficha W2 (1.5.11).
 *
 * `Ficha` = os campos que o candidato confere numa tela só. A ficha mínima (spec v2 §6.2) é o que
 * o recrutador precisa ver; sem ela não dá para publicar. `FichaW2` = o resumo padronizado que a IA
 * escreve a partir da ficha já conferida (resumo de 3 linhas + até 3 destaques); a linha de
 * cabeçalho, as competências e os idiomas saem da própria ficha, sem IA.
 * Funções puras: rodam no navegador e no servidor.
 */
import { getSkill, normalizeSkill } from "./taxonomy";

export const SENIORIDADES = ["estagio", "junior", "pleno", "senior", "especialista", "lideranca"] as const;
export const MODOS = ["remoto", "hibrido", "presencial"] as const;
export const REGIMES = ["CLT", "PJ", "Estágio", "Freelancer", "Outro"] as const;
export const DISPONIBILIDADES = ["imediata", "15d", "30d", "60d", "90d"] as const;
export const NIVEIS_IDIOMA = ["basico", "intermediario", "avancado", "fluente", "nativo"] as const;
export const MOEDAS = ["BRL", "USD", "EUR"] as const;
export const MAX_SKILLS = 10;
export const MAX_EXPERIENCIAS = 8;
export const MAX_DESTAQUES = 3;

export type Senioridade = (typeof SENIORIDADES)[number];
export type Modo = (typeof MODOS)[number];
export type Disponibilidade = (typeof DISPONIBILIDADES)[number];
export type NivelIdioma = (typeof NIVEIS_IDIOMA)[number];

export type Experiencia = {
  cargo: string;
  empresa: string;
  /** "AAAA-MM" */
  inicio: string;
  /** "AAAA-MM"; vazio quando é o emprego atual */
  fim: string;
  atual: boolean;
};
export type Idioma = { idioma: string; nivel: NivelIdioma | "" };
export type Formacao = { curso: string; instituicao: string; ano: string };

export type Ficha = {
  nome: string;
  email: string;
  celular: string;
  links: string[];
  titulo: string;
  senioridade: Senioridade | "";
  stack: { skillId: string; anos: number }[];
  /** A primeira é a última (mais recente). */
  experiencias: Experiencia[];
  formacao: Formacao[];
  localidade: string;
  modo: Modo | "";
  mudanca: boolean;
  regimes: string[];
  pretensaoDe: number | null;
  pretensaoAte: number | null;
  pretensaoMoeda: string;
  idiomas: Idioma[];
  disponibilidade: Disponibilidade | "";
  objetivo: string;
};

export type FichaW2 = {
  resumo: string;
  destaques: string[];
  /** Idioma em que a IA escreveu (pt-BR | en | es). */
  idioma: string;
  geradaEm: string;
  modelo?: string;
  /** true quando o candidato editou o resumo ou os destaques: a ficha não é refeita sozinha. */
  editada: boolean;
};

export function fichaVazia(): Ficha {
  return {
    nome: "",
    email: "",
    celular: "",
    links: [],
    titulo: "",
    senioridade: "",
    stack: [],
    experiencias: [],
    formacao: [],
    localidade: "",
    modo: "",
    mudanca: false,
    regimes: [],
    pretensaoDe: null,
    pretensaoAte: null,
    pretensaoMoeda: "BRL",
    idiomas: [],
    disponibilidade: "",
    objetivo: "",
  };
}

// ── normalização (entrada da IA, do navegador ou do banco) ───────────────
const str = (v: unknown, max = 120): string => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const oneOf = <T extends readonly string[]>(list: T, v: unknown): T[number] | "" => {
  const s = str(v, 40).toLowerCase();
  return (list.find((x) => x.toLowerCase() === s) ?? "") as T[number] | "";
};
function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/[^\d.]/g, "")) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}
/** "2021-03", "03/2021", "2021" → "AAAA-MM" (ou "" se não der para ler). */
export function anoMes(v: unknown): string {
  const s = str(v, 20);
  let m = s.match(/^(\d{4})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[2]}-${m[1].padStart(2, "0")}`;
  m = s.match(/^(\d{4})$/);
  if (m) return `${m[1]}-01`;
  return "";
}
const MODO_ALIAS: Record<string, Modo> = { remote: "remoto", remoto: "remoto", hybrid: "hibrido", híbrido: "hibrido", hibrido: "hibrido", "on-site": "presencial", onsite: "presencial", presencial: "presencial" };
const SENIOR_ALIAS: Record<string, Senioridade> = {
  estagio: "estagio", estágio: "estagio", intern: "estagio", internship: "estagio", pasantia: "estagio",
  junior: "junior", júnior: "junior", jr: "junior",
  pleno: "pleno", "mid-level": "pleno", mid: "pleno", intermediate: "pleno", semisenior: "pleno", "semi-senior": "pleno",
  senior: "senior", sênior: "senior", sr: "senior",
  especialista: "especialista", specialist: "especialista", staff: "especialista", principal: "especialista", expert: "especialista",
  lideranca: "lideranca", liderança: "lideranca", lead: "lideranca", manager: "lideranca", gerente: "lideranca", coordenador: "lideranca", head: "lideranca", director: "lideranca", diretor: "lideranca",
};
const REGIME_ALIAS: Record<string, string> = { clt: "CLT", pj: "PJ", contractor: "PJ", estágio: "Estágio", estagio: "Estágio", internship: "Estágio", freelancer: "Freelancer", freela: "Freelancer", freelance: "Freelancer", outro: "Outro" };

/** Aceita qualquer coisa e devolve uma Ficha válida (campos desconhecidos somem, tamanhos limitados). */
export function sanitizeFicha(input: unknown): Ficha {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, any>;
  const f = fichaVazia();
  f.nome = str(o.nome, 80);
  f.email = str(o.email, 120).toLowerCase();
  if (f.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) f.email = "";
  f.celular = str(o.celular, 30);
  f.links = (Array.isArray(o.links) ? o.links : []).map((x) => str(x, 200)).filter(Boolean).slice(0, 5);
  f.titulo = str(o.titulo, 80);
  f.senioridade = SENIOR_ALIAS[str(o.senioridade, 30).toLowerCase()] ?? "";
  const seen = new Set<string>();
  for (const it of Array.isArray(o.stack) ? o.stack : []) {
    const raw = typeof it === "string" ? it : it?.skillId ?? it?.nome ?? it?.skill ?? it?.name;
    const id = typeof raw === "string" ? (getSkill(raw) ? raw : normalizeSkill(raw)) : null;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const anos = typeof it === "object" ? num(it?.anos ?? it?.years) : null;
    f.stack.push({ skillId: id, anos: Math.min(anos ?? 0, 50) });
    if (f.stack.length >= MAX_SKILLS) break;
  }
  for (const e of Array.isArray(o.experiencias) ? o.experiencias : []) {
    if (!e || typeof e !== "object") continue;
    const cargo = str(e.cargo ?? e.titulo, 80);
    const empresa = str(e.empresa, 80);
    if (!cargo && !empresa) continue;
    const atual = e.atual === true || /atual|present|actual|hoje|now/i.test(String(e.fim ?? ""));
    f.experiencias.push({ cargo, empresa, inicio: anoMes(e.inicio), fim: atual ? "" : anoMes(e.fim), atual });
    if (f.experiencias.length >= MAX_EXPERIENCIAS) break;
  }
  f.formacao = (Array.isArray(o.formacao) ? o.formacao : [])
    .filter((x) => x && typeof x === "object")
    .map((x) => ({ curso: str(x.curso, 100), instituicao: str(x.instituicao, 100), ano: str(x.ano, 4).replace(/\D/g, "") }))
    .filter((x) => x.curso || x.instituicao)
    .slice(0, 5);
  f.localidade = str(o.localidade, 80);
  f.modo = MODO_ALIAS[str(o.modo, 20).toLowerCase()] ?? "";
  f.mudanca = o.mudanca === true;
  const regimes = (Array.isArray(o.regimes) ? o.regimes : Array.isArray(o.regimePreferido) ? o.regimePreferido : [])
    .map((r: unknown) => REGIME_ALIAS[str(r, 20).toLowerCase()])
    .filter(Boolean) as string[];
  f.regimes = [...new Set(regimes)];
  f.pretensaoDe = num(o.pretensaoDe);
  f.pretensaoAte = num(o.pretensaoAte);
  if (f.pretensaoDe && f.pretensaoAte && f.pretensaoAte < f.pretensaoDe) [f.pretensaoDe, f.pretensaoAte] = [f.pretensaoAte, f.pretensaoDe];
  f.pretensaoMoeda = oneOf(MOEDAS, o.pretensaoMoeda) || "BRL";
  f.idiomas = (Array.isArray(o.idiomas) ? o.idiomas : [])
    .filter((x) => x && typeof x === "object" && str(x.idioma, 40))
    .map((x) => ({ idioma: str(x.idioma, 40), nivel: oneOf(NIVEIS_IDIOMA, x.nivel) }))
    .slice(0, 6);
  f.disponibilidade = oneOf(DISPONIBILIDADES, o.disponibilidade);
  f.objetivo = str(o.objetivo ?? o.objetivoCrescimento, 300);
  return f;
}

// ── ficha mínima (spec §6.2) ─────────────────────────────────────────────
export const CAMPOS_MINIMOS = [
  "nome",
  "email",
  "titulo",
  "senioridade",
  "stack",
  "experiencia",
  "localidade",
  "modo",
  "regimes",
  "pretensao",
  "idiomas",
  "disponibilidade",
] as const;
export type CampoMinimo = (typeof CAMPOS_MINIMOS)[number];

/** O que falta para publicar, na ordem da tela. Lista vazia = ficha mínima completa. */
export function camposFaltando(f: Ficha): CampoMinimo[] {
  const falta: CampoMinimo[] = [];
  if (!f.nome) falta.push("nome");
  if (!f.email) falta.push("email");
  if (!f.titulo) falta.push("titulo");
  if (!f.senioridade) falta.push("senioridade");
  if (!f.stack.some((s) => s.anos > 0)) falta.push("stack");
  const ult = f.experiencias[0];
  if (!ult || !ult.cargo || !ult.empresa || !ult.inicio) falta.push("experiencia");
  if (!f.localidade) falta.push("localidade");
  if (!f.modo) falta.push("modo");
  if (!f.regimes.length) falta.push("regimes");
  if (f.pretensaoDe == null && f.pretensaoAte == null) falta.push("pretensao");
  if (!f.idiomas.some((i) => i.nivel)) falta.push("idiomas");
  if (!f.disponibilidade) falta.push("disponibilidade");
  return falta;
}

/** Anos de experiência: soma dos períodos de trabalho (sobreposições contam uma vez, intervalos sem emprego não contam). */
export function anosExperiencia(f: Ficha, now: Date = new Date()): number {
  const mes = (v: string) => {
    const [a, m] = v.split("-").map(Number);
    return a * 12 + (m - 1);
  };
  const hoje = now.getUTCFullYear() * 12 + now.getUTCMonth();
  const periodos = f.experiencias
    .filter((e) => e.inicio)
    .map((e) => [mes(e.inicio), e.atual || !e.fim ? hoje : mes(e.fim)] as [number, number])
    .filter(([i, fim]) => fim >= i)
    .sort((x, y) => x[0] - y[0]);
  if (!periodos.length) return Math.max(0, ...f.stack.map((s) => s.anos));
  let meses = 0;
  let [ini, fim] = periodos[0];
  for (const [i, e] of periodos.slice(1)) {
    if (i <= fim) fim = Math.max(fim, e);
    else {
      meses += fim - ini;
      [ini, fim] = [i, e];
    }
  }
  meses += fim - ini;
  return Math.max(0, Math.floor(meses / 12));
}

/** Top 5 competências por anos (as que a Ficha W2 mostra). */
export function topSkills(f: Ficha, n = 5): { skillId: string; anos: number }[] {
  return [...f.stack].sort((a, b) => b.anos - a.anos).slice(0, n);
}

/** "Ana S." — o nome que o recrutador vê antes do contato aprovado. */
export function nomeCurto(nome: string): string {
  const p = nome.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "";
  return p.length === 1 ? p[0] : `${p[0]} ${p[p.length - 1][0].toUpperCase()}.`;
}

export function sanitizeFichaW2(input: unknown): FichaW2 | null {
  const o = (input && typeof input === "object" ? input : null) as Record<string, any> | null;
  if (!o) return null;
  const resumo = typeof o.resumo === "string" ? o.resumo.trim().slice(0, 420) : "";
  if (!resumo) return null;
  return {
    resumo,
    destaques: (Array.isArray(o.destaques) ? o.destaques : [])
      .map((d) => (typeof d === "string" ? d.replace(/\s+/g, " ").trim().slice(0, 160) : ""))
      .filter(Boolean)
      .slice(0, MAX_DESTAQUES),
    idioma: typeof o.idioma === "string" ? o.idioma.slice(0, 10) : "pt-BR",
    geradaEm: typeof o.geradaEm === "string" ? o.geradaEm.slice(0, 40) : new Date().toISOString(),
    modelo: typeof o.modelo === "string" ? o.modelo.slice(0, 120) : undefined,
    editada: o.editada === true,
  };
}

/** Ficha → colunas do CandidateProfile. */
export function fichaToProfile(f: Ficha) {
  return {
    nome: f.nome,
    email: f.email,
    celular: f.celular || null,
    links: f.links,
    titulo: f.titulo,
    senioridade: f.senioridade || null,
    stack: f.stack.map((s) => ({ skillId: s.skillId, anos: s.anos })),
    experiencias: f.experiencias,
    formacao: f.formacao,
    localidade: f.localidade,
    modo: f.modo || null,
    mudanca: f.mudanca,
    regimePreferido: f.regimes,
    pretensaoDe: f.pretensaoDe,
    pretensaoAte: f.pretensaoAte,
    pretensaoMoeda: f.pretensaoMoeda,
    idiomas: f.idiomas,
    disponibilidade: f.disponibilidade || null,
    objetivoCrescimento: f.objetivo || null,
  };
}
