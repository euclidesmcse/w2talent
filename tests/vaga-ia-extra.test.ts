// 2.1c: reescrita sem viés e perguntas de entrevista (IA falsa; sem rede).
import { gerarPerguntas, MAX_ITEM_REVISAR, perguntasPorModelo, reescreverSemVies, sanitizarPerguntas, textoParaRevisar, type ChatExtraFn } from "@/lib/vaga-ia-extra";
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
    const p = (await reescreverSemVies(texto, resposta({ titulo: "", descricaoBullets: ["Pessoa proativa"], beneficios: [] }))) as Exclude<Awaited<ReturnType<typeof reescreverSemVies>>, "igual">;
    expect(p?.titulo).toBe("Vendedor");
    expect(p?.beneficios).toEqual(["VR"]);
  });

  it("texto longo vai inteiro (nada de cortar em 12 itens ou 200 letras); acima do limite, recusa", async () => {
    const longo = { titulo: "Vendedor", descricaoBullets: [...Array.from({ length: 13 }, (_, i) => `Item ${i + 1}`), "Buscamos pessoa jovem"], beneficios: ["B".repeat(318)] };
    expect(textoParaRevisar(longo)).toEqual(longo);
    expect(textoParaRevisar({ ...longo, beneficios: ["x".repeat(MAX_ITEM_REVISAR + 1)] })).toBeNull();
    expect(textoParaRevisar({ ...longo, descricaoBullets: [1, 2] })).toBeNull();
    const p = (await reescreverSemVies(longo, resposta({ ...longo, descricaoBullets: longo.descricaoBullets.map((b) => b.replace("jovem", "proativa")) }))) as Exclude<Awaited<ReturnType<typeof reescreverSemVies>>, "igual">;
    expect(p?.descricaoBullets).toHaveLength(14);
    expect(p?.beneficios[0]).toHaveLength(318);
  });

  it("IA quebrada ou sem JSON: null; sem mudança: igual", async () => {
    expect(await reescreverSemVies(texto, async () => { throw new Error("x"); })).toBeNull();
    expect(await reescreverSemVies(texto, async () => ({ text: "oi" }))).toBeNull();
    expect(await reescreverSemVies(texto, resposta(texto))).toBe("igual");
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

  it("responsabilidade com viés não vira pergunta nos modelos fixos", () => {
    const m = perguntasPorModelo({ stack: [], descricaoBullets: ["Boa aparência", "Sem filhos", "Atender clientes"] }, "pt-BR");
    expect(m.map((x) => x.competencia)).toEqual(["Atender clientes", ""]);
    expect(sanitizarPerguntas(m)).toHaveLength(2);
  });
});
