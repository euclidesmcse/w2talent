/**
 * 3.1a, D7: rota do admin para ver e desligar os pesos do ranking adaptativo. Banco de verdade:
 * só roda num Postgres local (apaga as linhas de RankingWeights).
 */
import type { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { MIN_EXEMPLOS, PESOS_PADRAO } from "../lib/ranking";

function localDb(url: string | undefined): boolean {
  try {
    return !!url && ["localhost", "127.0.0.1"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}
const describeDb = localDb(process.env.DATABASE_URL) ? describe : describe.skip;

const SECRET = "segredo-de-teste-com-mais-de-24-caracteres";
const EMP_A = "rank-adm-emp-a";
const EMP_B = "rank-adm-emp-b";

function req(method: string, cookie: string | null, body?: unknown, extra: Record<string, string> = {}) {
  const headers: Record<string, string> = { "content-type": "application/json", ...extra };
  if (cookie) headers.cookie = cookie;
  return new NextRequest("https://w2.test/api/admin/ranking", { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

describeDb("admin do ranking adaptativo", () => {
  let db: PrismaClient;
  let cookie = "";
  let rota: typeof import("../app/api/admin/ranking/route");
  const antes = process.env.ADMIN_SECRET;
  const pesos = { skills: 46, nivel: 18, condicoes: 18, recencia: 9, completude: 9 };

  const limpar = async () => {
    await db.rankingWeights.deleteMany({});
    await db.companyProfile.deleteMany({ where: { id: { in: [EMP_A, EMP_B] } } });
  };

  beforeAll(async () => {
    process.env.ADMIN_SECRET = SECRET;
    const { createPrismaClient } = await import("../lib/prisma");
    db = createPrismaClient(process.env.DATABASE_URL!);
    await limpar();
    await db.companyProfile.create({ data: { id: EMP_A, nome: "Acme Ranking", validacaoStatus: "validado" } });
    await db.companyProfile.create({ data: { id: EMP_B, nome: "Beta Ranking", validacaoStatus: "validado" } });
    const { signAdminSession, ADMIN_COOKIE } = await import("../lib/admin-auth");
    const s = await signAdminSession(SECRET);
    cookie = `${ADMIN_COOKIE}=${encodeURIComponent(s.value)}`;
    rota = await import("../app/api/admin/ranking/route");
  });
  afterAll(async () => {
    await limpar();
    await db.$disconnect();
    process.env.ADMIN_SECRET = antes;
  });

  it("sem o cookie de admin responde 401", async () => {
    expect((await rota.GET(req("GET", null))).status).toBe(401);
    expect((await rota.POST(req("POST", null, { escopo: "global", escopoId: "", desligado: true }))).status).toBe(401);
  });

  it("lista o global primeiro e depois as empresas pelo número de exemplos", async () => {
    await db.rankingWeights.createMany({
      data: [
        { escopo: "empresa", escopoId: EMP_A, pesos, n: 12, nPositivos: 5, nNegativos: 7 },
        { escopo: "empresa", escopoId: EMP_B, pesos, n: 80, nPositivos: 30, nNegativos: 50 },
        { escopo: "global", escopoId: "", pesos, n: 40, nPositivos: 15, nNegativos: 25 },
      ],
    });
    const res = await rota.GET(req("GET", cookie));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const j = await res.json();
    expect(j.padrao).toEqual(PESOS_PADRAO);
    expect(j.minimo).toBe(MIN_EXEMPLOS);
    expect(j.linhas.map((l: { escopo: string; escopoId: string }) => `${l.escopo}:${l.escopoId}`)).toEqual(["global:", `empresa:${EMP_B}`, `empresa:${EMP_A}`]);
    expect(j.linhas.map((l: { empresaNome: string | null }) => l.empresaNome)).toEqual([null, "Beta Ranking", "Acme Ranking"]);
    expect(j.linhas[1]).toMatchObject({ n: 80, nPositivos: 30, nNegativos: 50, desligado: false, pesos });
  });

  it("recusa pedido inválido com 400", async () => {
    const ruins: unknown[] = [
      {},
      { escopo: "outro", escopoId: "", desligado: true },
      { escopo: "global", escopoId: "", desligado: "sim" },
      { escopo: "global", escopoId: 5, desligado: true },
      { escopo: "empresa", escopoId: "x".repeat(65), desligado: true },
      { escopo: "empresa", escopoId: "", desligado: true },
      { escopo: "global", escopoId: EMP_A, desligado: true },
    ];
    for (const b of ruins) expect([b, (await rota.POST(req("POST", cookie, b))).status]).toEqual([b, 400]);
    // outra origem não grava
    expect((await rota.POST(req("POST", cookie, { escopo: "global", escopoId: "", desligado: true }, { origin: "https://outro.site" }))).status).toBe(403);
    expect((await db.rankingWeights.findFirst({ where: { escopo: "global" } }))?.desligado).toBe(false);
  });

  it("desliga e religa um escopo existente sem mexer nos pesos", async () => {
    const off = await rota.POST(req("POST", cookie, { escopo: "empresa", escopoId: EMP_B, desligado: true }));
    expect(off.status).toBe(200);
    expect((await off.json()).linha).toMatchObject({ escopo: "empresa", escopoId: EMP_B, desligado: true, n: 80, pesos });
    const row = await db.rankingWeights.findUnique({ where: { escopo_escopoId: { escopo: "empresa", escopoId: EMP_B } } });
    expect(row).toMatchObject({ desligado: true, n: 80, pesos });

    const on = await rota.POST(req("POST", cookie, { escopo: "empresa", escopoId: EMP_B, desligado: false }));
    expect((await on.json()).linha.desligado).toBe(false);
  });

  it("desligar um escopo sem linha cria com o padrão e zero exemplos", async () => {
    await db.rankingWeights.deleteMany({});
    const res = await rota.POST(req("POST", cookie, { escopo: "global", escopoId: "", desligado: true }));
    expect(res.status).toBe(200);
    const row = await db.rankingWeights.findUnique({ where: { escopo_escopoId: { escopo: "global", escopoId: "" } } });
    expect(row).toMatchObject({ desligado: true, n: 0, nPositivos: 0, nNegativos: 0, pesos: PESOS_PADRAO });
  });

  it("empresa que não existe responde 404 e não cria linha", async () => {
    const res = await rota.POST(req("POST", cookie, { escopo: "empresa", escopoId: "rank-adm-nao-existe", desligado: true }));
    expect(res.status).toBe(404);
    expect(await db.rankingWeights.count({ where: { escopoId: "rank-adm-nao-existe" } })).toBe(0);
  });
});
