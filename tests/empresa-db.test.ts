/**
 * 2.1a no banco de verdade: empresa ligada à conta e vagas só com login (D1–D3).
 * Só roda num Postgres local.
 */
import type { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { cookieDeTeste, type ContaTeste } from "./helpers/sessao-mock";

jest.mock("../lib/sessao", () => require("./helpers/sessao-mock").sessaoMock());
// Sem vetor nem IA no teste: a indexação em segundo plano não roda.
jest.mock("../lib/background", () => ({ runInBackground: () => undefined }));

function localDb(url: string | undefined): boolean {
  try {
    return !!url && ["localhost", "127.0.0.1"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}
const describeDb = localDb(process.env.DATABASE_URL) ? describe : describe.skip;

const REC_A = "emp-teste-rec-a";
const REC_B = "emp-teste-rec-b";
const REC_C = "emp-teste-rec-c";
const CAND = "emp-teste-cand";
const USERS = [REC_A, REC_B, REC_C, CAND];
const CNPJ_A = "11222333000181";
const SECRET = "segredo-de-teste-com-mais-de-24-caracteres";

const rec = (id: string): ContaTeste => ({ id, perfil: "recrutador", mfaLigado: true });

function req(url: string, method: string, conta: ContaTeste | null, body?: unknown, extra: Record<string, string> = {}) {
  const headers: Record<string, string> = { "content-type": "application/json", ...extra };
  if (conta) headers.cookie = [headers.cookie, cookieDeTeste(conta)].filter(Boolean).join("; ");
  return new NextRequest(`https://w2.test${url}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describeDb("empresa do recrutador e vagas com login", () => {
  let db: PrismaClient;
  const limpar = async () => {
    const membros = await db.companyMember.findMany({ where: { userId: { in: USERS } }, select: { companyId: true } });
    const ids = membros.map((m) => m.companyId);
    await db.vacancy.deleteMany({ where: { companyId: { in: [...ids, "emp-teste-outra"] } } });
    await db.companyProfile.deleteMany({ where: { id: { in: [...ids, "emp-teste-outra"] } } });
    await db.companyProfile.deleteMany({ where: { cnpj: CNPJ_A } });
    await db.user.deleteMany({ where: { id: { in: USERS } } });
  };

  beforeAll(async () => {
    const { createPrismaClient } = await import("../lib/prisma");
    db = createPrismaClient(process.env.DATABASE_URL!);
    await limpar();
    for (const id of USERS) await db.user.create({ data: { id, name: id, email: `${id}@exemplo.com`, perfil: id === CAND ? "candidato" : "recrutador" } });
    await db.companyProfile.create({ data: { id: "emp-teste-outra", nome: "Outra", validacaoStatus: "validado" } });
  });
  afterAll(async () => {
    await limpar();
    await db.$disconnect();
  });

  let empresaA = "";
  let vagaA = "";

  it("cadastra a empresa uma vez e recusa CNPJ repetido", async () => {
    const { POST, GET } = await import("../app/api/conta/empresa/route");
    const vazio = await GET(req("/api/conta/empresa", "GET", rec(REC_A)));
    expect(await vazio.json()).toEqual({ empresa: null });

    const bad = await POST(req("/api/conta/empresa", "POST", rec(REC_A), { nome: "Acme", cnpj: "123" }));
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: "campo_invalido", campo: "cnpj" });

    const ok = await POST(req("/api/conta/empresa", "POST", rec(REC_A), { nome: "Acme", site: "acme.com.br", cnpj: "11.222.333/0001-81" }));
    expect(ok.status).toBe(201);
    const { empresa } = await ok.json();
    expect(empresa).toMatchObject({ nome: "Acme", site: "https://acme.com.br", cnpj: CNPJ_A, validacaoStatus: "pendente" });
    empresaA = empresa.id;

    const de_novo = await POST(req("/api/conta/empresa", "POST", rec(REC_A), { nome: "Acme 2" }));
    expect(de_novo.status).toBe(409);
    expect((await de_novo.json()).error).toBe("ja_tem_empresa");

    const cnpj = await POST(req("/api/conta/empresa", "POST", rec(REC_B), { nome: "Copia", cnpj: CNPJ_A }));
    expect(cnpj.status).toBe(409);
    expect((await cnpj.json()).error).toBe("cnpj_em_uso");
    expect(await db.companyMember.count({ where: { userId: REC_B } })).toBe(0);
  });

  it("candidato, recrutador sem autenticador e outro site não mexem na empresa", async () => {
    const { POST } = await import("../app/api/conta/empresa/route");
    expect((await POST(req("/api/conta/empresa", "POST", { id: CAND, perfil: "candidato" }, { nome: "X" }))).status).toBe(403);
    expect((await POST(req("/api/conta/empresa", "POST", { id: REC_B, perfil: "recrutador", mfaLigado: false }, { nome: "X" }))).status).toBe(403);
    expect((await POST(req("/api/conta/empresa", "POST", rec(REC_B), { nome: "X" }, { origin: "https://ataque.test" }))).status).toBe(403);
  });

  it("criar vaga: sem login, candidato e recrutador sem empresa são recusados", async () => {
    const { POST } = await import("../app/api/vacancies/route");
    const corpo = { titulo: "DevOps Pleno", companyId: "emp-teste-outra", stack: ["aws"], descricaoBullets: ["AWS"] };
    expect((await POST(req("/api/vacancies", "POST", null, corpo))).status).toBe(401);
    expect((await POST(req("/api/vacancies", "POST", { id: CAND, perfil: "candidato" }, corpo))).status).toBe(403);
    const sem = await POST(req("/api/vacancies", "POST", rec(REC_B), corpo));
    expect(sem.status).toBe(409);
    expect((await sem.json()).error).toBe("sem_empresa");
    expect(await db.vacancy.count({ where: { companyId: "emp-teste-outra" } })).toBe(0);
  });

  it("recrutador cria vaga sempre na própria empresa (o companyId do pedido é ignorado)", async () => {
    const { POST } = await import("../app/api/vacancies/route");
    const res = await POST(req("/api/vacancies", "POST", rec(REC_A), { titulo: "DevOps Pleno", companyId: "emp-teste-outra", stack: ["aws"], descricaoBullets: ["AWS"] }));
    expect(res.status).toBe(201);
    vagaA = (await res.json()).id;
    const v = await db.vacancy.findUnique({ where: { id: vagaA } });
    expect(v?.companyId).toBe(empresaA);
  });

  it("editar, renovar e arquivar só na vaga da própria empresa", async () => {
    const outra = await db.vacancy.create({ data: { companyId: "emp-teste-outra", titulo: "Vaga alheia", expiresAt: new Date(Date.now() + 86400000) } });
    const rota = await import("../app/api/vacancies/[id]/route");
    const renew = await import("../app/api/vacancies/[id]/renew/route");

    expect((await rota.PUT(req(`/api/vacancies/${outra.id}`, "PUT", rec(REC_A), { titulo: "Minha agora" }), ctx(outra.id))).status).toBe(404);
    expect((await rota.DELETE(req(`/api/vacancies/${outra.id}`, "DELETE", rec(REC_A)), ctx(outra.id))).status).toBe(404);
    expect((await renew.POST(req(`/api/vacancies/${outra.id}/renew`, "POST", rec(REC_A)), ctx(outra.id))).status).toBe(404);
    expect((await rota.PUT(req(`/api/vacancies/${outra.id}`, "PUT", null, { titulo: "x" }), ctx(outra.id))).status).toBe(401);
    expect((await db.vacancy.findUnique({ where: { id: outra.id } }))?.titulo).toBe("Vaga alheia");

    const put = await rota.PUT(req(`/api/vacancies/${vagaA}`, "PUT", rec(REC_A), { titulo: "DevOps Sênior" }), ctx(vagaA));
    expect(put.status).toBe(200);
    expect((await db.vacancy.findUnique({ where: { id: vagaA } }))?.titulo).toBe("DevOps Sênior");
    const del = await rota.DELETE(req(`/api/vacancies/${vagaA}`, "DELETE", rec(REC_A)), ctx(vagaA));
    expect(del.status).toBe(200);
    expect((await db.vacancy.findUnique({ where: { id: vagaA } }))?.status).toBe("arquivada");
    await db.vacancy.delete({ where: { id: outra.id } });
  });

  it("admin (cookie assinado) cria vaga na empresa que indicar", async () => {
    const { signAdminSession, ADMIN_COOKIE } = await import("../lib/admin-auth");
    const antes = process.env.ADMIN_SECRET;
    process.env.ADMIN_SECRET = SECRET;
    try {
      const s = await signAdminSession(SECRET);
      const { POST } = await import("../app/api/vacancies/route");
      const res = await POST(req("/api/vacancies", "POST", null, { titulo: "SRE", companyId: "emp-teste-outra" }, { cookie: `${ADMIN_COOKIE}=${encodeURIComponent(s.value)}` }));
      expect(res.status).toBe(201);
      expect((await db.vacancy.findUnique({ where: { id: (await res.json()).id } }))?.companyId).toBe("emp-teste-outra");
    } finally {
      process.env.ADMIN_SECRET = antes;
    }
  });

  it("lista de vagas mostra o nome da empresa e se ela é verificada", async () => {
    const { anexarEmpresas } = await import("../lib/empresa");
    const r = await anexarEmpresas(db, [{ id: "1", companyId: empresaA }, { id: "2", companyId: "emp-teste-outra" }, { id: "3", companyId: "nao-existe" }]);
    expect(r).toEqual([
      { id: "1", companyId: empresaA, company: { nome: "Acme", verificada: false } },
      { id: "2", companyId: "emp-teste-outra", company: { nome: "Outra", verificada: true } },
      { id: "3", companyId: "nao-existe" },
    ]);
  });

  it("mudar o nome de empresa validada volta para verificação", async () => {
    const { decidirEmpresa } = await import("../lib/empresa");
    await decidirEmpresa(db, empresaA, "validar");
    const { PATCH } = await import("../app/api/conta/empresa/route");
    const mesmo = await PATCH(req("/api/conta/empresa", "PATCH", rec(REC_A), { nome: "Acme", site: "acme.com.br", cnpj: CNPJ_A, emailContato: "rh@acme.com.br" }));
    expect((await mesmo.json()).empresa.validacaoStatus).toBe("validado");
    const novo = await PATCH(req("/api/conta/empresa", "PATCH", rec(REC_A), { nome: "Acme Global", cnpj: CNPJ_A }));
    expect((await novo.json()).empresa).toMatchObject({ nome: "Acme Global", validacaoStatus: "pendente", site: null });
  });

  it("recusar a empresa arquiva as vagas ativas e bloqueia vagas novas", async () => {
    await db.vacancy.create({ data: { companyId: empresaA, titulo: "Ativa", expiresAt: new Date(Date.now() + 86400000) } });
    const { decidirEmpresa } = await import("../lib/empresa");
    expect(await decidirEmpresa(db, empresaA, "rejeitar")).toEqual({ arquivadas: 1 });
    expect(await db.vacancy.count({ where: { companyId: empresaA, status: "ativa" } })).toBe(0);
    expect(await decidirEmpresa(db, "nao-existe", "validar")).toBeNull();
    const { POST } = await import("../app/api/vacancies/route");
    const res = await POST(req("/api/vacancies", "POST", rec(REC_A), { titulo: "Nova" }));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("empresa_rejeitada");
  });

  it("dois cadastros ao mesmo tempo deixam uma empresa só para a conta", async () => {
    const { POST } = await import("../app/api/conta/empresa/route");
    const rs = await Promise.all([1, 2, 3].map((n) => POST(req("/api/conta/empresa", "POST", rec(REC_C), { nome: `Corrida ${n}` }))));
    expect(rs.map((r) => r.status).sort()).toEqual([201, 409, 409]);
    expect(await db.companyMember.count({ where: { userId: REC_C } })).toBe(1);
  });
});
