/**
 * Importar CV no estilo JobLeads (plano 2026-11-20, D1–D7). Funções puras: rodam no navegador e nos testes.
 *
 * - D2: as etapas da leitura chegam do servidor uma linha por vez (NDJSON); a tela só marca o que terminou.
 * - D3: a conferência é feita em 4 passos curtos antes da Ficha W2; cada campo mínimo mora num passo.
 * - D4: dicas de hunter por regra fixa, sem IA. Só avisam, nunca bloqueiam.
 */
import { mesAtual, mesDe } from "./linha-do-tempo";
import type { CampoMinimo, Ficha } from "./ficha";

export const ETAPAS_LEITURA = ["arquivo", "contatos", "ia", "organizar"] as const;
export type EtapaLeitura = (typeof ETAPAS_LEITURA)[number];

export const PASSOS_CONFERIR = ["pessoais", "experiencia", "formacao", "competencias"] as const;
export type PassoConferir = (typeof PASSOS_CONFERIR)[number];

/** Em que passo da conferência cada campo mínimo é preenchido. */
export function passoDoCampo(c: CampoMinimo): PassoConferir {
  if (c === "experiencia") return "experiencia";
  if (c === "idiomas") return "formacao";
  if (c === "stack") return "competencias";
  return "pessoais";
}

/**
 * Lê a resposta de /api/ficha/ler. Com etapas (NDJSON), chama `onEtapa` a cada linha de etapa e devolve a
 * última linha (o resultado ou o erro). Sem etapas (JSON comum, ou um proxy que juntou tudo), devolve o JSON.
 */
export async function lerRespostaEmEtapas(res: Response, onEtapa: (e: EtapaLeitura) => void): Promise<Record<string, unknown>> {
  const tipo = res.headers.get("content-type") ?? "";
  if (!tipo.includes("ndjson") || !res.body) return ((await res.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  const leitor = res.body.getReader();
  const dec = new TextDecoder();
  let resto = "";
  let ultimo: Record<string, unknown> = {};
  const linha = (l: string) => {
    if (!l.trim()) return;
    let o: unknown;
    try {
      o = JSON.parse(l);
    } catch {
      return;
    }
    if (!o || typeof o !== "object") return;
    const etapa = (o as { etapa?: unknown }).etapa;
    if (typeof etapa === "string" && (ETAPAS_LEITURA as readonly string[]).includes(etapa)) onEtapa(etapa as EtapaLeitura);
    else ultimo = o as Record<string, unknown>;
  };
  for (;;) {
    const { value, done } = await leitor.read();
    if (done) break;
    resto += dec.decode(value, { stream: true });
    const partes = resto.split("\n");
    resto = partes.pop() ?? "";
    partes.forEach(linha);
  }
  linha(resto + dec.decode());
  return ultimo;
}

export type Dica =
  | { codigo: "simultaneos"; passo: "experiencia"; a: string; b: string }
  | { codigo: "titulo_ruidoso"; passo: "pessoais" | "experiencia"; n: number }
  | { codigo: "sem_data" | "funcoes_vazias" | "cv_longo"; passo: "experiencia"; n: number }
  | { codigo: "formacao_vazia"; passo: "formacao" }
  | { codigo: "sem_anos"; passo: "competencias"; n: number };

/** Título em maiúsculas ("ARQUITETO CLOUD") ou com várias barras ("A | B | C"). */
export function tituloRuidoso(t: string): boolean {
  const letras = (t ?? "").replace(/[^\p{L}]/gu, "");
  if (letras.length >= 8 && letras.replace(/[^\p{Lu}]/gu, "").length / letras.length >= 0.8) return true;
  return ((t ?? "").match(/\s[|/]\s|\|/g) ?? []).length >= 2;
}

const PALAVRAS_POR_PAGINA = 500;

/** Dicas de hunter para a ficha conferida (D4). Regras fixas, na ordem dos passos. */
export function dicasFicha(f: Ficha, cvTexto?: string | null, now: Date = new Date()): Dica[] {
  const out: Dica[] = [];
  if (f.titulo && tituloRuidoso(f.titulo)) out.push({ codigo: "titulo_ruidoso", passo: "pessoais", n: 1 });

  const hoje = mesAtual(now);
  const exps = f.experiencias.filter((e) => e.cargo || e.empresa);
  // Dois empregos integrais (ou sem tipo) ao mesmo tempo por 3 meses ou mais: a primeira pergunta de um hunter.
  const integrais = exps
    .filter((e) => !e.tipo || e.tipo === "integral")
    .map((e) => {
      const ini = mesDe(e.inicio);
      return ini == null ? null : { e, ini, fim: Math.min(hoje, e.atual ? hoje : mesDe(e.fim) ?? ini) };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
  let pares = 0;
  for (let i = 0; i < integrais.length && pares < 2; i++) {
    for (let j = i + 1; j < integrais.length && pares < 2; j++) {
      const a = integrais[i];
      const b = integrais[j];
      if (a.e.empresa.trim().toLowerCase() === b.e.empresa.trim().toLowerCase()) continue;
      if (Math.min(a.fim, b.fim) - Math.max(a.ini, b.ini) + 1 >= 3) {
        out.push({ codigo: "simultaneos", passo: "experiencia", a: a.e.empresa || a.e.cargo, b: b.e.empresa || b.e.cargo });
        pares++;
      }
    }
  }
  const ruidosos = exps.filter((e) => tituloRuidoso(e.cargo)).length;
  if (ruidosos) out.push({ codigo: "titulo_ruidoso", passo: "experiencia", n: ruidosos });
  const semData = exps.filter((e) => e.cargo && mesDe(e.inicio) == null).length;
  if (semData) out.push({ codigo: "sem_data", passo: "experiencia", n: semData });
  const semFuncoes = exps.slice(0, 3).filter((e) => !e.funcoes.some((x) => x.trim())).length;
  if (semFuncoes) out.push({ codigo: "funcoes_vazias", passo: "experiencia", n: semFuncoes });
  const palavras = (cvTexto ?? "").split(/\s+/).filter(Boolean).length;
  if (palavras > PALAVRAS_POR_PAGINA * 3) out.push({ codigo: "cv_longo", passo: "experiencia", n: Math.round(palavras / PALAVRAS_POR_PAGINA) });

  if (!f.formacao.length) out.push({ codigo: "formacao_vazia", passo: "formacao" });

  const semAnos = f.stack.filter((s) => !s.anos).length;
  if (semAnos) out.push({ codigo: "sem_anos", passo: "competencias", n: semAnos });
  return out;
}
