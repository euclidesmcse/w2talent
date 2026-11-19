/**
 * Anonimização dos exemplos de treino (3.6a, D3). Roda ANTES de guardar qualquer exemplo.
 *
 * Duas camadas:
 * 1. valores conhecidos da própria pessoa (nome, e-mail, celular, empresa, links do banco), trocados
 *    por igualdade exata (sem diferença de maiúsculas e acentos), do mais longo ao mais curto;
 * 2. padrões (e-mails, links, documentos BR/ES/MX/US, telefones BR e internacionais, endereços PT/ES/EN,
 *    razão social com Ltda/S.A./Inc...), reaproveitando as regras de `redact.ts`.
 *
 * Marcadores: [NOME], [EMAIL], [TELEFONE], [LINK], [DOCUMENTO], [ENDERECO], [EMPRESA].
 *
 * `sobras` é a rede de segurança: procura, com regras mais largas que as da troca, qualquer coisa que
 * ainda pareça contato ou valor conhecido. Se achar, o exemplo NÃO é guardado (lib/treino.ts).
 * Funções puras, sem dependência: rodam no Worker e no Jest.
 */
import { REDACT_RULES } from "./redact";

export type Conhecidos = {
  nomes?: (string | null | undefined)[];
  emails?: (string | null | undefined)[];
  telefones?: (string | null | undefined)[];
  empresas?: (string | null | undefined)[];
  links?: (string | null | undefined)[];
  documentos?: (string | null | undefined)[];
};

export const MARCADORES = ["[NOME]", "[EMAIL]", "[TELEFONE]", "[LINK]", "[DOCUMENTO]", "[ENDERECO]", "[EMPRESA]"] as const;

const MARCA_DE: Record<string, string> = { "[CPF]": "[DOCUMENTO]", "[CEP]": "[ENDERECO]", "[PERFIL]": "[LINK]" };

// ── padrões ──
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
/** "maria [at] gmail [dot] com", "maria (arroba) gmail ponto com". */
const EMAIL_DISFARCADO =
  /[A-Za-z0-9._%+-]+\s*(?:\[\s*(?:at|arroba)\s*\]|\(\s*(?:at|arroba)\s*\)|\{\s*at\s*\}|\s+arroba\s+)\s*[A-Za-z0-9-]+(?:\s*(?:\[\s*(?:dot|ponto|punto)\s*\]|\(\s*(?:dot|ponto|punto)\s*\)|\s+(?:dot|ponto|punto)\s+|\.)\s*[A-Za-z0-9-]+)+/gi;
