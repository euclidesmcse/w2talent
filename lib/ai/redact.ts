/**
 * Tira contatos e documentos do texto antes de mandar a um fornecedor de IA externo (LGPD).
 * O modelo não precisa deles para resumir ou comparar um CV. Troca por marcadores.
 */

const RULES: [RegExp, string][] = [
  // e-mail
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[EMAIL]"],
  // CPF 000.000.000-00 ou 11 dígitos colados
  [/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, "[CPF]"],
  // CEP 00000-000
  [/\b\d{5}-\d{3}\b/g, "[CEP]"],
  // perfis pessoais (LinkedIn, GitHub)
  [/\b(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com\/in|github\.com)\/[A-Za-z0-9_-]+\/?/gi, "[PERFIL]"],
  // telefone: +55 (11) 98765-4321, (11) 3456-7890, 11987654321, +1 415 555 0100
  [/(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,3}\)|\d{2,3})[\s.-]?\d{4,5}[\s.-]?\d{4}\b/g, "[TELEFONE]"],
  // endereço: "Rua X, 123", "Av. Paulista 1000", "Avenida …, nº 45"
  [
    /\b(?:Rua|R\.|Avenida|Av\.?|Alameda|Al\.|Travessa|Tv\.|Rodovia|Estrada|Praça|Largo)\s+[^\n,;]{2,60}?,?\s*(?:n[º°o]\.?\s*)?\d{1,6}\b/gi,
    "[ENDERECO]",
  ],
];

export function redactContacts(text: string): string {
  let out = text;
  for (const [re, mark] of RULES) out = out.replace(re, mark);
  return out;
}
