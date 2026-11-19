/**
 * Login com e-mail e senha no banco de verdade: limite de 3 links por hora (D6/D7) e a trava depois de
 * 10 senhas erradas (D6), inclusive com pedidos ao mesmo tempo. Só roda num Postgres local.
 */
import type { PrismaClient } from "@prisma/client";

const enviados: { to: string; subject: string }[] = [];
jest.mock("../lib/notifications", () => ({
  enqueueEmail: async (m: { to: string; subject: string }) => {
    enviados.push({ to: m.to, subject: m.subject });
  },
}));

import { contaTravada, enviarEmailDeLogin, ERROS_PARA_TRAVAR, LINKS_POR_HORA, marcarSenhaErrada, reservarLink, zerarSenhaErrada } from "../lib/login-email";

function localDb(url: string | undefined): boolean {
  try {
    return !!url && ["localhost", "127.0.0.1"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}
const describeDb = localDb(process.env.DATABASE_URL) ? describe : describe.skip;

describeDb("login por senha no banco", () => {
  let db: PrismaClient;
  const sufixo = Date.now().toString(36);
  const email = (n: string) => `le-${n}-${sufixo}@exemplo.test`;

  beforeAll(async () => {
    const { createPrismaClient } = await import("../lib/prisma");
    db = createPrismaClient(process.env.DATABASE_URL!);
  });
  afterAll(async () => {
    await db.verification.deleteMany({ where: { identifier: { startsWith: "w2-" } } });
    await db.$disconnect();
  });

  it("até 3 links por hora por e-mail, sem distinguir maiúsculas", async () => {
    const e = email("links");
    const agora = new Date("2026-11-19T10:00:00Z");
    for (let i = 0; i < LINKS_POR_HORA; i++) expect(await reservarLink(db, i === 1 ? e.toUpperCase() : e, agora)).toBe(true);
    expect(await reservarLink(db, e, agora)).toBe(false);
    // Uma hora depois, volta a valer.
    expect(await reservarLink(db, e, new Date(agora.getTime() + 60 * 60 * 1000 + 1))).toBe(true);
  });

  it("pedidos ao mesmo tempo não passam do limite", async () => {
    const e = email("juntos");
    const agora = new Date();
    const r = await Promise.all(Array.from({ length: 8 }, () => reservarLink(db, e, agora)));
    expect(r.filter(Boolean)).toHaveLength(LINKS_POR_HORA);
  });

  it("passou do limite: não envia e não lança; aviso de senha trocada não conta", async () => {
    const e = email("envio");
    enviados.length = 0;
    const res = [];
    for (let i = 0; i < LINKS_POR_HORA + 1; i++) res.push(await enviarEmailDeLogin(db, { tipo: "redefinir", email: e, url: `https://w2.test/r/${i}` }));
    expect(res).toEqual(["enfileirado", "enfileirado", "enfileirado", "limite"]);
    expect(await enviarEmailDeLogin(db, { tipo: "senha_trocada", email: e, url: "https://w2.test/esqueci" })).toBe("enfileirado");
    expect(enviados).toHaveLength(LINKS_POR_HORA + 1);
    expect(enviados.every((m) => m.to === e)).toBe(true);
  });

  it("10 senhas erradas travam; senha nova destrava", async () => {
    const e = email("trava");
    for (let i = 1; i < ERROS_PARA_TRAVAR; i++) expect(await marcarSenhaErrada(db, e)).toBe(i);
    expect(await contaTravada(db, e)).toBe(false);
    expect(await marcarSenhaErrada(db, e.toUpperCase())).toBe(ERROS_PARA_TRAVAR);
    expect(await contaTravada(db, e)).toBe(true);
    await zerarSenhaErrada(db, e);
    expect(await contaTravada(db, e)).toBe(false);
  });

  it("senhas erradas ao mesmo tempo não se perdem", async () => {
    const e = email("rajada");
    const r = await Promise.all(Array.from({ length: 12 }, () => marcarSenhaErrada(db, e)));
    expect(Math.max(...r)).toBe(12);
    expect(await db.verification.count({ where: { identifier: { startsWith: "w2-erros:" }, value: "12" } })).toBeGreaterThanOrEqual(1);
    expect(await contaTravada(db, e)).toBe(true);
  });

  it("a contagem vencida recomeça do 1", async () => {
    const e = email("vencida");
    const antes = new Date("2026-01-01T00:00:00Z");
    for (let i = 0; i < ERROS_PARA_TRAVAR; i++) await marcarSenhaErrada(db, e, antes);
    expect(await contaTravada(db, e, antes)).toBe(true);
    const depois = new Date(antes.getTime() + 31 * 24 * 60 * 60 * 1000);
    expect(await contaTravada(db, e, depois)).toBe(false);
    expect(await marcarSenhaErrada(db, e, depois)).toBe(1);
  });
});
