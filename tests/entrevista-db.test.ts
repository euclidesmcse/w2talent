/** 2.5a Agenda no banco de verdade: oferecer, escolher, trocar, cancelar, conflito e fila. Só roda num Postgres local. */
import type { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { cookieDeTeste, type ContaTeste } from "./helpers/sessao-mock";

jest.mock("../lib/sessao", () => require("./helpers/sessao-mock").sessaoMock());
jest.mock("../lib/background", () => ({ runInBackground: () => undefined }));
const fila: any[] = [];
let filaFora = false;
jest.mock("../lib/notifications", () => ({
  enqueueEmail: async (m: any) => {
    if (filaFora) throw new Error("fila fora do ar");
    fila.push(m);
  },
}));

function localDb(url: string | undefined): boolean {
  try {
    return !!url && ["localhost", "127.0.0.1"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}
const describeDb = localDb(process.env.DATABASE_URL) ? describe : describe.skip;

const REC_A = "agd-teste-rec-a";
const REC_B = "agd-teste-rec-b";
const USERS = [REC_A, REC_B];
const CANDS = ["agd-teste-ana", "agd-teste-beto", "agd-teste-caio"];
const rec = (id: string): ContaTeste => ({ id, perfil: "recrutador", mfaLigado: true });

/** Horário redondo daqui a N horas (minutos zerados). */
const em = (horas: number) => {
  const d = new Date(Date.now() + horas * 3600_000);
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString();
};

describeDb("agenda de entrevistas (2.5a)", () => {
  let db: PrismaClient;
  let vagaA = "";
  const apps: Record<string, string> = {};

  const oferecer = async (conta: ContaTeste, app: string, body: unknown) => {
    const { POST } = await import("../app/api/rh/candidaturas/[id]/entrevista/route");
    return POST(
      new NextRequest(`https://w2.test/api/rh/candidaturas/${app}/entrevista`, { method: "POST", headers: { "content-type": "application/json", cookie: cookieDeTeste(conta), "x-locale": "en" }, body: JSON.stringify(body) }),
      { params: Promise.resolve({ id: app }) },
    );
  };
  const cancelarRh = async (conta: ContaTeste, app: string) => {
    const { DELETE } = await import("../app/api/rh/candidaturas/[id]/entrevista/route");
    return DELETE(new NextRequest(`https://w2.test/api/rh/candidaturas/${app}/entrevista`, { method: "DELETE", headers: { cookie: cookieDeTeste(conta) } }), { params: Promise.resolve({ id: app }) });
  };
  const agendar = async (body: Record<string, unknown>, origin?: string) => {
    const { POST } = await import("../app/api/agendar/route");
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (origin) headers.origin = origin;
    return POST(new NextRequest("https://w2.test/api/agendar", { method: "POST", headers, body: JSON.stringify(body) }));
  };
  const codigoDe = (m: any) => /agendar\?c=([A-Za-z0-9_-]+)/.exec(m.text)![1];

  const limpar = async () => {
    const membros = await db.companyMember.findMany({ where: { userId: { in: USERS } }, select: { companyId: true } });
    const ids = membros.map((m) => m.companyId);
    await db.feedbackSignal.deleteMany({ where: { candidateId: { in: CANDS } } });
    await db.entrevista.deleteMany({ where: { companyId: { in: ids } } });
    await db.application.deleteMany({ where: { companyId: { in: ids } } });
    await db.vacancy.deleteMany({ where: { companyId: { in: ids } } });
    await db.companyProfile.deleteMany({ where: { id: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: USERS } } });
    await db.candidateProfile.deleteMany({ where: { id: { in: CANDS } } });
  };

  beforeAll(async () => {
    const { createPrismaClient } = await import("../lib/prisma");
    db = createPrismaClient(process.env.DATABASE_URL!);
    await limpar();
    for (const id of USERS) await db.user.create({ data: { id, name: `Rita ${id}`, email: `${id}@exemplo.com`, perfil: "recrutador" } });
    const { cadastrarEmpresa } = await import("../lib/empresa");
    const empresaA = (await cadastrarEmpresa(db, REC_A, { nome: "Acme AGD", site: null, cnpj: null, emailContato: null })).id;
    await cadastrarEmpresa(db, REC_B, { nome: "Beta AGD", site: null, cnpj: null, emailContato: null });
    const futuro = new Date(Date.now() + 30 * 864e5);
    vagaA = (await db.vacancy.create({ data: { companyId: empresaA, titulo: "SRE Sênior", stack: [] as any, nivel: "Senior", regime: "PJ", localidade: "Remoto", status: "ativa", expiresAt: futuro } })).id;
    for (const [i, c] of CANDS.entries()) {
      await db.candidateProfile.create({ data: { id: c, userId: c, nome: `Pessoa ${c}`, titulo: "SRE", email: `${c}@exemplo.com`, localidade: "SP", expiresAt: futuro, idiomaOriginal: "pt-BR" } as any });
      const a = await db.application.create({
        data: { candidateId: c, vacancyId: vagaA, companyId: empresaA, origem: "candidaturaLote", proxyThreadId: `agd-${c}`, ...(i < 2 ? { etapa: "entrevista", contatoLiberadoEm: new Date() } : {}) },
      });
      apps[c] = a.id;
    }
  });
  afterAll(async () => {
    await limpar();
    await db.$disconnect();
  });

  const HS = [em(30), em(32), em(34)];

  it("só com contato liberado, só da própria empresa, horários válidos", async () => {
    expect((await oferecer(rec(REC_A), apps[CANDS[2]], { duracaoMin: 45, horarios: HS })).status).toBe(422);
    expect((await oferecer(rec(REC_B), apps[CANDS[0]], { duracaoMin: 45, horarios: HS })).status).toBe(404);
    const r = await oferecer(rec(REC_A), apps[CANDS[0]], { duracaoMin: 45, horarios: HS.slice(0, 2) });
    expect([r.status, (await r.json()).error]).toEqual([422, "horarios_qtd"]);
    expect(fila).toHaveLength(0);
  });

  it("oferece, o candidato vê os horários e escolhe; os dois recebem o convite", async () => {
    const r = await oferecer(rec(REC_A), apps[CANDS[0]], { duracaoMin: 45, horarios: HS, linkReuniao: "https://meet.example.com/abc", fuso: "America/New_York" });
    expect(r.status).toBe(200);
    expect((await r.json()).entrevista).toMatchObject({ status: "aberta", duracaoMin: 45, horarios: HS });
    expect(fila).toHaveLength(1);
    expect(fila[0].to).toBe(`${CANDS[0]}@exemplo.com`);
    const c = codigoDe(fila[0]);
    const e = await db.entrevista.findFirstOrThrow({ where: { applicationId: apps[CANDS[0]] } });
    expect(e.tokenHash).not.toBe(c); // só o hash fica no banco
    expect([e.idiomaRecrutador, e.fusoRecrutador, e.emailsPendentes]).toEqual(["en", "America/New_York", []]);

    const ver = await (await agendar({ c, acao: "ver" })).json();
    expect(ver.visao).toMatchObject({ empresa: "Acme AGD", vaga: "SRE Sênior", status: "aberta", disponiveis: HS, podeAlterar: true, linkReuniao: null });
    expect((await agendar({ c: "x".repeat(32), acao: "ver" })).status).toBe(404);
    expect((await agendar({ c, acao: "escolher", inicio: HS[0] }, "https://outro.site")).status).toBe(403);
    expect((await agendar({ c, acao: "escolher", inicio: em(31) })).status).toBe(409);

    const ok = await agendar({ c, acao: "escolher", inicio: HS[1], fuso: "America/Sao_Paulo" });
    expect(ok.status).toBe(200);
    expect((await ok.json()).visao).toMatchObject({ status: "marcada", inicio: HS[1], linkReuniao: "https://meet.example.com/abc" });
    expect(fila.slice(1).map((m) => m.to)).toEqual([`${CANDS[0]}@exemplo.com`, `${REC_A}@exemplo.com`]);
    expect(fila[2].subject).toContain("Interview booked");
    expect(Buffer.from(fila[1].attachments[0].content, "base64").toString("utf8")).toContain("METHOD:REQUEST");
    const marcada = await db.entrevista.findFirstOrThrow({ where: { applicationId: apps[CANDS[0]] } });
    expect([marcada.status, marcada.fusoCandidato, marcada.emailsPendentes]).toEqual(["marcada", "America/Sao_Paulo", []]);
  });

  it("um horário marcado some para outra oferta do mesmo recrutador", async () => {
    await oferecer(rec(REC_A), apps[CANDS[1]], { duracaoMin: 30, horarios: HS });
    const c2 = codigoDe(fila[fila.length - 1]);
    const ver = await (await agendar({ c: c2, acao: "ver" })).json();
    expect(ver.visao.disponiveis).toEqual([HS[0], HS[2]]);
    const r = await agendar({ c: c2, acao: "escolher", inicio: HS[1] });
    expect([r.status, (await r.json()).error]).toEqual([409, "horario_indisponivel"]);
  });

  it("o candidato troca de horário (SEQUENCE sobe) e cancela; com menos de 12 horas, não pode", async () => {
    const { escolherHorario, cancelarPeloCandidato } = await import("../lib/entrevista");
    const convite = fila.find((m) => m.to === `${CANDS[0]}@exemplo.com` && /agendar\?c=/.test(m.text));
    const c = codigoDe(convite);
    const antes = fila.length;
    const t = await agendar({ c, acao: "escolher", inicio: HS[2] });
    expect(t.status).toBe(200);
    const novos = fila.slice(antes);
    expect(novos.map((m) => m.subject).join(" | ")).toMatch(/remarcada|moved/);
    expect(Buffer.from(novos[0].attachments[0].content, "base64").toString("utf8")).toContain("SEQUENCE:1");

    // 11 horas antes do horário marcado: não dá mais para mudar.
    const quase = new Date(new Date(HS[2]).getTime() - 11 * 3600_000);
    expect(await cancelarPeloCandidato(db, c, quase, { appUrl: "https://w2.test" })).toEqual({ ok: false, erro: "nao_pode" });
    expect(await escolherHorario(db, c, HS[0], null, quase, { appUrl: "https://w2.test" })).toEqual({ ok: false, erro: "nao_pode" });

    const cancel = await agendar({ c, acao: "cancelar" });
    expect(cancel.status).toBe(200);
    expect((await cancel.json()).visao).toMatchObject({ status: "cancelada", podeAlterar: false });
    const ultimos = fila.slice(-2);
    expect(ultimos.map((m) => m.to)).toEqual([`${CANDS[0]}@exemplo.com`, `${REC_A}@exemplo.com`]);
    expect(Buffer.from(ultimos[1].attachments[0].content, "base64").toString("utf8")).toContain("METHOD:CANCEL");
    expect((await agendar({ c, acao: "escolher", inicio: HS[0] })).status).toBe(409);
  });

  it("a lista da vaga e Minhas candidaturas mostram a entrevista", async () => {
    const { GET } = await import("../app/api/rh/vagas/[id]/route");
    const j = await (await GET(new NextRequest(`https://w2.test/api/rh/vagas/${vagaA}`, { headers: { cookie: cookieDeTeste(rec(REC_A)) } }), { params: Promise.resolve({ id: vagaA }) })).json();
    const por = (cid: string) => j.itens.find((i: any) => i.candidato.id === cid);
    expect(por(CANDS[0]).entrevista).toMatchObject({ status: "cancelada", canceladaPor: "candidato" });
    expect(por(CANDS[1]).entrevista).toMatchObject({ status: "aberta", duracaoMin: 30 });
    expect(por(CANDS[2]).entrevista).toBeNull();

    const { listarEnviadas } = await import("../lib/envio");
    const enviadas = await listarEnviadas(db, CANDS[1]);
    expect(enviadas[0].entrevista).toMatchObject({ status: "aberta", duracaoMin: 30 });
    expect((await listarEnviadas(db, CANDS[0]))[0].entrevista).toBeNull();
  });

  it("nova oferta cancela a marcada (cancelamento vai para os dois) e o recrutador cancela a aberta", async () => {
    const c1 = codigoDe([...fila].reverse().find((m) => m.to === `${CANDS[1]}@exemplo.com` && /agendar\?c=/.test(m.text)));
    expect((await agendar({ c: c1, acao: "escolher", inicio: HS[0] })).status).toBe(200);
    const antes = fila.length;
    const nova = await oferecer(rec(REC_A), apps[CANDS[1]], { duracaoMin: 60, horarios: [em(40), em(42), em(44)] });
    expect(nova.status).toBe(200);
    const novos = fila.slice(antes);
    expect(novos.map((m) => m.to)).toEqual([`${CANDS[1]}@exemplo.com`, `${REC_A}@exemplo.com`, `${CANDS[1]}@exemplo.com`]);
    expect(Buffer.from(novos[0].attachments[0].content, "base64").toString("utf8")).toContain("METHOD:CANCEL");
    expect(novos[2].text).toMatch(/agendar\?c=/);
    expect(await db.entrevista.count({ where: { applicationId: apps[CANDS[1]], status: { in: ["aberta", "marcada"] } } })).toBe(1);

    const d = await cancelarRh(rec(REC_A), apps[CANDS[1]]);
    expect([d.status, (await d.json()).entrevista.status]).toEqual([200, "cancelada"]);
    expect(fila[fila.length - 1].to).toBe(`${CANDS[1]}@exemplo.com`);
    expect((await cancelarRh(rec(REC_A), apps[CANDS[1]])).status).toBe(404);

    const sinais = await db.feedbackSignal.groupBy({ by: ["tipo"], where: { candidateId: { in: CANDS }, tipo: { startsWith: "entrevista_" } }, _count: { _all: true } });
    expect(Object.fromEntries(sinais.map((s) => [s.tipo, s._count._all]))).toEqual({ entrevista_oferecida: 3, entrevista_marcada: 3, entrevista_cancelada: 2 });
  });

  it("se a fila falhar, os e-mails ficam guardados e o Cron manda depois", async () => {
    filaFora = true;
    try {
      expect((await oferecer(rec(REC_A), apps[CANDS[0]], { duracaoMin: 30, horarios: [em(50), em(52), em(54)] })).status).toBe(200);
    } finally {
      filaFora = false;
    }
    const e = await db.entrevista.findFirstOrThrow({ where: { applicationId: apps[CANDS[0]], status: "aberta" } });
    expect((e.emailsPendentes as any[]).map((m) => m.to)).toEqual([`${CANDS[0]}@exemplo.com`]);
    const { reenviarEmailsEntrevista } = await import("../lib/entrevista");
    const antes = fila.length;
    expect(await reenviarEmailsEntrevista(db, async (m) => void fila.push(m))).toMatchObject({ enviados: 1, falhas: 0 });
    expect(fila.length).toBe(antes + 1);
    expect((await db.entrevista.findUniqueOrThrow({ where: { id: e.id } })).emailsPendentes).toEqual([]);
  });
});
