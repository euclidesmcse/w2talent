/** 2.7 Tradução automática: regras sem banco e a chamada à IA com um chat falso. */
import { hashCampos, numeros, protegidosDaVaga, traducaoValida, traduzirCampos, type ChatTraducaoFn } from "../lib/traducao";

const VAGA = { titulo: "Desenvolvedora React Sênior", descricaoBullets: ["5 anos com React e TypeScript", "Salário de R$ 8.000"], beneficios: ["Plano de saúde"] };
const EN = { titulo: "Senior React Developer", descricaoBullets: ["5 years with React and TypeScript", "Salary of R$ 8,000"], beneficios: ["Health insurance"] };

const chatQue = (resposta: unknown, vistos: unknown[] = []): ChatTraducaoFn => async (_t, req) => {
  vistos.push(JSON.parse(req.messages[1].content));
  return { text: JSON.stringify(resposta), model: "falso" };
};

describe("regras", () => {
  it("hash não depende da ordem das chaves e muda com o texto", async () => {
    expect(await hashCampos({ a: "x", b: ["y"] })).toBe(await hashCampos({ b: ["y"], a: "x" }));
    expect(await hashCampos({ a: "x" })).not.toBe(await hashCampos({ a: "x " }));
  });
  it("números iguais com separadores diferentes", () => {
    expect(numeros("R$ 8.000,50 e 5 anos")).toEqual(numeros("5 years and R$ 8,000.50"));
  });
  it("aceita a tradução boa e recusa a que muda números, itens ou tecnologia", () => {
    const prot = protegidosDaVaga(["react", { skillId: "typescript" }]);
    expect(prot).toEqual(["React", "TypeScript"]);
    expect(traducaoValida(VAGA, EN, prot)).toBe(true);
    expect(traducaoValida(VAGA, { ...EN, descricaoBullets: ["6 years with React and TypeScript", EN.descricaoBullets[1]] }, prot)).toBe(false);
    expect(traducaoValida(VAGA, { ...EN, beneficios: [] }, prot)).toBe(false);
    expect(traducaoValida(VAGA, { ...EN, descricaoBullets: ["5 years with Vue and TypeScript", EN.descricaoBullets[1]] }, prot)).toBe(false);
    expect(traducaoValida(VAGA, { ...EN, titulo: "" }, prot)).toBe(false);
  });
});

describe("traduzirCampos", () => {
  it("devolve a tradução e o idioma original", async () => {
    const r = await traduzirCampos(VAGA, "en", chatQue({ origem: "pt-BR", campos: EN }), ["React"]);
    expect(r).toEqual({ origem: "pt-BR", campos: EN, modelo: "falso" });
  });
  it("texto já no idioma de destino não guarda cópia", async () => {
    expect(await traduzirCampos(EN, "en", chatQue({ origem: "en", campos: EN }))).toEqual({ origem: "en", campos: null, modelo: "falso" });
  });
  it("item com contato não vai para a IA e volta como estava", async () => {
    const vistos: any[] = [];
    const c = { titulo: "Analista", descricaoBullets: ["Atendimento ao cliente", "Dúvidas: rh@acme.com"], beneficios: [] };
    const r = await traduzirCampos(c, "en", chatQue({ origem: "pt-BR", campos: { titulo: "Analyst", descricaoBullets: ["Customer service", ""], beneficios: [] } }, vistos));
    expect(JSON.stringify(vistos)).not.toContain("rh@acme.com");
    expect(r?.campos).toEqual({ titulo: "Analyst", descricaoBullets: ["Customer service", "Dúvidas: rh@acme.com"], beneficios: [] });
  });
  it("resposta quebrada ou que não passa nas conferências vira null", async () => {
    expect(await traduzirCampos(VAGA, "en", async () => ({ text: "não é json" }))).toBeNull();
    expect(await traduzirCampos(VAGA, "en", chatQue({ origem: "pt-BR", campos: { ...EN, beneficios: "x" } }))).toBeNull();
    expect(await traduzirCampos(VAGA, "en", async () => { throw new Error("fora"); })).toBeNull();
  });
});
