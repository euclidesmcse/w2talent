/** Escolher o perfil (1.5.5) no banco de verdade: uma vez só e com o consentimento gravado. Só roda num Postgres local. */
import type { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { cookieDeTeste } from "./helpers/sessao-mock";
import { CONSENTIMENTO_VERSAO, textoConsentimento } from "../lib/consentimento";

jest.mock("../lib/sessao", () => require("./helpers/sessao-mock").sessaoMock());

function localDb(url: string | undefined): boolean {
  try {
    return !!url && ["localhost", "127.0.0.1"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}
const describeDb = localDb(process.env.DATABASE_URL) ? describe : describe.skip;

describeDb("Escolher o perfil", () => {
  let db: PrismaClient;
  const IDS = ["login-teste-cand", "login-teste-rec", "login-teste-sem"];
  beforeAll(async () => {
    const { createPrismaClient } = await import("../lib/prisma");
    db = createPrismaClient(process.env.DATABASE_URL!);
    await db.user.deleteMany({ where: { id: { in: IDS } } });
    for (const id of IDS) await db.user.create({ data: { id, name: id, email: `${id}@exemplo.com` } });
  });
  afterAll(async () => {
    await db.user.deleteMany({ where: { id: { in: IDS } } });
    await db.$disconnect();
  });

  const post = (id: string, body: unknown, perfil: null | "candidato" | "recrutador" = null) =>
    new NextRequest("https://w2.test/api/conta/perfil", {
      method: "POST",
      headers: { "content-type": "application/json", "x-locale": "en", cookie: cookieDeTeste({ id, perfil }) },
      body: JSON.stringify(body),
    });

  it("candidato sem os aceites obrigatórios é recusado e nada é gravado", async () => {
    const { POST } = await import("../app/api/conta/perfil/route");
    const r = await POST(post("login-teste-sem", { perfil: "candidato", consentimentos: { tratamentoBusca: true } }));
    expect(r.status).toBe(400);
    expect((await db.user.findUniqueOrThrow({ where: { id: "login-teste-sem" } })).perfil).toBeNull();
    expect(await db.consentLog.count({ where: { userId: "login-teste-sem" } })).toBe(0);
  });

  it("candidato grava o perfil e cada aceite com a versão e o texto no idioma da tela", async () => {
    const { POST } = await import("../app/api/conta/perfil/route");
    const r = await POST(post("login-teste-cand", { perfil: "candidato", consentimentos: { tratamentoBusca: true, contatoProxy: true, nudges: false } }));
    expect(r.status).toBe(200);
    expect((await db.user.findUniqueOrThrow({ where: { id: "login-teste-cand" } })).perfil).toBe("candidato");
    const logs = await db.consentLog.findMany({ where: { userId: "login-teste-cand" }, orderBy: { tipo: "asc" } });
    expect(logs.map((l) => [l.tipo, l.versao, l.texto])).toEqual([
      ["contatoProxy", CONSENTIMENTO_VERSAO, textoConsentimento("contatoProxy", "en")],
      ["tratamentoBusca", CONSENTIMENTO_VERSAO, textoConsentimento("tratamentoBusca", "en")],
    ]);
  });

  it("o perfil não muda depois de escolhido, nem com dois pedidos ao mesmo tempo", async () => {
    const { POST } = await import("../app/api/conta/perfil/route");
    const rs = await Promise.all([POST(post("login-teste-rec", { perfil: "recrutador" })), POST(post("login-teste-rec", { perfil: "candidato", consentimentos: { tratamentoBusca: true, contatoProxy: true } }))]);
    expect(rs.map((r) => r.status).sort()).toEqual([200, 409]);
    const u = await db.user.findUniqueOrThrow({ where: { id: "login-teste-rec" } });
    expect(["recrutador", "candidato"]).toContain(u.perfil);
    // a sessão já diz o perfil: 409 sem tocar no banco
    expect((await POST(post("login-teste-cand", { perfil: "recrutador" }, "candidato"))).status).toBe(409);
  });

  it("apagar a conta apaga os consentimentos dela", async () => {
    await db.user.delete({ where: { id: "login-teste-cand" } });
    expect(await db.consentLog.count({ where: { userId: "login-teste-cand" } })).toBe(0);
    await db.user.create({ data: { id: "login-teste-cand", name: "x", email: "login-teste-cand@exemplo.com" } });
  });
});
