/** 2.3 Link da comparação no banco de verdade: só a mesma empresa abre, por 14 dias. Só roda num Postgres local. */
import type { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { cookieDeTeste, type ContaTeste } from "./helpers/sessao-mock";

jest.mock("../lib/sessao", () => require("./helpers/sessao-mock").sessaoMock());
jest.mock("../lib/background", () => ({ runInBackground: () => undefined }));
jest.mock("../lib/auth-server", () => ({ segredoDoLogin: () => "segredo-de-teste-shr-com-mais-de-32-caracteres" }));

function localDb(url: string | undefined): boolean {
  try {
    return !!url && ["localhost", "127.0.0.1"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}
const describeDb = localDb(process.env.DATABASE_URL) ? describe : describe.skip;

const REC_A = "shr-teste-rec-a";
const REC_A2 = "shr-teste-rec-a2";
const REC_B = "shr-teste-rec-b";
const REC_SEM = "shr-teste-rec-sem-empresa";
const USERS = [REC_A, REC_A2, REC_B, REC_SEM];
const IDS = ["shr-teste-ana", "shr-teste-beto", "shr-teste-arquivada"];
const rec = (id: string, extra: Partial<ContaTeste> = {}): ContaTeste => ({ id, perfil: "recrutador", mfaLigado: true, ...extra });

describeDb("link da comparação (rotas)", () => {
  let db: PrismaClient;
  let vagaA = "";
  let vagaB = "";
  const futuro = () => new Date(Date.now() + 30 * 864e5);

  const post = async (mod: string, url: string, conta: ContaTeste | null, body: unknown) => {
    const { POST } = await import(mod);
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (conta) headers.cookie = cookieDeTeste(conta);
    return POST(new NextRequest(`https://w2.test${url}`, { method: "POST", headers, body: JSON.stringify(body) })) as Promise<Response>;
  };
  const criar = (conta: ContaTeste | null, body: unknown) => post("../app/api/candidates/comparar/link/route", "/api/candidates/comparar/link", conta, body);
  const abrir = (conta: ContaTeste | null, body: unknown) => post("../app/api/candidates/comparar/link/abrir/route", "/api/candidates/comparar/link/abrir", conta, body);
  const tokenDe = async (r: Response) => {
    const j = await r.json();
    return String(j.caminho).split("#link=")[1];
  };

  const limpar = async () => {
    const membros = await db.companyMember.findMany({ where: { userId: { in: USERS } }, select: { companyId: true } });
    const ids = membros.map((m) => m.companyId);
    await db.vacancy.deleteMany({ where: { companyId: { in: ids } } });
    await db.companyProfile.deleteMany({ where: { id: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: USERS } } });
    await db.candidateProfile.deleteMany({ where: { id: { in: IDS } } });
  };

  beforeAll(async () => {
    const { createPrismaClient } = await import("../lib/prisma");
    db = createPrismaClient(process.env.DATABASE_URL!);
    await limpar();
    for (const id of USERS) await db.user.create({ data: { id, name: id, email: `${id}@exemplo.com`, perfil: "recrutador" } });
    const { cadastrarEmpresa } = await import("../lib/empresa");
    const empresaA = (await cadastrarEmpresa(db, REC_A, { nome: "Acme Shr", site: null, cnpj: null, emailContato: null })).id;
    const empresaB = (await cadastrarEmpresa(db, REC_B, { nome: "Beta Shr", site: null, cnpj: null, emailContato: null })).id;
    // Outra pessoa da mesma empresa A.
    await db.companyMember.create({ data: { userId: REC_A2, companyId: empresaA, papel: "membro" } });
    const vaga = (companyId: string) =>
      db.vacancy.create({ data: { companyId, titulo: "Cloud Pleno", stack: [{ skillId: "aws" }, { skillId: "kubernetes" }] as any, nivel: "Pleno", regime: "PJ", localidade: "Remoto", status: "ativa", expiresAt: futuro() } });
    vagaA = (await vaga(empresaA)).id;
    vagaB = (await vaga(empresaB)).id;
    const perfil = (id: string, extra: Record<string, unknown>) =>
      db.candidateProfile.create({
        data: { id, userId: id, nome: id, titulo: "Engenharia Cloud", email: `${id}@exemplo.com`, celular: "+5511988887777", localidade: "São Paulo", expiresAt: futuro(), ...extra } as any,
      });
    await perfil(IDS[0], { stack: [{ skillId: "aws", anos: 4 }, { skillId: "kubernetes", anos: 2 }], senioridade: "pleno" });
    await perfil(IDS[1], { stack: [{ skillId: "aws", anos: 1 }], senioridade: "junior" });
    await perfil(IDS[2], { status: "arquivado" });
  });
  afterAll(async () => {
    await limpar();
    await db.$disconnect();
  });

  it("criar: só recrutador com autenticador e empresa; vaga só da própria empresa", async () => {
    expect((await criar(null, { ids: [IDS[0]] })).status).toBe(401);
    expect((await criar({ id: "shr-teste-cand", perfil: "candidato" }, { ids: [IDS[0]] })).status).toBe(403);
    expect((await criar(rec(REC_A, { mfaLigado: false }), { ids: [IDS[0]] })).status).toBe(403);
    expect((await criar(rec(REC_SEM), { ids: [IDS[0]] })).status).toBe(409);
    expect((await criar(rec(REC_A), { ids: [] })).status).toBe(422);
    expect((await criar(rec(REC_A), { ids: [IDS[0]], vaga: vagaB })).status).toBe(404);
    const r = await criar(rec(REC_A), { ids: [IDS[1], IDS[0]], vaga: vagaA });
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    const j = await r.json();
    expect(j.caminho).toMatch(/^\/candidatos\/comparar#link=[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    const dias = (new Date(j.expira).getTime() - Date.now()) / 864e5;
    expect(dias).toBeGreaterThan(13.99);
    expect(dias).toBeLessThanOrEqual(14);
  });

  it("criar: recusa pedido de outro site", async () => {
    const { POST } = await import("../app/api/candidates/comparar/link/route");
    const r = await POST(
      new NextRequest("https://w2.test/api/candidates/comparar/link", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://mal.example", cookie: cookieDeTeste(rec(REC_A)) },
        body: JSON.stringify({ ids: [IDS[0]] }),
      }),
    );
    expect(r.status).toBe(403);
  });

  it("abrir: outra pessoa da mesma empresa vê a mesma comparação, com o match da vaga e sem contato", async () => {
    const token = await tokenDe(await criar(rec(REC_A), { ids: [IDS[1], IDS[2], IDS[0]], vaga: vagaA }));
    const r = await abrir(rec(REC_A2), { t: token });
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    const j = await r.json();
    expect(j.vaga).toEqual({ id: vagaA, titulo: "Cloud Pleno" });
    expect(j.vagaSumiu).toBe(false);
    expect(j.itens.map((i: { id: string }) => i.id)).toEqual([IDS[1], IDS[0]]);
    expect(j.fora).toEqual([IDS[2]]);
    expect(j.itens[1].match).toBeGreaterThan(j.itens[0].match);
    const texto = JSON.stringify(j);
    expect(texto).not.toContain("@exemplo.com");
    expect(texto).not.toContain("988887777");

    // A mesma coisa que a tela Comparar devolve para quem é da empresa.
    const { POST } = await import("../app/api/candidates/comparar/route");
    const direto = await (
      await POST(new NextRequest("https://w2.test/api/candidates/comparar", { method: "POST", headers: { "content-type": "application/json", cookie: cookieDeTeste(rec(REC_A2)) }, body: JSON.stringify({ ids: [IDS[1], IDS[2], IDS[0]], vaga: vagaA }) }))
    ).json();
    expect(j.itens).toEqual(direto.itens);
  });

  it("abrir: sem login 401; outra empresa ou sem empresa 403, sem nenhum dado de candidato", async () => {
    const token = await tokenDe(await criar(rec(REC_A), { ids: [IDS[0]] }));
    const anon = await abrir(null, { t: token });
    expect(anon.status).toBe(401);
    expect(await anon.json()).toEqual({ error: "login" });
    for (const conta of [rec(REC_B), rec(REC_SEM)]) {
      const r = await abrir(conta, { t: token });
      expect(r.status).toBe(403);
      expect(await r.json()).toEqual({ error: "sem_acesso" });
    }
    expect((await abrir({ id: "shr-teste-cand", perfil: "candidato" }, { t: token })).status).toBe(403);
    expect((await abrir(rec(REC_A2, { mfaLigado: false }), { t: token })).status).toBe(403);
  });

  it("abrir: link adulterado 404, vencido 410", async () => {
    const token = await tokenDe(await criar(rec(REC_A), { ids: [IDS[0]] }));
    const [corpo, sig] = token.split(".");
    const b = JSON.parse(Buffer.from(corpo, "base64url").toString());
    const outraEmpresa = Buffer.from(JSON.stringify({ ...b, e: "outra" })).toString("base64url");
    let r = await abrir(rec(REC_B), { t: `${outraEmpresa}.${sig}` });
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ error: "link_invalido" });
    expect((await abrir(rec(REC_A), {})).status).toBe(404);

    const { assinarLinkComparacao } = await import("../lib/comparar-link");
    const empresaA = (await db.companyMember.findUniqueOrThrow({ where: { userId: REC_A } })).companyId;
    const velho = await assinarLinkComparacao({ empresa: empresaA, ids: [IDS[0]] }, "segredo-de-teste-shr-com-mais-de-32-caracteres", Date.now() - 15 * 864e5);
    r = await abrir(rec(REC_A2), { t: velho.token });
    expect(r.status).toBe(410);
    expect(await r.json()).toEqual({ error: "link_vencido" });
  });

  it("abrir: vaga que saiu do ar some da comparação e avisa", async () => {
    const token = await tokenDe(await criar(rec(REC_A), { ids: [IDS[0]], vaga: vagaA }));
    await db.vacancy.update({ where: { id: vagaA }, data: { status: "arquivada" } });
    try {
      const j = await (await abrir(rec(REC_A2), { t: token })).json();
      expect(j.vaga).toBeNull();
      expect(j.vagaSumiu).toBe(true);
      expect(j.itens[0].match).toBeNull();
    } finally {
      await db.vacancy.update({ where: { id: vagaA }, data: { status: "ativa" } });
    }
  });
});
