/**
 * Higiene (1.5.15) no banco de verdade. Apaga perfis e vagas, então só roda num Postgres local
 * (localhost/127.0.0.1, como o do CI), nunca no Neon. Sem rede: a fila é um array.
 */
import type { PrismaClient } from "@prisma/client";
import { runHygiene, renewCandidate, CANDIDATE_TTL_DAYS } from "../lib/hygiene";
import type { EmailMessage } from "../lib/email";
import { verifyRenewToken } from "../lib/renew-token";

function localDb(url: string | undefined): boolean {
  try {
    return !!url && ["localhost", "127.0.0.1"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}
const describeDb = localDb(process.env.DATABASE_URL) ? describe : describe.skip;
const DAY = 24 * 60 * 60 * 1000;
const SECRET = "z".repeat(40);
const NOW = new Date("2026-11-09T12:00:00Z");

describeDb("Higiene no banco", () => {
  let db: PrismaClient;
  let fila: EmailMessage[];
  const deps = (over: Partial<Parameters<typeof runHygiene>[1]> = {}) => ({
    now: NOW,
    enqueue: async (m: EmailMessage) => {
      fila.push(m);
    },
    appUrl: "https://w2.test/",
    renewSecret: SECRET,
    ...over,
  });

  /** Perfil no dia `dia` do ciclo de 180 dias. Por padrão a conta aceitou os lembretes (nudges, 1.5.5). */
  async function perfil(userId: string, dia: number, extra: Record<string, unknown> = {}, aceitaLembretes = true) {
    await db.user.create({ data: { id: userId, name: userId, email: `${userId}@hyg.test` } });
    if (aceitaLembretes) await db.consentLog.create({ data: { userId, tipo: "nudges", versao: 1, texto: "x", baseLegal: "consentimento" } });
    return db.candidateProfile.create({
      data: {
        userId,
        nome: `Pessoa ${userId}`,
        titulo: "Dev",
        objetivoCrescimento: "x",
        celular: "+5511999990000",
        email: `${userId}@gmail.com`,
        expiresAt: new Date(NOW.getTime() + (CANDIDATE_TTL_DAYS - dia) * DAY),
        ...extra,
      },
    });
  }

  beforeAll(async () => {
    const { createPrismaClient } = await import("../lib/prisma");
    db = createPrismaClient(process.env.DATABASE_URL!);
  });
  beforeEach(async () => {
    fila = [];
    await db.hygieneEvent.deleteMany();
    await db.application.deleteMany();
    await db.consentLog.deleteMany();
    await db.candidateProfile.deleteMany();
    await db.vacancy.deleteMany();
    await db.companyProfile.deleteMany();
    await db.user.deleteMany({ where: { email: { endsWith: "@hyg.test" } } });
  });
  afterAll(async () => {
    await db?.$disconnect();
  });

  it("lembretes D150/D165/D175 uma vez só, mesmo rodando duas vezes no dia", async () => {
    await perfil("u149", 149);
    await perfil("u150", 150);
    await perfil("u166", 166); // Cron perdeu a faixa do D150: vai só o D165
    await perfil("u177", 177, { idiomaOriginal: "es" });
    await perfil("demo", 160, { email: "demo@example.com" });

    const r1 = await runHygiene(db, deps());
    expect(r1.emails.enfileirados).toBe(3);
    expect(r1.emails.porMarco).toEqual({ D150: 1, D165: 1, D175: 1 });
    expect(fila.map((m) => m.to).sort()).toEqual(["u150@gmail.com", "u166@gmail.com", "u177@gmail.com"]);
    expect(fila.find((m) => m.to.startsWith("u177"))!.subject).toMatch(/búsqueda/);

    const r2 = await runHygiene(db, deps());
    expect(r2.emails.enfileirados).toBe(0);
    expect(fila).toHaveLength(3);
    expect(await db.hygieneEvent.count()).toBe(3);
  });

  it("sem o aceite de lembretes (nudges) não vai lembrete; o aviso de arquivamento vai", async () => {
    await perfil("semAceite", 150, {}, false);
    await perfil("arqSemAceite", 0, { status: "arquivado", arquivadoEm: new Date(NOW.getTime() - DAY) }, false);
    const r = await runHygiene(db, deps());
    expect(fila.map((m) => m.to)).toEqual(["arqSemAceite@gmail.com"]);
    expect(r.emails.porMarco).toEqual({ D180: 1 });
  });

  it("o link do e-mail renova o perfil certo", async () => {
    await perfil("u150", 150);
    await runHygiene(db, deps());
    const url = new URL(fila[0].text.match(/https:\/\/w2\.test\/renovar\?t=\S+/)![0]);
    const check = await verifyRenewToken(url.searchParams.get("t"), SECRET, NOW);
    expect(check).toEqual({ ok: true, userId: "u150" });
    expect(await renewCandidate(db, "u150", NOW)).toMatchObject({ ok: true });
    const p = await db.candidateProfile.findUniqueOrThrow({ where: { userId: "u150" } });
    expect(p.expiresAt.getTime()).toBe(NOW.getTime() + CANDIDATE_TTL_DAYS * DAY);
    // Ciclo novo: os lembretes voltam a valer quando chegar o D150 dele.
    expect(await runHygiene(db, deps()).then((s) => s.emails.enfileirados)).toBe(0);
  });

  it("D180 arquiva com a data, avisa, e só apaga 30 dias depois", async () => {
    await perfil("u180", 180);
    const r = await runHygiene(db, deps());
    expect(r.perfisArquivados).toBe(1);
    expect(r.emails.porMarco).toEqual({ D180: 1 });
    expect(fila[0].text).toMatch(/30 dias/);
    let p = await db.candidateProfile.findUniqueOrThrow({ where: { userId: "u180" } });
    expect(p.status).toBe("arquivado");
    expect(p.arquivadoEm!.getTime()).toBe(NOW.getTime());

    // 29 dias depois: ainda existe (antes, o updatedAt podia apagar antes da hora).
    const r29 = await runHygiene(db, deps({ now: new Date(NOW.getTime() + 29 * DAY) }));
    expect(r29.perfisApagados).toBe(0);
    expect(r29.emails.enfileirados).toBe(0);

    const r30 = await runHygiene(db, deps({ now: new Date(NOW.getTime() + 30 * DAY) }));
    expect(r30.perfisApagados).toBe(1);
    expect(await db.candidateProfile.count({ where: { userId: "u180" } })).toBe(0);
    expect(await db.hygieneEvent.count({ where: { userId: "u180" } })).toBe(0);
  });

  it("arquivado volta para a busca pelo link, sem apagar", async () => {
    await perfil("u180", 180);
    await runHygiene(db, deps());
    await renewCandidate(db, "u180", new Date(NOW.getTime() + 10 * DAY));
    const p = await db.candidateProfile.findUniqueOrThrow({ where: { userId: "u180" } });
    expect(p.status).toBe("ativo");
    expect(p.arquivadoEm).toBeNull();
    const r = await runHygiene(db, deps({ now: new Date(NOW.getTime() + 40 * DAY) }));
    expect(r.perfisApagados).toBe(0);
  });

  it("limite diário: o que passa fica para o dia seguinte", async () => {
    for (let i = 0; i < 5; i++) await perfil(`u${i}`, 155);
    const r = await runHygiene(db, deps({ dailyCap: 3 }));
    expect(r.emails.enfileirados).toBe(3);
    expect(r.emails.ficamParaAmanha).toBe(2);
    expect((await runHygiene(db, deps({ dailyCap: 3 }))).emails.enfileirados).toBe(0);
    const amanha = await runHygiene(db, deps({ dailyCap: 3, now: new Date(NOW.getTime() + DAY) }));
    expect(amanha.emails.enfileirados).toBe(2);
  });

  it("duas execuções ao mesmo tempo não passam do limite do dia", async () => {
    for (let i = 0; i < 8; i++) await perfil(`p${i}`, 155);
    const [a, b] = await Promise.all([runHygiene(db, deps({ dailyCap: 5 })), runHygiene(db, deps({ dailyCap: 5 }))]);
    expect(a.emails.enfileirados + b.emails.enfileirados).toBeLessThanOrEqual(5);
    expect(fila.length).toBeLessThanOrEqual(5);
    expect(await db.hygieneEvent.count()).toBe(fila.length);
  });

  it("muitos já avisados não escondem um pendente (páginas)", async () => {
    const exp = new Date(NOW.getTime() - 5 * DAY);
    await db.candidateProfile.createMany({
      data: Array.from({ length: 600 }, (_, i) => ({
        id: `a${String(i).padStart(4, "0")}`,
        userId: `arq${i}`,
        nome: "x",
        titulo: "x",
        objetivoCrescimento: "x",
        celular: "+55",
        email: `arq${i}@gmail.com`,
        expiresAt: exp,
        status: "arquivado" as const,
        arquivadoEm: NOW,
      })),
    });
    const ciclo = new Date(exp.getTime() - CANDIDATE_TTL_DAYS * DAY).toISOString().slice(0, 10);
    await db.hygieneEvent.createMany({ data: Array.from({ length: 600 }, (_, i) => ({ userId: `arq${i}`, marco: "D180", date: ciclo, createdAt: new Date(NOW.getTime() - 2 * DAY) })) });
    await perfil("zz150", 150, { id: "zzzz" });
    const r = await runHygiene(db, deps());
    expect(r.emails.enfileirados).toBe(1);
    expect(fila[0].to).toBe("zz150@gmail.com");
  });

  it("falha ao enfileirar libera a reserva para o próximo Cron", async () => {
    await perfil("u150", 150);
    const r = await runHygiene(db, deps({ enqueue: async () => { throw new Error("fila fora"); } }));
    expect(r.emails.falhas).toBe(1);
    expect(await db.hygieneEvent.count()).toBe(0);
    expect((await runHygiene(db, deps())).emails.enfileirados).toBe(1);
  });

  it("sem RENEW_LINK_SECRET: arquiva e apaga, mas não manda e-mail", async () => {
    await perfil("u150", 150);
    const r = await runHygiene(db, deps({ renewSecret: undefined }));
    expect(r.emails.enfileirados).toBe(0);
    expect(r.emails.aviso).toMatch(/RENEW_LINK_SECRET/);
  });

  it("vagas vencidas são arquivadas; as outras ficam", async () => {
    const c = await db.companyProfile.create({ data: { nome: "Empresa" } });
    await db.vacancy.create({ data: { companyId: c.id, titulo: "Vencida", expiresAt: new Date(NOW.getTime() - DAY) } });
    await db.vacancy.create({ data: { companyId: c.id, titulo: "Vale", expiresAt: new Date(NOW.getTime() + DAY) } });
    const r = await runHygiene(db, deps());
    expect(r.vagasArquivadas).toBe(1);
    expect((await db.vacancy.findMany({ orderBy: { titulo: "asc" } })).map((v) => [v.titulo, v.status])).toEqual([
      ["Vale", "ativa"],
      ["Vencida", "arquivada"],
    ]);
  });
});
