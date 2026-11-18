/**
 * 2.1c (plano 2.1, D5 e D6, aprovado em 2026-11-18):
 * - Reescrita sem viés: só quando o recrutador pede. A IA reescreve título, descrição e benefícios
 *   sem os termos que o revisor apontou; a tela mostra a proposta e ele decide se usa.
 * - Perguntas de entrevista: geradas na hora a partir das competências e responsabilidades.
 *   Só para o recrutador, não ficam guardadas e não dão nota. Sem IA, saem de modelos fixos.
 * O texto da vaga não tem dados pessoais; e-mail e telefone saem mesmo assim antes da chamada.
 */
import type { ChatRequest, ChatResult } from "./ai/types";
import { redactContacts } from "./ai/redact";
import { parseJsonObject } from "./ficha-ai";
import { getSkill } from "./taxonomy";
import type { RascunhoVaga } from "./vaga-campos";
import { revisarVies, type AvisoVies } from "./vaga-vies";

export type ChatExtraFn = (task: "review_bias" | "interview_questions", req: ChatRequest) => Promise<ChatResult & { model?: string }>;

export type TextoVaga = Pick<RascunhoVaga, "titulo" | "descricaoBullets" | "beneficios">;

function camposVies(v: TextoVaga) {
  return { titulo: v.titulo, descricao: v.descricaoBullets.join("\n"), beneficios: v.beneficios.join("\n") };
}

export function avisosDoTexto(v: TextoVaga): AvisoVies[] {
  return revisarVies(camposVies(v));
}

// ── Reescrita sem viés ─────────────────────────────────────────────────────

/** Limites da reescrita: folgados, para não cortar texto que a tela e a vaga aceitam. */
export const MAX_TITULO_REVISAR = 200;
export const MAX_ITENS_REVISAR = 60;
export const MAX_ITEM_REVISAR = 2000;

function itens(v: unknown): string[] | null {
  if (!Array.isArray(v)) return v === undefined || v === null ? [] : null;
  const out: string[] = [];
  for (const x of v) {
    if (typeof x !== "string") return null;
    const s = x.replace(/[ \t]+/g, " ").trim();
    if (s.length > MAX_ITEM_REVISAR) return null;
    if (s) out.push(s);
  }
  return out.length > MAX_ITENS_REVISAR ? null : out;
}

/**
 * Texto da vaga para revisar, inteiro. Null quando passa dos limites (nunca corta em silêncio:
 * usar uma proposta cortada apagaria requisitos ou benefícios).
 */
export function textoParaRevisar(input: unknown): TextoVaga | null {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const titulo = typeof o.titulo === "string" ? o.titulo.replace(/\s+/g, " ").trim() : "";
  if (titulo.length > MAX_TITULO_REVISAR) return null;
  const descricaoBullets = itens(o.descricaoBullets);
  const beneficios = itens(o.beneficios);
  if (!descricaoBullets || !beneficios) return null;
  return { titulo, descricaoBullets, beneficios };
}

const SYSTEM_VIES = `You edit job postings to remove exclusionary language. Reply with one JSON object only.
Rewrite only what is needed so the posting does not filter people by age, gender, appearance, national origin or native language, marital or family status, health or disability, or religion.
Keep every real requirement, responsibility and benefit, the same order, the same tone and the same language as the input. Never add requirements, salary or benefits.
"Native speaker" becomes a fluency level (for example "fluent English"). Age, appearance, family, health and religion requirements are removed.
Schema: {"titulo": string, "descricaoBullets": [string], "beneficios": [string]}`;

export type Reescrita = TextoVaga & { restantes: number };

