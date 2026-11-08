/** Camada de IA (1.5.7): adaptadores, roteador, cifra das chaves e filtro de contatos. Sem rede: fetch simulado. */
import { createRouter, resetBreaker, AiBudgetError, AiUnavailableError, type AiStore, type InteractionRecord, type RouteCandidate, type RouteConfig } from "../lib/ai/router";
import { callChat, callEmbed } from "../lib/ai/providers";
import { encryptApiKey, decryptApiKey, keyHint } from "../lib/ai/keys";
import { redactContacts } from "../lib/ai/redact";
import { defaultCandidate, prismaAiStore, startOfUtcDay } from "../lib/ai/store";
import { TASKS } from "../lib/ai/tasks";
import type { CallContext } from "../lib/ai/types";

const MASTER = Buffer.alloc(32, 7).toString("base64");
const GW = { accountId: "acc123", id: "w2talent" };

type Call = { url: string; init: RequestInit };
function fakeFetch(responses: (url: string) => { status?: number; body: unknown }) {
  const calls: Call[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const r = responses(url);
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200 });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

const ctx = (over: Partial<CallContext>): CallContext => ({
  kind: "OPENAI_COMPATIBLE",
  model: "m",
  apiKey: "sk-test",
  gatewayPath: "openai",
  gateway: GW,
  fetch: fetch,
  ...over,
});

describe("adaptadores", () => {
  it("compatível com OpenAI passa pelo AI Gateway com a chave no cabeçalho", async () => {
    const f = fakeFetch(() => ({ body: { choices: [{ message: { content: "{\"a\":1}" } }], usage: { prompt_tokens: 10, completion_tokens: 3 } } }));
    const r = await callChat(ctx({ fetch: f.fn, model: "gpt-4o-mini" }), { messages: [{ role: "user", content: "oi" }], json: true });
    expect(f.calls[0].url).toBe("https://gateway.ai.cloudflare.com/v1/acc123/w2talent/openai/chat/completions");
    expect((f.calls[0].init.headers as Record<string, string>).authorization).toBe("Bearer sk-test");
    const body = JSON.parse(String(f.calls[0].init.body));
    expect(body).toMatchObject({ model: "gpt-4o-mini", response_format: { type: "json_object" } });
    expect(r).toEqual({ text: "{\"a\":1}", tokensIn: 10, tokensOut: 3 });
  });

  it("sem caminho no gateway, chama direto o baseUrl", async () => {
    const f = fakeFetch(() => ({ body: { data: [{ embedding: [1, 2] }] } }));
    const r = await callEmbed(ctx({ fetch: f.fn, gatewayPath: null, baseUrl: "https://api.exemplo.ai/v1/" }), ["x"]);
    expect(f.calls[0].url).toBe("https://api.exemplo.ai/v1/embeddings");
    expect(r.vectors).toEqual([[1, 2]]);
  });

  it("Anthropic: system separado, versão da API e chave em x-api-key", async () => {
    const f = fakeFetch(() => ({ body: { content: [{ type: "text", text: "olá" }], usage: { input_tokens: 5, output_tokens: 2 } } }));
    const r = await callChat(ctx({ kind: "ANTHROPIC", gatewayPath: "anthropic", fetch: f.fn }), {
      messages: [{ role: "system", content: "seja breve" }, { role: "user", content: "oi" }],
    });
    expect(f.calls[0].url).toBe("https://gateway.ai.cloudflare.com/v1/acc123/w2talent/anthropic/v1/messages");
    const h = f.calls[0].init.headers as Record<string, string>;
    expect(h["x-api-key"]).toBe("sk-test");
    expect(h["anthropic-version"]).toBe("2023-06-01");
    const body = JSON.parse(String(f.calls[0].init.body));
    expect(body.system).toBe("seja breve");
    expect(body.messages).toEqual([{ role: "user", content: "oi" }]);
    expect(r.text).toBe("olá");
  });

  it("Google: generateContent com JSON pedido no generationConfig", async () => {
    const f = fakeFetch(() => ({ body: { candidates: [{ content: { parts: [{ text: "{}" }] } }], usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 1 } } }));
    await callChat(ctx({ kind: "GOOGLE", gatewayPath: "google-ai-studio", model: "gemini-2.0-flash", fetch: f.fn }), {
      messages: [{ role: "user", content: "oi" }],
      json: true,
    });
    expect(f.calls[0].url).toBe("https://gateway.ai.cloudflare.com/v1/acc123/w2talent/google-ai-studio/v1beta/models/gemini-2.0-flash:generateContent");
    expect(JSON.parse(String(f.calls[0].init.body)).generationConfig).toEqual({ responseMimeType: "application/json" });
  });

  it("Workers AI usa o binding com o gateway", async () => {
    const run = jest.fn(async () => ({ data: [[0.1, 0.2]] }));
    const r = await callEmbed(ctx({ kind: "WORKERS_AI", model: "@cf/baai/bge-m3", ai: { run } }), ["texto"]);
    expect(run).toHaveBeenCalledWith("@cf/baai/bge-m3", { text: ["texto"] }, { gateway: { id: "w2talent" } });
    expect(r.vectors).toEqual([[0.1, 0.2]]);
  });

  it("erro HTTP vira AiProviderError com o status", async () => {
    const f = fakeFetch(() => ({ status: 401, body: { error: "bad key" } }));
    await expect(callChat(ctx({ fetch: f.fn }), { messages: [{ role: "user", content: "oi" }] })).rejects.toMatchObject({ status: 401 });
  });
});

