/**
 * 3.5b Webhook da Meta no banco de verdade: verificação do endereço (GET), assinatura errada → 401,
 * SAIR desliga na hora (também sem o 9 no número), resposta automática uma vez por dia, texto recebido
 * nunca guardado nem no log. Só roda num Postgres local.
 */
import { createHmac } from "crypto";
import type { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";

function localDb(url: string | undefined): boolean {
  try {
    return !!url && ["localhost", "127.0.0.1"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}
const describeDb = localDb(process.env.DATABASE_URL) ? describe : describe.skip;

const CAND = "wa35b-cand";
const NUMERO = "+5511987654321";
const SEGREDO = "app-secret-wa35b";
const DIA = 86_400_000;

const corpoDe = (from: string, body: string) =>
  JSON.stringify({ object: "whatsapp_business_account", entry: [{ id: "1", changes: [{ field: "messages", value: { messages: [{ from, id: `wamid.${Math.random()}`, type: "text", text: { body } }] } }] }] });
const assinar = (cru: string, segredo = SEGREDO) => `sha256=${createHmac("sha256", segredo).update(cru).digest("hex")}`;

describeDb("WhatsApp 3.5b: webhook da Meta", () => {
  let db: PrismaClient;
  const envAntes = { ...process.env };
  let fetchMock: jest.SpyInstance;
  const enviados = () => fetchMock.mock.calls.map((c) => JSON.parse(String((c[1] as RequestInit).body)));

  const limpar = async () => {
    await db.candidateProfile.deleteMany({ where: { id: CAND } });
    await db.user.deleteMany({ where: { id: CAND } });
  };

  beforeAll(async () => {
    const { createPrismaClient } = await import("../lib/prisma");
    db = createPrismaClient(process.env.DATABASE_URL!);
    await limpar();
    await db.user.create({ data: { id: CAND, name: "Elena", email: "wa35b.cand@exemplo.com", perfil: "candidato" } });
    await db.candidateProfile.create({
      data: { id: CAND, userId: CAND, nome: "Elena", titulo: "Dev", email: "wa35b.cand@exemplo.com", stack: [], expiresAt: new Date(Date.now() + 30 * DIA), idiomaOriginal: "es" } as any,
    });
  });

  afterAll(async () => {
    await limpar();
    process.env = envAntes;
    await db.$disconnect();
    const { prisma } = await import("../lib/prisma");
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    process.env.WHATSAPP_APP_SECRET = SEGREDO;
    process.env.WHATSAPP_VERIFY_TOKEN = "verifica-wa35b";
    process.env.WHATSAPP_TOKEN = "tok-wa35b";
    process.env.WHATSAPP_PHONE_ID = "777";
    delete process.env.WHATSAPP_TEST_TO;
    await db.usoDiario.deleteMany({ where: { dia: { gte: "2026-01-01" } } });
    await db.candidateProfile.update({ where: { id: CAND }, data: { whatsappOpt: true, whatsappNumero: NUMERO, whatsappVerificadoEm: new Date() } });
    fetchMock = jest.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify({ messages: [{ id: "wamid.r" }] }), { status: 200 }));
  });

  afterEach(() => jest.restoreAllMocks());

  const post = async (cru: string, assinatura: string | null) => {
    const { POST } = await import("../app/api/whatsapp/webhook/route");
    return POST(new NextRequest("https://w2.test/api/whatsapp/webhook", { method: "POST", headers: { "content-type": "application/json", ...(assinatura ? { "x-hub-signature-256": assinatura } : {}) }, body: cru }));
  };

  it("GET: devolve o hub.challenge só com o token certo", async () => {
    const { GET } = await import("../app/api/whatsapp/webhook/route");
    const get = (q: string) => GET(new NextRequest(`https://w2.test/api/whatsapp/webhook?${q}`));
    const ok = await get("hub.mode=subscribe&hub.verify_token=verifica-wa35b&hub.challenge=1158201444");
    expect(ok.status).toBe(200);
    expect(await ok.text()).toBe("1158201444");
    expect((await get("hub.mode=subscribe&hub.verify_token=errado&hub.challenge=1")).status).toBe(403);
    expect((await get("hub.mode=unsubscribe&hub.verify_token=verifica-wa35b&hub.challenge=1")).status).toBe(403);
    delete process.env.WHATSAPP_VERIFY_TOKEN;
    expect((await get("hub.mode=subscribe&hub.verify_token=&hub.challenge=1")).status).toBe(403);
  });

  it("POST: sem assinatura ou com assinatura errada → 401 e nada muda; sem o App Secret → 503", async () => {
    const cru = corpoDe("5511987654321", "SAIR");
    expect((await post(cru, null)).status).toBe(401);
    expect((await post(cru, assinar(cru, "outro"))).status).toBe(401);
    expect((await post(cru, assinar(cru + " "))).status).toBe(401);
    expect((await db.candidateProfile.findUniqueOrThrow({ where: { id: CAND } })).whatsappOpt).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    delete process.env.WHATSAPP_APP_SECRET;
    expect((await post(cru, assinar(cru))).status).toBe(503);
  });

  it("SAIR desliga na hora (também quando a Meta manda o número sem o 9) e confirma no idioma da pessoa", async () => {
    const log = jest.spyOn(console, "log").mockImplementation(() => undefined);
    const cru = corpoDe("551187654321", "  Salír! ");
    const r = await post(cru, assinar(cru));
    expect(r.status).toBe(200);
    const p = await db.candidateProfile.findUniqueOrThrow({ where: { id: CAND } });
    expect(p).toMatchObject({ whatsappOpt: false, whatsappNumero: null, whatsappVerificadoEm: null });
    expect(enviados()).toEqual([{ messaging_product: "whatsapp", to: "551187654321", type: "text", text: { preview_url: false, body: expect.stringMatching(/^Listo: ya no recibirás avisos/) } }]);
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://graph.facebook.com/v21.0/777/messages");
    expect(JSON.stringify(log.mock.calls)).not.toContain("87654321");
  });

  it("outra mensagem: uma resposta automática por dia, sem guardar o texto; status de entrega é ignorado", async () => {
    const cru = corpoDe("5511987654321", "oi, tenho uma dúvida sobre a vaga segredo-xyz");
    expect((await post(cru, assinar(cru))).status).toBe(200);
    const cru2 = corpoDe("5511987654321", "alguém aí?");
    expect((await post(cru2, assinar(cru2))).status).toBe(200);
    expect(enviados()).toHaveLength(1);
    expect(enviados()[0].text.body).toMatch(/^Este número solo envía avisos de W2Talent/);
    // Continua ligado, e o texto não foi parar em nenhuma tabela nossa.
    expect((await db.candidateProfile.findUniqueOrThrow({ where: { id: CAND } })).whatsappOpt).toBe(true);
    const achou = await db.$queryRawUnsafe<{ n: number }[]>(`SELECT count(*)::int AS n FROM "ConversaMensagem" WHERE texto LIKE '%segredo-xyz%'`);
    expect(achou[0].n).toBe(0);
    const status = JSON.stringify({ entry: [{ changes: [{ value: { statuses: [{ id: "wamid.s", status: "read", recipient_id: "5511987654321" }] } }] }] });
    expect((await post(status, assinar(status))).status).toBe(200);
    expect(enviados()).toHaveLength(1);
  });

  it("número sem conta: resposta no idioma do DDI; SAIR sem conta só confirma; modo teste não envia", async () => {
    const cru = corpoDe("14155550123", "hello");
    await post(cru, assinar(cru));
    expect(enviados()[0].text.body).toMatch(/^This number only sends W2Talent notices/);
    const sair = corpoDe("14155550123", "STOP");
    await post(sair, assinar(sair));
    expect(enviados()[1].text.body).toMatch(/^Done: you will no longer/);
    delete process.env.WHATSAPP_TOKEN;
    jest.spyOn(console, "log").mockImplementation(() => undefined);
    const outro = corpoDe("34612345678", "hola");
    expect((await post(outro, assinar(outro))).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