/** Proposta de texto sem os termos apontados. "igual" quando a IA respondeu sem mudar nada; null quando falha. */
export async function reescreverSemVies(v: TextoVaga, chat: ChatExtraFn): Promise<Reescrita | "igual" | null> {
  const avisos = avisosDoTexto(v);
  const entrada = {
    titulo: redactContacts(v.titulo),
    descricaoBullets: v.descricaoBullets.map(redactContacts),
    beneficios: v.beneficios.map(redactContacts),
    termos: [...new Set(avisos.map((a) => a.trecho))],
  };
  try {
    const r = await chat("review_bias", {
      json: true,
      temperature: 0,
      maxTokens: 2000,
      messages: [
        { role: "system", content: SYSTEM_VIES },
        { role: "user", content: JSON.stringify(entrada) },
      ],
    });
    const obj = parseJsonObject(r.text);
    if (!obj) return null;
    const lido = textoParaRevisar(obj);
    if (!lido) return null;
    const limpo: TextoVaga = {
      titulo: redactContacts(lido.titulo),
      descricaoBullets: lido.descricaoBullets.map(redactContacts),
      beneficios: lido.beneficios.map(redactContacts),
    };
    const out: TextoVaga = {
      titulo: limpo.titulo || v.titulo,
      // Lista vazia quase sempre é resposta quebrada: mantém a do recrutador.
      descricaoBullets: limpo.descricaoBullets.length || !v.descricaoBullets.length ? limpo.descricaoBullets : v.descricaoBullets,
      beneficios: limpo.beneficios.length || !v.beneficios.length ? limpo.beneficios : v.beneficios,
    };
    if (JSON.stringify(out) === JSON.stringify({ titulo: v.titulo, descricaoBullets: v.descricaoBullets, beneficios: v.beneficios })) return "igual";
    return { ...out, restantes: avisosDoTexto(out).length };
  } catch (e) {
    console.warn("[vaga] reescrita sem viés falhou:", e instanceof Error ? e.name : e);
    return null;
  }
}

// ── Perguntas de entrevista ────────────────────────────────────────────────

export type Idioma = "pt-BR" | "en" | "es";
export type Pergunta = { competencia: string; pergunta: string; observar: string };
export const MAX_PERGUNTAS = 8;

const NOME_IDIOMA: Record<Idioma, string> = { "pt-BR": "Brazilian Portuguese", en: "English", es: "Spanish" };

const SYSTEM_PERGUNTAS = (idioma: Idioma) => `You write structured interview questions for a recruiter. Reply with one JSON object only.
Write 6 to 8 questions in ${NOME_IDIOMA[idioma]}. Each question checks one skill or responsibility from the job, asks for a concrete past example or a practical problem, and is the same for every candidate.
Never ask about age, gender, appearance, origin, marital or family status, children, pregnancy, health, disability, religion, politics, union membership or salary history.
"observar" says what a good answer shows (evidence to look for), never a score.
Schema: {"perguntas": [{"competencia": string, "pergunta": string, "observar": string}]}`;

function nomeSkill(id: string): string {
  return getSkill(id)?.label ?? id;
}

const MODELOS: Record<Idioma, { skill: [string, string][]; tarefa: [string, string]; geral: [string, string] }> = {
  "pt-BR": {
    skill: [
      ["Conte um projeto recente em que você usou {x}. Qual problema resolveu e qual foi a sua parte?", "Um exemplo concreto, as decisões que a pessoa tomou e o resultado."],
      ["Qual foi o problema mais difícil que você enfrentou com {x}? Como chegou à solução?", "Os passos do raciocínio, o que testou e o que aprendeu."],
    ],
    tarefa: ["A vaga inclui: \"{x}\". Conte uma situação em que você fez algo parecido.", "O contexto, o que a pessoa fez e o que mudou depois."],
    geral: ["Conte uma entrega da qual você se orgulha. O que você faria diferente hoje?", "Clareza sobre o próprio papel e capacidade de rever o que fez."],
  },
  en: {
    skill: [
      ["Tell me about a recent project where you used {x}. What problem did it solve and what was your part?", "A concrete example, the decisions the person made and the outcome."],
      ["What was the hardest problem you faced with {x}? How did you get to the solution?", "The reasoning steps, what they tested and what they learned."],
    ],
    tarefa: ["This role includes: \"{x}\". Tell me about a time you did something similar.", "The context, what the person did and what changed afterwards."],
    geral: ["Tell me about a piece of work you are proud of. What would you do differently today?", "Clarity about their own role and the ability to reflect on it."],
  },
  es: {
    skill: [
      ["Cuéntame un proyecto reciente en el que usaste {x}. ¿Qué problema resolvió y cuál fue tu parte?", "Un ejemplo concreto, las decisiones que tomó la persona y el resultado."],
      ["¿Cuál fue el problema más difícil que enfrentaste con {x}? ¿Cómo llegaste a la solución?", "Los pasos del razonamiento, qué probó y qué aprendió."],
    ],
    tarefa: ["La vacante incluye: \"{x}\". Cuéntame una situación en la que hiciste algo parecido.", "El contexto, qué hizo la persona y qué cambió después."],
    geral: ["Cuéntame un trabajo del que te sientas orgulloso. ¿Qué harías distinto hoy?", "Claridad sobre su propio papel y capacidad de revisar lo que hizo."],
  },
};

