/**
 * 2.0 Transparência (plano "IA para RH (SAP)", aprovado pelo Euclides em 2026-11-18).
 * Onde a IA aparece no W2Talent, na ordem da página /ia. Cada linha tem uma âncora
 * (os selos "Como usamos IA" apontam para ela) e as tarefas do roteador que usa.
 * Ao ligar uma tarefa nova de IA numa tela, acrescente a linha aqui e os textos em messages/*.json (grupo "ia").
 */
import type { TaskName } from "@/lib/ai/tasks";

export type LinhaIa = {
  /** Prefixo das chaves em messages ("cv" → ia.cvTarefa, ia.cvFaz, ia.cvDados, ia.cvDecide) e âncora na página. */
  id: "cv" | "w2" | "vaga" | "vies" | "perguntas" | "busca" | "parecidas" | "match" | "ajuda" | "traducao" | "mercado" | "ranking" | "atendimento" | "treino";
  ancora: string;
  /** Tarefas do roteador de IA usadas. Vazio = não é IA (o match é uma conta com pesos fixos). */
  tarefas: TaskName[];
};

export const LINHAS_IA: LinhaIa[] = [
  { id: "cv", ancora: "leitura-cv", tarefas: ["extract_cv"] },
  { id: "w2", ancora: "ficha-w2", tarefas: ["ficha_w2"] },
  // 2.1b: Publicar vaga (leitura do texto colado; o vetor confere duplicada e faixa).
  { id: "vaga", ancora: "leitura-vaga", tarefas: ["extract_vacancy", "embed"] },
  // 2.1c: revisor de viés (regras fixas; a IA só reescreve quando o recrutador pede) e perguntas de entrevista.
  { id: "vies", ancora: "revisor-vies", tarefas: ["review_bias"] },
  { id: "perguntas", ancora: "perguntas-entrevista", tarefas: ["interview_questions"] },
  { id: "busca", ancora: "busca", tarefas: ["embed"] },
  { id: "parecidas", ancora: "parecidas", tarefas: ["embed"] },
  { id: "match", ancora: "match", tarefas: [] },
  // 2.6a-2: perguntas na Ajuda, respondidas só com os artigos.
  { id: "ajuda", ancora: "ajuda", tarefas: ["support_chat", "embed"] },
  // 2.6b: "Falar com uma pessoa" (não é IA: só a equipe responde; apagada 180 dias depois de encerrada).
  { id: "atendimento", ancora: "falar-com-pessoa", tarefas: [] },
  // 2.7a: tradução automática das vagas para o idioma de quem vê (o original fica a um clique).
  { id: "traducao", ancora: "traducao", tarefas: ["translate_content", "translate_profile"] },
  // 3.2: números do mercado (não é IA; mostra o que a pretensão agregada revela ao recrutador).
  { id: "mercado", ancora: "mercado", tarefas: [] },
  // 3.1b: ordem dos candidatos ajustada pelo que a empresa escolhe (não é IA; a % de match não muda).
  { id: "ranking", ancora: "ranking", tarefas: [] },
  // 3.6a: exemplos de treino (consentimento opcional, anonimizados; não chama IA, só guarda o par IA/corrigido).
  { id: "treino", ancora: "treino", tarefas: [] },
];

export const CAMPOS_LINHA = ["Tarefa", "Faz", "Dados", "Decide"] as const;

/** Endereço para pedir revisão por uma pessoa (LGPD art. 20). Confirmar com o Euclides que a caixa existe. */
export const EMAIL_REVISAO = "contato@w2talent.com";

export function hrefIa(ancora?: string): string {
  return ancora ? `/ia#${ancora}` : "/ia";
}
