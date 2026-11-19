/**
 * 3.6b no banco de verdade: Admin > Dados de treino (guarda, revisão, exportação auditada, apagar,
 * comparação com a IA simulada e limpeza dos descartados). Só roda num Postgres local. Ids `tr36`.
 * Apaga todas as linhas de ExemploTreino/ExportacaoTreino do banco de teste.
 */
import type { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { TEXT_MODEL } from "../lib/ai/tasks";

const chamadas: { model: string }[] = [];
jest.mock("../lib/ai/providers", () => {
  const real = jest.requireActual("../lib/ai/providers");
  return {
    ...real,
    callChat: jest.fn(async (ctx: { model: string }, req: { messages: { role: string; content: string }[] }) => {
      chamadas.push({ model: ctx.model });
      const user = req.messages.find((m) => m.role === "user")?.content ?? "";
      // O modelo atual (padrão do Workers AI) acerta tudo; o outro erra o regime e falha num exemplo.
      if (ctx.model === TEXT_MODEL) return { text: JSON.stringify(RESPOSTA_CERTA), tokensIn: 100, tokensOut: 50 };
      if (user.includes("quebrado")) return { text: "não sei", tokensIn: 100, tokensOut: 5 };
      return { text: "```json\n" + JSON.stringify({ ...RESPOSTA_CERTA, regime: "PJ" }) + "\n```", tokensIn: 100, tokensOut: 50 };
    }),
  };
});

const RESPOSTA_CERTA = {
  titulo: "Engenheiro de Dados Pleno",
  nivel: "Pleno",
  regime: "CLT",
  modo: "remoto",
  cidade: "",
  faixaDe: 9000,
  faixaAte: 12000,
  faixaMoeda: "BRL",
  stack: ["python"],
  descricaoBullets: ["Pipelines em Python"],
  beneficios: ["Plano de saúde"],
};

function localDb(url: string | undefined): boolean {
  try {
    return !!url && ["localhost", "127.0.0.1"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}
const describeDb = localDb(process.env.DATABASE_URL) ? describe : describe.skip;

const SECRET = "segredo-de-teste-tr36-com-mais-de-24-caracteres";
const PROV = "tr36-prov";
const MODELO = "tr36-modelo";

function req(method: string, cookie: string | null, body?: unknown, query = "", extra: Record<string, string> = {}) {
  const headers: Record<string, string> = { "content-type": "application/json", ...extra };
  if (cookie) headers.cookie = cookie;
  return new NextRequest(`https://w2.test/api/admin/treino${query}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

describeDb("3.6b Admin > Dados de treino", () => {
  let db: PrismaClient;
  let cookie = "";
  let rota: typeof import("../app/api/admin/treino/route");
  const antes = { admin: process.env.ADMIN_SECRET, budget: process.env.AI_DAILY_BUDGET_USD };

  const limpar = async () => {
    await db.exemploTreino.deleteMany({});
    await db.exportacaoTreino.deleteMany({});
    await db.aiInteraction.deleteMany({ where: { tarefa: "admin_comparacao" } });
    await db.aiModel.deleteMany({ where: { providerId: PROV } });
    await db.aiProvider.deleteMany({ where: { id: PROV } });
    await db.taskRoute.deleteMany({ where: { tarefa: "extract_vacancy" } });
  };

  const exemplo = (i: number, extra: Record<string, unknown> = {}) => ({
    id: `tr36-ex-${i}`,
    tarefa: "extract_vacancy",
    donoHash: "tr36-dono",
    conteudoHash: `tr36-hash-${String(i).padStart(3, "0")}`,
    sistema: "Extraia a vaga em JSON.",
    entrada: `Vaga ${i} na [EMPRESA]: Engenheiro de Dados Pleno, CLT, remoto.`,
    saidaIa: JSON.stringify({ ...RESPOSTA_CERTA, regime: "" }),
    saidaFinal: JSON.stringify(RESPOSTA_CERTA),
    corrigido: true,
    createdAt: new Date(Date.UTC(2026, 10, 1, 0, i)),
    ...extra,
  });

  beforeAll(async () => {
    process.env.ADMIN_SECRET = SECRET;
    process.env.AI_DAILY_BUDGET_USD = "1000";
    const { createPrismaClient } = await import("../lib/prisma");
    db = createPrismaClient(process.env.DATABASE_URL!);
    await limpar();
    const { signAdminSession, ADMIN_COOKIE } = await import("../lib/admin-auth");
    cookie = `${ADMIN_COOKIE}=${encodeURIComponent((await signAdminSession(SECRET)).value)}`;
    rota = await import("../app/api/admin/treino/route");
    await db.exemploTreino.createMany({
      data: [
        exemplo(1),
        exemplo(2),
        exemplo(3, { status: "aprovado", prova: false }),
        exemplo(4, { status: "aprovado", prova: true }),
        exemplo(5, { status: "aprovado", prova: true, entrada: "Vaga quebrado" }),
        exemplo(6, { status: "descartado", revisadoEm: new Date(Date.now() - 40 * 864e5) }),
        exemplo(7, { status: "descartado", revisadoEm: new Date() }),
        exemplo(8, { tarefa: "ficha_w2", saidaFinal: '{"resumo":"x","destaques":[]}' }),
      ],
    });
    await db.aiProvider.create({ data: { id: PROV, nome: "tr36 Workers", tipo: "WORKERS_AI", ativo: true, aceitaDadosPessoais: false } });
    await db.aiModel.create({ data: { id: MODELO, providerId: PROV, modelo: "@cf/tr36/modelo-ajustado", precoEntradaUsdMilhao: 0.1, precoSaidaUsdMilhao: 0.2, ativo: true } });
  });
  afterAll(async () => {
    await limpar();
    await db.$disconnect();
    process.env.ADMIN_SECRET = antes.admin;
    process.env.AI_DAILY_BUDGET_USD = antes.budget;
  });

  it("sem o cookie de admin responde 401; de outra origem, 403", async () => {
    expect((await rota.GET(req("GET", null))).status).toBe(401);
    expect((await rota.POST(req("POST", null, { acao: "exportar", tarefa: "extract_vacancy" }))).status).toBe(401);
    expect((await rota.POST(req("POST", cookie, { acao: "exportar", tarefa: "extract_vacancy" }, "", { origin: "https://outro.site" }))).status).toBe(403);
    expect(await db.exportacaoTreino.count()).toBe(0);
  });

  it("resumo por tarefa e status, com o mínimo de 500 e os modelos comparáveis", async () => {
    const j = await (await rota.GET(req("GET", cookie))).json();
    const vaga = j.tarefas.find((t: { tarefa: string }) => t.tarefa === "extract_vacancy");
    expect(vaga).toEqual({ tarefa: "extract_vacancy", pendente: 2, aprovado: 3, descartado: 2, paraTreino: 1, prova: 2, minimo: 500, podeTreinar: false });
    expect(j.tarefas.find((t: { tarefa: string }) => t.tarefa === "ficha_w2").pendente).toBe(1);
    expect(j.modelos.extract_vacancy.atual.rotulo).toBe(`Workers AI / ${TEXT_MODEL}`);
    expect(j.modelos.extract_vacancy.outros.map((m: { id: string }) => m.id)).toContain(MODELO);
    // ficha_w2 tem dado pessoal: fornecedor sem aceite fica de fora.
    expect(j.modelos.ficha_w2.outros.map((m: { id: string }) => m.id)).not.toContain(MODELO);
    expect(j.exemplo).toBeNull();
  });

  it("revisão: um por vez, do mais antigo; aprovar e descartar", async () => {
    const j = await (await rota.GET(req("GET", cookie, undefined, "?revisar=extract_vacancy"))).json();
    expect(j.exemplo.id).toBe("tr36-ex-1");
    expect(j.exemplo.entrada).toContain("[EMPRESA]");
    expect(Object.keys(j.exemplo)).not.toContain("donoHash");
    expect((await rota.POST(req("POST", cookie, { acao: "aprovar", id: "tr36-ex-1" }))).status).toBe(200);
    expect((await rota.POST(req("POST", cookie, { acao: "descartar", id: "tr36-ex-2" }))).status).toBe(200);
    expect((await rota.POST(req("POST", cookie, { acao: "aprovar", id: "nao-existe" }))).status).toBe(404);
    expect((await rota.POST(req("POST", cookie, { acao: "pular", id: "tr36-ex-1" }))).status).toBe(400);
    const e1 = await db.exemploTreino.findUniqueOrThrow({ where: { id: "tr36-ex-1" } });
    const e2 = await db.exemploTreino.findUniqueOrThrow({ where: { id: "tr36-ex-2" } });
    expect([e1.status, e2.status]).toEqual(["aprovado", "descartado"]);
    expect(e1.revisadoEm).toBeTruthy();
    expect((await (await rota.GET(req("GET", cookie, undefined, "?revisar=extract_vacancy"))).json()).exemplo).toBeNull();
  });

  it("exporta só os aprovados fora da prova, em JSONL, e registra a exportação", async () => {
    const r = await rota.POST(req("POST", cookie, { acao: "exportar", tarefa: "extract_vacancy" }, "", { "x-forwarded-for": "203.0.113.9" }));
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toMatch(/ndjson/);
    expect(r.headers.get("content-disposition")).toMatch(/attachment; filename="w2talent-treino-extract_vacancy-\d{4}-\d{2}-\d{2}\.jsonl"/);
    const linhas = (await r.text()).trim().split("\n").map((l) => JSON.parse(l));
    // ex-1 (aprovado agora) e ex-3; ex-4 e ex-5 estão na prova; pendentes e descartados ficam de fora.
    expect(linhas).toHaveLength(2);
    expect(linhas[0].messages.map((m: { role: string }) => m.role)).toEqual(["system", "user", "assistant"]);
    expect(linhas.map((l) => l.messages[1].content)).toEqual([expect.stringContaining("Vaga 1 "), expect.stringContaining("Vaga 3 ")]);
    expect(JSON.parse(linhas[0].messages[2].content)).toEqual(RESPOSTA_CERTA);
    const reg = await db.exportacaoTreino.findMany();
    expect(reg).toHaveLength(1);
    expect(reg[0]).toMatchObject({ tarefa: "extract_vacancy", quantidade: 2 });
    expect(reg[0].quem).toMatch(/^admin:[0-9a-f]{16}$/);
    expect(reg[0].quem).not.toContain("203.0.113.9");
    const j = await (await rota.GET(req("GET", cookie))).json();
    expect(j.exportacoes[0]).toMatchObject({ tarefa: "extract_vacancy", quantidade: 2 });
  });

  it("compara o modelo atual com o escolhido na prova fixa (IA simulada) e grava o custo", async () => {
    chamadas.length = 0;
    const r = await rota.POST(req("POST", cookie, { acao: "comparar", tarefa: "extract_vacancy", modelo: MODELO }));
    const j = await r.json();
    expect(r.status).toBe(200);
    expect(j.n).toBe(2);
    expect(j.atual).toMatchObject({ rotulo: `Workers AI / ${TEXT_MODEL}`, nota: 1, falhas: 0 });
    // escolhido: um exemplo com o regime errado (10/11) e um sem JSON (0)
    expect(j.outro.falhas).toBe(1);
    expect(j.outro.nota).toBeCloseTo((10 / 11) / 2);
    expect(chamadas).toHaveLength(4);
    const regs = await db.aiInteraction.findMany({ where: { tarefa: "admin_comparacao" } });
    expect(regs).toHaveLength(2);
    expect(regs.find((x) => x.modelo === "@cf/tr36/modelo-ajustado")?.custoUsd).toBeCloseTo((200 * 0.1 + 55 * 0.2) / 1e6);
  });

  it("comparação recusa: mesmo modelo, modelo que não serve, sem prova e sem orçamento", async () => {
    const post = (b: Record<string, unknown>) => rota.POST(req("POST", cookie, { acao: "comparar", ...b }));
    expect(await (await post({ tarefa: "ficha_w2", modelo: MODELO })).json()).toEqual({ error: "modelo_nao_serve" });
    expect(await (await post({ tarefa: "outra", modelo: MODELO })).json()).toEqual({ error: "tarefa_invalida" });
    await db.taskRoute.create({ data: { tarefa: "extract_vacancy", modo: "fixo", modelos: [MODELO] } });
    expect(await (await post({ tarefa: "extract_vacancy", modelo: MODELO })).json()).toEqual({ error: "mesmo_modelo" });
    await db.taskRoute.deleteMany({ where: { tarefa: "extract_vacancy" } });
    process.env.AI_DAILY_BUDGET_USD = "0.0000001";
    expect(await (await post({ tarefa: "extract_vacancy", modelo: MODELO })).json()).toEqual({ error: "orcamento_insuficiente" });
    process.env.AI_DAILY_BUDGET_USD = "1000";
    await db.aiProvider.update({ where: { id: PROV }, data: { aceitaDadosPessoais: true } });
    expect(await (await post({ tarefa: "ficha_w2", modelo: MODELO })).json()).toEqual({ error: "prova_vazia" });
  });

  it("Cron: descartados há mais de 30 dias saem", async () => {
    const { apagarDescartadosAntigos } = await import("../lib/treino-admin");
    expect(await apagarDescartadosAntigos(db)).toBe(1);
    expect(await db.exemploTreino.findUnique({ where: { id: "tr36-ex-6" } })).toBeNull();
    expect(await db.exemploTreino.findUnique({ where: { id: "tr36-ex-7" } })).toBeTruthy();
  });

  it("apagar tudo de uma tarefa pede confirmação e não mexe na outra", async () => {
    expect((await rota.POST(req("POST", cookie, { acao: "apagar_tarefa", tarefa: "extract_vacancy" }))).status).toBe(400);
    const r = await rota.POST(req("POST", cookie, { acao: "apagar_tarefa", tarefa: "extract_vacancy", confirmar: true }));
    expect(await r.json()).toEqual({ ok: true, apagados: 6 });
    expect(await db.exemploTreino.count({ where: { tarefa: "extract_vacancy" } })).toBe(0);
    expect(await db.exemploTreino.count({ where: { tarefa: "ficha_w2" } })).toBe(1);
  });
});