const URL_COMPLETA = /\b(?:https?:\/\/|www\.)[^\s<>"'()\]]+/gi;
const PERFIL = /\b(?:linkedin\.com\/in|github\.com|gitlab\.com|bitbucket\.org|twitter\.com|x\.com|instagram\.com|facebook\.com|behance\.net|dribbble\.com|medium\.com)\/[^\s<>"'()\]]+/gi;
const TLDS = "com|org|net|io|dev|me|co|app|info|tech|br|pt|es|mx|ar|cl|uk|us|de|fr";
const DOMINIO = new RegExp(`\\b[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\\.[a-z0-9-]+)*\\.(?:${TLDS})(?:\\.[a-z]{2})?\\b(?:\\/[^\\s<>"'()\\]]*)?`, "gi");
/** Nomes de tecnologia com cara de domínio: não são links. */
const TECNOLOGIAS = new Set(["asp.net", "vb.net", "ado.net", "socket.io", "read.me", "dot.net"]);

const CPF = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g;
const CNPJ = /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g;
const RG = /\b\d{1,2}\.\d{3}\.\d{3}-[\dXx]\b/g;
const SSN = /\b\d{3}-\d{2}-\d{4}\b/g;
const DNI = /\b[XYZ]?\d{7,8}-?[A-Z]\b/g;
const CURP = /\b[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d\b/g;
const DOC_ROTULO =
  /\b(?:CPF|CNPJ|RG|CNH|PIS|PASEP|CTPS|NIS|DNI|NIE|NIF|CURP|RFC|RUT|SSN|passaporte|pasaporte|passport)\b\s*(?:n[º°o]\.?|number|n[uú]mero)?\s*[:#-]?\s*([A-Za-z0-9./-]{5,24})/gi;
const DIGITOS_14 = /\b\d{14}\b/g;
const DIGITOS_11 = /\b\d{11}\b/g;

const TEL_INTL = /\+\d{1,3}[\s.-]?(?:\(?\d{1,4}\)?[\s.-]?){2,5}\d{2,4}\b/g;
const TEL_ES = /\b\d{3}[ -]\d{3}[ -]\d{3}\b/g;
/** "98765-4321", "3456-7890" (sem DDD); "2019-2023" é período, não telefone. */
const TEL_LOCAL = /\b(?!(?:19|20)\d{2}-(?:19|20)\d{2}\b)9?\d{4}-\d{4}\b/g;

const END_ES = /\b(?:Calle|C\/|Avenida|Avda\.?|Carrera|Cra\.?|Paseo|Plaza|Camino|Carretera)\s+[^\n,;]{2,60}?,?\s*(?:n[º°o]\.?\s*|#\s*)?\d{1,6}\b/gi;
/** Sem diferença de maiúsculas: "123 main street" e "CALLE MAYOR 15" também são endereços. */
const END_EN = /\b\d{1,6}\s+(?:[A-Za-z][A-Za-z'-]+\s){1,4}(?:Street|St\.|Avenue|Ave\.?|Road|Rd\.|Boulevard|Blvd\.?|Lane|Ln\.|Drive|Dr\.|Way|Court|Ct\.)/gi;
const CEP_ROTULO = /\b(?:CEP|C\.P\.|ZIP)\s*:?\s*\d{5}-?\d{3}\b/gi;

/** Sufixo de razão social em qualquer caixa ("Ltda", "LTDA", "ltda"). */
const SUFIXOS_EMPRESA = ["Ltda.", "Ltda", "S.A.", "S/A", "Inc.", "Inc", "LLC", "Ltd.", "Ltd", "GmbH", "S.L.", "EIRELI", "Corp.", "Corp", "Corporation"];
const qualquerCaixa = (t: string) =>
  t.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&").replace(/\p{L}/gu, (ch) => (ch.toLowerCase() === ch.toUpperCase() ? ch : `[${ch.toLowerCase()}${ch.toUpperCase()}]`));
const SUFIXO_EMPRESA = `(?:${SUFIXOS_EMPRESA.map(qualquerCaixa).join("|")})(?![\\p{L}])`;
/** "Acme Tecnologia Ltda", "ACME TECNOLOGIA LTDA": até 5 palavras que começam com maiúscula ou número. */
const RAZAO_SOCIAL = new RegExp(`(?:[A-ZÀ-Þ0-9][\\p{L}\\p{N}&'-]*\\s+){0,4}[A-ZÀ-Þ0-9][\\p{L}\\p{N}&'-]*\\s+${SUFIXO_EMPRESA}`, "gu");
/** Tudo minúsculo ("acme tecnologia ltda"): só as 2 palavras antes, para não engolir a frase. */
const RAZAO_MINUSCULA = new RegExp(`(?<![\\p{L}\\p{N}])(?:\\p{L}[\\p{L}\\p{N}&'-]*\\s+){1,2}${SUFIXO_EMPRESA}`, "gu");

// ── ajuda ──

/** Uma letra sem acento e minúscula por letra (mantém as posições do texto original). */
function dobrar(s: string): string {
  let out = "";
  for (const ch of s) {
    const d = ch.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
    out += d.length === ch.length ? d : ch.toLowerCase().length === ch.length ? ch.toLowerCase() : ch;
  }
  return out;
}

function escapar(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}

const SEM_LETRA_ANTES = "(?<![\\p{L}\\p{N}])";
const SEM_LETRA_DEPOIS = "(?![\\p{L}\\p{N}])";

/** Troca cada ocorrência (sem maiúsculas e acentos, palavra inteira) de `valor` por `marca`. */
function trocarConhecido(texto: string, valor: string, marca: string): string {
  const v = dobrar(valor.trim()).replace(/\s+/g, " ");
  if (!v) return texto;
  const re = new RegExp(SEM_LETRA_ANTES + escapar(v).replace(/ /g, "\\s+") + SEM_LETRA_DEPOIS, "gu");
  const base = dobrar(texto);
  let out = "";
  let ultimo = 0;
  for (const m of base.matchAll(re)) {
    out += texto.slice(ultimo, m.index) + marca;
    ultimo = (m.index ?? 0) + m[0].length;
  }
  return ultimo ? out + texto.slice(ultimo) : texto;
}

/** Regex de um número conhecido (telefone, documento): os dígitos com qualquer separador entre eles. */
function regexDigitos(digitos: string): RegExp {
  return new RegExp(`(?<!\\d)\\+?${digitos.split("").map(escapar).join("[\\s().\\/-]*")}(?!\\d)`, "g");
}

const PARTICULAS = new Set(["da", "de", "do", "das", "dos", "del", "la", "las", "los", "le", "y", "e", "van", "von", "di", "du", "der"]);

/** Nome inteiro e cada parte com 3+ letras (sem "da", "de"...). */
export function partesDoNome(nome: string): string[] {
  const limpo = nome.replace(/\s+/g, " ").trim();
  if (!limpo) return [];
  const partes = limpo.split(" ").filter((p) => p.replace(/[^\p{L}]/gu, "").length >= 3 && !PARTICULAS.has(dobrar(p)));
  return [...new Set([limpo, ...partes])];
}

function valores(lista: (string | null | undefined)[] | undefined, min = 3): string[] {
  return [...new Set((lista ?? []).map((x) => (typeof x === "string" ? x.trim() : "")).filter((x) => x.length >= min))];
}

function digitosConhecidos(lista: (string | null | undefined)[] | undefined): string[] {
  const out = new Set<string>();
  for (const x of lista ?? []) {
    const d = (x ?? "").replace(/\D/g, "");
    if (d.length < 8) continue;
    out.add(d);
    // Sem o código do país e sem o DDD: o texto pode trazer só o número local.
    if (d.length > 11) out.add(d.slice(-11));
    if (d.length > 10) out.add(d.slice(-10));
    if (d.length > 9) out.add(d.slice(-9));
    out.add(d.slice(-8));
  }
  return [...out].sort((a, b) => b.length - a.length);
}

/** CPF com os dígitos verificadores certos. */
export function cpfValido(d: string): boolean {
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

function contarDigitos(s: string): number {
  return (s.match(/\d/g) ?? []).length;
}

// ── troca ──

/** Texto → texto anonimizado. Nunca lança. */
export function anonimizar(texto: string, c: Conhecidos = {}): string {
  let out = texto ?? "";
  if (!out) return out;

  // 1. valores conhecidos (mais longos primeiro, para "Maria Silva" virar um [NOME] só)
  for (const e of valores(c.emails)) out = trocarConhecido(out, e, "[EMAIL]");
  for (const l of valores(c.links).sort((a, b) => b.length - a.length)) out = trocarConhecido(out, l.replace(/^https?:\/\//i, ""), "[LINK]");
  for (const d of digitosConhecidos(c.documentos)) out = out.replace(regexDigitos(d), "[DOCUMENTO]");
  for (const d of digitosConhecidos(c.telefones)) out = out.replace(regexDigitos(d), "[TELEFONE]");

  // 2. padrões de contato e documento
  out = out.replace(EMAIL_DISFARCADO, "[EMAIL]").replace(EMAIL, "[EMAIL]");
  out = out.replace(URL_COMPLETA, "[LINK]").replace(PERFIL, "[LINK]");
  out = out.replace(DOMINIO, (m) => (TECNOLOGIAS.has(m.toLowerCase()) ? m : "[LINK]"));
  out = out.replace(DOC_ROTULO, (m, valor: string) => (contarDigitos(valor) >= 5 ? m.slice(0, m.length - valor.length).replace(/\s*[:#-]?\s*$/, ": ") + "[DOCUMENTO]" : m));
  out = out.replace(CNPJ, "[DOCUMENTO]").replace(CPF, "[DOCUMENTO]").replace(RG, "[DOCUMENTO]").replace(SSN, "[DOCUMENTO]");
  out = out.replace(CURP, "[DOCUMENTO]").replace(DNI, "[DOCUMENTO]").replace(DIGITOS_14, "[DOCUMENTO]");
  out = out.replace(DIGITOS_11, (m) => (cpfValido(m) ? "[DOCUMENTO]" : m));
  out = out.replace(CEP_ROTULO, "[ENDERECO]");
  out = out.replace(TEL_INTL, (m) => (contarDigitos(m) >= 8 && contarDigitos(m) <= 15 ? "[TELEFONE]" : m));
  for (const [re, marca] of REDACT_RULES) out = out.replace(re, MARCA_DE[marca] ?? marca);
  out = out.replace(TEL_ES, "[TELEFONE]").replace(TEL_LOCAL, "[TELEFONE]");
  out = out.replace(END_ES, "[ENDERECO]").replace(END_EN, "[ENDERECO]");

  // 3. empresas e nomes (depois dos links, que podem levar o nome dentro)
  // Empresas de 2 letras (HP, EY, GE) também contam; a troca é por palavra inteira.
  for (const e of valores(c.empresas, 2).sort((a, b) => b.length - a.length)) out = trocarConhecido(out, e, "[EMPRESA]");
  out = out.replace(RAZAO_SOCIAL, "[EMPRESA]");
  out = out.replace(RAZAO_MINUSCULA, "[EMPRESA]");
  const nomes = valores(c.nomes, 2).flatMap(partesDoNome);
  for (const n of [...new Set(nomes)].sort((a, b) => b.length - a.length)) out = trocarConhecido(out, n, "[NOME]");
  // "[NOME] [NOME]" de nome e sobrenome trocados separadamente vira um só.
  return out.replace(/\[NOME\](?:\s+\[NOME\])+/g, "[NOME]");
}

/** Anonimiza cada texto de um valor JSON (objeto, lista ou texto). As chaves ficam. */
export function anonimizarValor<T>(v: T, c: Conhecidos = {}): T {
  if (typeof v === "string") return anonimizar(v, c) as unknown as T;
  if (Array.isArray(v)) return v.map((x) => anonimizarValor(x, c)) as unknown as T;
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = anonimizarValor(x, c);
    return out as T;
  }
  return v;
}

// ── rede de segurança ──

const SOBRA_EMAIL = /[^\s@[\]]+\s?@+\s?[^\s@[\]]+\.[A-Za-z]{2,}/;
const SOBRA_LINK = /https?:\/\/|\bwww\./i;
const SOBRA_DIGITOS = /(?:\d[\s().\/-]?){10,}/;

/**
 * O que ainda parece dado pessoal depois da troca. Códigos: email, link, telefone, documento, conhecido.
 * Lista vazia = pode guardar.
 */
export function sobras(texto: string, c: Conhecidos = {}): string[] {
  const t = texto ?? "";
  const out = new Set<string>();
  if (SOBRA_EMAIL.test(t) || new RegExp(EMAIL_DISFARCADO.source, "i").test(t)) out.add("email");
  if (SOBRA_LINK.test(t) || new RegExp(PERFIL.source, "i").test(t)) out.add("link");
  if ([...t.matchAll(new RegExp(DOMINIO.source, "gi"))].some((m) => !TECNOLOGIAS.has(m[0].toLowerCase()))) out.add("link");
  if (new RegExp(CPF.source).test(t) || new RegExp(CNPJ.source).test(t) || [...t.matchAll(/\b\d{11}\b/g)].some((m) => cpfValido(m[0]))) out.add("documento");
  if (SOBRA_DIGITOS.test(t)) out.add("telefone");
  const base = dobrar(t);
  const presente = (v: string) => {
    const d = dobrar(v.trim()).replace(/\s+/g, " ");
    return !!d && new RegExp(SEM_LETRA_ANTES + escapar(d).replace(/ /g, "\\s+") + SEM_LETRA_DEPOIS, "u").test(base);
  };
  const textos = [...valores(c.emails), ...valores(c.links).map((l) => l.replace(/^https?:\/\//i, "")), ...valores(c.empresas, 2), ...valores(c.nomes, 2).flatMap(partesDoNome)];
  if (textos.some(presente)) out.add("conhecido");
  if ([...digitosConhecidos(c.telefones), ...digitosConhecidos(c.documentos)].some((d) => regexDigitos(d).test(t))) out.add("conhecido");
  return [...out];
}

/** `sobras` em cada texto de um valor JSON (cada campo por si: números de campos vizinhos não se juntam). */
export function sobrasValor(v: unknown, c: Conhecidos = {}): string[] {
  const out = new Set<string>();
  const andar = (x: unknown) => {
    if (typeof x === "string") for (const s of sobras(x, c)) out.add(s);
    else if (Array.isArray(x)) x.forEach(andar);
    else if (x && typeof x === "object") Object.values(x as Record<string, unknown>).forEach(andar);
  };
  andar(v);
  return [...out];
}
