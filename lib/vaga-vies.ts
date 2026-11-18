/**
 * Revisor de viés no texto da vaga (2.1c, plano 2.1, D5, aprovado em 2026-11-18).
 * Regras fixas em PT, EN e ES apontam termos que excluem gente por idade, gênero, aparência,
 * origem, família, saúde ou religião, e sugerem uma troca quando existe uma boa. Só avisa:
 * quem decide é o recrutador. Roda no navegador e no servidor (sem dependências).
 */

export type CategoriaVies = "idade" | "genero" | "aparencia" | "origem" | "familia" | "saude" | "religiao";
export const CATEGORIAS_VIES: CategoriaVies[] = ["idade", "genero", "aparencia", "origem", "familia", "saude", "religiao"];

export type CampoVies = "titulo" | "descricao" | "beneficios";
export const CAMPOS_VIES: CampoVies[] = ["titulo", "descricao", "beneficios"];

/** `troca`: texto sugerido no lugar do trecho; "" = tirar o trecho; null = reescrever à mão. */
type Regra = { id: string; categoria: CategoriaVies; padrao: string; troca: string | null };

export type AvisoVies = {
  regra: string;
  categoria: CategoriaVies;
  campo: CampoVies;
  trecho: string;
  /** Posição do trecho no campo (para trocar exatamente esse). */
  inicio: number;
  troca: string | null;
};

// Letras acentuadas que o recrutador às vezes digita sem acento.
const A = "[aáàâã]";
const E = "[eéê]";
const I = "[ií]";
const O = "[oóôõ]";
const U = "[uú]";
const C = "[cç]";

/**
 * A ordem importa: quando dois padrões pegam o mesmo trecho, vale o primeiro
 * ("nativo digital" é idade, não origem).
 */
const REGRAS: Regra[] = [
  // ── Idade ──
  { id: "nativo-digital", categoria: "idade", padrao: `nativ[oa]s? digita(?:l|is|les)|digital natives?`, troca: null },
  { id: "jovem", categoria: "idade", padrao: `jove(?:m|ns)(?!\\s+aprendiz)|j${O}venes|joven(?!\\s+aprendiz)|young(?:er)?`, troca: "" },
  { id: "idade-limite", categoria: "idade", padrao: `(?:idade|edad|age)\\s*(?:m${A}xima|m${I}nima|limite|l${I}mite|entre|at${E}|hasta|de|up to|between|under|below|max(?:imum)?|min(?:imum)?)?\\s*:?\\s*(?:de\\s*)?\\d{2}(?:\\s*(?:a|e|y|-|–|to|and)\\s*\\d{2})?(?:\\s*(?:anos|a${N()}os|years(?:\\s*old)?))?`, troca: null },
  { id: "faixa-idade", categoria: "idade", padrao: `(?:entre|de|between)\\s+(?:1[6-9]|[2-6]\\d)\\s*(?:a|e|y|-|–|to|and)\\s*(?:[2-7]\\d)\\s*(?:anos|a${N()}os|years)(?!\\s*(?:de|of)\\s*(?:experi|exp))`, troca: null },
  { id: "menos-de-idade", categoria: "idade", padrao: `(?:at${E}|menos de|hasta|menores? de|under|younger than)\\s+(?:[2-6]\\d)\\s*(?:anos|a${N()}os|years)\\s*(?:de idade|de edad|old|of age)`, troca: null },
  // ── Gênero ──
  { id: "sexo", categoria: "genero", padrao: `(?:do |de )?sexo\\s+(?:masculino|feminino|femenino)`, troca: "" },
  { id: "so-homens", categoria: "genero", padrao: `(?:apenas|somente|s${O}|solo|s${O}lo|only)\\s+(?:homens|mulheres|hombres|mujeres|men|women|males?|females?)|(?:men|women|males?|females?)\\s+only`, troca: "" },
  { id: "salesman", categoria: "genero", padrao: `salesman|salesmen`, troca: "salesperson" },
  { id: "chairman", categoria: "genero", padrao: `chairman`, troca: "chair" },
  { id: "manpower", categoria: "genero", padrao: `manpower`, troca: "workforce" },
  // ── Aparência ──
  { id: "boa-aparencia", categoria: "aparencia", padrao: `boa apar${E}ncia|boa apresenta${C}${A}o`, troca: "postura profissional" },
  { id: "buena-presencia", categoria: "aparencia", padrao: `buena presencia|buena apariencia`, troca: "trato profesional" },
  { id: "good-appearance", categoria: "aparencia", padrao: `good appearance|good[- ]looking|well[- ]groomed`, troca: "professional manner" },
  { id: "foto", categoria: "aparencia", padrao: `(?:foto|photo|picture)\\s+(?:no|en el|in your|on your|with your)\\s+(?:curr${I}culo|cv|resume)|(?:curr${I}culo|cv|resume)\\s+(?:com|con|with)\\s+(?:foto|photo|picture)|(?:enviar|envie|anexar|anexe|adjuntar|adjunte|send|attach)\\s+(?:uma\\s+|una\\s+|a\\s+)?(?:foto|photo|picture)|(?:foto|photo)\\s+(?:obrigat${O}ria|obligatoria|required)`, troca: "" },
  { id: "altura-peso", categoria: "aparencia", padrao: `(?:altura|estatura|height|peso|weight)\\s+(?:m${I}nima|m${A}xima|minimum|maximum|ideal)`, troca: null },
  // ── Origem ──
  { id: "nativo", categoria: "origem", padrao: `(?:falante|hablante)\\s+nativ[oa]|native(?:\\s+(?:english|spanish|portuguese))?\\s+speaker|(?:ingl${E}s|espanhol|portugu${E}s|ingl${E}s|espa${N()}ol|english|spanish|portuguese)\\s+nativ[oa]|nativ[oa]\\s+(?:em|en)\\s+(?:ingl${E}s|espanhol|espa${N()}ol|portugu${E}s|franc${E}s|alem${A}o|alem${A}n|italiano|english|spanish|portuguese)|native\\s+(?:level\\s+)?(?:english|spanish|portuguese)`, troca: null },
  { id: "nacionalidade", categoria: "origem", padrao: `brasileir[oa]s?\\s+nat[oa]s?|nacionalidade\\s+brasileira\\s+obrigat${O}ria`, troca: "" },
  // ── Família ──
  { id: "estado-civil", categoria: "familia", padrao: `estado civil|marital status`, troca: null },
  { id: "solteiro", categoria: "familia", padrao: `solteir[oa]s?|casad[oa]s?(?=\\s*(?:ou|o|,|\\.|$))|solter[oa]s?`, troca: "" },
  { id: "sem-filhos", categoria: "familia", padrao: `sem filhos|sin hijos|no children|without children`, troca: "" },
  // ── Saúde ──
  { id: "boa-saude", categoria: "saude", padrao: `(?:boa|${O}tima|excelente|buena|good|excellent)\\s+(?:sa${U}de|salud|health)(?!\\s+(?:insurance|plan|care|coverage|benefits?))|sem defici${E}ncia|sin discapacidad|able[- ]bodied`, troca: "" },
  // ── Religião ──
  { id: "religiao", categoria: "religiao", padrao: `religi${A}o|religi${O}n|religion|evang${E}lic[oa]s?|cat${O}lic[oa]s?`, troca: "" },
];

