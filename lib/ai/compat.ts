/**
 * Testes de compatibilidade dos modelos (1.5.8). Textos fixos, sem dado de ninguém.
 *
 * Decisão do Euclides em 2026-11-09: rodam só quando o admin pede, só nos modelos marcados,
 * com o custo estimado mostrado antes. O teste de texto longo é opcional (custa mais).
 * Visão fica de fora: nenhuma tarefa usa imagem hoje.
 */
import { AiProviderError, type CallContext } from "./types";
import { callChat, callEmbed, supportsEmbeddings } from "./providers";
import { postJson, providerUrl } from "./providers/http";
import { safeErrorText } from "./router";
import { TASKS, type TaskName } from "./tasks";

export const COMPAT_TESTS = ["texto", "json", "ferramentas", "idiomas", "contexto_longo", "embeddings"] as const;
export type CompatTest = (typeof COMPAT_TESTS)[number];

export type TestResult = {
  teste: CompatTest;
  ok: boolean;
  /** Código curto do resultado ("json_invalido", "idioma:es≠pt", "HTTP 401 (invalid_api_key)"…). Nunca a resposta do modelo. */
  detalhe?: string;
  latenciaMs: number;
  tokensIn?: number;
  tokensOut?: number;
};

/** Tokens de cada teste (aproximado), para a estimativa de custo. */
export const TEST_TOKENS = {
  chat: { in: 420, out: 330 },
  contexto_longo: { in: 33_500, out: 10 },
  embed: { in: 20, out: 0 },
} as const;

/** Tamanho do teste de texto longo: acima dos 32 mil tokens que Ficha W2 e leitura de CV pedem. */
export const LONG_CONTEXT_TOKENS = 33_000;

export type Price = { in?: number | null; out?: number | null };

/** Custo estimado (US$) para testar um modelo, ou null se o preço é desconhecido. */
export function estimateTestCost(embedding: boolean, price: Price, long: boolean): number | null {
  if (price.in == null && price.out == null) return null;
  const pin = price.in ?? 0;
  const pout = price.out ?? 0;
  if (embedding) return (TEST_TOKENS.embed.in * pin) / 1e6;
  let tin: number = TEST_TOKENS.chat.in;
  let tout: number = TEST_TOKENS.chat.out;
  if (long) {
    tin += TEST_TOKENS.contexto_longo.in;
    tout += TEST_TOKENS.contexto_longo.out;
  }
  return (tin * pin + tout * pout) / 1e6;
}

// ── idioma da resposta ──
const LANG_MARKERS: Record<"pt" | "en" | "es", RegExp> = {
  pt: /ção|ções|ões|ã|õ|\bnão\b|\bvocê\b|\bé\b|\bdo\b|\bda\b|\bem\b|\bum\b|\buma\b|\bque\b/gi,
  es: /ción|ciones|ñ|¿|¡|\bel\b|\bes\b|\blos\b|\blas\b|\bdel\b|\by\b|\buna\b|\bun\b|\bque\b|\bmuy\b/gi,
  en: /\bthe\b|\bis\b|\band\b|\bof\b|\bbecause\b|\bit\b|\bthat\b|\bwith\b|\bthis\b|\bare\b/gi,
};

export function detectLang(text: string): "pt" | "en" | "es" | null {
  let best: "pt" | "en" | "es" | null = null;
  let bestN = 0;
  for (const lang of ["pt", "es", "en"] as const) {
    const n = (text.match(LANG_MARKERS[lang]) ?? []).length;
    if (n > bestN) {
      best = lang;
      bestN = n;
    }
  }
  return bestN >= 2 ? best : null;
}

const LANG_PROMPTS: Record<"pt" | "en" | "es", string> = {
  pt: "Responda em português, em duas frases: por que o céu é azul?",
  en: "Answer in English, in two sentences: why is the sky blue?",
  es: "Responde en español, en dos frases: ¿por qué el cielo es azul?",
};

// ── ferramentas: cada API tem o seu formato ──
const TOOL = {
  name: "consultar_clima",
  description: "Consulta a temperatura atual de uma cidade.",
  parameters: { type: "object", properties: { cidade: { type: "string" } }, required: ["cidade"] },
};
const TOOL_PROMPT = "Qual é a temperatura agora em São Paulo? Use a ferramenta consultar_clima.";

