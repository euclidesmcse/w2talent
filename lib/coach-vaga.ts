/**
 * Coach IA por vaga (plano 2026-11-20, D1–D8). Na tela Aprovar, o candidato pede uma versão da
 * Ficha W2 voltada para a vaga (resumo e destaques) e uma carta curta, e vê o que a vaga pede e
 * falta na ficha. Nada sai sem ele conferir; a Ficha W2 publicada não muda.
 *
 * - D2: a IA só reordena e reescreve resumo e destaques e escreve a carta, com fatos da ficha.
 * - D3: trava por regra depois da IA. Frase que cita competência que a pessoa não tem, ou número
 *   que não está na ficha nem no CV completo, sai, e a tela mostra o que saiu.
 * - D5: lacunas por regra (sem IA), com a regra das competências próximas (2.2).
 * - D6: o que o candidato aceitou fica na aprovação e vai com a candidatura.
 *
 * CV reescrito por vaga (plano 2026-11-20 "CV por vaga", D1–D8): a mesma chamada devolve também
 * o título, até 5 pontos por cargo (só com fatos daquele cargo: funções e o trecho dele no CV
 * completo, com a mesma trava, cargo a cargo) e a frase "por que se destaca". Competências,
 * formação e idiomas saem da ficha por regra. O aviso de idioma e o "por que" do detalhe da vaga
 * são por regra, sem IA. Fica tudo no Json `adaptacao` (campo `cv`), sem migração.
 */
import type { ChatRequest, ChatResult } from "./ai/types";
import { redactContacts } from "./ai/redact";
import { limparCv } from "./cv-completo";
import { ETICA, parseJsonObject, W2_LANG } from "./ficha-ai";
import { anosExperiencia, MAX_DESTAQUES, MAX_EXPERIENCIAS, topSkills, type Experiencia, type Ficha, type FichaW2 } from "./ficha";
import { trechoDoCargo } from "./cv-cargo";
import { getSkill, normalizeSkill } from "./taxonomy";
import { melhorCompetencia } from "./taxonomia-proximas";
import type { SnapshotVaga } from "./envio";

/** Mesmos limites da Ficha W2, para caber no e-mail e no cartão de sempre. */
export const MAX_RESUMO_ADAPTADO = 420;
export const MAX_DESTAQUE_ADAPTADO = 160;
export const MAX_CARTA = 800;
/** CV por vaga (D1). */
export const MAX_TITULO_CV = 100;
export const MAX_PONTOS = 5;
export const MAX_PONTO = 200;
export const MAX_POR_QUE = 240;

/** Um cargo do CV por vaga. `i`: posição do cargo na ficha (a tela usa para editar). */
export type CvCargo = { i: number; cargo: string; empresa: string; inicio: string; fim: string; atual: boolean; pontos: string[] };

/** CV inteiro para uma vaga, como a empresa recebe (sem contatos, sem foto, sem endereço). */
export type CvVaga = {
  titulo: string;
  cargos: CvCargo[];
  /** Da ficha, as que a vaga pede primeiro. */
  competencias: { nome: string; anos: number }[];
  formacao: { curso: string; instituicao: string; ano: string }[];
  idiomas: { idioma: string; nivel: string }[];
};

/** O que o candidato conferiu para uma vaga (guardado na aprovação e na candidatura). */
export type Adaptacao = {
  resumo: string;
  destaques: string[];
  carta: string;
  /** true quando alguma parte veio da IA (a empresa vê "feito com IA, conferido pelo candidato"). */
  ia: boolean;
  /** Versão da vaga para a qual foi feita (hash do snapshot). */
  vacancyHash: string;
  criadaEm: string;
  /** CV reescrito para a vaga (null = vai só a Ficha W2). */
  cv: CvVaga | null;
  /** "Por que se destaca", uma frase (vazio = sem frase). */
  porQue: string;
};

/** Sugestão da IA já passada pela trava; `removidos`: frases que saíram por não estarem na ficha. */
export type Proposta = { resumo: string; destaques: string[]; carta: string; removidos: string[]; porQue: string; cv: CvVaga };

export type Lacuna = { skillId: string; nome: string; proxima: string | null };

export type ChatCoachFn = (task: "coach_candidate", req: ChatRequest) => Promise<ChatResult & { model?: string }>;