// ── roteador ──
let KEY = "";
beforeAll(async () => {
  KEY = await encryptApiKey("sk-test", MASTER);
});

function cand(over: Partial<RouteCandidate>): RouteCandidate {
  return {
    providerId: "p1",
    providerName: "Prov1",
    kind: "OPENAI_COMPATIBLE",
    gatewayPath: "openai",
    acceptsPersonalData: true,
    modelId: "m1",
    model: "modelo-1",
    priceIn: 1,
    priceOut: 2,
    encryptedKey: KEY,
    ...over,
  };
}

function memStore(cfg: RouteConfig, spent = { all: 0, task: 0 }) {
  const records: InteractionRecord[] = [];
  const store: AiStore = {
    route: async () => cfg,
    spentTodayUsd: async (task) => (task ? spent.task : spent.all),
    record: async (r) => {
      records.push(r);
    },
  };
  return { store, records };
}

const okChat = (text: string) => ({ body: { choices: [{ message: { content: text } }], usage: { prompt_tokens: 1000, completion_tokens: 500 } } });

describe("roteador", () => {
  beforeEach(() => resetBreaker());

  it("usa o mais barato primeiro e, se falhar, tenta o próximo", async () => {
    const cheap = cand({ providerId: "barato", providerName: "Barato", model: "barato", gatewayPath: "groq", priceIn: 0.1, priceOut: 0.1 });
    const pricey = cand({ providerId: "caro", providerName: "Caro", model: "caro", gatewayPath: "openai", priceIn: 5, priceOut: 15 });
    const f = fakeFetch((url) => (url.includes("/groq/") ? { status: 503, body: {} } : okChat("resposta")));
    const { store, records } = memStore({ mode: "automatico", candidates: [pricey, cheap] });
    const r = createRouter(store, { fetch: f.fn, gateway: GW, globalDailyBudgetUsd: 1, master: MASTER });
    const out = await r.chat("translate_ui", { messages: [{ role: "user", content: "oi" }] });
    expect(f.calls.map((c) => c.url)).toEqual([
      "https://gateway.ai.cloudflare.com/v1/acc123/w2talent/groq/chat/completions",
      "https://gateway.ai.cloudflare.com/v1/acc123/w2talent/openai/chat/completions",
    ]);
    expect(out.model).toBe("caro");
    expect(records.map((x) => [x.modelo, x.ok])).toEqual([["barato", false], ["caro", true]]);
    expect(records[1].custoUsd).toBeCloseTo((1000 * 5 + 500 * 15) / 1e6);
  });

  it("modo fixo não cai para outro modelo", async () => {
    const f = fakeFetch(() => ({ status: 500, body: {} }));
    const { store } = memStore({ mode: "fixo", candidates: [cand({}), cand({ providerId: "p2", model: "m2" })] });
    const r = createRouter(store, { fetch: f.fn, gateway: GW, globalDailyBudgetUsd: 1, master: MASTER });
    await expect(r.chat("translate_ui", { messages: [{ role: "user", content: "oi" }] })).rejects.toBeInstanceOf(AiUnavailableError);
    expect(f.calls).toHaveLength(1);
  });

  it("recusa quando o orçamento geral do dia acabou, sem chamar ninguém", async () => {
    const f = fakeFetch(() => okChat("x"));
    const { store } = memStore({ mode: "automatico", candidates: [cand({})] }, { all: 1.2, task: 0 });
    const r = createRouter(store, { fetch: f.fn, gateway: GW, globalDailyBudgetUsd: 1, master: MASTER });
    await expect(r.chat("translate_ui", { messages: [{ role: "user", content: "oi" }] })).rejects.toBeInstanceOf(AiBudgetError);
    expect(f.calls).toHaveLength(0);
  });

  it("recusa quando o orçamento da tarefa acabou", async () => {
    const f = fakeFetch(() => okChat("x"));
    const { store } = memStore({ mode: "automatico", candidates: [cand({})], dailyBudgetUsd: 0.05 }, { all: 0.1, task: 0.05 });
    const r = createRouter(store, { fetch: f.fn, gateway: GW, globalDailyBudgetUsd: 1, master: MASTER });
    await expect(r.chat("translate_ui", { messages: [{ role: "user", content: "oi" }] })).rejects.toBeInstanceOf(AiBudgetError);
  });

  it("pausa o fornecedor por 10 min depois de 3 falhas em 5 min", async () => {
    let t = 1_000_000;
    const f = fakeFetch(() => ({ status: 500, body: {} }));
    const { store } = memStore({ mode: "automatico", candidates: [cand({})] });
    const r = createRouter(store, { fetch: f.fn, gateway: GW, globalDailyBudgetUsd: 1, master: MASTER, now: () => t });
    const ask = () => r.chat("translate_ui", { messages: [{ role: "user", content: "oi" }] }).catch((e) => e);
    for (let i = 0; i < 3; i++) await ask();
    expect(f.calls).toHaveLength(3);
    const e = await ask();
    expect(f.calls).toHaveLength(3); // pausado: nem tentou
    expect(e.attempts[0].error).toMatch(/pausado/);
    t += 10 * 60_000 + 1;
    await ask();
    expect(f.calls).toHaveLength(4); // voltou a tentar
  });

  it("dados pessoais: pula quem não aceita e tira contatos antes de ir a fornecedor externo", async () => {
    const naoAceita = cand({ providerId: "x", providerName: "SemDPA", model: "sem-dpa", priceIn: 0, priceOut: 0, acceptsPersonalData: false });
    const aceita = cand({ providerId: "y", providerName: "ComDPA", model: "com-dpa", gatewayPath: "anthropic", kind: "ANTHROPIC", encryptedKey: undefined });
    const f = fakeFetch(() => ({ body: { content: [{ type: "text", text: "{}" }] } }));
    const { store } = memStore({ mode: "automatico", candidates: [naoAceita, { ...aceita, encryptedKey: await encryptApiKey("sk-ant-1234", MASTER) }] });
    const r = createRouter(store, { fetch: f.fn, gateway: GW, globalDailyBudgetUsd: 1, master: MASTER });
    await r.chat("extract_cv", { messages: [{ role: "user", content: "Ana Lima, ana@x.com, (11) 98765-4321, Rua Augusta, 100" }] });
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0].url).toContain("/anthropic/");
    expect((f.calls[0].init.headers as Record<string, string>)["x-api-key"]).toBe("sk-ant-1234");
    const sent = String(f.calls[0].init.body);
    expect(sent).not.toMatch(/ana@x\.com|98765|Augusta/);
    expect(sent).toMatch(/\[EMAIL\].*\[TELEFONE\].*\[ENDERECO\]/);
  });

  it("Workers AI recebe o texto como está (roda na Cloudflare) e o histórico nunca guarda texto", async () => {
    const run = jest.fn(async () => ({ response: "ok" }));
    const { store, records } = memStore({ mode: "automatico", candidates: [defaultCandidate("extract_cv")] });
    const r = createRouter(store, { ai: { run }, fetch: fetch, gateway: GW, globalDailyBudgetUsd: 1, master: MASTER });
    await r.chat("extract_cv", { messages: [{ role: "user", content: "ana@x.com" }] });
    expect(JSON.stringify((run.mock.calls[0] as unknown[])[1])).toContain("ana@x.com");
    expect(JSON.stringify(records)).not.toContain("ana@x.com");
    expect(Object.keys(records[0]).sort()).toEqual(["custoUsd", "fornecedor", "latenciaMs", "modelo", "ok", "tarefa", "tokensEntrada", "tokensSaida", "userId"].sort());
  });

  it("embeddings só usa fornecedor que gera embeddings", async () => {
    const run = jest.fn(async () => ({ data: [[1]] }));
    const anth = cand({ kind: "ANTHROPIC", priceIn: 0, priceOut: 0 });
    const { store } = memStore({ mode: "automatico", candidates: [anth, defaultCandidate("embed")] });
    const r = createRouter(store, { ai: { run }, fetch: fetch, gateway: GW, globalDailyBudgetUsd: 1, master: MASTER });
    const out = await r.embed("embed", ["a"]);
    expect(out.model).toBe("@cf/baai/bge-m3");
  });

  it("erro do fornecedor que ecoa o pedido não vai para o histórico nem para as tentativas", async () => {
    const f = fakeFetch(() => ({ status: 400, body: { error: { type: "invalid_request_error", message: "Ana Lima, 10 anos na Empresa X: entrada inválida" } } }));
    const { store, records } = memStore({ mode: "automatico", candidates: [cand({})] });
    const r = createRouter(store, { fetch: f.fn, gateway: GW, globalDailyBudgetUsd: 1, master: MASTER });
    const e = await r.chat("extract_cv", { messages: [{ role: "user", content: "Ana Lima" }] }).catch((x) => x);
    expect(e).toBeInstanceOf(AiUnavailableError);
    expect(records[0].erro).toBe("HTTP 400 (invalid_request_error)");
    expect(JSON.stringify(records) + JSON.stringify(e.attempts)).not.toMatch(/Ana|Empresa/);
  });

  it("exceção do binding do Workers AI grava só o tipo do erro", async () => {
    const run = jest.fn(async () => {
      throw new TypeError("entrada inválida: Ana Lima, ana@x.com");
    });
    const { store, records } = memStore({ mode: "automatico", candidates: [defaultCandidate("extract_cv")] });
    const r = createRouter(store, { ai: { run }, fetch: fetch, gateway: GW, globalDailyBudgetUsd: 1, master: MASTER });
    await r.chat("extract_cv", { messages: [{ role: "user", content: "Ana Lima" }] }).catch(() => null);
    expect(records[0].erro).toBe("TypeError (detalhe omitido)");
  });

  it("falha ao gravar o histórico não derruba a chamada", async () => {
    const run = jest.fn(async () => ({ response: "ok" }));
    const store: AiStore = { route: async () => ({ mode: "automatico", candidates: [defaultCandidate("translate_ui")] }), spentTodayUsd: async () => 0, record: async () => { throw new Error("db fora"); } };
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    const r = createRouter(store, { ai: { run }, fetch: fetch, gateway: GW, globalDailyBudgetUsd: 1, master: MASTER });
    await expect(r.chat("translate_ui", { messages: [{ role: "user", content: "oi" }] })).resolves.toMatchObject({ text: "ok" });
    spy.mockRestore();
  });
});

