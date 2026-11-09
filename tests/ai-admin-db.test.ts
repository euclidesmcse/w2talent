/**
 * Admin de IA (1.5.8) com banco de verdade. Apaga as APIs e rotas cadastradas, então só roda num
 * Postgres local (localhost/127.0.0.1, como o do CI), nunca no Neon. Sem rede.
 */
import type { PrismaClient } from "@prisma/client";
import { addProvider, adminState, AdminInputError, estimateTests, refreshModels, runTests, setRoute, updateModel, type AdminEnv } from "../lib/ai/admin";

function localDb(url: string | undefined): boolean {
  try {
    return !!url && ["localhost", "127.0.0.1"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}
const describeDb = localDb(process.env.DATABASE_URL) ? describe : describe.skip;
const MASTER = Buffer.alloc(32, 9).toString("base64");
const KEY = "sk-segredo-de-teste-1234";

const ANSWERS: Record<string, string> = {
  "Responda em": "O céu é azul porque a luz do sol se espalha. É por isso que não vemos outra cor.",
  "Answer in": "The sky is blue because of the scattering of sunlight and that is why it looks blue.",
  "Responde en": "El cielo es azul por la dispersión de la luz. Los rayos azules se dispersan más que los otros.",
};

const fakeFetch = (async (url: string, init?: RequestInit) => {
  const body = init?.body ? JSON.parse(String(init.body)) : undefined;
  if (url.endsWith("/models")) return new Response(JSON.stringify({ data: [{ id: "gpt-4.1-mini" }, { id: "gpt-4.1" }, { id: "modelo-sem-preco" }, { id: "dall-e-3" }] }));
  if (body?.tools) return new Response(JSON.stringify({ choices: [{ message: { tool_calls: [{ function: { name: "consultar_clima" } }] } }], usage: { prompt_tokens: 50, completion_tokens: 10 } }));
  const prompt: string = body?.messages?.[0]?.content ?? "";
  let content = body?.response_format ? '{"ok": true, "itens": [1, 2, 3]}' : "ok";
  for (const k of Object.keys(ANSWERS)) if (prompt.startsWith(k)) content = ANSWERS[k];
  return new Response(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 20, completion_tokens: 5 } }));
}) as unknown as typeof fetch;

describeDb("Admin de IA no banco", () => {
  let db: PrismaClient;
  const env: AdminEnv = { fetch: fakeFetch, gateway: { accountId: "acc", id: "gw" }, master: MASTER, globalDailyBudgetUsd: 5 };

  beforeAll(async () => {
    const { createPrismaClient } = await import("../lib/prisma");
    db = createPrismaClient(process.env.DATABASE_URL!);
    await db.aiModelTest.deleteMany();
    await db.aiModel.deleteMany();
    await db.aiProvider.deleteMany();
    await db.taskRoute.deleteMany();
  });
  afterAll(async () => {
    await db?.$disconnect();
  });

  it("cadastra, lista, testa e monta as rotas", async () => {
    await expect(addProvider(db, { tipo: "OPENAI_COMPATIBLE", nome: "OpenAI", gatewayPath: "openai" }, MASTER)).rejects.toThrow(AdminInputError);
    await expect(addProvider(db, { tipo: "OPENAI_COMPATIBLE", nome: "X", baseUrl: "http://inseguro", chave: KEY }, MASTER)).rejects.toThrow("url_invalida");
    const { id } = await addProvider(db, { tipo: "OPENAI_COMPATIBLE", nome: "OpenAI", gatewayPath: "openai", chave: KEY, aceitaDadosPessoais: true }, MASTER);

    expect(await refreshModels(db, id, env)).toEqual({ listados: 3, novos: 3 });
    // de novo: nada novo, e o preço editado pelo admin não volta ao de referência
    const mini = await db.aiModel.findFirstOrThrow({ where: { modelo: "gpt-4.1-mini" } });
    await updateModel(db, mini.id, { precoEntrada: "0,5" });
    expect(await refreshModels(db, id, env)).toEqual({ listados: 3, novos: 0 });
    expect((await db.aiModel.findUniqueOrThrow({ where: { id: mini.id } })).precoEntradaUsdMilhao).toBe(0.5);

    const all = await db.aiModel.findMany();
    const est = await estimateTests(db, { modelos: all.map((m) => m.id) }, env);
    expect(est.semPreco).toBe(1);
    expect(est.cabeNoOrcamento).toBe(true);

    await runTests(db, { modelos: all.map((m) => m.id) }, env);
    const state = await adminState(db, env);
    expect(JSON.stringify(state)).not.toContain(KEY);
    expect(state.providers[0].chaveFinal).toBe("1234");
    const cv = state.routes.find((r) => r.tarefa === "extract_cv")!;
    const byName = (n: string) => all.find((m) => m.modelo === n)!.id;
    // mini (0,5+1,6) antes do 4.1 (2+8); sem preço fica de fora
    expect(cv.modelos).toEqual([byName("gpt-4.1-mini"), byName("gpt-4.1")]);
    expect(cv.fora[byName("modelo-sem-preco")]).toEqual(["contexto_desconhecido", "sem_preco"]);
    expect(state.gastoHojeUsd).toBeGreaterThan(0);
    // a rota gravada é a que o roteador lê
    expect((await db.taskRoute.findUniqueOrThrow({ where: { tarefa: "extract_cv" } })).modelos).toEqual(cv.modelos);

    await setRoute(db, { tarefa: "support_chat", modo: "fixo", modelo: byName("gpt-4.1") });
    expect(await db.taskRoute.findUniqueOrThrow({ where: { tarefa: "support_chat" } })).toMatchObject({ modo: "fixo", modelos: [byName("gpt-4.1")] });
    await expect(setRoute(db, { tarefa: "embed", modo: "fixo", modelo: byName("gpt-4.1") })).rejects.toThrow("tarefa_invalida");
    await setRoute(db, { tarefa: "support_chat", modo: "automatico" });
    expect((await db.taskRoute.findUniqueOrThrow({ where: { tarefa: "support_chat" } })).modo).toBe("automatico");
  });
});
