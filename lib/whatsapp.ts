/**
 * 3.5 Canal WhatsApp (plano https://claude.ai/artifact/B1kcRjUJ5emNK2W4Xu9WSW).
 * - D1: API oficial da Meta (WhatsApp Cloud API, Graph API) com `fetch`, sem SDK. Para fora, só modelos
 *   de mensagem aprovados (docs/whatsapp-modelos.md); a resposta automática do 3.5b é texto livre,
 *   permitido dentro das 24 horas depois de a pessoa escrever.
 * - D2: só avisos ao candidato, com o nome da vaga e da empresa e um link para o site.
 * - D5: até 3 por dia, só das 8h às 20h de Brasília; fora disso espera até as 8h.
 * - D7: sem WHATSAPP_TOKEN / WHATSAPP_PHONE_ID, nada sai ("modo teste"). WHATSAPP_TEST_TO limita os destinos.
 *   Número nunca vai inteiro para o log (mascararNumero), nem o token.
 *
 * Este arquivo não importa o Prisma (é usado pelo consumidor da fila e pela rota do webhook da Meta).
 * O que usa o banco fica em lib/whatsapp-db.ts.
 */
export type TipoAviso = "vista" | "etapa" | "entrevista" | "aprovadas" | "atendimento";
export const TIPOS_AVISO: readonly TipoAviso[] = ["vista", "etapa", "entrevista", "aprovadas", "atendimento"];

/** Nomes dos modelos na Meta (docs/whatsapp-modelos.md). */
export const MODELOS: Record<TipoAviso | "codigo", string> = {
  codigo: "w2_codigo",
  vista: "w2_candidatura_vista",
  etapa: "w2_candidatura_etapa",
  entrevista: "w2_entrevista",
  aprovadas: "w2_aprovadas_vencer",
  atendimento: "w2_atendimento",
};

/** Final do link do botão de cada aviso (o modelo tem "https://w2talent.com/{{1}}"). */
export const CAMINHO_AVISO: Record<TipoAviso, string> = {
  vista: "minhas-candidaturas",
  etapa: "minhas-candidaturas",
  entrevista: "minhas-candidaturas",
  aprovadas: "vagas/aprovar",
  atendimento: "ajuda/minhas-conversas",
};

export const AVISOS_POR_DIA = 3;
export const HORA_INICIO = 8;
export const HORA_FIM = 20;
export const FUSO = "America/Sao_Paulo";
export const CODIGO_VALIDADE_MS = 10 * 60_000;
export const CODIGO_MAX_TENTATIVAS = 5;
/** Códigos pedidos por conta e por dia (UsoDiario). */
export const CODIGOS_POR_DIA = 3;
/** Até 10 tentativas na fila, como o webhook (3.4a). */
export const WHATSAPP_MAX_TENTATIVAS = 10;
export const GRAPH_URL = "https://graph.facebook.com/v21.0";
export const WHATSAPP_TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------------------------
// Número (E.164)
// ---------------------------------------------------------------------------------------------

export type MotivoNumero = "vazio" | "invalido" | "fixo";

/**
 * Normaliza para E.164. Sem "+" (nem "00"), vale como número do Brasil: DDD + número, com ou sem 55.
 * Do Brasil, só celular (DDD válido + 9 + 8 dígitos). De fora, "+" e de 8 a 15 dígitos.
 */
export function normalizarNumero(raw: unknown): { ok: true; numero: string } | { ok: false; motivo: MotivoNumero } {
  if (typeof raw !== "string" || !raw.trim()) return { ok: false, motivo: "vazio" };
  const s = raw.trim();
  if (s.length > 40 || /[^\d\s()+.\-/]/.test(s)) return { ok: false, motivo: "invalido" };
  let d = s.replace(/\D/g, "");
  let internacional = s.startsWith("+");
  if (!internacional && d.startsWith("00")) {
    d = d.slice(2);
    internacional = true;
  }
  if (!internacional) {
    // Brasil: tira o 0 do DDD (0 11 9...) e põe o 55 quando falta.
    if (d.startsWith("0") && (d.length === 11 || d.length === 12)) d = d.slice(1);
    if (d.length === 10 || d.length === 11) d = `55${d}`;
  }
  if (!/^[1-9]\d{7,14}$/.test(d)) return { ok: false, motivo: "invalido" };
  if (d.startsWith("55")) {
    const resto = d.slice(2);
    if (!/^[1-9][1-9]\d{8,9}$/.test(resto)) return { ok: false, motivo: "invalido" };
    if (resto.length === 10) return { ok: false, motivo: "fixo" };
    if (resto[2] !== "9") return { ok: false, motivo: "fixo" };
  }
  return { ok: true, numero: `+${d}` };
}

