/** 2.7b Tradução da Ficha W2: o que vai para a IA, o nome trocado por marcadores e a troca na tela. */
import { idiomaDoPedido, lerTextoFicha, marcadoresDoNome, textoDaFicha, traducaoValida, trocarNome } from "../lib/traducao";
import { aplicarTraducaoFicha, tituloDaFicha } from "../components/traducao-ficha";
import { TASKS } from "../lib/ai/tasks";

const perfil = {
  id: "c1",
  nome: "Ana Souza",
  titulo: "Engenheira de Dados",
  resumo3linhas: "Resumo antigo",
  fichaW2: { resumo: "Engenheira com 8 anos em pipelines.", destaques: ["Migrou 40 jobs para AWS", "Lidera 3 pessoas"], idioma: "pt-BR", editada: false },
  experiencias: [
    { cargo: "Engenheira de Dados Sênior", empresa: "Acme", inicio: "2020-01", fim: "", atual: true },
    { titulo: "Analista de BI", empresa: "Beta", inicio: "2016-03", fim: "2019-12", atual: false },
    { empresa: "Gama", inicio: "2015-01", fim: "2016-01", atual: false },
  ],
  email: "ana@exemplo.com",
  localidade: "São Paulo",
};

describe("textoDaFicha", () => {
  it("leva título, resumo da Ficha W2, destaques e um cargo por experiência; nunca nome, empresa, cidade ou contato", () => {
    const t = textoDaFicha(perfil);
    expect(t).toEqual({
      titulo: "Engenheira de Dados",
      resumo: "Engenheira com 8 anos em pipelines.",
      destaques: ["Migrou 40 jobs para AWS", "Lidera 3 pessoas"],
      cargos: ["Engenheira de Dados Sênior", "Analista de BI", ""],
    });
    const json = JSON.stringify(t);
    for (const fora of ["Ana Souza", "Acme", "Beta", "São Paulo", "ana@exemplo.com", "2020-01"]) expect(json).not.toContain(fora);
  });

  it("sem Ficha W2 usa o resumo3linhas; dados ruins viram listas vazias", () => {
    expect(textoDaFicha({ titulo: "SRE", resumo3linhas: "Resumo", fichaW2: null, experiencias: "x" })).toEqual({ titulo: "SRE", resumo: "Resumo", destaques: [], cargos: [] });
    expect(textoDaFicha({ titulo: "SRE" })).toEqual({ titulo: "SRE", resumo: "", destaques: [], cargos: [] });
  });

  it("lerTextoFicha normaliza o conteúdo guardado", () => {
    expect(lerTextoFicha({ titulo: "T", resumo: 3, destaques: ["a", 1], cargos: null })).toEqual({ titulo: "T", resumo: "", destaques: ["a"], cargos: [] });
    expect(lerTextoFicha(null)).toEqual({ titulo: "", resumo: "", destaques: [], cargos: [] });
  });
});

describe("nome fora da IA", () => {
  it("troca as partes do nome por marcadores e volta depois", () => {
    const pares = marcadoresDoNome("Ana Souza de Lima");
    expect(pares.map((p) => p.de).sort()).toEqual(["Ana", "Lima", "Souza"]);
    const c = { resumo: "Ana Souza lidera o time; ANA é citada. Analítica e anagrama não mudam.", lista: ["Lima"] };
    const ida = trocarNome(c, pares);
    expect(JSON.stringify(ida)).not.toMatch(/\bAna\b|Souza|Lima|ANA/);
    expect(ida.resumo).toContain("Analítica e anagrama");
    const volta = trocarNome(ida, pares, true);
    expect(volta.resumo).toBe("Ana Souza lidera o time; Ana é citada. Analítica e anagrama não mudam.");
    expect(volta.lista).toEqual(["Lima"]);
  });

  it("marcador perdido pela IA reprova a tradução (termo protegido)", () => {
    const orig = { resumo: "[NOME1] lidera o time" };
    expect(traducaoValida(orig, { resumo: "[NOME1] leads the team" }, ["[NOME1]"])).toBe(true);
    expect(traducaoValida(orig, { resumo: "Ana leads the team" }, ["[NOME1]"])).toBe(false);
  });

  it("a tarefa da ficha é de dados pessoais e a da vaga continua como era", () => {
    expect(TASKS.translate_profile).toMatchObject({ kind: "chat", personalData: true, defaultWorkersModel: TASKS.translate_content.defaultWorkersModel });
    expect("personalData" in TASKS.translate_content).toBe(false);
  });
});

