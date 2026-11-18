/** 2.7 Tradução automática no banco de verdade: grava, reaproveita o idioma original, invalida ao editar. */
import type { PrismaClient } from "@prisma/client";
import type { ChatTraducaoFn } from "../lib/traducao";

function localDb(url: string | undefined): boolean {
  try {
    return !!url && ["localhost", "127.0.0.1"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}
const describeDb = localDb(process.env.DATABASE_URL) ? describe : describe.skip;

const DONO = "trv-teste-dono";

describeDb("tradução de vagas (2.7a)", () => {
  let db: PrismaClient;
  let vaga = "";
  const pedidos: string[] = [];
  const TRAD: Record<string, any> = {
    en: { titulo: "Senior Developer", descricaoBullets: ["5 years of experience"], beneficios: ["Health insurance"] },
    es: { titulo: "Desarrolladora Sénior", descricaoBullets: ["5 años de experiencia"], beneficios: ["Seguro médico"] },
  };
  const chat: ChatTraducaoFn = async (_t, req) => {
    const alvo = /into (\w+)/.exec(req.messages[0].content)![1];
    const idioma = alvo === "English" ? "en" : alvo === "Spanish" ? "es" : "pt-BR";
    pedidos.push(idioma);
    const entrada = JSON.parse(req.messages[1].content);
    return { text: JSON.stringify({ origem: "pt-BR", campos: idioma === "pt-BR" ? entrada : TRAD[idioma] }) };
  };

  const limpar = async () => {
    const m = await db.companyMember.findMany({ where: { userId: DONO }, select: { companyId: true } });
    await db.vacancy.deleteMany({ where: { companyId: { in: m.map((x) => x.companyId) } } });
    await db.companyProfile.deleteMany({ where: { id: { in: m.map((x) => x.companyId) } } });
    await db.user.deleteMany({ where: { id: DONO } });
  };

  beforeAll(async () => {
    const { createPrismaClient } = await import("../lib/prisma");
    db = createPrismaClient(process.env.DATABASE_URL!);
    await limpar();
    await db.user.create({ data: { id: DONO, name: "Rita", email: `${DONO}@exemplo.com`, perfil: "recrutador" } });
    const { cadastrarEmpresa } = await import("../lib/empresa");
    const empresa = (await cadastrarEmpresa(db, DONO, { nome: "Acme TRV", site: null, cnpj: null, emailContato: null })).id;
    vaga = (
      await db.vacancy.create({
        data: { companyId: empresa, titulo: "Desenvolvedora Sênior", descricaoBullets: ["5 anos de experiência"], beneficios: ["Plano de saúde"], stack: [] as any, status: "ativa", expiresAt: new Date(Date.now() + 30 * 864e5) },
      })
    ).id;
  });
  afterAll(async () => {
    await limpar();
    await db.$disconnect();
  });

  it("traduz para inglês e espanhol; o português original não gasta IA", async () => {
    const { traduzirVaga, traducoesDasVagas, vagasSemTraducao } = await import("../lib/traducao");
    expect(await vagasSemTraducao(db, [vaga])).toEqual([vaga]);
    const r = await traduzirVaga(db, vaga, chat);
    expect(r).toMatchObject({ traduzidas: 2, mesmoIdioma: 1, falhas: 0 });
    expect(pedidos).toEqual(["en", "es"]);
    expect(await vagasSemTraducao(db, [vaga])).toEqual([]);
    expect((await traducoesDasVagas(db, [vaga], "en")).get(vaga)).toMatchObject({ ...TRAD.en, idiomaOrigem: "pt-BR" });
    expect((await traducoesDasVagas(db, [vaga], "pt-BR")).has(vaga)).toBe(false);
    // Nada a fazer: não chama a IA de novo.
    await traduzirVaga(db, vaga, chat);
    expect(pedidos.length).toBe(2);
  });

  it("editar o texto invalida a tradução até traduzir de novo", async () => {
    const { traduzirPendentes, traducoesDasVagas } = await import("../lib/traducao");
    await db.vacancy.update({ where: { id: vaga }, data: { titulo: "Desenvolvedora Sênior Java" } });
    expect((await traducoesDasVagas(db, [vaga], "en")).has(vaga)).toBe(false);
    const r = await traduzirPendentes(db, chat, 30);
    expect(r.vagas).toBeGreaterThanOrEqual(1);
    expect(await db.traducao.count({ where: { vacancyId: vaga } })).toBe(3);
  });

  it("apagar a vaga apaga as traduções", async () => {
    await db.vacancy.delete({ where: { id: vaga } });
    expect(await db.traducao.count({ where: { vacancyId: vaga } })).toBe(0);
  });
});