function N(): string {
  return "[nñ]";
}

const BORDA_ANTES = "(?<![\\p{L}\\p{N}])";
const BORDA_DEPOIS = "(?![\\p{L}\\p{N}])";

/** Frase de inclusão ("sem distinção de idade, gênero, religião"): a linha não gera aviso. */
const INCLUSAO = /independente(?:mente)? d|sem distin[cç][aã]o|n[aã]o discrimin|no discrimin|sin distinci[oó]n|independientemente|regardless of|without regard|equal opportunit|igualdade de oportunidade|igualdad de oportunidad|diversidade|diversidad|diversity/i;

const COMPILADAS = REGRAS.map((r) => ({ ...r, re: new RegExp(`${BORDA_ANTES}(?:${r.padrao})${BORDA_DEPOIS}`, "giu") }));

export type CamposVies = Partial<Record<CampoVies, string>>;

/** Avisos de viés por campo, na ordem do texto. No máximo `max` (padrão 20). */
export function revisarVies(campos: CamposVies, max = 20): AvisoVies[] {
  const out: AvisoVies[] = [];
  for (const campo of CAMPOS_VIES) {
    const texto = campos[campo] ?? "";
    if (!texto.trim()) continue;
    const pegos: AvisoVies[] = [];
    for (const r of COMPILADAS) {
      r.re.lastIndex = 0;
      for (let m = r.re.exec(texto); m; m = r.re.exec(texto)) {
        if (!m[0]) {
          r.re.lastIndex++;
          continue;
        }
        const inicio = m.index;
        const ini = texto.lastIndexOf("\n", inicio) + 1;
        const fimLinha = texto.indexOf("\n", inicio);
        if (INCLUSAO.test(texto.slice(ini, fimLinha < 0 ? undefined : fimLinha))) continue;
        const fim = inicio + m[0].length;
        if (pegos.some((p) => inicio < p.inicio + p.trecho.length && p.inicio < fim)) continue;
        pegos.push({ regra: r.id, categoria: r.categoria, campo, trecho: m[0], inicio, troca: r.troca });
      }
    }
    pegos.sort((a, b) => a.inicio - b.inicio);
    out.push(...pegos);
    if (out.length >= max) break;
  }
  return out.slice(0, max);
}

/** Troca o trecho do aviso no texto do campo. Se o texto mudou e o trecho não está mais lá, devolve igual. */
export function aplicarTroca(texto: string, aviso: Pick<AvisoVies, "trecho" | "inicio" | "troca">): string {
  if (aviso.troca === null) return texto;
  const i = texto.slice(aviso.inicio, aviso.inicio + aviso.trecho.length) === aviso.trecho ? aviso.inicio : texto.indexOf(aviso.trecho);
  if (i < 0) return texto;
  const novo = texto.slice(0, i) + aviso.troca + texto.slice(i + aviso.trecho.length);
  // Ao tirar um trecho, não deixa espaço duplo, espaço antes de pontuação nem vírgula sobrando.
  return aviso.troca
    ? novo
    : novo
        .split("\n")
        .map((l) => l.replace(/[ \t]{2,}/g, " ").replace(/\s+([,.;:!?)])/g, "$1").replace(/([,;(])\s*([,.;)])/g, "$2").replace(/^[\s,;]+/, "").trimEnd())
        .join("\n");
}
