/** Admin de IA (1.5.8): senha de admin, preços, catálogo, testes de compatibilidade e rota automática. Sem rede. */
import {
  adminSecretUsable,
  cookieHeader,
  passwordMatches,
  readCookie,
  signAdminSession,
  verifyAdminSession,
} from "../lib/admin-auth";
import { knownPrice } from "../lib/ai/prices";
import { listModels, looksLikeEmbedding, WORKERS_AI_MODELS } from "../lib/ai/catalog";
import { blockers, detectLang, estimateTestCost, runCompatTests, testTokens, TEST_TOKENS, TEST_TOKENS_EACH, type LatestTests } from "../lib/ai/compat";
import { autoRoute, computeRoutes, exclusionReasons, type RoutingModel } from "../lib/ai/routing";
import { createRouter, RESERVE_PROVIDER_ID, type AiStore, type RouteCandidate } from "../lib/ai/router";
import type { CallContext } from "../lib/ai/types";

const SECRET = "uma-senha-de-admin-bem-comprida-123";
const GW = { accountId: "acc123", id: "w2talent" };

function fakeFetch(responses: (url: string, body: any) => { status?: number; body: unknown }) {
  const calls: { url: string; body: any }[] = [];
  const fn = (async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, body });
    const r = responses(url, body);
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200 });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

describe("acesso de admin", () => {
  it("senha curta não liga o painel", () => {
    expect(adminSecretUsable(undefined)).toBe(false);
    expect(adminSecretUsable("curta")).toBe(false);
    expect(adminSecretUsable(SECRET)).toBe(true);
    expect(passwordMatches("curta", "curta")).toBe(false);
  });

  it("compara a senha", () => {
    expect(passwordMatches(SECRET, SECRET)).toBe(true);
    expect(passwordMatches(SECRET + "x", SECRET)).toBe(false);
    expect(passwordMatches(undefined, SECRET)).toBe(false);
  });

  it("cookie assinado vale 12 horas e não aceita alteração", async () => {
    const now = Date.UTC(2026, 10, 9, 12);
    const s = await signAdminSession(SECRET, now);
    expect(await verifyAdminSession(s.value, SECRET, now + 60_000)).toBe(true);
    expect(await verifyAdminSession(s.value, SECRET, now + 12 * 3600_000 + 1)).toBe(false);
    expect(await verifyAdminSession(s.value, "outra-senha-de-admin-bem-comprida", now)).toBe(false);
    const [exp, sig] = s.value.split(".");
    expect(await verifyAdminSession(`${Number(exp) + 3600_000}.${sig}`, SECRET, now)).toBe(false);
    expect(await verifyAdminSession("lixo", SECRET, now)).toBe(false);
    expect(await verifyAdminSession(s.value, undefined, now)).toBe(false);
  });

  it("cookie só do servidor, seguro e do próprio site", async () => {
    const s = await signAdminSession(SECRET);
    const h = cookieHeader(s.value, s.expires);
    expect(h).toMatch(/HttpOnly/);
    expect(h).toMatch(/Secure/);
    expect(h).toMatch(/SameSite=Strict/);
    expect(readCookie(`a=1; w2_admin=${encodeURIComponent(s.value)}`, "w2_admin")).toBe(s.value);
  });
});

describe("preços de referência", () => {
  it("acha pelo id, com sufixo de data e no Workers AI", () => {
    expect(knownPrice("gpt-4.1-mini")).toMatchObject({ in: 0.4, out: 1.6 });
    expect(knownPrice("gpt-4.1-mini-2025-04-14")).toMatchObject({ in: 0.4 });
    expect(knownPrice("claude-3-5-haiku-20241022")).toMatchObject({ in: 0.8 });
    expect(knownPrice("models/gemini-2.5-flash")).toMatchObject({ in: 0.3 });
    expect(knownPrice("@cf/baai/bge-m3")).toMatchObject({ dim: 1024 });
    expect(knownPrice("modelo-que-ninguem-conhece")).toBeNull();
    expect(knownPrice("constructor")).toBeNull();
  });
});