describe("cifra das chaves", () => {
  it("cifra e decifra; o texto cifrado não contém a chave", async () => {
    const stored = await encryptApiKey("sk-secreta-9876", MASTER);
    expect(stored).toMatch(/^v1:/);
    expect(stored).not.toContain("secreta");
    expect(await decryptApiKey(stored, MASTER)).toBe("sk-secreta-9876");
    expect(keyHint("sk-secreta-9876")).toBe("9876");
  });

  it("com a chave mestra errada, falha sem revelar nada", async () => {
    const stored = await encryptApiKey("sk-1", MASTER);
    const other = Buffer.alloc(32, 9).toString("base64");
    await expect(decryptApiKey(stored, other)).rejects.toThrow(/AI_KEYS_MASTER trocada/);
  });

  it("exige chave mestra de 32 bytes", async () => {
    await expect(encryptApiKey("x", undefined)).rejects.toThrow(/não configurada/);
    await expect(encryptApiKey("x", Buffer.alloc(16).toString("base64"))).rejects.toThrow(/32 bytes/);
  });
});

describe("filtro de contatos", () => {
  it("tira e-mail, telefone, CPF, CEP, endereço e perfis", () => {
    const cv = [
      "Ana Lima — Analista Cloud",
      "ana.lima@gmail.com | +55 (11) 98765-4321 | 11 3456-7890",
      "CPF 123.456.789-09, CEP 01310-100",
      "Av. Paulista, 1000 - São Paulo",
      "linkedin.com/in/analima github.com/analima",
      "AWS, Terraform, 5 anos de experiência, salário 13000",
    ].join("\n");
    const out = redactContacts(cv);
    for (const s of ["ana.lima@gmail.com", "98765", "3456-7890", "123.456.789-09", "01310-100", "Paulista", "analima"]) expect(out).not.toContain(s);
    expect(out).toContain("AWS, Terraform, 5 anos de experiência, salário 13000");
    expect(out).toContain("Ana Lima — Analista Cloud");
  });

  it("tira telefones dos EUA com prefixo de 3 dígitos e não mexe em anos e valores", () => {
    for (const tel of ["+1 415 555 0100", "(415) 555-0100", "415-555-0100", "415.555.0100"]) {
      expect(redactContacts(`Fone: ${tel}.`)).toBe("Fone: [TELEFONE].");
    }
    expect(redactContacts("2019 - 2023, R$ 9.000, 120 horas")).toBe("2019 - 2023, R$ 9.000, 120 horas");
  });

  it("telefone dos EUA não chega ao fornecedor externo", async () => {
    const c = cand({ providerId: "y", providerName: "ComDPA", gatewayPath: "anthropic", kind: "ANTHROPIC", encryptedKey: await encryptApiKey("sk-ant-1", MASTER) });
    const f = fakeFetch(() => ({ body: { content: [{ type: "text", text: "{}" }] } }));
    const { store } = memStore({ mode: "automatico", candidates: [c] });
    const r = createRouter(store, { fetch: f.fn, gateway: GW, globalDailyBudgetUsd: 1, master: MASTER });
    await r.chat("extract_cv", { messages: [{ role: "user", content: "Tel +1 415 555 0100 ou (415) 555-0100" }] });
    expect(String(f.calls[0].init.body)).not.toMatch(/555/);
  });
});

