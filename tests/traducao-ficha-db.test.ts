/** 2.7b Tradução da Ficha W2 no banco de verdade, com uma IA falsa. Só roda num Postgres local. */
import type { PrismaClient } from "@prisma/client";
import type { ChatRequest } from "../lib/ai/types";

jest.mock("../lib/background", () => ({ runInBackground: () => undefined }));

function localDb(url: string | undefined): boolean {
  try {
    return !!url && ["localhost", "127.0.0.1"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}
const describeDb = localDb(process.env.DATABASE_URL) ? describe : describe.skip;

const ATIVA = "trf-teste-ativa";
const ARQUIVADA = "trf-teste-arquivada";
const IDS = [ATIVA, ARQUIVADA];
// Dia fixo no futuro: o limite diário da tradução não se mistura com o de hoje.
const DIA = new Date("2099-03-10T12:00:00Z");

/** IA falsa: "traduz" pondo o idioma na frente de cada texto e diz que o original é pt-BR. */
function iaFalsa() {
  const pedidos: { task: string; alvo: string; conteudo: string }[] = [];
  const chat = async (task: "translate_profile", req: ChatRequest) => {
    const system = req.messages[0].content;
    const alvo = /into English/.test(system) ? "EN" : /into Spanish/.test(system) ? "ES" : "PT";
    const conteudo = req.messages[1].content;
    pedidos.push({ task, alvo, conteudo });
    if (alvo === "PT") return { text: JSON.stringify({ origem: "pt-BR", campos: JSON.parse(conteudo) }), model: "falso" };
    const t = (s: string) => (s ? `${alvo}: ${s}` : s);
    const c = JSON.parse(conteudo) as Record<string, string | string[]>;
    const campos = Object.fromEntries(Object.entries(c).map(([k, v]) => [k, Array.isArray(v) ? v.map(t) : t(v)]));
    return { text: JSON.stringify({ origem: "pt-BR", campos }), model: "falso" };
  };
  return { chat, pedidos };
}

describeDb("tradução da Ficha W2 (2.7b)", () => {
  let db: PrismaClient;

  const limpar = async () => {
    await db.candidateProfile.deleteMany({ where: { id: { in: IDS } } });
    const { chaveUso } = await import("../lib/uso-diario");
    await db.$executeRaw`DELETE FROM "UsoDiario" WHERE "chave" = ${await chaveUso("traducao", "geral")} AND "dia" = ${DIA.toISOString().slice(0, 10)}`;
  };

  beforeAll(async () => {
    const { createPrismaClient } = await import("../lib/prisma");
    db = createPrismaClient(process.env.DATABASE_URL!);
    await limpar();
    const futuro = new Date(DIA.getTime() + 90 * 864e5);
    const base = {
      email: "ana.trf@exemplo.com",
      localidade: "Recife",
      stack: [{ skillId: "python", anos: 5 }] as any,
      experiencias: [
        { cargo: "Engenheira de Dados Sênior", empresa: "Acme Dados", inicio: "2020-01", fim: "", atual: true },
        { cargo: "Analista de BI", empresa: "Beta", inicio: "2016-03", fim: "2019-12", atual: false },
      ] as any,
      fichaW2: {
        resumo: "Ana Souza tem 8 anos com Python e pipelines.",
        destaques: ["Migrou 40 rotinas para a nuvem", "Contato: ana.trf@exemplo.com"],
        idioma: "pt-BR",
        geradaEm: "2099-03-01T00:00:00Z",
        editada: false,
      } as any,
      resumo3linhas: "Ana Souza tem 8 anos com Python e pipelines.",
      expiresAt: futuro,
      idiomaOriginal: "pt-BR",
    };
    await db.candidateProfile.create({ data: { id: ARQUIVADA, userId: ARQUIVADA, nome: "Ana Souza", titulo: "Analista", status: "arquivado", ...base } as any });
    await db.candidateProfile.create({ data: { id: ATIVA, userId: ATIVA, nome: "Ana Souza", titulo: "Engenheira de Dados", ...base } as any });
  });
  afterAll(async () => {
    await limpar();
    await db.$disconnect();
  });

  it("traduz para inglês e espanhol, sem nome nem contato na IA; o português fica sem conteúdo", async () => {
    const { fichasSemTraducao, traduzirFicha, traducoesDasFichas } = await import("../lib/traducao");
    expect(await fichasSemTraducao(db, [ATIVA])).toEqual([ATIVA]);
    const ia = iaFalsa();
    const r = await traduzirFicha(db, ATIVA, ia.chat, DIA);
    expect(r).toEqual({ traduzidas: 2, mesmoIdioma: 1, falhas: 0, semLimite: false });
    // O português (original) não chama a IA: o primeiro pedido já disse a origem.
    expect(ia.pedidos.map((p) => [p.task, p.alvo])).toEqual([["translate_profile", "EN"], ["translate_profile", "ES"]]);
    for (const p of ia.pedidos) {
      expect(p.conteudo).not.toMatch(/\bAna\b|Souza|ana\.trf|Acme|Recife/);
      expect(p.conteudo).toContain("[NOME");
      expect(p.conteudo).toContain("Python");
    }

    const en = (await traducoesDasFichas(db, [ATIVA], "en")).get(ATIVA)!;
    expect(en).toEqual({
      titulo: "EN: Engenheira de Dados",
      resumo: "EN: Ana Souza tem 8 anos com Python e pipelines.",
      destaques: ["EN: Migrou 40 rotinas para a nuvem", "Contato: ana.trf@exemplo.com"],
      cargos: ["EN: Engenheira de Dados Sênior", "EN: Analista de BI"],
      idiomaOrigem: "pt-BR",
    });
    expect((await traducoesDasFichas(db, [ATIVA], "es")).get(ATIVA)?.titulo).toBe("ES: Engenheira de Dados");
    // Já em português: nada a trocar na tela.
    expect((await traducoesDasFichas(db, [ATIVA], "pt-BR")).size).toBe(0);
    const linhas = await db.traducao.findMany({ where: { candidateId: ATIVA }, orderBy: { idioma: "asc" } });
    expect(linhas.map((l) => [l.idioma, l.idiomaOrigem, l.conteudo === null, l.modelo])).toEqual([
      ["en", "pt-BR", false, "falso"],
      ["es", "pt-BR", false, "falso"],
      ["pt-BR", "pt-BR", true, null],
    ]);
    expect(await fichasSemTraducao(db, [ATIVA])).toEqual([]);

    // Pedir de novo não gasta IA.
    const outra = iaFalsa();
    expect(await traduzirFicha(db, ATIVA, outra.chat, DIA)).toEqual({ traduzidas: 0, mesmoIdioma: 0, falhas: 0, semLimite: false });
    expect(outra.pedidos).toHaveLength(0);
  });

  it("IA que mexe no marcador do nome tem a tradução descartada", async () => {
    const { traduzirFicha } = await import("../lib/traducao");
    await db.traducao.deleteMany({ where: { candidateId: ARQUIVADA } });
    const chat = async (_t: "translate_profile", req: ChatRequest) => {
      const c = JSON.parse(req.messages[1].content);
      return { text: JSON.stringify({ origem: "pt-BR", campos: { ...c, resumo: String(c.resumo).replace(/\[NOME\d\]/g, "Fulano") } }) };
    };
    const r = await traduzirFicha(db, ARQUIVADA, chat, DIA);
    expect(r.falhas).toBe(2);
    expect(await db.traducao.count({ where: { candidateId: ARQUIVADA, conteudo: { not: null as any } } })).toBe(0);
  });

  it("texto mudou: a tradução antiga deixa de valer e o Cron refaz só as fichas publicadas", async () => {
    const { fichasSemTraducao, traducoesDasFichas, traduzirFichasPendentes } = await import("../lib/traducao");
    await db.candidateProfile.update({ where: { id: ATIVA }, data: { titulo: "Engenheira de Dados Pleno" } });
    expect((await traducoesDasFichas(db, [ATIVA], "en")).size).toBe(0);
    expect(await fichasSemTraducao(db, IDS)).toEqual(IDS);

    // A arquivada é a mais recente, mas não está publicada: o Cron (limite 1) pega a ativa.
    await db.candidateProfile.update({ where: { id: ARQUIVADA }, data: { titulo: "Analista Sênior" } });
    const ia = iaFalsa();
    const r = await traduzirFichasPendentes(db, ia.chat, 1, DIA);
    expect(r).toMatchObject({ fichas: 1, traduzidas: 2, falhas: 0 });
    expect((await traducoesDasFichas(db, [ATIVA], "en")).get(ATIVA)?.titulo).toBe("EN: Engenheira de Dados Pleno");
    expect(await fichasSemTraducao(db, IDS)).toEqual([ARQUIVADA]);
  });

  it("a busca e as rotas recebem a tradução no idioma de quem vê", async () => {
    const { comTraducaoDasFichas } = await import("../lib/traducao");
    const itens = [{ id: ATIVA, titulo: "x" }, { id: "nao-existe" }, { titulo: "sem id" }];
    const out = await comTraducaoDasFichas(db, itens, "es");
    expect(out[0].traducao?.titulo).toBe("ES: Engenheira de Dados Pleno");
    expect(out.slice(1)).toEqual(itens.slice(1));
    expect(await comTraducaoDasFichas(db, itens, "pt-BR")).toBe(itens);
    // Banco fora do ar: os itens voltam como estavam.
    const quebrado = { candidateProfile: { findMany: async () => { throw new Error("fora"); } } } as any;
    expect(await comTraducaoDasFichas(quebrado, itens, "en")).toBe(itens);
  });

  it("limite diário de traduções vale também para as fichas", async () => {
    const { traduzirFicha, LIMITE_TRADUCOES_DIA } = await import("../lib/traducao");
    const { chaveUso } = await import("../lib/uso-diario");
    const dia = DIA.toISOString().slice(0, 10);
    await db.$executeRaw`UPDATE "UsoDiario" SET "total" = ${LIMITE_TRADUCOES_DIA} WHERE "chave" = ${await chaveUso("traducao", "geral")} AND "dia" = ${dia}`;
    await db.candidateProfile.update({ where: { id: ATIVA }, data: { titulo: "Engenheira de Dados Sênior" } });
    const ia = iaFalsa();
    const r = await traduzirFicha(db, ATIVA, ia.chat, DIA);
    expect(r.semLimite).toBe(true);
    expect(ia.pedidos).toHaveLength(0);
  });
});