/** Texto que vai para a empresa: sem contatos, documentos nem links (qualquer site, como no CV completo). */
const limpar = (v: unknown, max: number): string =>
  typeof v === "string"
    ? limparCv(v)
        .replace(/\[LINK\]/g, "")
        .replace(/\s+/g, " ")
        .replace(/\s+([.,;:!?])/g, "$1")
        .trim()
        .slice(0, max)
        .trim()
    : "";

// ── competências e números citados num texto ─────────────────────────────

/** Rótulos curtos demais para achar com segurança no meio de uma frase (Go, R, C). */
const CURTO = 2;

/**
 * Competências citadas no texto. Uma palavra só conta quando escrita como o rótulo da taxonomia
 * ("AWS", "Terraform"), para "go", "rest" ou "express" do texto comum não virarem competência.
 */
export function skillsNoTexto(texto: string): string[] {
  return lerSkills(texto).ids;
}

/** Competências do texto e o texto sem os nomes delas (para conferir só os números de fato). */
function lerSkills(texto: string): { ids: string[]; resto: string } {
  const fonteTexto = texto ?? "";
  // Palavras com a posição no texto; vírgula entre dígitos fica dentro ("10,5").
  const toks = [...fonteTexto.matchAll(/(?:[^\s,;:()"“”/|]|(?<=\d),(?=\d))+/g)]
    .map((m) => ({ t: m[0].replace(/[.!?]+$/, ""), ini: m.index ?? 0, fim: (m.index ?? 0) + m[0].length }))
    .filter((x) => x.t);
  const usados = new Array(toks.length).fill(false);
  const out: string[] = [];
  for (let n = 3; n >= 1; n--) {
    for (let i = 0; i + n <= toks.length; i++) {
      if (usados.slice(i, i + n).some(Boolean)) continue;
      // "PL/SQL", "Pub/Sub": tokens grudados por barra contam como um nome só antes de separar.
      const colado = fonteTexto.slice(toks[i].ini, toks[i + n - 1].fim).replace(/[.!?]+$/, "");
      const fonte = n > 1 && /^[^\s]+$/.test(colado) && colado.includes("/") && normalizeSkill(colado) ? colado : toks.slice(i, i + n).map((x) => x.t).join(" ");
      const id = normalizeSkill(fonte);
      if (!id) continue;
      const rotulo = getSkill(id)?.label ?? "";
      if (rotulo.length <= CURTO) continue;
      if (n === 1 && fonte !== rotulo) continue;
      for (let k = i; k < i + n; k++) usados[k] = true;
      if (!out.includes(id)) out.push(id);
    }
  }
  // O resto é o texto original com os nomes das competências trocados por espaço (números ficam como estão).
  let resto = fonteTexto;
  for (let k = toks.length - 1; k >= 0; k--) if (usados[k]) resto = resto.slice(0, toks[k].ini) + " ".repeat(toks[k].fim - toks[k].ini) + resto.slice(toks[k].fim);
  return { ids: out, resto };
}

/** Números do texto sem separador de milhar ("1.500" → "1500"); anos e porcentagens também contam. */
export function numerosNoTexto(texto: string): string[] {
  return ((texto ?? "").match(/\d[\d.,]*\d|\d/g) ?? []).map((n) => n.replace(/[.,](?=\d{3}\b)/g, "").replace(/,/g, "."));
}

export type Permitidos = { skills: Set<string>; numeros: Set<string> };

/** O que a IA pode citar: competências e números que aparecem na ficha, na Ficha W2 ou no CV completo. */
export function permitidosDaFicha(f: Ficha, w2: FichaW2 | null, cvTexto: string | null | undefined, now: Date = new Date()): Permitidos {
  const textoFicha = [
    f.titulo,
    f.objetivo,
    ...f.experiencias.flatMap((e) => [e.cargo, e.empresa, e.inicio, e.fim, ...e.funcoes]),
    ...f.formacao.flatMap((x) => [x.curso, x.instituicao, x.ano]),
    w2?.resumo ?? "",
    ...(w2?.destaques ?? []),
  ].join("\n");
  const skills = new Set<string>([...f.stack.map((s) => s.skillId), ...f.experiencias.flatMap((e) => e.skills), ...skillsNoTexto(textoFicha), ...skillsNoTexto(cvTexto ?? "")]);
  const numeros = new Set<string>([
    ...numerosNoTexto(textoFicha),
    ...numerosNoTexto(cvTexto ?? ""),
    ...f.stack.map((s) => String(s.anos)),
    String(anosExperiencia(f, now)),
  ]);
  return { skills, numeros };
}

/** A competência citada está na ficha (ela mesma, igual ou uma que a cobre por inteiro, 2.2). */
function temSkill(p: Permitidos, id: string): boolean {
  return p.skills.has(id) || (melhorCompetencia(p.skills, id)?.peso ?? 0) >= 1;
}

/** Por que a frase não pode sair (null quando pode). */
export function motivoInvencao(frase: string, p: Permitidos): string | null {
  const { ids, resto } = lerSkills(frase);
  const skill = ids.find((id) => !temSkill(p, id));
  if (skill) return getSkill(skill)?.label ?? skill;
  // O nome de uma competência (EC2, n8n, Route 53) sai antes: só os outros números são conferidos.
  const numero = numerosNoTexto(resto).find((n) => !p.numeros.has(n));
  return numero ?? null;
}

const frases = (t: string): string[] => t.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);

/** Trava (D3): tira as frases com competência ou número fora da ficha. */
export function travarTexto(texto: string, p: Permitidos): { texto: string; removidas: string[] } {
  const ficam: string[] = [];
  const removidas: string[] = [];
  for (const f of frases(texto)) (motivoInvencao(f, p) ? removidas : ficam).push(f);
  return { texto: ficam.join(" "), removidas };
}

// ── lacunas (D5) ─────────────────────────────────────────────────────────

/** Competências que a vaga pede e a ficha não tem por inteiro; `proxima`: a da pessoa que vale meio ponto. */
export function lacunasDaVaga(f: Ficha, competenciasVaga: string[]): Lacuna[] {
  const daPessoa = [...new Set([...f.stack.map((s) => s.skillId), ...f.experiencias.flatMap((e) => e.skills)])];
  const out: Lacuna[] = [];
  for (const id of competenciasVaga) {
    const m = melhorCompetencia(daPessoa, id);
    if (m && m.peso >= 1) continue;
    out.push({ skillId: id, nome: getSkill(id)?.label ?? id, proxima: m ? getSkill(m.skill)?.label ?? m.skill : null });
  }
  return out;
}

// ── IA ───────────────────────────────────────────────────────────────────

export function idiomaCoach(v: unknown): string {
  return typeof v === "string" && W2_LANG[v] ? v : "pt-BR";
}

/** Instruções e entrada (sem nome nem contatos). Cada cargo leva o trecho dele no CV completo, já limpo. */
export function promptCoach(f: Ficha, w2: FichaW2, vaga: SnapshotVaga, idioma: string, now: Date = new Date(), cvTexto?: string | null): { sistema: string; entrada: string } {
  const lang = idiomaCoach(idioma);
  const sistema = `You help a candidate adapt their CV and profile card to one job post. Reply with one JSON object only:
{"titulo": string, "resumo": string, "destaques": [string], "porQue": string, "cargos": [{"i": number, "pontos": [string]}], "carta": string}.
"titulo": the candidate's headline for this job, max 80 characters, based on "perfil.titulo" and the experience. Never a title the candidate never held or claimed.
"resumo": at most 3 short sentences (max 380 characters), third person, no name. Rewrite the current summary so the parts of the career that matter most for this job come first.
"destaques": up to 3 items, each under 140 characters, chosen and ordered by what the job asks. Prefer the current highlights and the duties listed in the experience.
"porQue": one sentence (max 200 characters), third person, on why this candidate stands out for this job, citing 1 or 2 concrete facts from the profile.
"cargos": for each experience in "perfil.experiencias" (by its "i"), up to 5 bullet points, each under 180 characters, starting with an action verb, ordered by what the job asks. Each point must come only from that same experience: its "funcoes" and its "trechoCv". Do not move facts between experiences. Keep numbers exactly as written.
"carta": a short cover message from the candidate to the company, first person, 3 to 5 sentences (max 700 characters): why this job, and the 2 or 3 facts from the profile that match it. No greeting with a person's name, no contact data, no salary.
Use only facts present in "perfil". Never claim a skill, tool, certification, employer, number or length of career that is not in "perfil", even if the job asks for it. Never compute or round years of experience; use "anosExperiencia" if you need it. If the job asks for something the candidate does not have, leave it out; do not apologize for it.
No adjectives like "passionate" or "excellent".
${ETICA}
Write in ${W2_LANG[lang]}.`;
  const cv = limparCv(cvTexto ?? "");
  const entrada = JSON.stringify({
    vaga: {
      titulo: vaga.titulo,
      nivel: vaga.nivel,
      regime: vaga.regime,
      competencias: vaga.competencias.map((id) => getSkill(id)?.label ?? id),
      descricao: vaga.descricao.slice(0, 15),
    },
    perfil: {
      titulo: f.titulo,
      senioridade: f.senioridade,
      anosExperiencia: anosExperiencia(f, now),
      competencias: topSkills(f, 10).map((s) => ({ nome: getSkill(s.skillId)?.label ?? s.skillId, anos: s.anos })),
      experiencias: f.experiencias.map((e, i) => ({
        i,
        cargo: e.cargo,
        empresa: e.empresa,
        inicio: e.inicio,
        fim: e.atual ? "atual" : e.fim,
        funcoes: e.funcoes,
        competencias: e.skills.map((id) => getSkill(id)?.label ?? id),
        ...(cv ? { trechoCv: trechoDoCargo(cv, f.experiencias, i).replace(/\[LINK\]/g, "") } : {}),
      })),
      formacao: f.formacao,
      idiomas: f.idiomas,
      resumoAtual: w2.resumo,
      destaquesAtuais: w2.destaques,
    },
  });
  return { sistema, entrada: redactContacts(entrada) };
}

// ── CV por vaga (D1, D2) ─────────────────────────────────────────────────

/** O que um ponto do cargo pode citar: só o que está naquele cargo (funções, competências, trecho do CV, datas). */
export function permitidosDoCargo(e: Experiencia, trecho: string): Permitidos {
  const texto = [e.cargo, e.empresa, e.inicio, e.fim, ...e.funcoes, trecho].join("\n");
  return {
    skills: new Set<string>([...e.skills, ...skillsNoTexto(texto)]),
    numeros: new Set<string>(numerosNoTexto(texto)),
  };
}

/** Competências da ficha, as que a vaga pede (ou que cobrem por inteiro o que ela pede) primeiro. */
export function competenciasParaVaga(f: Ficha, competenciasVaga: string[]): { nome: string; anos: number }[] {
  const todas = topSkills(f, 10);
  const pede = (id: string) => competenciasVaga.some((v) => v === id || (melhorCompetencia([id], v)?.peso ?? 0) >= 1);
  const ordem = [...todas.filter((s) => pede(s.skillId)), ...todas.filter((s) => !pede(s.skillId))];
  return ordem.map((s) => ({ nome: getSkill(s.skillId)?.label ?? s.skillId, anos: s.anos }));
}

const cargoDaFicha = (e: Experiencia, i: number, pontos: string[]): CvCargo => ({
  i,
  cargo: limpar(e.cargo, 120),
  empresa: limpar(e.empresa, 120),
  inicio: e.inicio.slice(0, 7),
  fim: e.atual ? "" : e.fim.slice(0, 7),
  atual: e.atual,
  pontos,
});

/** CV da ficha como está (sem IA): funções como pontos, competências na ordem da vaga. Base do "fazer eu mesmo". */
export function cvBaseDaFicha(f: Ficha, competenciasVaga: string[]): CvVaga {
  return {
    titulo: limpar(f.titulo, MAX_TITULO_CV),
    cargos: f.experiencias.slice(0, MAX_EXPERIENCIAS).map((e, i) => cargoDaFicha(e, i, e.funcoes.map((x) => limpar(x, MAX_PONTO)).filter(Boolean).slice(0, MAX_PONTOS))),
    competencias: competenciasParaVaga(f, competenciasVaga),
    formacao: f.formacao.map((x) => ({ curso: limpar(x.curso, 120), instituicao: limpar(x.instituicao, 120), ano: limpar(x.ano, 10) })).filter((x) => x.curso || x.instituicao),
    idiomas: f.idiomas.filter((x) => x.idioma).map((x) => ({ idioma: limpar(x.idioma, 40), nivel: x.nivel })),
  };
}

/** Pontos da IA para cada cargo, passados pela trava do próprio cargo. Cargo sem ponto que sobreviva fica com as funções. */
export function sanitizarCargos(cargosIa: unknown, f: Ficha, cvTexto: string | null | undefined, removidos: string[]): CvCargo[] {
  const cv = limparCv(cvTexto ?? "");
  const daIa = new Map<number, unknown[]>();
  for (const c of Array.isArray(cargosIa) ? cargosIa : []) {
    const o = (c && typeof c === "object" ? c : null) as Record<string, unknown> | null;
    const i = typeof o?.i === "number" ? o.i : Number.NaN;
    if (Number.isInteger(i) && Array.isArray(o?.pontos) && !daIa.has(i)) daIa.set(i, o!.pontos as unknown[]);
  }
  return f.experiencias.slice(0, MAX_EXPERIENCIAS).map((e, i) => {
    const p = permitidosDoCargo(e, cv ? trechoDoCargo(cv, f.experiencias, i) : "");
    const pontos: string[] = [];
    for (const x of daIa.get(i) ?? []) {
      const t = limpar(x, MAX_PONTO);
      if (!t || pontos.includes(t)) continue;
      if (motivoInvencao(t, p)) removidos.push(t);
      else if (pontos.length < MAX_PONTOS) pontos.push(t);
    }
    return cargoDaFicha(e, i, pontos.length ? pontos : e.funcoes.map((x) => limpar(x, MAX_PONTO)).filter(Boolean).slice(0, MAX_PONTOS));
  });
}

// ── aviso de idioma e "por que se destaca" por regra (D6, D7) ────────────

export const NIVEL_RANK: Record<string, number> = { basico: 0, intermediario: 1, avancado: 2, fluente: 3, nativo: 4 };

/** Idiomas que a regra reconhece (nome na vaga e na ficha, em PT, EN e ES). */
const IDIOMAS: { id: string; re: RegExp }[] = [
  { id: "en", re: /\b(?:ingl[eê]s|english|ingl[eé]s)\b/i },
  { id: "es", re: /\b(?:espanhol|spanish|espa[nñ]ol|castellano)\b/i },
  { id: "fr", re: /\b(?:franc[eê]s|french|franc[eé]s)\b/i },
  { id: "de", re: /\b(?:alem[aã]o|german|alem[aá]n|deutsch)\b/i },
  { id: "it", re: /\b(?:italiano|italian)\b/i },
  { id: "pt", re: /\b(?:portugu[eê]s|portuguese|portugu[eé]s)\b/i },
];

/** Nível explícito (B1, B2, C1, C2) vem antes das palavras ("English proficiency: B2" pede B2, não fluência). */
const NIVEIS_CEFR: { nivel: "fluente" | "avancado" | "intermediario"; re: RegExp }[] = [
  { nivel: "fluente", re: /\b(?:c1|c2)\b/i },
  { nivel: "avancado", re: /\bb2\b/i },
  { nivel: "intermediario", re: /\bb1\b/i },
];

const NIVEIS_PEDIDOS: { nivel: "fluente" | "avancado" | "intermediario"; re: RegExp }[] = [
  ...NIVEIS_CEFR,
  { nivel: "fluente", re: /\b(?:fluente|flu[eê]ncia|fluent|fluency|fluido|fluidez|nativ[oa]|native|bil[ií]ng[uü]e|bilingual|proficient)\b/i },
  { nivel: "avancado", re: /\b(?:avan[cç]ad[oa]|advanced|avanzad[oa]|upper[- ]intermediate)\b/i },
  { nivel: "intermediario", re: /\b(?:intermedi[aá]ri[oa]|intermediate|intermedi[oa])\b/i },
];

const DESEJAVEL = /\b(?:desej[aá]vel|diferencial|nice to have|a plus|bonus|deseable|valorad[oa]|plus)\b/i;

export type AvisoIdioma = { idioma: string; pede: "fluente" | "avancado" | "intermediario"; tem: string | null; trecho: string };

/** Idioma da ficha → código ("Inglês" → "en"); null quando a regra não reconhece. */
export function codigoIdioma(nome: string): string | null {
  return IDIOMAS.find((x) => x.re.test(nome))?.id ?? null;
}

/**
 * Idiomas que a vaga pede com nível claro (fluente, avançado, B2, C1...) e a ficha não mostra nesse nível.
 * Só avisa; trecho vazio de "desejável" ou "diferencial" não conta. `tem`: nível da ficha ("" sem nível, null sem o idioma).
 */
export function avisosIdioma(textosVaga: string[], idiomas: Ficha["idiomas"]): AvisoIdioma[] {
  const pedidos = new Map<string, AvisoIdioma>();
  for (const linha of textosVaga) {
    if (!linha) continue;
    // Dois-pontos fica ("Inglês: fluente"): ligam o idioma ao nível, não separam pedidos.
    const partes = linha.replace(/[()[\]]/g, " ").split(/[,;.]|\s(?:e|and|y|ou|or|o)\s/i);
    for (const parte of partes) {
      // "Inglês fluente obrigatório; espanhol desejável": só a parte desejável fica de fora.
      if (DESEJAVEL.test(parte)) continue;
      const langs = IDIOMAS.filter((x) => x.re.test(parte));
      if (langs.length !== 1) continue;
      const n = NIVEIS_PEDIDOS.find((x) => x.re.test(parte));
      if (!n) continue;
      const id = langs[0].id;
      const antes = pedidos.get(id);
      if (antes && NIVEL_RANK[antes.pede] >= NIVEL_RANK[n.nivel]) continue;
      pedidos.set(id, { idioma: parte.match(langs[0].re)![0], pede: n.nivel, tem: null, trecho: linha.replace(/\s+/g, " ").trim().slice(0, 140) });
    }
  }
  const out: AvisoIdioma[] = [];
  for (const [id, a] of pedidos) {
    const naFicha = idiomas.filter((x) => codigoIdioma(x.idioma) === id);
    const melhor = naFicha.reduce<number>((m, x) => Math.max(m, x.nivel ? NIVEL_RANK[x.nivel] ?? -1 : -1), -1);
    if (melhor >= NIVEL_RANK[a.pede]) continue;
    const tem = naFicha.length ? naFicha.find((x) => (x.nivel ? NIVEL_RANK[x.nivel] : -1) === melhor)?.nivel ?? "" : null;
    out.push({ ...a, tem });
  }
  return out.slice(0, 3);
}

const mesDe = (v: string): number | null => {
  const m = /^(\d{4})-(\d{2})/.exec(v ?? "");
  return m ? Number(m[1]) * 12 + Number(m[2]) - 1 : null;
};

/** Anos inteiros num cargo (null sem datas). */
export function anosNoCargo(e: Experiencia, now: Date = new Date()): number | null {
  const ini = mesDe(e.inicio);
  const fim = e.atual ? now.getUTCFullYear() * 12 + now.getUTCMonth() : mesDe(e.fim);
  if (ini == null || fim == null || fim < ini) return null;
  return Math.floor((fim - ini) / 12);
}

/**
 * "Por que se destaca" por regra (D7), sem IA: quantas competências da vaga a ficha cobre e o cargo
 * que mais usa o que a vaga pede, com os anos nele. null quando não há nada a dizer.
 */
export type PorQueRegra = { bate: number; total: number; cargo: string | null; empresa: string | null; anos: number | null };

export function porQueRegra(f: Ficha, competenciasVaga: string[], now: Date = new Date()): PorQueRegra | null {
  const total = competenciasVaga.length;
  const bate = total - lacunasDaVaga(f, competenciasVaga).length;
  let melhor: { e: Experiencia; n: number } | null = null;
  for (const e of f.experiencias) {
    const n = competenciasVaga.filter((v) => (melhorCompetencia(e.skills, v)?.peso ?? 0) >= 1).length;
    if (n > 0 && (!melhor || n > melhor.n)) melhor = { e, n };
  }
  if (!bate && !melhor) return null;
  return { bate, total, cargo: melhor?.e.cargo || null, empresa: melhor?.e.empresa || null, anos: melhor ? anosNoCargo(melhor.e, now) : null };
}

const semAcento = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** O título da IA só vale se contiver o título da ficha ou o de um cargo dela (um cargo que a pessoa nunca teve não entra). */
export function tituloDaFicha(titulo: string, f: Ficha | undefined): boolean {
  if (!f) return false;
  const t = semAcento(titulo);
  return [f.titulo, ...f.experiencias.map((e) => e.cargo)].map(semAcento).some((c) => c.length >= 3 && t.includes(c));
}

/** Resposta da IA → proposta já travada. Sem resumo que sobreviva, fica o resumo atual. */
export function sanitizarProposta(
  obj: Record<string, unknown> | null,
  w2: FichaW2,
  p: Permitidos,
  ctx?: { ficha: Ficha; competenciasVaga: string[]; cvTexto?: string | null },
): Proposta {
  const removidos: string[] = [];
  const r = travarTexto(limpar(obj?.resumo, MAX_RESUMO_ADAPTADO), p);
  removidos.push(...r.removidas);
  const destaques: string[] = [];
  for (const d of Array.isArray(obj?.destaques) ? (obj!.destaques as unknown[]) : []) {
    const t = limpar(d, MAX_DESTAQUE_ADAPTADO);
    if (!t) continue;
    if (motivoInvencao(t, p)) removidos.push(t);
    else if (destaques.length < MAX_DESTAQUES) destaques.push(t);
  }
  const c = travarTexto(limpar(obj?.carta, MAX_CARTA), p);
  removidos.push(...c.removidas);
  const q = travarTexto(limpar(obj?.porQue, MAX_POR_QUE), p);
  removidos.push(...q.removidas);
  const tituloIa = limpar(obj?.titulo, MAX_TITULO_CV);
  const tituloOk = tituloIa && !motivoInvencao(tituloIa, p) && tituloDaFicha(tituloIa, ctx?.ficha) ? tituloIa : "";
  if (tituloIa && !tituloOk) removidos.push(tituloIa);
  const base = ctx ? cvBaseDaFicha(ctx.ficha, ctx.competenciasVaga) : { titulo: "", cargos: [], competencias: [], formacao: [], idiomas: [] };
  const cargos = ctx ? sanitizarCargos(obj?.cargos, ctx.ficha, ctx.cvTexto, removidos) : [];
  return {
    resumo: r.texto || w2.resumo,
    destaques: destaques.length ? destaques : w2.destaques.slice(0, MAX_DESTAQUES),
    carta: c.texto,
    porQue: q.texto,
    cv: { ...base, titulo: tituloOk || base.titulo, cargos },
    removidos: removidos.slice(0, 15),
  };
}

export async function prepararParaVaga(
  args: { ficha: Ficha; w2: FichaW2; vaga: SnapshotVaga; cvTexto?: string | null; idioma: string; now?: Date },
  chat: ChatCoachFn,
): Promise<Proposta & { modelo?: string }> {
  const now = args.now ?? new Date();
  const { sistema, entrada } = promptCoach(args.ficha, args.w2, args.vaga, args.idioma, now, args.cvTexto);
  const r = await chat("coach_candidate", {
    json: true,
    temperature: 0.2,
    // CV inteiro (D8): até 5 pontos por cargo, além de resumo, destaques e carta.
    maxTokens: 3000,
    messages: [
      { role: "system", content: sistema },
      { role: "user", content: entrada },
    ],
  });
  const obj = parseJsonObject(r.text);
  if (!obj) throw new Error("resposta da IA sem JSON");
  const p = permitidosDaFicha(args.ficha, args.w2, args.cvTexto, now);
  return { ...sanitizarProposta(obj, args.w2, p, { ficha: args.ficha, competenciasVaga: args.vaga.competencias, cvTexto: args.cvTexto }), modelo: r.model };
}

// ── o que o candidato aprova (D6) ─────────────────────────────────────────

/** CV guardado (aprovação ou candidatura) → formato seguro, ou null. */
export function lerCv(v: unknown): CvVaga | null {
  const o = (v && typeof v === "object" ? v : null) as Record<string, unknown> | null;
  if (!o || !Array.isArray(o.cargos)) return null;
  const arr = (x: unknown): Record<string, unknown>[] => (Array.isArray(x) ? x.filter((y): y is Record<string, unknown> => !!y && typeof y === "object") : []);
  const cargos: CvCargo[] = arr(o.cargos)
    .slice(0, MAX_EXPERIENCIAS)
    .map((c) => ({
      i: typeof c.i === "number" && Number.isInteger(c.i) ? c.i : -1,
      cargo: limpar(c.cargo, 120),
      empresa: limpar(c.empresa, 120),
      inicio: typeof c.inicio === "string" ? c.inicio.slice(0, 7) : "",
      fim: typeof c.fim === "string" ? c.fim.slice(0, 7) : "",
      atual: c.atual === true,
      pontos: (Array.isArray(c.pontos) ? c.pontos : []).map((x) => limpar(x, MAX_PONTO)).filter(Boolean).slice(0, MAX_PONTOS),
    }))
    .filter((c) => c.cargo || c.empresa);
  if (!cargos.length) return null;
  return {
    titulo: limpar(o.titulo, MAX_TITULO_CV),
    cargos,
    competencias: arr(o.competencias)
      .map((c) => ({ nome: limpar(c.nome, 60), anos: typeof c.anos === "number" && c.anos >= 0 ? Math.min(60, Math.floor(c.anos)) : 0 }))
      .filter((c) => c.nome)
      .slice(0, 20),
    formacao: arr(o.formacao).map((x) => ({ curso: limpar(x.curso, 120), instituicao: limpar(x.instituicao, 120), ano: limpar(x.ano, 10) })).filter((x) => x.curso || x.instituicao).slice(0, 10),
    idiomas: arr(o.idiomas).map((x) => ({ idioma: limpar(x.idioma, 40), nivel: typeof x.nivel === "string" && x.nivel in NIVEL_RANK ? x.nivel : "" })).filter((x) => x.idioma).slice(0, 10),
  };
}

/**
 * CV vindo da tela: só o título, os pontos de cada cargo e quais cargos entram vêm do candidato.
 * Cargo, empresa, datas, competências, formação e idiomas saem da ficha (não dá para mudar por aqui).
 */
export function cvDaTela(input: unknown, f: Ficha, competenciasVaga: string[]): CvVaga | null {
  const o = (input && typeof input === "object" ? input : null) as Record<string, unknown> | null;
  if (!o || !Array.isArray(o.cargos)) return null;
  const base = cvBaseDaFicha(f, competenciasVaga);
  const vistos = new Set<number>();
  const cargos: CvCargo[] = [];
  for (const c of o.cargos as unknown[]) {
    const x = (c && typeof c === "object" ? c : null) as Record<string, unknown> | null;
    const i = typeof x?.i === "number" ? x.i : Number.NaN;
    const daFicha = Number.isInteger(i) ? base.cargos.find((b) => b.i === i) : undefined;
    if (!daFicha || vistos.has(i)) continue;
    vistos.add(i);
    const pontos = (Array.isArray(x!.pontos) ? x!.pontos : []).map((y) => limpar(y, MAX_PONTO)).filter(Boolean).slice(0, MAX_PONTOS);
    cargos.push({ ...daFicha, pontos });
  }
  if (!cargos.length) return null;
  cargos.sort((a, b) => a.i - b.i);
  return { ...base, titulo: limpar(o.titulo, MAX_TITULO_CV) || base.titulo, cargos };
}

/**
 * Adaptação vinda da tela (o candidato pode ter editado). Limites e contatos como na Ficha W2;
 * contato só sai na Entrevista (2.4c). null quando não sobra nada para mandar.
 * `ctx` (ficha e competências da vaga): sem ele, o CV da tela é ignorado.
 */
export function sanitizarAdaptacao(input: unknown, vacancyHash: string, now: Date = new Date(), ctx?: { ficha: Ficha; competenciasVaga: string[] }): Adaptacao | null {
  const o = (input && typeof input === "object" ? input : null) as Record<string, unknown> | null;
  if (!o) return null;
  const resumo = limpar(o.resumo, MAX_RESUMO_ADAPTADO);
  const destaques = (Array.isArray(o.destaques) ? o.destaques : []).map((d) => limpar(d, MAX_DESTAQUE_ADAPTADO)).filter(Boolean).slice(0, MAX_DESTAQUES);
  const carta = limpar(o.carta, MAX_CARTA);
  const porQue = limpar(o.porQue, MAX_POR_QUE);
  const cv = ctx ? cvDaTela(o.cv, ctx.ficha, ctx.competenciasVaga) : null;
  if (!resumo && !carta && !cv) return null;
  return { resumo, destaques, carta, ia: o.ia === true, vacancyHash, criadaEm: now.toISOString(), cv, porQue };
}

/** Adaptação guardada (aprovação ou candidatura) → formato seguro, ou null. */
export function lerAdaptacao(v: unknown): Adaptacao | null {
  const o = (v && typeof v === "object" ? v : null) as Record<string, unknown> | null;
  if (!o) return null;
  const a = sanitizarAdaptacao(o, typeof o.vacancyHash === "string" ? o.vacancyHash.slice(0, 128) : "", new Date(0));
  const cv = lerCv(o.cv);
  const base = a ?? (cv ? { resumo: "", destaques: [], carta: "", ia: o.ia === true, vacancyHash: typeof o.vacancyHash === "string" ? o.vacancyHash.slice(0, 128) : "", criadaEm: new Date(0).toISOString(), cv: null, porQue: limpar(o.porQue, MAX_POR_QUE) } : null);
  if (!base) return null;
  const out = { ...base, cv };
  return typeof o.criadaEm === "string" ? { ...out, criadaEm: o.criadaEm.slice(0, 40) } : out;
}
