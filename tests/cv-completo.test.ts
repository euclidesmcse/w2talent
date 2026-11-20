/**
 * Linha do tempo da carreira (2026-11-20): funções, tipo e competências de cada cargo (D2) e o
 * CV completo guardado só com consentimento e sem contatos (D3). A parte de banco só roda num Postgres local.
 */
import type { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { cookieDeTeste } from "./helpers/sessao-mock";
import { DEMO_FICHAS } from "../lib/demo-data";

jest.mock("../lib/sessao", () => require("./helpers/sessao-mock").sessaoMock());
jest.mock("../lib/background", () => ({ runInBackground: () => {} }));
const chamadasIa: string[] = [];
jest.mock("../lib/ai", () => ({
  getAiRouter: () => ({
    chat: async (task: string) => {
      chamadasIa.push(task);
      return { text: JSON.stringify({ geral: "Carreira em nuvem com migrações grandes para o Azure.", cargos: ["Migrou 140 sistemas para o Azure."] }), model: "fake" };
    },
  }),
}));
import { experienciaVazia, MAX_EXPERIENCIAS, sanitizeFicha } from "../lib/ficha";
import { limparCv } from "../lib/cv-completo";
import { CV_COMPLETO_TIPO, textoCvCompleto } from "../lib/consentimento";

describe("cargos da ficha", () => {
  it("guarda tipo, funções e competências de cada cargo", () => {
    const f = sanitizeFicha({
      experiencias: [
        {
          cargo: "Professor de Cloud",
          empresa: "Instituto",
          inicio: "2024-02",
          fim: "atual",
          tipo: "Part-time",
          funcoes: ["• Dá aula de Arquitetura Cloud", "", "Prepara as provas", "a", "b", "c", "d"],
          competencias: ["Azure", "aws", "Azure", "habilidade inventada"],
        },
        { cargo: "Freela", empresa: "X", inicio: "2024-05", fim: "2024-06", tipo: "freela", funcoes: "Diagnóstico de custo\nRelatório final" },
        { cargo: "Sem tipo", empresa: "Y", inicio: "2020-01", fim: "2021-01", tipo: "qualquer coisa" },
      ],
    });
    const [a, b, c] = f.experiencias;
    expect(a).toMatchObject({ atual: true, fim: "", tipo: "meio" });
    expect(a.funcoes).toEqual(["Dá aula de Arquitetura Cloud", "Prepara as provas", "a", "b", "c"]);
    expect(a.skills).toEqual(["azure", "aws"]);
    expect(b).toMatchObject({ tipo: "freelancer", funcoes: ["Diagnóstico de custo", "Relatório final"], skills: [] });
    expect(c.tipo).toBe("");
  });

  it("aceita até 20 cargos, e rascunhos antigos sem os campos novos", () => {
    const muitos = Array.from({ length: 25 }, (_, i) => ({ cargo: `Cargo ${i}`, empresa: "E", inicio: "2010-01", fim: "2011-01" }));
    expect(sanitizeFicha({ experiencias: muitos }).experiencias).toHaveLength(MAX_EXPERIENCIAS);
    expect(MAX_EXPERIENCIAS).toBe(20);
    const antigo = sanitizeFicha({ experiencias: [{ cargo: "Dev", empresa: "X", inicio: "2020-01", fim: "", atual: true }] });
    expect(antigo.experiencias[0]).toEqual({ ...experienciaVazia(), cargo: "Dev", empresa: "X", inicio: "2020-01", atual: true });
  });
});

describe("texto do CV", () => {
  it("tira e-mail, telefone, links, documentos e endereço", () => {
    const t = limparCv(
      "Ana Souza\nana.souza@exemplo.com | +55 (11) 98765-4321\nhttps://ana.dev/portfolio  www.blog.ana.com\nlinkedin.com/in/anasouza\nRua das Flores, 123\nCPF 123.456.789-00\n\n\n\nExperiência\nAnalista Cloud",
    );
    expect(t).not.toMatch(/exemplo\.com|98765|ana\.dev|blog\.ana|anasouza|Flores, 123|123\.456/);
    expect(t).toContain("[EMAIL]");
    expect(t).toContain("[LINK]");
    expect(t).not.toMatch(/\n{3,}/);
    expect(t).toContain("Analista Cloud");
    expect(limparCv(123)).toBe("");
  });

  it("tira endereços e documentos em inglês e espanhol", () => {
    const t = limparCv(
      "Address: 123 Main Street, London\nLives at 45 Baker Street\nDirección: Calle Mayor 12, Madrid\nCalle de Alcalá 200, 3º\nDNI: 12345678Z\nNIE X1234567L\nSSN 123-45-6789\nPassport number: AB1234567\nTel. +34 612 345 678 / 612 345 678\nMobile: +44 7700 900123 or 07700 900123\nPhone +1 (415) 555-0100\n\nExperience\nSenior Engineer at Acme since 2020. Led 12 people on 3 streets of work.\nCarrera de Ingeniería Informática, 2014\nPlaza de la Universidad, 2016",
    );
    expect(t).not.toMatch(/Main Street|Baker Street|Calle Mayor|Alcalá 200|12345678Z|X1234567L|123-45-6789|AB1234567|612 345|7700|555-0100/);
    expect(t).toContain("[ENDERECO]");
    expect(t).toContain("[DOCUMENTO]");
    expect(t).toContain("Senior Engineer at Acme since 2020. Led 12 people on 3 streets of work.");
    expect(t).toContain("Carrera de Ingeniería Informática, 2014");
    expect(t).toContain("Plaza de la Universidad, 2016");
    expect(limparCv("Migrou 140 sistemas e 1.200 servidores em 2021 (3 anos).")).toBe("Migrou 140 sistemas e 1.200 servidores em 2021 (3 anos).");
  });

  it("tira links sem http nem www, sem pegar nomes de tecnologia", () => {
    const t = limparCv("Portfólio: ana.dev/portfolio e blog.ana.com.\nNode.js, Vue.js, ASP.NET, asp.net, socket.io e Next.js. E-mail ana@x.io");
    expect(t).not.toMatch(/ana\.dev|blog\.ana/);
    expect(t).toContain("Node.js, Vue.js, ASP.NET, asp.net, socket.io e Next.js");
    expect(t.match(/\[LINK\]/g)).toHaveLength(2);
    expect(t).toContain("[EMAIL]");
  });

  it("o texto do consentimento existe nos três idiomas", () => {
    for (const l of ["pt-BR", "en", "es"]) {
      expect(textoCvCompleto(l).length).toBeGreaterThan(80);
      expect(textoCvCompleto(l, true).length).toBeGreaterThan(20);
    }
  });
});

function localDb(url: string | undefined): boolean {
  try {
    return !!url && ["localhost", "127.0.0.1"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}
const describeDb = localDb(process.env.DATABASE_URL) ? describe : describe.skip;

describeDb("CV completo no banco", () => {
  let db: PrismaClient;
  const USER = `conta-teste-cv-${Date.now().toString(36)}`;
  const cookie = cookieDeTeste({ id: USER });
  const ficha = { ...DEMO_FICHAS["demo-c-01"], nome: "Bia Teste", email: `${USER}@exemplo.test`, titulo: "Analista Cloud", localidade: "Porto", modo: "remoto", regimes: ["CLT"] };
  const CV = "Bia Teste\nbia@exemplo.test\n\nAnalista Cloud na Nuvia desde 2022. Migrou 140 sistemas para o Azure.";

  beforeAll(async () => {
    const { createPrismaClient } = await import("../lib/prisma");
    db = createPrismaClient(process.env.DATABASE_URL!);
    await db.user.create({ data: { id: USER, name: "Bia Teste", email: `${USER}@exemplo.test`, perfil: "candidato" } });
  });
  afterAll(async () => {
    await db.candidateProfile.deleteMany({ where: { userId: USER } });
    await db.user.deleteMany({ where: { id: USER } });
    await db.$disconnect();
  });

  async function publicar(cv?: unknown) {
    const { POST } = await import("../app/api/ficha/publicar/route");
    const res = await POST(
      new NextRequest("http://w2.test/api/ficha/publicar", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ ficha, fichaW2: { resumo: "Resumo.", idioma: "pt-BR" }, cv }),
      }),
    );
    expect(res.status).toBe(200);
    return (await res.json()) as { cvCompleto?: boolean };
  }
  const perfil = () => db.candidateProfile.findFirstOrThrow({ where: { userId: USER }, select: { id: true, cv: true } });
  const logs = () => db.consentLog.findMany({ where: { userId: USER, tipo: CV_COMPLETO_TIPO }, orderBy: { createdAt: "asc" } });

  it("sem pedido, nada é guardado", async () => {
    expect((await publicar()).cvCompleto).toBeUndefined();
    expect((await perfil()).cv).toBeNull();
    expect(await logs()).toHaveLength(0);
  });

  it("ligado: guarda o texto limpo e registra o consentimento uma vez", async () => {
    expect((await publicar({ mostrar: true, texto: CV })).cvCompleto).toBe(true);
    const p = await perfil();
    expect(p.cv?.texto).toContain("Migrou 140 sistemas");
    expect(p.cv?.texto).not.toContain("bia@exemplo.test");
    // ligado de novo sem texto novo: mantém o texto e não grava outro consentimento
    await db.candidateCv.update({ where: { profileId: p.id }, data: { resumos: { hash: "x", geral: "resumo velho" } } });
    expect((await publicar({ mostrar: true })).cvCompleto).toBe(true);
    expect((await perfil()).cv?.resumos).toEqual({ hash: "x", geral: "resumo velho" });
    // o mesmo texto de novo (republicar a ficha): mantém os resumos
    await publicar({ mostrar: true, texto: CV });
    expect((await perfil()).cv?.resumos).toEqual({ hash: "x", geral: "resumo velho" });
    // texto novo: troca e esquece os resumos
    await publicar({ mostrar: true, texto: `${CV}\nCertificação AZ-305.` });
    const novo = (await perfil()).cv;
    expect(novo?.texto).toContain("AZ-305");
    expect(novo?.resumos).toBeNull();
    const l = await logs();
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ baseLegal: "consentimento", versao: 1, texto: textoCvCompleto("pt-BR") });
  });

  it("desligado: apaga o texto e registra a revogação", async () => {
    expect((await publicar({ mostrar: false })).cvCompleto).toBe(false);
    expect((await perfil()).cv).toBeNull();
    const l = await logs();
    expect(l.map((x) => x.baseLegal)).toEqual(["consentimento", "revogacao"]);
    // a rota de status conta o que está guardado
    const { GET } = await import("../app/api/ficha/publicar/route");
    const j = await (await GET(new NextRequest("http://w2.test/api/ficha/publicar", { headers: { cookie } }))).json();
    expect(j).toMatchObject({ podePublicar: true, cvCompleto: false });
  });

  it("recrutador lê o CV e o resumo; revogado, some", async () => {
    await publicar({ mostrar: true, texto: CV });
    const { id } = await perfil();
    const { GET, POST } = await import("../app/api/candidates/[id]/cv/route");
    const ctx = { params: Promise.resolve({ id }) };
    const rec = cookieDeTeste({ id: `${USER}-rec`, perfil: "recrutador", mfaLigado: true });
    const pedir = (metodo: "GET" | "POST", c = rec) =>
      (metodo === "GET" ? GET : POST)(
        new NextRequest(`http://w2.test/api/candidates/${id}/cv`, { method: metodo, headers: { cookie: c, "content-type": "application/json" }, ...(metodo === "POST" ? { body: JSON.stringify({ idioma: "pt-BR" }) } : {}) }),
        ctx,
      );
    // candidato não lê CV de ninguém por aqui
    expect((await pedir("GET", cookie)).status).toBe(403);
    const g = await pedir("GET");
    expect(g.status).toBe(200);
    expect((await g.json()).texto).toContain("Migrou 140 sistemas");
    const r1 = await (await pedir("POST")).json();
    expect(r1.resumo.cargos[0]).toBe("Migrou 140 sistemas para o Azure.");
    await pedir("POST");
    expect(chamadasIa).toEqual(["summarize_cv"]);
    const { perfisComCv } = await import("../lib/cv-completo");
    expect([...(await perfisComCv(db, [id, "outro"]))]).toEqual([id]);
    await publicar({ mostrar: false });
    expect((await pedir("GET")).status).toBe(404);
  });

  it("o texto sai junto com o perfil", async () => {
    await publicar({ mostrar: true, texto: CV });
    const { id } = await perfil();
    await db.candidateProfile.delete({ where: { id } });
    expect(await db.candidateCv.count({ where: { profileId: id } })).toBe(0);
  });
});