async function probeTools(ctx: CallContext): Promise<{ ok: boolean; tokensIn?: number; tokensOut?: number }> {
  const messages = [{ role: "user", content: TOOL_PROMPT }];
  switch (ctx.kind) {
    case "OPENAI_COMPATIBLE": {
      if (!ctx.apiKey) throw new AiProviderError("fornecedor sem chave de API");
      const out = await postJson(
        ctx,
        providerUrl(ctx, "/chat/completions"),
        { model: ctx.model, messages, tools: [{ type: "function", function: TOOL }], max_tokens: 200 },
        { authorization: `Bearer ${ctx.apiKey}` },
      );
      const calls = out?.choices?.[0]?.message?.tool_calls;
      return { ok: Array.isArray(calls) && calls.some((c: any) => c?.function?.name === TOOL.name), tokensIn: out?.usage?.prompt_tokens, tokensOut: out?.usage?.completion_tokens };
    }
    case "ANTHROPIC": {
      if (!ctx.apiKey) throw new AiProviderError("fornecedor sem chave de API");
      const out = await postJson(
        ctx,
        providerUrl(ctx, "/v1/messages"),
        { model: ctx.model, max_tokens: 200, messages, tools: [{ name: TOOL.name, description: TOOL.description, input_schema: TOOL.parameters }] },
        { "x-api-key": ctx.apiKey, "anthropic-version": "2023-06-01" },
      );
      const ok = Array.isArray(out?.content) && out.content.some((c: any) => c?.type === "tool_use" && c?.name === TOOL.name);
      return { ok, tokensIn: out?.usage?.input_tokens, tokensOut: out?.usage?.output_tokens };
    }
    case "GOOGLE": {
      if (!ctx.apiKey) throw new AiProviderError("fornecedor sem chave de API");
      const out = await postJson(
        ctx,
        providerUrl(ctx, `/v1beta/models/${encodeURIComponent(ctx.model)}:generateContent`),
        { contents: [{ role: "user", parts: [{ text: TOOL_PROMPT }] }], tools: [{ functionDeclarations: [TOOL] }] },
        { "x-goog-api-key": ctx.apiKey },
      );
      const parts = out?.candidates?.[0]?.content?.parts;
      const ok = Array.isArray(parts) && parts.some((p: any) => p?.functionCall?.name === TOOL.name);
      return { ok, tokensIn: out?.usageMetadata?.promptTokenCount, tokensOut: out?.usageMetadata?.candidatesTokenCount };
    }
    case "WORKERS_AI": {
      if (!ctx.ai) throw new AiProviderError("binding AI ausente (fora do Worker?)");
      let out: any;
      try {
        out = await ctx.ai.run(ctx.model, { messages, tools: [{ type: "function", function: TOOL }] }, ctx.gateway.id ? { gateway: { id: ctx.gateway.id } } : undefined);
      } catch (e) {
        const code = /(?:^|\s)(\d{4}):/.exec(e instanceof Error ? e.message : "")?.[1];
        throw new AiProviderError(`Workers AI ${code ?? "erro"}`);
      }
      const calls = out?.tool_calls ?? out?.choices?.[0]?.message?.tool_calls;
      const ok = Array.isArray(calls) && calls.some((c: any) => (c?.name ?? c?.function?.name) === TOOL.name);
      return { ok, tokensIn: out?.usage?.prompt_tokens, tokensOut: out?.usage?.completion_tokens };
    }
  }
}

function longText(): { text: string; code: string } {
  const code = "ZEBRA-4821";
  const sentence = "O W2Talent aproxima pessoas candidatas e vagas de tecnologia com respeito à privacidade. ";
  const reps = Math.ceil((LONG_CONTEXT_TOKENS * 4) / sentence.length);
  const half = sentence.repeat(Math.floor(reps / 2));
  return { text: `${half}O código secreto é ${code}. ${half}`, code };
}

async function timed<T>(fn: () => Promise<T>, now: () => number): Promise<{ value?: T; error?: string; ms: number }> {
  const t = now();
  try {
    const value = await fn();
    return { value, ms: now() - t };
  } catch (e) {
    return { error: safeErrorText(e), ms: now() - t };
  }
}