/** Perguntas sem IA: uma por competência (até 5), até 2 das responsabilidades e uma geral. */
export function perguntasPorModelo(v: Pick<RascunhoVaga, "stack" | "descricaoBullets">, idioma: Idioma): Pergunta[] {
  const m = MODELOS[idioma];
  const out: Pergunta[] = v.stack.slice(0, 5).map((id, i) => {
    const [p, o] = m.skill[i % m.skill.length];
    const nome = nomeSkill(id);
    return { competencia: nome, pergunta: p.replace("{x}", nome), observar: o };
  });
  // Responsabilidade que cai no revisor de viés ("Boa aparência", "Sem filhos") não vira pergunta.
  const tarefas = v.descricaoBullets.filter((b) => !revisarVies({ descricao: b }).length);
  for (const b of tarefas.slice(0, 2)) {
    const x = b.length > 120 ? `${b.slice(0, 117)}...` : b;
    out.push({ competencia: x, pergunta: m.tarefa[0].replace("{x}", x), observar: m.tarefa[1] });
  }
  out.push({ competencia: "", pergunta: m.geral[0], observar: m.geral[1] });
  return out.slice(0, MAX_PERGUNTAS);
}

function curto(v: unknown, max: number): string {
  return typeof v === "string" ? redactContacts(v.replace(/\s+/g, " ").trim()).slice(0, max) : "";
}

/** Limpa a resposta da IA. Pergunta que cai no revisor de viés sai. */
export function sanitizarPerguntas(v: unknown): Pergunta[] {
  const arr = Array.isArray(v) ? v : [];
  const out: Pergunta[] = [];
  for (const item of arr) {
    const o = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const p: Pergunta = { competencia: curto(o.competencia, 80), pergunta: curto(o.pergunta, 300), observar: curto(o.observar, 200) };
    if (p.pergunta.length < 10) continue;
    if (revisarVies({ descricao: `${p.pergunta}\n${p.observar}` }).length) continue;
    if (out.some((x) => x.pergunta === p.pergunta)) continue;
    out.push(p);
    if (out.length >= MAX_PERGUNTAS) break;
  }
  return out;
}

export async function gerarPerguntas(
  v: RascunhoVaga,
  idioma: Idioma,
  chat: ChatExtraFn | null,
): Promise<{ perguntas: Pergunta[]; origem: "ia" | "regras" }> {
  if (chat) {
    const entrada = {
      titulo: redactContacts(v.titulo),
      nivel: v.nivel,
      competencias: v.stack.map(nomeSkill),
      responsabilidades: v.descricaoBullets.map(redactContacts),
    };
    try {
      const r = await chat("interview_questions", {
        json: true,
        temperature: 0.3,
        maxTokens: 2000,
        messages: [
          { role: "system", content: SYSTEM_PERGUNTAS(idioma) },
          { role: "user", content: JSON.stringify(entrada) },
        ],
      });
      const perguntas = sanitizarPerguntas(parseJsonObject(r.text)?.perguntas);
      if (perguntas.length >= 3) return { perguntas, origem: "ia" };
    } catch (e) {
      console.warn("[vaga] perguntas pela IA falharam:", e instanceof Error ? e.name : e);
    }
  }
  return { perguntas: perguntasPorModelo(v, idioma), origem: "regras" };
}
