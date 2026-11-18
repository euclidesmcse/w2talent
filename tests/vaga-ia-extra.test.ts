// 2.1c: reescrita sem viés e perguntas de entrevista (IA falsa; sem rede).
import { gerarPerguntas, perguntasPorModelo, reescreverSemVies, sanitizarPerguntas, type ChatExtraFn } from "@/lib/vaga-ia-extra";
import { rascunhoVazio } from "@/lib/vaga-campos";

const resposta = (obj: unknown): ChatExtraFn => async () => ({ text: JSON.stringify(obj) });

describe("reescrita sem viés", () => {
  const texto = { titulo: "Vendedor", descricaoBullets: ["Buscamos pessoa jovem", "Falar com clientes"], beneficios: ["VR"] };

  it("devolve a proposta e quantos termos ainda sobram; manda os termos apontados", async () => {
    let enviado = "";
    const chat: ChatExtraFn = async (task, r) => {
      expect(task).toBe("review_bias");
      enviado = r.messages[1].content;
      return { text: JSON.stringify({ titulo: "Vendedor", descricaoBullets: ["Buscamos pessoa proativa", "Falar com clientes"], beneficios: ["VR"] }) };
    };
    const p = await reescreverSemVies(texto, chat);
    expect(JSON.parse(enviado).termos).toEqual(["jovem"]);
    expect(p).toEqual({ titulo: "Vendedor", descricaoBullets: ["Buscamos pessoa proativa", "Falar com clientes"], beneficios: ["VR"], restantes: 0 });
  });

  it("lista vazia ou título vazio da IA não apaga o texto do recrutador", async () => {
    const p = await reescreverSemVies(texto, resposta({ titulo: "", descricaoBullets: ["Pessoa proativa"], beneficios: [] }));
    expect(p?.titulo).toBe("Vendedor");
    expect(p?.beneficios).toEqual(["VR"]);
  });

  it("IA quebrada, sem JSON ou sem mudança: null", async () => {
    expect(await reescreverSemVies(texto, async () => { throw new Error("x"); })).toBeNull();
    expect(await reescreverSemVies(texto, async () => ({ text: "oi" }))).toBeNull();
    expect(await reescreverSemVies(texto, resposta(texto))).toBeNull();
  });
});

describe("perguntas de entrevista", () => {
  const vaga = { ...rascunhoVazio(), titulo: "Dev", stack: ["react", "typescript"], descricaoBullets: ["Manter o front-end"] };

  it("tira pergunta que cai no revisor de viés, repetida ou curta", () => {
    const p = sanitizarPerguntas([
      { competencia: "React", pergunta: "Conte um projeto com React.", observar: "Exemplo concreto" },
      { competencia: "", pergunta: "Você é casado ou solteiro?", observar: "" },
      { competencia: "React", pergunta: "Conte um projeto com React.", observar: "x" },
      { pergunta: "Oi?" },
      "lixo",
    ]);
    expect(p.map((x) => x.pergunta)).toEqual(["Conte um projeto com React."]);
  });

  it("IA com perguntas boas: origem ia, no idioma pedido", async () => {
    let sys = "";
    const chat: ChatExtraFn = async (_t, r) => {
      sys = r.messages[0].content;
      return { text: JSON.stringify({ perguntas: [1, 2, 3].map((n) => ({ competencia: "React", pergunta: `Pergunta número ${n} sobre React?`, observar: "Exemplo" })) }) };
    };
    const r = await gerarPerguntas(vaga, "es", chat);
    expect(r.origem).toBe("ia");
    expect(r.perguntas).toHaveLength(3);
    expect(sys).toContain("Spanish");
  });

  it("sem IA ou com poucas perguntas: modelos fixos", async () => {
    expect((await gerarPerguntas(vaga, "pt-BR", null)).origem).toBe("regras");
    expect((await gerarPerguntas(vaga, "pt-BR", resposta({ perguntas: [] }))).origem).toBe("regras");
    const m = perguntasPorModelo(vaga, "pt-BR");
    expect(m.map((x) => x.competencia)).toEqual(["React", "TypeScript", "Manter o front-end", ""]);
    expect(m[0].pergunta).toContain("React");
  });
});