describe("catálogo de modelos", () => {
  const ctx = (over: Partial<CallContext>) => ({ kind: "OPENAI_COMPATIBLE", apiKey: "sk", gatewayPath: "openai", gateway: GW, fetch, ...over }) as Omit<CallContext, "model">;

  it("OpenAI-compatível: lista pelo gateway, tira imagem/áudio e marca embeddings", async () => {
    const f = fakeFetch(() => ({ body: { data: [{ id: "gpt-4.1-mini" }, { id: "dall-e-3" }, { id: "text-embedding-3-small" }, { id: "whisper-1" }, { id: "deepseek-chat", context_length: 64000 }] } }));
    const r = await listModels(ctx({ fetch: f.fn }));
    expect(f.calls[0].url).toBe("https://gateway.ai.cloudflare.com/v1/acc123/w2talent/openai/models");
    expect(r.map((m) => m.modelo)).toEqual(["deepseek-chat", "gpt-4.1-mini", "text-embedding-3-small"]);
    expect(r.find((m) => m.modelo === "text-embedding-3-small")?.embedding).toBe(true);
    expect(r.find((m) => m.modelo === "deepseek-chat")?.contexto).toBe(64000);
  });

  it("Google: tira o prefixo models/ e usa os métodos para saber se é embeddings", async () => {
    const f = fakeFetch(() => ({
      body: {
        models: [
          { name: "models/gemini-2.5-flash", inputTokenLimit: 1048576, supportedGenerationMethods: ["generateContent"] },
          { name: "models/text-embedding-004", supportedGenerationMethods: ["embedContent"] },
        ],
      },
    }));
    const r = await listModels(ctx({ kind: "GOOGLE", gatewayPath: "google-ai-studio", fetch: f.fn }));
    expect(r).toEqual([
      { modelo: "gemini-2.5-flash", contexto: 1048576, embedding: false },
      { modelo: "text-embedding-004", contexto: null, embedding: true },
    ]);
  });

  it("Workers AI usa a lista do app; sem chave dá erro", async () => {
    expect(await listModels(ctx({ kind: "WORKERS_AI", apiKey: undefined }))).toBe(WORKERS_AI_MODELS);
    await expect(listModels(ctx({ apiKey: undefined }))).rejects.toThrow(/chave/);
    expect(looksLikeEmbedding("@cf/baai/bge-m3")).toBe(true);
  });
});

