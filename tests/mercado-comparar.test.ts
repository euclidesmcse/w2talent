/** 3.2b: comparar um valor com o mercado (painel, Publicar, Painel RH). Contas sem banco. */
import { grupoDaVaga, type Demanda, type GrupoFaixa, type MercadoDoGrupo } from "../lib/mercado";
import { faixaDaPretensao, faixaDasVagas, posicaoNaFaixa, valorDaVaga } from "../lib/mercado-tela";
import { gruposDaFicha, montarPainelMercado } from "../lib/painel-mercado";

describe("posicaoNaFaixa", () => {
  const f = { de: 10000, ate: 15000 };
  it("abaixo, dentro (pontas incluídas) e acima", () => {
    expect(posicaoNaFaixa(9999, f)).toBe("abaixo");
    expect(posicaoNaFaixa(10000, f)).toBe("dentro");
    expect(posicaoNaFaixa(12500, f)).toBe("dentro");
    expect(posicaoNaFaixa(15000, f)).toBe("dentro");
    expect(posicaoNaFaixa(15001, f)).toBe("acima");
  });
  it("sem valor, valor inválido, sem faixa ou faixa invertida = null", () => {
    expect(posicaoNaFaixa(null, f)).toBeNull();
    expect(posicaoNaFaixa(0, f)).toBeNull();
    expect(posicaoNaFaixa(-5, f)).toBeNull();
    expect(posicaoNaFaixa(NaN, f)).toBeNull();
    expect(posicaoNaFaixa(12000, null)).toBeNull();
    expect(posicaoNaFaixa(12000, { de: 15000, ate: 10000 })).toBeNull();
  });
  it("faixa de um ponto só", () => {
    expect(posicaoNaFaixa(10000, { de: 10000, ate: 10000 })).toBe("dentro");
  });
});

describe("faixaDasVagas e faixaDaPretensao", () => {
  const g = (de: GrupoFaixa["de"], ate: GrupoFaixa["ate"]) => ({ de, ate });
  it("vagas: do 'de' mediano ao 'até' mediano, com o meio entre os dois", () => {
    expect(faixaDasVagas(g({ p25: 8000, p50: 9000, p75: 10000 }, { p25: 12000, p50: 14000, p75: 16000 }))).toEqual({ de: 9000, ate: 14000, mediana: 11500 });
  });
  it("vagas: grupo abaixo do mínimo (sem números) = null", () => {
    expect(faixaDasVagas(g(null, null))).toBeNull();
    expect(faixaDasVagas(g({ p25: 1, p50: 2, p75: 3 }, null))).toBeNull();
    expect(faixaDasVagas(null)).toBeNull();
  });
  it("vagas: 'até' mediano menor que o 'de' mediano não inverte a faixa", () => {
    expect(faixaDasVagas(g({ p25: 9000, p50: 10000, p75: 11000 }, { p25: 8000, p50: 9000, p75: 12000 }))).toEqual({ de: 10000, ate: 10000, mediana: 10000 });
  });
  it("pretensão: a metade do meio (25%–75%) e a mediana; sem números = null", () => {
    expect(faixaDaPretensao({ p25: 11000, p50: 13000, p75: 15000 })).toEqual({ de: 11000, ate: 15000, mediana: 13000 });
    expect(faixaDaPretensao(null)).toBeNull();
  });
});

describe("valorDaVaga", () => {
  it("o meio da faixa; com uma ponta só, essa ponta", () => {
    expect(valorDaVaga(10000, 14000)).toBe(12000);
    expect(valorDaVaga(null, 14000)).toBe(14000);
    expect(valorDaVaga(10000, null)).toBe(10000);
  });
  it("sem faixa ou faixa invertida = null", () => {
    expect(valorDaVaga(null, null)).toBeNull();
    expect(valorDaVaga(0, 0)).toBeNull();
    expect(valorDaVaga(15000, 10000)).toBeNull();
  });
});

describe("grupoDaVaga", () => {
  it("primeira competência + nível + regime + moeda", () => {
    expect(grupoDaVaga({ stack: [{ skillId: "aws" }, { skillId: "python" }], nivel: "Pleno/Sênior", regime: "CLT ou PJ", faixaMoeda: "USD" })).toEqual({ skillId: "aws", nivel: "pleno", regime: "CLT", moeda: "USD" });
    // Rascunho do /publicar: stack em texto, moeda padrão BRL.
    expect(grupoDaVaga({ stack: ["react"], nivel: "Júnior", regime: "PJ" })).toEqual({ skillId: "react", nivel: "junior", regime: "PJ", moeda: "BRL" });
  });
  it("sem competência, nível ou regime = null", () => {
    expect(grupoDaVaga({ stack: [], nivel: "Pleno", regime: "CLT" })).toBeNull();
    expect(grupoDaVaga({ stack: ["aws"], nivel: "", regime: "CLT" })).toBeNull();
    expect(grupoDaVaga({ stack: ["aws"], nivel: "Pleno", regime: null })).toBeNull();
  });
});

