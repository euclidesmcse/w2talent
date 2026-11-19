/**
 * 3.6a no banco de verdade: consentimento "treinoIA", captura anonimizada sem id da conta,
 * recusa por sobra, recibo adulterado e revogação que apaga. Só roda num Postgres local. Ids `tr36`.
 */
import type { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { cookieDeTeste, type ContaTeste } from "./helpers/sessao-mock";
import { DEMO_FICHAS } from "../lib/demo-data";
import { assinarRecibo, donoHash, lerRecibo, naProva } from "../lib/treino";
import { segredoDoLogin } from "../lib/segredo-login";
import { promptFichaW2 } from "../lib/ficha-ai";
import { sanitizeFicha } from "../lib/ficha";

jest.mock("../lib/sessao", () => require("./helpers/sessao-mock").sessaoMock());
jest.mock("../lib/background", () => ({ runInBackground: () => undefined }));
jest.mock("../lib/traducao", () => ({ pedirTraducaoFichas: async () => undefined }));
jest.mock("../lib/traducao-anexar", () => ({ pedirTraducaoDaVaga: async () => undefined }));

function localDb(url: string | undefined): boolean {
  try {
    return !!url && ["localhost", "127.0.0.1"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}
const describeDb = localDb(process.env.DATABASE_URL) ? describe : describe.skip;

const CAND = "tr36-cand";
const SEM = "tr36-sem";
const REC = "tr36-rec";
const USERS = [CAND, SEM, REC];
const cand = (id: string): ContaTeste => ({ id, perfil: "candidato" });
const rec: ContaTeste = { id: REC, perfil: "recrutador", mfaLigado: true };

function req(url: string, method: string, conta: ContaTeste | null, body?: unknown) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (conta) headers.cookie = cookieDeTeste(conta);
  return new NextRequest(`https://w2.test${url}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

const FICHA = sanitizeFicha({
  ...DEMO_FICHAS["demo-c-01"],
  nome: "Joana Prado Tavares",
  email: "joana.tavares@exemplo.com",
  celular: "+55 11 97777-1234",
  titulo: "Analista Cloud",
  localidade: "São Paulo",
  modo: "remoto",
  regimes: ["CLT"],
  experiencias: [{ cargo: "Analista Cloud", empresa: "Nimbus Hospedagem", inicio: "2022-03", fim: "", atual: true }],
  objetivo: "Crescer em cloud; falar com Joana em joana.tavares@exemplo.com",
});

async function reciboFicha(saidaIa: { resumo: string; destaques: string[] }) {
  const p = promptFichaW2(FICHA, "pt-BR");
  return assinarRecibo({ tarefa: "ficha_w2", sistema: p.sistema, entrada: p.entrada, saidaIa, idioma: "pt-BR" }, segredoDoLogin());
}

describeDb("3.6a exemplos de treino", () => {
  let db: PrismaClient;
  let empresa = "";

  const limpar = async () => {
    const hashes = await Promise.all(USERS.map((u) => donoHash(u, segredoDoLogin())));
    await db.exemploTreino.deleteMany({ where: { donoHash: { in: hashes } } });
    const membros = await db.companyMember.findMany({ where: { userId: { in: USERS } }, select: { companyId: true } });
    await db.vacancy.deleteMany({ where: { companyId: { in: membros.map((m) => m.companyId) } } });
    await db.companyProfile.deleteMany({ where: { id: { in: membros.map((m) => m.companyId) } } });
    await db.candidateProfile.deleteMany({ where: { userId: { in: USERS } } });
    await db.user.deleteMany({ where: { id: { in: USERS } } });
    await db.$executeRawUnsafe(`DELETE FROM "UsoDiario"`).catch(() => 0);
  };

  beforeAll(async () => {
    const { createPrismaClient } = await import("../lib/prisma");
    db = createPrismaClient(process.env.DATABASE_URL!);
    await limpar();
    await db.user.create({ data: { id: CAND, name: "Joana Prado Tavares", email: "joana.conta@exemplo.com", perfil: "candidato" } });
    await db.user.create({ data: { id: SEM, name: "Pedro Sem", email: "pedro.sem@exemplo.com", perfil: "candidato" } });
    await db.user.create({ data: { id: REC, name: "Rita Recrutadora", email: "rita@quasar.com.br", perfil: "recrutador" } });
    const { cadastrarEmpresa } = await import("../lib/empresa");
    empresa = (await cadastrarEmpresa(db, REC, { nome: "Quasar Dados", site: "https://quasar.com.br", cnpj: "11.222.333/0001-81", emailContato: "vagas@quasar.com.br" })).id;
  });
  afterAll(async () => {
    await limpar();
    await db.$disconnect();
  });

  const publicarFicha = async (conta: ContaTeste, recibo: string | undefined, final: { resumo: string; destaques: string[] }) => {
    const { POST } = await import("../app/api/ficha/publicar/route");
    return POST(req("/api/ficha/publicar", "POST", conta, { ficha: FICHA, fichaW2: { ...final, idioma: "pt-BR" }, recibo }));
  };
  const exemplosDe = async (userId: string) => db.exemploTreino.findMany({ where: { donoHash: await donoHash(userId, segredoDoLogin()) } });

  it("consentimento: sem login 401; começa desligado", async () => {
    const { GET, POST } = await import("../app/api/conta/treino/route");
    expect((await GET(req("/api/conta/treino", "GET", null))).status).toBe(401);
    expect((await POST(req("/api/conta/treino", "POST", null, { ligar: true }))).status).toBe(401);
    const r = await GET(req("/api/conta/treino?idioma=en", "GET", cand(CAND)));
    const j = await r.json();
    expect(j.ligado).toBe(false);
    expect(j.texto).toMatch(/open AI model/);
    expect((await POST(req("/api/conta/treino", "POST", cand(CAND), { ligar: "sim" }))).status).toBe(400);
  });

  it("sem consentimento, nada é guardado", async () => {
    const recibo = await reciboFicha({ resumo: "Analista cloud com 5 anos.", destaques: ["Migrou 40 servidores"] });
    expect((await publicarFicha(cand(SEM), recibo, { resumo: "Analista cloud com 5 anos.", destaques: [] })).status).toBe(200);
    expect(await exemplosDe(SEM)).toHaveLength(0);
  });

  it("com consentimento, guarda anonimizado e sem o id da conta", async () => {
    const { POST } = await import("../app/api/conta/treino/route");
    const r = await POST(req("/api/conta/treino", "POST", cand(CAND), { ligar: true, idioma: "pt-BR" }));
    expect(await r.json()).toEqual({ ligado: true, apagados: 0 });
    const log = await db.consentLog.findFirstOrThrow({ where: { userId: CAND, tipo: "treinoIA" } });
    expect(log).toMatchObject({ versao: 1, baseLegal: "consentimento" });
    expect(log.texto).toMatch(/modelo de IA aberto/);

    const saidaIa = { resumo: "Joana é analista cloud na Nimbus Hospedagem com 5 anos.", destaques: ["Migrou 40 servidores"] };
    const recibo = await reciboFicha(saidaIa);
    expect((await publicarFicha(cand(CAND), recibo, { resumo: "Analista cloud com 5 anos em AWS.", destaques: ["Migrou 40 servidores para AWS"] })).status).toBe(200);
    const [ex] = await exemplosDe(CAND);
    expect(ex).toBeTruthy();
    expect(ex.tarefa).toBe("ficha_w2");
    expect(ex.status).toBe("pendente");
    expect(ex.corrigido).toBe(true);
    expect(ex.prova).toBe(naProva(ex.conteudoHash));
    const tudo = JSON.stringify(ex);
    for (const proibido of [CAND, "Joana", "Tavares", "joana.tavares@exemplo.com", "Nimbus"]) expect(tudo).not.toContain(proibido);
    expect(ex.entrada).toContain("[EMPRESA]");
    expect(ex.entrada).toContain("[EMAIL]");
    expect(JSON.parse(ex.saidaIa).resumo).toBe("[NOME] é analista cloud na [EMPRESA] com 5 anos.");
    expect(JSON.parse(ex.saidaFinal)).toEqual({ resumo: "Analista cloud com 5 anos em AWS.", destaques: ["Migrou 40 servidores para AWS"] });
    expect(Object.keys(ex)).not.toContain("userId");

    // Publicar de novo o mesmo conteúdo não repete o exemplo.
    await publicarFicha(cand(CAND), recibo, { resumo: "Analista cloud com 5 anos em AWS.", destaques: ["Migrou 40 servidores para AWS"] });
    expect(await exemplosDe(CAND)).toHaveLength(1);
  });

  it("sobra depois da anonimização: recusa o exemplo inteiro", async () => {
    const recibo = await reciboFicha({ resumo: "Analista cloud.", destaques: [] });
    await publicarFicha(cand(CAND), recibo, { resumo: "Analista cloud. Contato 11.9.8765.4321.0", destaques: [] });
    expect(await exemplosDe(CAND)).toHaveLength(1);
  });

  it("recibo adulterado, vencido ou de outra tarefa não vale", async () => {
    const recibo = await reciboFicha({ resumo: "Outro resumo.", destaques: [] });
    const [corpo, sig] = recibo.split(".");
    const outro = Buffer.from(JSON.stringify({ tarefa: "ficha_w2", sistema: "x", entrada: "{}", saidaIa: { resumo: "inventado" }, x: Date.now() + 1e6 })).toString("base64url");
    expect(await lerRecibo(`${outro}.${sig}`, segredoDoLogin())).toBeNull();
    expect(await lerRecibo(`${corpo}.${sig}x`, segredoDoLogin())).toBeNull();
    expect(await lerRecibo(recibo, segredoDoLogin(), Date.now() + 8 * 864e5)).toBeNull();
    expect(await lerRecibo(recibo, "outro-segredo-com-mais-de-32-caracteres!!")).toBeNull();
    await publicarFicha(cand(CAND), `${outro}.${sig}`, { resumo: "Resumo final diferente.", destaques: [] });
    expect(await exemplosDe(CAND)).toHaveLength(1);
  });

  it("vaga: o recrutador com consentimento gera exemplo sem empresa, e-mail, site nem CNPJ", async () => {
    const { POST: consent } = await import("../app/api/conta/treino/route");
    await consent(req("/api/conta/treino", "POST", rec, { ligar: true }));
    const { SISTEMA_VAGA, sanitizarRascunho } = await import("../lib/vaga-ai");
    const entrada = "A Quasar Dados (CNPJ 11.222.333/0001-81) contrata Engenheiro de Dados Pleno. Envie CV para vagas@quasar.com.br ou veja quasar.com.br. Fale com Rita.";
    const saidaIa = sanitizarRascunho({ titulo: "Engenheiro de Dados Pleno na Quasar Dados", nivel: "Pleno", stack: ["Python"], descricaoBullets: ["Pipelines na Quasar Dados"] });
    const recibo = await assinarRecibo({ tarefa: "extract_vacancy", sistema: SISTEMA_VAGA, entrada, saidaIa }, segredoDoLogin());
    const final = sanitizarRascunho({ ...saidaIa, titulo: "Engenheiro de Dados Pleno", regime: "CLT" });
    const { POST } = await import("../app/api/vacancies/route");
    const r = await POST(req("/api/vacancies", "POST", rec, { titulo: final.titulo, nivel: "Pleno", regime: "CLT", stack: final.stack, descricaoBullets: final.descricaoBullets, treino: { recibo, final } }));
    expect(r.status).toBe(201);
    const [ex] = await exemplosDe(REC);
    expect(ex.tarefa).toBe("extract_vacancy");
    for (const proibido of ["Quasar", "quasar.com.br", "vagas@", "11.222.333", "Rita"]) expect(JSON.stringify(ex)).not.toContain(proibido);
    expect(ex.entrada).toBe("A [EMPRESA] (CNPJ [DOCUMENTO]) contrata Engenheiro de Dados Pleno. Envie CV para [EMAIL] ou veja [LINK]. Fale com [NOME].");
    expect(JSON.parse(ex.saidaFinal).regime).toBe("CLT");

    // final que não é a vaga salva: ignora
    const r2 = await POST(req("/api/vacancies", "POST", rec, { titulo: "Outra vaga", stack: ["python"], treino: { recibo, final: { ...final, titulo: "Título diferente" } } }));
    expect(r2.status).toBe(201);
    expect(await exemplosDe(REC)).toHaveLength(1);
  });

  it("ler a vaga devolve recibo só quando a IA leu (sem IA no teste: regras, sem recibo)", async () => {
    jest.resetModules();
    jest.doMock("../lib/ai", () => ({ getAiRouter: () => { throw new Error("sem IA"); } }));
    const { POST } = await import("../app/api/vacancies/ler/route");
    const r = await POST(req("/api/vacancies/ler", "POST", rec, { texto: "Engenheiro de Dados Pleno, CLT, remoto. Python e SQL no dia a dia. Benefícios: plano de saúde." }));
    const j = await r.json();
    expect(j.origem).toBe("regras");
    expect(j.recibo).toBeNull();
  });

  it("revogar apaga os exemplos da pessoa e registra a revogação", async () => {
    const { POST, GET } = await import("../app/api/conta/treino/route");
    expect((await exemplosDe(CAND)).length).toBe(1);
    const r = await POST(req("/api/conta/treino", "POST", cand(CAND), { ligar: false, idioma: "es" }));
    expect(await r.json()).toEqual({ ligado: false, apagados: 1 });
    expect(await exemplosDe(CAND)).toHaveLength(0);
    expect(await exemplosDe(REC)).toHaveLength(1);
    const ultimo = await db.consentLog.findFirstOrThrow({ where: { userId: CAND, tipo: "treinoIA" }, orderBy: { createdAt: "desc" } });
    expect(ultimo.baseLegal).toBe("revogacao");
    expect(ultimo.texto).toMatch(/Desactivé/);
    expect((await (await GET(req("/api/conta/treino", "GET", cand(CAND)))).json()).ligado).toBe(false);
    // Depois de revogar, publicar não guarda mais.
    await publicarFicha(cand(CAND), await reciboFicha({ resumo: "Novo.", destaques: [] }), { resumo: "Novo resumo.", destaques: [] });
    expect(await exemplosDe(CAND)).toHaveLength(0);
  });
});