describe("rotas padrão", () => {
  it("toda tarefa tem um modelo padrão no Workers AI e o embed é o bge-m3 de 1024", () => {
    for (const t of Object.keys(TASKS) as (keyof typeof TASKS)[]) expect(defaultCandidate(t).kind).toBe("WORKERS_AI");
    expect(defaultCandidate("embed").model).toBe("@cf/baai/bge-m3");
  });
  it("rota sem modelos usa o padrão e mantém o orçamento da tarefa", async () => {
    const db = { taskRoute: { findUnique: async () => ({ tarefa: "extract_cv", modo: "automatico", modelos: [], orcamentoDiarioUsd: 0.2 }) } };
    const cfg = await prismaAiStore(db as never).route("extract_cv");
    expect(cfg.dailyBudgetUsd).toBe(0.2);
    expect(cfg.candidates.map((c) => c.providerId)).toEqual(["workers-ai-padrao"]);
  });
  it("o dia do orçamento começa à meia-noite UTC", () => {
    expect(startOfUtcDay(Date.UTC(2026, 10, 8, 23, 59)).toISOString()).toBe("2026-11-08T00:00:00.000Z");
  });
});

describe("rota de teste /api/ai/ping", () => {
  const OLD = process.env.CRON_SECRET;
  afterAll(() => {
    process.env.CRON_SECRET = OLD;
  });
  it("fecha sem o segredo e recusa o segredo na URL", async () => {
    process.env.CRON_SECRET = "s3gredo";
    const { POST } = await import("../app/api/ai/ping/route");
    const { NextRequest } = await import("next/server");
    const sem = await POST(new NextRequest("http://x/api/ai/ping", { method: "POST" }));
    expect(sem.status).toBe(401);
    const naUrl = await POST(new NextRequest("http://x/api/ai/ping?cron_secret=s3gredo", { method: "POST" }));
    expect(naUrl.status).toBe(401);
  });
});
