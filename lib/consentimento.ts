/**
 * Consentimentos LGPD do candidato (1.5.5). O texto mostrado na tela é este mesmo, no idioma
 * da pessoa, e vai inteiro para o ConsentLog com a versão. Mudou o texto: suba a versão.
 */
export const CONSENTIMENTO_VERSAO = 1;
export type TipoConsentimento = "tratamentoBusca" | "contatoProxy" | "nudges" | "whatsapp";
export const CONSENTIMENTOS_OBRIGATORIOS: TipoConsentimento[] = ["tratamentoBusca", "contatoProxy"];
/** Os que a tela de perfil oferece na primeira entrada. O "whatsapp" (3.5a) é aceito em Minha conta. */
export const CONSENTIMENTOS: TipoConsentimento[] = ["tratamentoBusca", "contatoProxy", "nudges"];
/** 3.5a: versão do texto do WhatsApp (sobe quando o texto mudar). */
export const CONSENTIMENTO_WHATSAPP_VERSAO = 1;

type Idioma = "pt-BR" | "en" | "es";
const TEXTOS: Record<TipoConsentimento, Record<Idioma, string>> = {
  tratamentoBusca: {
    "pt-BR": "Autorizo o W2Talent a guardar meus dados profissionais e mostrá-los a recrutadores logados nas buscas por candidatos, sem meus contatos.",
    en: "I allow W2Talent to store my professional data and show it to signed-in recruiters in candidate searches, without my contact details.",
    es: "Autorizo a W2Talent a guardar mis datos profesionales y mostrarlos a reclutadores con sesión iniciada en las búsquedas de candidatos, sin mis contactos.",
  },
  contatoProxy: {
    "pt-BR": "Autorizo o envio da minha Ficha W2 às empresas das vagas que eu aprovar, e o contato delas comigo por um endereço protegido do W2Talent.",
    en: "I allow my W2 Profile to be sent to the companies of the jobs I approve, and them to contact me through a protected W2Talent address.",
    es: "Autorizo el envío de mi Ficha W2 a las empresas de las vacantes que apruebe, y que me contacten por una dirección protegida de W2Talent.",
  },
  nudges: {
    "pt-BR": "Quero receber e-mails do W2Talent sobre a minha ficha (por exemplo, quando ela estiver para vencer). Opcional.",
    en: "I want to receive emails from W2Talent about my profile (for example, when it is about to expire). Optional.",
    es: "Quiero recibir correos de W2Talent sobre mi ficha (por ejemplo, cuando esté por vencer). Opcional.",
  },
  whatsapp: {
    "pt-BR":
      "Quero receber avisos do W2Talent no WhatsApp deste número: quando uma empresa vir minha candidatura, quando ela mudar de etapa, sobre entrevistas, vagas aprovadas que vão vencer e respostas da equipe. Cada aviso traz só o nome da vaga e da empresa e um link para o site. No máximo 3 por dia, das 8h às 20h (Brasília). Posso desligar a qualquer hora em Minha conta ou respondendo SAIR. Opcional.",
    en: "I want to receive W2Talent notices on WhatsApp at this number: when a company views my application, when it changes stage, about interviews, approved jobs about to expire and replies from the team. Each notice carries only the job title, the company name and a link to the website. At most 3 a day, from 8am to 8pm (Brasília time). I can turn it off at any time in My account or by replying STOP. Optional.",
    es: "Quiero recibir avisos de W2Talent por WhatsApp en este número: cuando una empresa vea mi postulación, cuando cambie de etapa, sobre entrevistas, vacantes aprobadas por vencer y respuestas del equipo. Cada aviso trae solo el nombre de la vacante y de la empresa y un enlace al sitio. Como máximo 3 por día, de 8 a 20 h (hora de Brasilia). Puedo desactivarlo cuando quiera en Mi cuenta o respondiendo SALIR. Opcional.",
  },
};

export function textoConsentimento(tipo: TipoConsentimento, idioma: string): string {
  const l: Idioma = idioma === "en" || idioma === "es" ? idioma : "pt-BR";
  return TEXTOS[tipo][l];
}

/**
 * 3.6a (D2): consentimento separado, opcional e desligado por padrão para usar as correções da pessoa
 * no treino de um modelo aberto. Fica no ConsentLog com tipo "treinoIA"; desligar grava outra linha do
 * mesmo tipo com baseLegal "revogacao" (vale a linha mais recente). Mudou o texto: suba a versão.
 */
export const TREINO_IA_TIPO = "treinoIA";
export const TREINO_IA_VERSAO = 1;
const TEXTOS_TREINO: Record<"aceite" | "revogacao", Record<Idioma, string>> = {
  aceite: {
    "pt-BR":
      "Autorizo o W2Talent a guardar, sem meu nome, contatos, links, documentos, endereço e nomes de empresas, o texto que a IA escreveu para mim e a versão que eu corrigi, para treinar e avaliar um modelo de IA aberto do próprio W2Talent. Opcional; posso desligar quando quiser e meus exemplos são apagados.",
    en: "I allow W2Talent to keep, without my name, contact details, links, documents, address and company names, the text the AI wrote for me and the version I corrected, to train and evaluate W2Talent's own open AI model. Optional; I can turn it off at any time and my examples are deleted.",
    es: "Autorizo a W2Talent a guardar, sin mi nombre, contactos, enlaces, documentos, dirección ni nombres de empresas, el texto que la IA escribió para mí y la versión que corregí, para entrenar y evaluar un modelo de IA abierto del propio W2Talent. Opcional; puedo desactivarlo cuando quiera y mis ejemplos se borran.",
  },
  revogacao: {
    "pt-BR": "Desliguei o uso das minhas correções no treino da IA. Meus exemplos guardados foram apagados.",
    en: "I turned off the use of my corrections to train the AI. My stored examples were deleted.",
    es: "Desactivé el uso de mis correcciones para entrenar la IA. Mis ejemplos guardados se borraron.",
  },
};

export function textoTreinoIa(idioma: string, revogacao = false): string {
  const l: Idioma = idioma === "en" || idioma === "es" ? idioma : "pt-BR";
  return TEXTOS_TREINO[revogacao ? "revogacao" : "aceite"][l];
}
