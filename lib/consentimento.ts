/**
 * Consentimentos LGPD do candidato (1.5.5). O texto mostrado na tela é este mesmo, no idioma
 * da pessoa, e vai inteiro para o ConsentLog com a versão. Mudou o texto: suba a versão.
 */
export const CONSENTIMENTO_VERSAO = 1;
export type TipoConsentimento = "tratamentoBusca" | "contatoProxy" | "nudges";
export const CONSENTIMENTOS_OBRIGATORIOS: TipoConsentimento[] = ["tratamentoBusca", "contatoProxy"];
export const CONSENTIMENTOS: TipoConsentimento[] = ["tratamentoBusca", "contatoProxy", "nudges"];

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
};

export function textoConsentimento(tipo: TipoConsentimento, idioma: string): string {
  const l: Idioma = idioma === "en" || idioma === "es" ? idioma : "pt-BR";
  return TEXTOS[tipo][l];
}