/** "+5511987654321" → "+55•••••••4321". Para logs e para a tela. */
export function mascararNumero(n: string | null | undefined): string {
  const d = (n ?? "").replace(/\D/g, "");
  if (d.length < 6) return "•••";
  return `+${d.slice(0, 2)}${"•".repeat(Math.max(3, d.length - 6))}${d.slice(-4)}`;
}

/**
 * Formas do mesmo número que a Meta pode mandar no `from` (só dígitos): no Brasil, contas antigas
 * aparecem sem o 9 da frente. Devolve E.164 com e sem o 9.
 */
export function variantesDoNumero(fromDigitos: string): string[] {
  const d = fromDigitos.replace(/\D/g, "");
  if (!d) return [];
  const out = new Set([`+${d}`]);
  if (d.startsWith("55") && d.length === 12) out.add(`+55${d.slice(2, 4)}9${d.slice(4)}`);
  if (d.startsWith("55") && d.length === 13 && d[4] === "9") out.add(`+55${d.slice(2, 4)}${d.slice(5)}`);
  return [...out];
}

// ---------------------------------------------------------------------------------------------
// Código de 6 dígitos
// ---------------------------------------------------------------------------------------------

/** 6 dígitos sem viés (rejeita o resto da divisão). */
export function gerarCodigo6(): string {
  const limite = Math.floor(0x1_0000_0000 / 1_000_000) * 1_000_000;
  const b = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(b);
    if (b[0] < limite) return String(b[0] % 1_000_000).padStart(6, "0");
  }
}

/** SHA-256 em hex do código, ligado ao perfil e ao número (o mesmo código não vale para outro). */
export async function hashCodigoWhatsapp(candidateId: string, numero: string, codigo: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`w2-wa:${candidateId}:${numero}:${codigo}`)));
  return Array.from(d, (x) => x.toString(16).padStart(2, "0")).join("");
}

export function codigoExpirado(expira: Date | null | undefined, now: Date): boolean {
  return !expira || expira.getTime() <= now.getTime();
}

export function formatoCodigo(c: unknown): c is string {
  return typeof c === "string" && /^\d{6}$/.test(c);
}

// ---------------------------------------------------------------------------------------------
// Horário (D5)
// ---------------------------------------------------------------------------------------------

const fmtSP = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export function partesSP(now: Date): { dia: string; hora: number; minuto: number; segundo: number } {
  const p = Object.fromEntries(fmtSP.formatToParts(now).map((x) => [x.type, x.value]));
  return { dia: `${p.year}-${p.month}-${p.day}`, hora: Number(p.hour) % 24, minuto: Number(p.minute), segundo: Number(p.second) };
}

export function dentroDaJanela(now: Date): boolean {
  const { hora } = partesSP(now);
  return hora >= HORA_INICIO && hora < HORA_FIM;
}

/** Segundos até as 8h de Brasília; 0 dentro da janela. No máximo 12 horas (o limite da fila). */
export function segundosAteJanela(now: Date): number {
  const { hora, minuto, segundo } = partesSP(now);
  if (hora >= HORA_INICIO && hora < HORA_FIM) return 0;
  const horas = hora < HORA_INICIO ? HORA_INICIO - hora : 24 - hora + HORA_INICIO;
  return Math.min(12 * 3600, Math.max(60, horas * 3600 - minuto * 60 - segundo));
}

/** Dia (Brasília) em que o aviso sai: depois das 20h, o dia seguinte. */
export function diaDoAviso(now: Date): string {
  const espera = segundosAteJanela(now);
  return partesSP(espera ? new Date(now.getTime() + espera * 1000) : now).dia;
}

// ---------------------------------------------------------------------------------------------
// Configuração e envio (D1, D7)
// ---------------------------------------------------------------------------------------------

export type ConfigWhatsapp = { token?: string; phoneId?: string; testTo?: string[] };