describe("testes de compatibilidade", () => {
  it("reconhece o idioma da resposta", () => {
    expect(detectLang("O céu é azul por causa da dispersão da luz. Isso não acontece à noite.")).toBe("pt");
    expect(detectLang("El cielo es azul por la dispersión de la luz. Los rayos azules se dispersan más.")).toBe("es");
    expect(detectLang("The sky is blue because of the scattering of light and this is why.")).toBe("en");
    expect(detectLang("ok")).toBeNull();
  });

  it("sem uso informado pelo fornecedor, conta a estimativa do teste", () => {
    expect(testTokens({ teste: "embeddings", latenciaMs: 300 })).toEqual({ in: 20, out: 0 });
    expect(testTokens({ teste: "json", latenciaMs: 300, tokensIn: 5, tokensOut: 2 })).toEqual({ in: 5, out: 2 });
    expect(testTokens({ teste: "texto", latenciaMs: 0 })).toEqual({ in: 0, out: 0 });
    const chat = (["texto", "json", "ferramentas", "idiomas"] as const).reduce((n, k) => n + TEST_TOKENS_EACH[k].in, 0);
    expect(chat).toBe(TEST_TOKENS.chat.in);
  });

  it("estima o custo (nulo sem preço)", () => {
    expect(estimateTestCost(false, { in: null, out: null }, false)).toBeNull();
    const short = estimateTestCost(false, { in: 1, out: 1 }, false)!;
    expect(estimateTestCost(false, { in: 1, out: 1 }, true)!).toBeGreaterThan(short * 10);
    expect(estimateTestCost(true, { in: 1, out: 0 }, false)).toBeCloseTo(0.00002);
  });

  const LANG_ANSWERS: Record<string, string> = {
    "Responda em": "O céu é azul porque a luz do sol se espalha. É por isso que não vemos outra cor.",
    "Answer in": "The sky is blue because of the scattering of sunlight and that is why it looks blue.",
    "Responde en": "El cielo es azul por la dispersión de la luz. Los rayos azules se dispersan más que los otros.",
  };

  function openAiFake(opts: { json?: string; tools?: boolean; failAll?: boolean } = {}) {
    return fakeFetch((url, body) => {
      if (opts.failAll) return { status: 401, body: { error: { message: "invalid_api_key" } } };
      if (body?.tools) {
        return { body: { choices: [{ message: { tool_calls: opts.tools ? [{ function: { name: "consultar_clima" } }] : [] } }], usage: { prompt_tokens: 50, completion_tokens: 10 } } };
      }
      const prompt: string = body?.messages?.[0]?.content ?? "";
      let content = "ok";
      if (body?.response_format) content = opts.json ?? '{"ok": true, "itens": [1, 2, 3]}';
      for (const k of Object.keys(LANG_ANSWERS)) if (prompt.startsWith(k)) content = LANG_ANSWERS[k];
      if (prompt.includes("código secreto")) content = "ZEBRA-4821";
      return { body: { choices: [{ message: { content } }], usage: { prompt_tokens: 20, completion_tokens: 5 } } };
    });
  }
  const chatCtx = (f: typeof fetch): CallContext => ({ kind: "OPENAI_COMPATIBLE", model: "gpt-4.1-mini", apiKey: "sk", gatewayPath: "openai", gateway: GW, fetch: f });

  it("modelo bom passa em tudo, inclusive contexto longo", async () => {
    const f = openAiFake({ tools: true });
    const r = await runCompatTests(chatCtx(f.fn), { embedding: false, longContext: true });
    expect(Object.fromEntries(r.map((x) => [x.teste, x.ok]))).toEqual({ texto: true, json: true, ferramentas: true, idiomas: true, contexto_longo: true });
    expect(r.find((x) => x.teste === "json")?.tokensIn).toBe(20);
  });

  it("JSON errado e sem ferramentas viram falha com código", async () => {
    const f = openAiFake({ json: "não sei", tools: false });
    const r = await runCompatTests(chatCtx(f.fn), { embedding: false });
    expect(r.find((x) => x.teste === "json")).toMatchObject({ ok: false, detalhe: "json_invalido" });
    expect(r.find((x) => x.teste === "ferramentas")).toMatchObject({ ok: false, detalhe: "sem_chamada_de_ferramenta" });
    expect(r.some((x) => x.teste === "contexto_longo")).toBe(false);
  });

  it("chave errada para no primeiro teste, sem lançar e sem vazar a chave", async () => {
    const f = openAiFake({ failAll: true });
    const r = await runCompatTests(chatCtx(f.fn), { embedding: false, longContext: true });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ teste: "texto", ok: false });
    expect(r[0].detalhe).not.toContain("sk");
    expect(f.calls).toHaveLength(1);
  });

  it("embeddings: devolve a dimensão", async () => {
    const f = fakeFetch(() => ({ body: { data: [{ embedding: [0.1, 0.2, 0.3] }, { embedding: [0.1, 0.2, 0.3] }], usage: { prompt_tokens: 12 } } }));
    const r = await runCompatTests({ ...chatCtx(f.fn), model: "text-embedding-3-small" }, { embedding: true });
    expect(r).toEqual([expect.objectContaining({ teste: "embeddings", ok: true, detalhe: "dim:3" })]);
  });
});

const PASS: LatestTests = { texto: { ok: true }, json: { ok: true }, ferramentas: { ok: true }, idiomas: { ok: true } };

function model(over: Partial<RoutingModel>): RoutingModel {
  return {
    id: "m",
    modelo: "m",
    providerNome: "P",
    providerAtivo: true,
    aceitaDadosPessoais: true,
    ativo: true,
    embedding: false,
    contexto: 128_000,
    precoEntrada: 1,
    precoSaida: 1,
    tests: PASS,
    ...over,
  };
}

describe("o que impede um modelo numa tarefa", () => {
  it("lista os motivos em código", () => {
    expect(blockers("extract_cv", { embedding: false, contexto: 128_000, tests: {} })).toEqual(["nao_testado"]);
    expect(blockers("extract_cv", { embedding: false, contexto: 128_000, tests: { ...PASS, json: { ok: false } } })).toEqual(["sem_json"]);
    expect(blockers("support_chat", { embedding: false, contexto: 128_000, tests: { ...PASS, json: { ok: false } } })).toEqual([]);
    expect(blockers("extract_cv", { embedding: false, contexto: 16_000, tests: PASS })).toEqual(["contexto_curto"]);
    expect(blockers("extract_cv", { embedding: false, contexto: 16_000, tests: { ...PASS, contexto_longo: { ok: true } } })).toEqual([]);
    expect(blockers("extract_cv", { embedding: false, contexto: null, tests: PASS })).toEqual(["contexto_desconhecido"]);
    expect(blockers("embed", { embedding: false, tests: PASS })).toEqual(["tipo_errado"]);
    expect(blockers("support_chat", { embedding: true, tests: {} })).toEqual(["tipo_errado"]);
  });

  it("dados pessoais, desligado e sem preço também tiram da rota automática", () => {
    expect(exclusionReasons("extract_cv", model({ aceitaDadosPessoais: false }))).toEqual(["dados_pessoais"]);
    expect(exclusionReasons("support_chat", model({ aceitaDadosPessoais: false }))).toEqual([]);
    expect(exclusionReasons("support_chat", model({ providerAtivo: false }))).toEqual(["desligado"]);
    expect(exclusionReasons("support_chat", model({ precoEntrada: null, precoSaida: null }))).toEqual(["sem_preco"]);
  });
});

