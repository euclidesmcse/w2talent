// 2.1c: revisor de viés (regras fixas PT/EN/ES, só avisa).
import { aplicarTroca, revisarVies } from "@/lib/vaga-vies";

const regras = (texto: string) => revisarVies({ descricao: texto }).map((a) => a.regra);

describe("revisor de viés — regras", () => {
  it("idade", () => {
    expect(regras("Buscamos pessoa jovem e dinâmica")).toEqual(["jovem"]);
    expect(regras("Idade entre 20 e 35 anos")).toEqual(["idade-limite"]);
    expect(regras("Candidatos de 18 a 30 anos")).toEqual(["faixa-idade"]);
    expect(regras("Perfil nativo digital")).toEqual(["nativo-digital"]);
    expect(regras("We want a young and energetic team member")).toEqual(["jovem"]);
    expect(regras("Buscamos persona joven")).toEqual(["jovem"]);
  });

  it("não confunde experiência nem programa de aprendiz com idade", () => {
    expect(regras("De 3 a 5 anos de experiência com Java")).toEqual([]);
    expect(regras("5 anos de experiência")).toEqual([]);
    expect(regras("Programa Jovem Aprendiz")).toEqual([]);
    expect(regras("Experiência com fotografia de produto")).toEqual([]);
    expect(regras("Salário atrativo, attractive package")).toEqual([]);
  });

  it("gênero, aparência, origem, família, saúde e religião", () => {
    expect(regras("Vaga para o sexo masculino")).toEqual(["sexo"]);
    expect(regras("Apenas mulheres")).toEqual(["so-homens"]);
    expect(regras("Boa aparência")).toEqual(["boa-aparencia"]);
    expect(regras("Enviar currículo com foto")).toEqual(["foto"]);
    expect(regras("Inglês nativo")).toEqual(["nativo"]);
    expect(regras("Native English speaker")).toEqual(["nativo"]);
    expect(regras("Hablante nativo de inglés")).toEqual(["nativo"]);
    expect(regras("Preferência por solteiros, sem filhos")).toEqual(["solteiro", "sem-filhos"]);
    expect(regras("Estado civil: indiferente")).toEqual(["estado-civil"]);
    expect(regras("Ter boa saúde")).toEqual(["boa-saude"]);
    expect(regras("Ser evangélico")).toEqual(["religiao"]);
    expect(regras("Top salesman wanted")).toEqual(["salesman"]);
  });

  it("frase de inclusão não gera aviso", () => {
    expect(regras("Contratamos sem distinção de idade, gênero, religião ou estado civil.")).toEqual([]);
    expect(regras("We hire regardless of age, religion or marital status.")).toEqual([]);
    expect(regras("Valorizamos a diversidade\nBuscamos pessoa jovem")).toEqual(["jovem"]);
  });

  it("aponta o campo e a posição de cada trecho", () => {
    const a = revisarVies({ titulo: "Vendedora jovem", descricao: "Ok", beneficios: "Plano de saúde" });
    expect(a).toEqual([{ regra: "jovem", categoria: "idade", campo: "titulo", trecho: "jovem", inicio: 10, troca: "" }]);
  });
});

describe("revisor de viés — trocar", () => {
  it("tira o trecho sem deixar espaço nem vírgula sobrando", () => {
    const t = "Buscamos pessoa jovem, proativa e organizada";
    const [a] = revisarVies({ descricao: t });
    expect(aplicarTroca(t, a)).toBe("Buscamos pessoa, proativa e organizada");
  });

  it("troca pelo texto sugerido", () => {
    const t = "Boa aparência e boa comunicação";
    const [a] = revisarVies({ descricao: t });
    expect(aplicarTroca(t, a)).toBe("postura profissional e boa comunicação");
  });

  it("sem sugestão, ou com o trecho já editado, devolve igual", () => {
    const t = "Inglês nativo";
    const [a] = revisarVies({ descricao: t });
    expect(aplicarTroca(t, a)).toBe(t);
    expect(aplicarTroca("Outro texto", { trecho: "jovem", inicio: 0, troca: "" })).toBe("Outro texto");
  });
});