/** Roda os testes de um modelo. Nunca lança: cada falha vira um resultado com o código do erro. */
export async function runCompatTests(
  ctx: CallContext,
  opts: { embedding: boolean; longContext?: boolean; now?: () => number },
): Promise<TestResult[]> {
  const now = opts.now ?? Date.now;
  const out: TestResult[] = [];

  if (opts.embedding) {
    if (!supportsEmbeddings(ctx.kind)) return [{ teste: "embeddings", ok: false, detalhe: "tipo_sem_embeddings", latenciaMs: 0 }];
    const r = await timed(() => callEmbed(ctx, ["vaga de engenheiro de dados", "pessoa analista de dados"]), now);
    const dim = r.value?.vectors?.[0]?.length ?? 0;
    out.push({ teste: "embeddings", ok: !r.error && dim > 0, detalhe: r.error ?? `dim:${dim}`, latenciaMs: r.ms, tokensIn: r.value?.tokensIn });
    return out;
  }

  // Texto simples: se nem isso funciona, os outros testes não fazem sentido.
  const basic = await timed(() => callChat(ctx, { messages: [{ role: "user", content: "Responda só com a palavra: ok" }], maxTokens: 300, temperature: 0 }), now);
  const basicOk = !basic.error && /\bok\b/i.test(basic.value?.text ?? "");
  out.push({ teste: "texto", ok: basicOk, detalhe: basic.error ?? (basicOk ? undefined : "resposta_inesperada"), latenciaMs: basic.ms, tokensIn: basic.value?.tokensIn, tokensOut: basic.value?.tokensOut });
  if (basic.error) return out;

  const json = await timed(
    () =>
      callChat(ctx, {
        messages: [{ role: "user", content: 'Devolva só este objeto JSON, sem texto em volta: {"ok": true, "itens": [1, 2, 3]}' }],
        json: true,
        maxTokens: 300,
        temperature: 0,
      }),
    now,
  );
  let jsonOk = false;
  if (!json.error) {
    try {
      const parsed = JSON.parse((json.value?.text ?? "").trim().replace(/^```(?:json)?\s*|\s*```$/g, ""));
      jsonOk = parsed?.ok === true && Array.isArray(parsed?.itens) && parsed.itens.length === 3;
    } catch {
      jsonOk = false;
    }
  }
  out.push({ teste: "json", ok: jsonOk, detalhe: json.error ?? (jsonOk ? undefined : "json_invalido"), latenciaMs: json.ms, tokensIn: json.value?.tokensIn, tokensOut: json.value?.tokensOut });

  const tools = await timed(() => probeTools(ctx), now);
  out.push({ teste: "ferramentas", ok: !!tools.value?.ok, detalhe: tools.error ?? (tools.value?.ok ? undefined : "sem_chamada_de_ferramenta"), latenciaMs: tools.ms, tokensIn: tools.value?.tokensIn, tokensOut: tools.value?.tokensOut });

  const wrong: string[] = [];
  let langMs = 0;
  let langErr: string | undefined;
  let lin = 0;
  let lout = 0;
  for (const lang of ["pt", "en", "es"] as const) {
    const r = await timed(() => callChat(ctx, { messages: [{ role: "user", content: LANG_PROMPTS[lang] }], maxTokens: 400, temperature: 0 }), now);
    langMs += r.ms;
    lin += r.value?.tokensIn ?? 0;
    lout += r.value?.tokensOut ?? 0;
    if (r.error) {
      langErr = r.error;
      break;
    }
    const got = detectLang(r.value?.text ?? "");
    if (got !== lang) wrong.push(`${lang}≠${got ?? "?"}`);
  }
  out.push({
    teste: "idiomas",
    ok: !langErr && wrong.length === 0,
    detalhe: langErr ?? (wrong.length ? `idioma:${wrong.join(",")}` : undefined),
    latenciaMs: Math.round(langMs / 3),
    tokensIn: lin,
    tokensOut: lout,
  });

  if (opts.longContext) {
    const { text, code } = longText();
    const r = await timed(
      () => callChat(ctx, { messages: [{ role: "user", content: `${text}\n\nQual é o código secreto citado no texto acima? Responda só o código.` }], maxTokens: 300, temperature: 0 }),
      now,
    );
    const ok = !r.error && (r.value?.text ?? "").includes(code);
    out.push({ teste: "contexto_longo", ok, detalhe: r.error ?? (ok ? `${LONG_CONTEXT_TOKENS}` : "nao_achou_o_codigo"), latenciaMs: r.ms, tokensIn: r.value?.tokensIn, tokensOut: r.value?.tokensOut });
  }
  return out;
}

// ── o que cada resultado significa para as tarefas ──

/** Resultado mais recente de cada teste de um modelo. */
export type LatestTests = Partial<Record<CompatTest, { ok: boolean; detalhe?: string | null; latenciaMs?: number | null }>>;

export type ModelFacts = {
  embedding: boolean;
  contexto?: number | null;
  tests: LatestTests;
};

/**
 * Por que um modelo não serve para uma tarefa (códigos), ou [] se serve.
 * Códigos: nao_testado, falhou_texto, sem_json, idiomas, contexto_curto, contexto_desconhecido, tipo_errado, sem_embeddings.
 */
export function blockers(task: TaskName, m: ModelFacts): string[] {
  const spec = TASKS[task];
  if (spec.kind === "embed") {
    if (!m.embedding) return ["tipo_errado"];
    if (!m.tests.embeddings) return ["nao_testado"];
    return m.tests.embeddings.ok ? [] : ["sem_embeddings"];
  }
  if (m.embedding) return ["tipo_errado"];
  if (!m.tests.texto) return ["nao_testado"];
  if (!m.tests.texto.ok) return ["falhou_texto"];
  const out: string[] = [];
  if ("json" in spec && spec.json && !m.tests.json?.ok) out.push("sem_json");
  if (!m.tests.idiomas?.ok) out.push("idiomas");
  if ("minContext" in spec) {
    const longOk = m.tests.contexto_longo?.ok === true;
    if (m.contexto != null) {
      if (m.contexto < spec.minContext && !longOk) out.push("contexto_curto");
    } else if (!longOk) {
      out.push("contexto_desconhecido");
    }
  }
  return out;
}