describe("rota automática", () => {
  it("do mais barato ao mais caro, só os aprovados", () => {
    const r = autoRoute("extract_cv", [
      model({ id: "caro", precoEntrada: 3, precoSaida: 15 }),
      model({ id: "barato", precoEntrada: 0.1, precoSaida: 0.4 }),
      model({ id: "sem-teste", precoEntrada: 0.01, tests: {} }),
      model({ id: "externo", precoEntrada: 0.05, aceitaDadosPessoais: false }),
    ]);
    expect(r.modelos).toEqual(["barato", "caro"]);
    expect(r.motivo).toBe("mais_barato_aprovado");
    expect(r.fora).toEqual({ "sem-teste": ["nao_testado"], externo: ["dados_pessoais"] });
  });

  it("nenhum aprovado: fica só o padrão", () => {
    expect(autoRoute("support_chat", [model({ tests: {} })])).toMatchObject({ modelos: [], motivo: "nenhum_aprovado" });
  });

  it("embeddings fica travada; tarefa fixada fica como o admin deixou", () => {
    const models = [model({ id: "a", precoEntrada: 0.1 }), model({ id: "e", embedding: true, tests: { embeddings: { ok: true } } })];
    const routes = computeRoutes(models, { embed: { modo: "automatico", modelos: [] }, support_chat: { modo: "fixo", modelos: ["x", "y"] } });
    expect(routes.find((r) => r.tarefa === "embed")).toMatchObject({ modo: "travado", modelos: [] });
    expect(routes.find((r) => r.tarefa === "support_chat")).toMatchObject({ modo: "fixo", modelos: ["x"] });
    expect(routes.find((r) => r.tarefa === "translate_ui")).toMatchObject({ modo: "automatico", modelos: ["a"] });
  });
});

describe("reserva do Workers AI no roteador", () => {
  it("fica por último mesmo sendo a mais barata", async () => {
    const cand = (over: Partial<RouteCandidate>): RouteCandidate => ({
      providerId: "p",
      providerName: "P",
      kind: "OPENAI_COMPATIBLE",
      model: "m",
      gatewayPath: "openai",
      acceptsPersonalData: true,
      priceIn: 1,
      priceOut: 1,
      ...over,
    } as RouteCandidate);
    const tried: string[] = [];
    const f = fakeFetch((url, body) => {
      tried.push(body.model);
      return { status: 500, body: {} };
    });
    const store: AiStore = {
      async route() {
        return {
          mode: "automatico",
          candidates: [
            cand({ providerId: RESERVE_PROVIDER_ID, providerName: "Workers AI", kind: "WORKERS_AI", model: "@cf/x", priceIn: 0.01, priceOut: 0.01 }),
            cand({ providerId: "outro", kind: "WORKERS_AI", model: "@cf/pago" }),
          ],
        };
      },
      async spentTodayUsd() { return 0; },
      async record() {},
    };
    const ran: string[] = [];
    const ai = {
      run: async (m: string) => {
        ran.push(m);
        if (m === "@cf/pago") throw new Error("3040: capacidade");
        return { response: "ok" };
      },
    };
    const router = createRouter(store, { ai: ai as any, fetch: f.fn, gateway: GW, master: undefined, globalDailyBudgetUsd: 10 });
    const r = await router.chat("support_chat", { messages: [{ role: "user", content: "oi" }] });
    expect(tried).toEqual([]);
    expect(ran).toEqual(["@cf/pago", "@cf/x"]);
    expect(r.model).toBe("@cf/x");
  });
});
