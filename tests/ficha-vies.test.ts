// Revisor de viés na Ficha W2: as mesmas regras das vagas no texto livre do candidato (só avisa).
import * as fs from "fs";
import * as path from "path";
import { revisarViesFicha, trocarViesFicha } from "@/lib/ficha-vies";
import { achadosVies, revisarVies } from "@/lib/vaga-vies";

describe("revisor de viés na Ficha W2", () => {
  it("usa a mesma lista de regras das vagas", () => {
    const texto = "Jovem, casado, católico, boa aparência e inglês nativo. Idade: 28 anos.";
    const daVaga = revisarVies({ descricao: texto }).map(({ campo: _c, ...a }) => a);
    expect(revisarViesFicha({ resumo: texto }).map(({ campo: _c, indice: _i, ...a }) => a)).toEqual(daVaga);
    expect(achadosVies(texto).map((a) => a.regra)).toEqual(["jovem", "solteiro", "religiao", "boa-aparencia", "nativo", "idade-limite"]);
  });

  it("olha cargo, objetivo, resumo e cada destaque, na ordem dos campos", () => {
    const avisos = revisarViesFicha({
      titulo: "Vendedor jovem",
      objetivo: "Crescer na área comercial. Solteiro, sem filhos.",
      resumo: "Vendedor com 5 anos de experiência em B2B.",
      destaques: ["Meta batida 12 meses seguidos", "Boa aparência e comunicação"],
    });
    expect(avisos.map((a) => [a.campo, a.indice, a.regra, a.categoria])).toEqual([
      ["titulo", 0, "jovem", "idade"],
      ["objetivo", 0, "solteiro", "familia"],
      ["objetivo", 0, "sem-filhos", "familia"],
      ["destaque", 1, "boa-aparencia", "aparencia"],
    ]);
  });

  it("texto comum de candidato não gera aviso", () => {
    expect(
      revisarViesFicha({
        titulo: "Desenvolvedora Python",
        objetivo: "Trabalhar com dados em produto",
        resumo: "De 3 a 5 anos de experiência com Java. Programa Jovem Aprendiz em 2019. Inglês fluente.",
        destaques: ["Apps nativos em iOS e Android", "Fotografia de produto", ""],
      }),
    ).toEqual([]);
    expect(revisarViesFicha({})).toEqual([]);
  });

  it("frase de inclusão não gera aviso", () => {
    expect(revisarViesFicha({ resumo: "Defendo times com diversidade de idade, gênero e religião." })).toEqual([]);
  });

  it("respeita o máximo", () => {
    expect(revisarViesFicha({ resumo: "jovem jovem jovem jovem" }, 2)).toHaveLength(2);
  });

  it("troca no campo certo e não mexe nos outros", () => {
    const textos = { titulo: "Vendedor", resumo: "Salesman com boa aparência.", destaques: ["Pontual", "Católico praticante, ótimo time"] };
    const [salesman, aparencia, religiao] = revisarViesFicha(textos);
    expect(trocarViesFicha(textos, salesman).resumo).toBe("salesperson com boa aparência.");
    expect(trocarViesFicha(textos, aparencia)).toEqual({ ...textos, resumo: "Salesman com postura profissional." });
    const semReligiao = trocarViesFicha(textos, religiao);
    expect(semReligiao.destaques).toEqual(["Pontual", "praticante, ótimo time"]);
    expect(textos.destaques[1]).toBe("Católico praticante, ótimo time");
  });

  it("aviso sem troca (reescrever à mão) deixa o texto igual", () => {
    const textos = { objetivo: "Inglês nativo" };
    const [a] = revisarViesFicha(textos);
    expect(a.troca).toBeNull();
    expect(trocarViesFicha(textos, a)).toEqual(textos);
  });

  it("a tela só avisa: salvar, gerar e publicar não dependem dos avisos", () => {
    const src = fs.readFileSync(path.join(__dirname, "..", "app", "minha-ficha", "page.tsx"), "utf-8");
    expect(src).toContain("<FichaViesAviso");
    for (const linha of src.split("\n").filter((l) => /disabled=/.test(l))) expect(linha).not.toMatch(/vies|Vies/);
  });
});