describe("tela do recrutador", () => {
  const traducao = { titulo: "Data Engineer", resumo: "Engineer with 8 years in pipelines.", destaques: ["Moved 40 jobs to AWS", "Leads 3 people"], cargos: ["Senior Data Engineer", "BI Analyst", ""], idiomaOrigem: "pt-BR" };

  it("aplicarTraducaoFicha troca só os textos traduzidos", () => {
    const item = aplicarTraducaoFicha({ ...perfil, traducao });
    expect(item.titulo).toBe("Data Engineer");
    expect(item.resumo3linhas).toBe(traducao.resumo);
    expect(item.fichaW2).toMatchObject({ resumo: traducao.resumo, destaques: traducao.destaques, idioma: "pt-BR" });
    expect(item.experiencias.map((e: any) => [e.cargo, e.empresa])).toEqual([["Senior Data Engineer", "Acme"], ["BI Analyst", "Beta"], [undefined, "Gama"]]);
    expect([item.nome, item.localidade]).toEqual(["Ana Souza", "São Paulo"]);
    // o original fica intacto (os arquivos exportados usam ele)
    expect(perfil.titulo).toBe("Engenheira de Dados");
  });

  it("listas de tamanho diferente (ficha mudou) ficam no original; sem tradução nada muda", () => {
    const item = aplicarTraducaoFicha({ ...perfil, traducao: { ...traducao, destaques: ["só um"], cargos: ["x"] } });
    expect(item.fichaW2.destaques).toEqual(perfil.fichaW2.destaques);
    expect(item.experiencias).toEqual(perfil.experiencias);
    expect(aplicarTraducaoFicha(perfil)).toBe(perfil);
  });

  it("itens da comparação: resumo e destaques", () => {
    const it = aplicarTraducaoFicha({ titulo: "Engenheira", resumo: "Resumo", destaques: ["a", "b"], traducao });
    expect([it.titulo, it.resumo, it.destaques]).toEqual(["Data Engineer", traducao.resumo, traducao.destaques]);
  });

  it("tituloDaFicha prefere a tradução", () => {
    expect(tituloDaFicha({ titulo: "Engenheira", traducao })).toBe("Data Engineer");
    expect(tituloDaFicha({ titulo: "Engenheira" })).toBe("Engenheira");
    expect(tituloDaFicha(null)).toBe("");
  });

  it("idiomaDoPedido: ?lang=, depois o corpo, depois x-locale; senão pt-BR", () => {
    expect(idiomaDoPedido(new Request("https://w2.test/x?lang=es", { headers: { "x-locale": "en" } }))).toBe("es");
    expect(idiomaDoPedido(new Request("https://w2.test/x", { headers: { "x-locale": "en" } }), "es")).toBe("es");
    expect(idiomaDoPedido(new Request("https://w2.test/x", { headers: { "x-locale": "en" } }))).toBe("en");
    expect(idiomaDoPedido(new Request("https://w2.test/x?lang=fr"))).toBe("pt-BR");
  });
});

describe("Ficha W2 traduzida na tela", () => {
  it("não corta a tradução mais longa no limite de entrada", async () => {
    const { sanitizeFichaW2 } = await import("../lib/ficha");
    const resumo = "x".repeat(600);
    const destaque = "y".repeat(300);
    expect(sanitizeFichaW2({ resumo, destaques: [destaque] })?.resumo.length).toBe(420);
    const t = sanitizeFichaW2({ resumo, destaques: [destaque] }, { traduzida: true });
    expect([t?.resumo.length, t?.destaques[0].length]).toEqual([600, 300]);
  });
});
