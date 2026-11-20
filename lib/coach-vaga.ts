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
 */
import type { ChatRequest, ChatResult } from "./ai/types";
import { redactContacts } from "./ai/redact";
import { ETICA, parseJsonObject, W2_LANG } from "./ficha-ai";
import { anosExperiencia, MAX_DESTAQUES, topSkills, type Ficha, type FichaW2 } from "./ficha";
import { getSkill, normalizeSkill } from "./taxonomy";
import { melhorCompetencia } from "./taxonomia-proximas";
import type { SnapshotVaga } from "./envio";

/** Mesmos limites da Ficha W2, para caber no e-mail e no cartão de sempre. */
export const MAX_RESUMO_ADAPTADO = 420;
export const MAX_DESTAQUE_ADAPTADO = 160;
export const MAX_CARTA = 800;

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
};

/** Sugestão da IA já passada pela trava; `removidos`: frases que saíram por não estarem na ficha. */
export type Proposta = { resumo: string; destaques: string[]; carta: string; removidos: string[] };

export type Lacuna = { skillId: string; nome: string; proxima: string | null };

export type ChatCoachFn = (task: "coach_candidate", req: ChatRequest) => Promise<ChatResult & { model?: string }>;

const limpar = (v: unknown, max: number): string =>
  typeof v === "string" ? redactContacts(v.replace(/\s+/g, " ").trim()).slice(0, max).trim() : "";

// ── competências e números citados num texto ─────────────────────────────

/** Rótulos curtos demais para achar com segurança no meio de uma frase (Go, R, C). */
const CURTO = 2;

/**
 * Competências citadas no texto. Uma palavra só conta quando escrita como o rótulo da taxonomia
 * ("AWS", "Terraform"), para "go", "rest" ou "express" do texto comum não virarem competência.
 */
export function skillsNoTexto(texto: string): string[] {
  const toks = (texto ?? "")
    .split(/[\s,;:()"“”/|]+/)
    .map((t) => t.replace(/[.!?]+$/, ""))
    .filter(Boolean);
  const usados = new Array(toks.length).fill(false);
  const out: string[] = [];
  for (let n = 3; n >= 1; n--) {
    for (let i = 0; i + n <= toks.length; i++) {
      if (usados.slice(i, i + n).some(Boolean)) continue;
      const fonte = toks.slice(i, i + n).join(" ");
      const id = normalizeSkill(fonte);
      if (!id) continue;
      const rotulo = getSkill(id)?.label ?? "";
      if (rotulo.length <= CURTO) continue;
      if (n === 1 && fonte !== rotulo) continue;
      for (let k = i; k < i + n; k++) usados[k] = true;
      if (!out.includes(id)) out.push(id);
    }
  }
  return out;
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
  const skill = skillsNoTexto(frase).find((id) => !temSkill(p, id));
  if (skill) return getSkill(skill)?.label ?? skill;
  const numero = numerosNoTexto(frase).find((n) => !p.numeros.has(n));
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

/** Instruções e entrada (sem nome nem contatos; o CV completo não vai para a IA). */
export function promptCoach(f: Ficha, w2: FichaW2, vaga: SnapshotVaga, idioma: string, now: Date = new Date()): { sistema: string; entrada: string } {
  const lang = idiomaCoach(idioma);
  const sistema = `You help a candidate adapt their profile card to one job post. Reply with one JSON object only: {"resumo": string, "destaques": [string], "carta": string}.
"resumo": at most 3 short sentences (max 380 characters), third person, no name. Rewrite the current summary so the parts of the career that matter most for this job come first.
"destaques": up to 3 items, each under 140 characters, chosen and ordered by what the job asks. Prefer the current highlights and the duties listed in the experience.
"carta": a short cover message from the candidate to the company, first person, 3 to 5 sentences (max 700 characters): why this job, and the 2 or 3 facts from the profile that match it. No greeting with a person's name, no contact data, no salary.
Use only facts present in "perfil". Never claim a skill, tool, certification, employer or number that is not in "perfil", even if the job asks for it. If the job asks for something the candidate does not have, leave it out; do not apologize for it.
No adjectives like "passionate" or "excellent".
${ETICA}
Write in ${W2_LANG[lang]}.`;
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
      experiencias: f.experiencias.map((e) => ({ cargo: e.cargo, empresa: e.empresa, inicio: e.inicio, fim: e.atual ? "atual" : e.fim, funcoes: e.funcoes, competencias: e.skills.map((id) => getSkill(id)?.label ?? id) })),
      formacao: f.formacao,
      idiomas: f.idiomas,
      resumoAtual: w2.resumo,
      destaquesAtuais: w2.destaques,
    },
  });
  return { sistema, entrada: redactContacts(entrada) };
}

/** Resposta da IA → proposta já travada. Sem resumo que sobreviva, fica o resumo atual. */
export function sanitizarProposta(obj: Record<string, unknown> | null, w2: FichaW2, p: Permitidos): Proposta {
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
  return {
    resumo: r.texto || w2.resumo,
    destaques: destaques.length ? destaques : w2.destaques.slice(0, MAX_DESTAQUES),
    carta: c.texto,
    removidos: removidos.slice(0, 10),
  };
}

export async function prepararParaVaga(
  args: { ficha: Ficha; w2: FichaW2; vaga: SnapshotVaga; cvTexto?: string | null; idioma: string; now?: Date },
  chat: ChatCoachFn,
): Promise<Proposta & { modelo?: string }> {
  const now = args.now ?? new Date();
  const { sistema, entrada } = promptCoach(args.ficha, args.w2, args.vaga, args.idioma, now);
  const r = await chat("coach_candidate", {
    json: true,
    temperature: 0.2,
    maxTokens: 1200,
    messages: [
      { role: "system", content: sistema },
      { role: "user", content: entrada },
    ],
  });
  const obj = parseJsonObject(r.text);
  if (!obj) throw new Error("resposta da IA sem JSON");
  return { ...sanitizarProposta(obj, args.w2, permitidosDaFicha(args.ficha, args.w2, args.cvTexto, now)), modelo: r.model };
}

// ── o que o candidato aprova (D6) ─────────────────────────────────────────

/**
 * Adaptação vinda da tela (o candidato pode ter editado). Limites e contatos como na Ficha W2;
 * contato só sai na Entrevista (2.4c). null quando não sobra nada para mandar.
 */
export function sanitizarAdaptacao(input: unknown, vacancyHash: string, now: Date = new Date()): Adaptacao | null {
  const o = (input && typeof input === "object" ? input : null) as Record<string, unknown> | null;
  if (!o) return null;
  const resumo = limpar(o.resumo, MAX_RESUMO_ADAPTADO);
  const destaques = (Array.isArray(o.destaques) ? o.destaques : []).map((d) => limpar(d, MAX_DESTAQUE_ADAPTADO)).filter(Boolean).slice(0, MAX_DESTAQUES);
  const carta = limpar(o.carta, MAX_CARTA);
  if (!resumo && !carta) return null;
  return { resumo, destaques, carta, ia: o.ia === true, vacancyHash, criadaEm: now.toISOString() };
}

/** Adaptação guardada (aprovação ou candidatura) → formato seguro, ou null. */
export function lerAdaptacao(v: unknown): Adaptacao | null {
  const o = (v && typeof v === "object" ? v : null) as Record<string, unknown> | null;
  if (!o) return null;
  const a = sanitizarAdaptacao(o, typeof o.vacancyHash === "string" ? o.vacancyHash.slice(0, 128) : "", new Date(0));
  return a && typeof o.criadaEm === "string" ? { ...a, criadaEm: o.criadaEm.slice(0, 40) } : a;
}