describe("painel: pretensão e o mercado", () => {
  const ficha = {
    stack: [{ skillId: "go" }, { skillId: "aws" }, { skillId: "terraform" }],
    senioridade: "pleno",
    pretensoes: [
      { regime: "CLT", valor: 9000, unidade: "mes", moeda: "BRL" },
      { regime: "PJ", valor: 20000, unidade: "mes", moeda: "BRL" },
      { regime: "Freelancer", valor: 150, unidade: "hora", moeda: "BRL" },
    ],
  };
  const faixa = (de: number, ate: number) => ({ de: { p25: de - 1000, p50: de, p75: de + 1000 }, ate: { p25: ate - 1000, p50: ate, p75: ate + 1000 } });
  const grupo = (skillId: string, regime: string, publicavel: boolean, de = 10000, ate = 15000): MercadoDoGrupo => ({
    skillId,
    nivel: "pleno",
    regime,
    moeda: "BRL",
    vagas: { skillId, nivel: "pleno", regime, modo: "", moeda: "BRL", n: publicavel ? 12 : 4, nEmpresas: 3, ...(publicavel ? faixa(de, ate) : { de: null, ate: null }), faltam: { registros: publicavel ? 0 : 6, empresas: 0 } },
    pretensao: null,
  });
  const alta = (ids: string[]): Demanda[] => ids.map((skillId) => ({ skillId, vagas: 8, empresas: 3, recentes: 6, anteriores: 2, fichas: 4 }));

  it("lê os grupos de cada competência × pretensão mensal (a por hora fica fora)", () => {
    expect(gruposDaFicha(ficha)).toEqual([
      { skillId: "go", nivel: "pleno", regime: "CLT", moeda: "BRL" },
      { skillId: "go", nivel: "pleno", regime: "PJ", moeda: "BRL" },
      { skillId: "aws", nivel: "pleno", regime: "CLT", moeda: "BRL" },
      { skillId: "aws", nivel: "pleno", regime: "PJ", moeda: "BRL" },
      { skillId: "terraform", nivel: "pleno", regime: "CLT", moeda: "BRL" },
      { skillId: "terraform", nivel: "pleno", regime: "PJ", moeda: "BRL" },
    ]);
    expect(gruposDaFicha({ ...ficha, senioridade: null })).toEqual([]);
  });

  it("competência principal = a primeira do stack com faixa publicável; compara cada pretensão", () => {
    const grupos = [grupo("go", "CLT", false), grupo("go", "PJ", false), grupo("aws", "CLT", true, 10000, 15000), grupo("aws", "PJ", true, 14000, 18000), grupo("terraform", "CLT", true)];
    const r = montarPainelMercado(ficha, "2026-11-16", grupos, alta(["terraform", "kubernetes"]), (s) => s.toUpperCase());
    expect(r.principal).toEqual({
      skillId: "aws",
      label: "AWS",
      nivel: "pleno",
      comparacoes: [
        { regime: "CLT", moeda: "BRL", valor: 9000, faixa: { de: 10000, ate: 15000, mediana: 12500 }, posicao: "abaixo" },
        { regime: "PJ", moeda: "BRL", valor: 20000, faixa: { de: 14000, ate: 18000, mediana: 16000 }, posicao: "acima" },
      ],
    });
    expect(r.semPretensao).toBe(false);
    expect(r.emAlta).toEqual([
      { skillId: "terraform", label: "TERRAFORM", tem: true },
      { skillId: "kubernetes", label: "KUBERNETES", tem: false },
    ]);
  });

  it("sem grupo publicável: principal null (Ainda poucos dados); em alta até 5", () => {
    const r = montarPainelMercado(ficha, "2026-11-16", [grupo("aws", "CLT", false)], alta(["a", "b", "c", "d", "e", "f"]));
    expect(r.principal).toBeNull();
    expect(r.emAlta).toHaveLength(5);
  });

  it("sem pretensão mensal ou sem nível: semPretensao", () => {
    expect(montarPainelMercado({ ...ficha, pretensoes: [] }, null, [], []).semPretensao).toBe(true);
    expect(montarPainelMercado({ ...ficha, senioridade: "x" }, null, [grupo("aws", "CLT", true)], []).principal).toBeNull();
  });
});