export function configDoAmbiente(env: Record<string, string | undefined> = process.env): ConfigWhatsapp {
  const testTo = (env.WHATSAPP_TEST_TO ?? "")
    .split(",")
    .map((x) => normalizarNumero(x))
    .filter((x): x is { ok: true; numero: string } => x.ok)
    .map((x) => x.numero);
  return { token: env.WHATSAPP_TOKEN || undefined, phoneId: env.WHATSAPP_PHONE_ID || undefined, testTo: testTo.length ? testTo : undefined };
}

export function modoTeste(c: ConfigWhatsapp): boolean {
  return !c.token || !c.phoneId;
}

/** Com WHATSAPP_TEST_TO, só esses números recebem. */
export function destinoPermitido(c: ConfigWhatsapp, numero: string): boolean {
  return !c.testTo || c.testTo.includes(numero);
}

export type IdiomaWa = "pt_BR" | "en" | "es";
export function idiomaWhatsapp(idioma: string | null | undefined): IdiomaWa {
  const v = (idioma ?? "").toLowerCase();
  if (v.startsWith("en")) return "en";
  if (v.startsWith("es")) return "es";
  return "pt_BR";
}

/** Corpo do pedido de um modelo: textos do corpo e, quando há, o final do link do botão ou o código. */
export function corpoModelo(a: { numero: string; modelo: string; idioma: IdiomaWa; textos?: string[]; botaoUrl?: string; codigo?: string }): Record<string, unknown> {
  const components: Record<string, unknown>[] = [];
  const textos = a.codigo ? [a.codigo] : (a.textos ?? []);
  if (textos.length) components.push({ type: "body", parameters: textos.map((t) => ({ type: "text", text: limparParametro(t) })) });
  const botao = a.codigo ?? a.botaoUrl;
  if (botao) components.push({ type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: botao }] });
  return {
    messaging_product: "whatsapp",
    to: a.numero.replace(/\D/g, ""),
    type: "template",
    template: { name: a.modelo, language: { code: a.idioma }, components },
  };
}

/** A Meta recusa quebra de linha, tab e mais de 4 espaços seguidos nos parâmetros. */
export function limparParametro(t: string): string {
  const s = String(t ?? "").replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ").trim();
  return (s || "-").slice(0, 200);
}

/** Erros da Meta que passam com o tempo (limite de envio), mesmo vindo com 400. */
const CODIGOS_REPETIR = new Set([4, 80007, 130429, 131048, 131056, 133004]);

export type ResultadoEnvioWa = { resultado: "ok" | "repetir" | "desistir"; status: number | null; erro?: string; atrasoSeg?: number };

/**
 * POST /{phoneId}/messages. 2xx: ok; 429, 5xx, rede e limites da Meta: repetir; o resto: desistir.
 * Não lê nem guarda a resposta além do código de erro.
 */
export async function enviarWhatsapp(c: ConfigWhatsapp, corpo: Record<string, unknown>, f: typeof fetch = fetch): Promise<ResultadoEnvioWa> {
  if (modoTeste(c)) return { resultado: "ok", status: null, erro: "modo_teste" };
  let res: Response;
  try {
    res = await f(`${GRAPH_URL}/${encodeURIComponent(c.phoneId!)}/messages`, {
      method: "POST",
      headers: { authorization: `Bearer ${c.token}`, "content-type": "application/json" },
      body: JSON.stringify(corpo),
      redirect: "manual",
      signal: AbortSignal.timeout(WHATSAPP_TIMEOUT_MS),
    });
  } catch (e) {
    const nome = e instanceof Error ? e.name : "";
    return { resultado: "repetir", status: null, erro: nome === "TimeoutError" || nome === "AbortError" ? "tempo" : "rede" };
  }
  const status = res.status;
  if (status >= 200 && status < 300) {
    await res.body?.cancel().catch(() => undefined);
    return { resultado: "ok", status };
  }
  let codigo: number | null = null;
  try {
    const j = (await res.json()) as { error?: { code?: unknown } };
    codigo = typeof j?.error?.code === "number" ? j.error.code : null;
  } catch {
    codigo = null;
  }
  const erro = codigo != null ? `meta_${codigo}` : `http_${status}`;
  if (status === 429 || status >= 500 || (codigo != null && CODIGOS_REPETIR.has(codigo))) return { resultado: "repetir", status, erro };
  return { resultado: "desistir", status, erro };
}
