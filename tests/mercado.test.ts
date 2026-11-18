/** 3.2a Inteligência de mercado: contas sem banco. */
import { calcularMercado, emAlta, faltam, inicioDaSemana, nivelDaVaga, percentil, pretensoesMensais, publicavel, type VagaMercado } from "../lib/mercado";

const NOW = new Date("2026-11-18T12:00:00Z");
const dias = (n: number) => new Date(NOW.getTime() - n * 864e5);
const futuro = new Date(NOW.getTime() + 30 * 864e5);

function vaga(i: number, extra: Partial<VagaMercado> = {}): VagaMercado {
  return {
    companyId: `emp-${i % 4}`,
    stack: [{ skillId: "aws" }],
    nivel: "Pleno",
    regime: "CLT",
    localidade: "Remoto",
    faixaDe: 8000 + i * 100,
    faixaAte: 12000 + i * 100,
    faixaMoeda: "BRL",
    status: "ativa",
    expiresAt: futuro,
    createdAt: dias(5),
    ...extra,
  };
}

describe("contas", () => {
  it("percentil com interpolação", () => {
    expect(percentil([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(percentil([10], 0.25)).toBe(10);
    expect(percentil([1, 2, 3, 4, 5], 0.25)).toBe(2);
  });
  it("anonimato: 10 registros e 3 empresas", () => {
    expect(publicavel(9, 5)).toBe(false);
    expect(publicavel(10, 2)).toBe(false);
    expect(publicavel(10, 3)).toBe(true);
    expect(publicavel(10, null)).toBe(true);
    expect(faltam({ n: 6, nEmpresas: 1 })).toEqual({ registros: 4, empresas: 2 });
  });
  it("nível da vaga e pretensão mensal", () => {
    expect(nivelDaVaga("Sênior")).toBe("senior");
    expect(nivelDaVaga("Jr")).toBe("junior");
    expect(nivelDaVaga("qualquer")).toBeNull();
    expect(
      pretensoesMensais([
        { regime: "CLT", valor: 9000, unidade: "mes", moeda: "BRL" },
        { regime: "Freelancer", valor: 120, unidade: "hora", moeda: "BRL" },
        { regime: "PJ", valor: 0, unidade: "mes" },
      ]),
    ).toEqual([{ regime: "CLT", valor: 9000, moeda: "BRL" }]);
  });
  it("semana começa na segunda", () => {
    expect(inicioDaSemana(NOW).toISOString()).toBe("2026-11-16T00:00:00.000Z");
  });
});

describe("calcularMercado", () => {
  it("faixa por competência, nível, regime e moeda; com e sem modo", () => {
    const vagas = Array.from({ length: 12 }, (_, i) => vaga(i));
    const linhas = calcularMercado(vagas, [], [], [], NOW);
    const de = linhas.find((l) => l.metrica === "faixa_de" && l.skillId === "aws" && l.nivel === "pleno" && l.regime === "CLT" && l.modo === "" && l.moeda === "BRL")!;
    expect(de).toMatchObject({ n: 12, nEmpresas: 4 });
    expect(de.p50).toBe(8550);
    expect(linhas.some((l) => l.metrica === "faixa_ate" && l.skillId === "aws" && l.modo === "remoto")).toBe(true);
    expect(linhas.some((l) => l.metrica === "faixa_de" && l.skillId === "" && l.nivel === "pleno")).toBe(true);
  });

  it("grupo pequeno ou de poucas empresas guarda só as contagens", () => {
    const poucas = Array.from({ length: 9 }, (_, i) => vaga(i));
    const umaEmpresa = Array.from({ length: 15 }, (_, i) => vaga(i, { companyId: "so-uma", stack: [{ skillId: "gcp" }] }));
    const linhas = calcularMercado([...poucas, ...umaEmpresa], [], [], [], NOW);
    const aws = linhas.find((l) => l.metrica === "faixa_de" && l.skillId === "aws" && l.modo === "")!;
    const gcp = linhas.find((l) => l.metrica === "faixa_de" && l.skillId === "gcp" && l.modo === "")!;
    expect(aws).toMatchObject({ n: 9, p50: null, p25: null, p75: null });
    expect(gcp).toMatchObject({ n: 15, nEmpresas: 1, p50: null });
  });

  it("vaga vencida, sem nível/regime ou com faixa inválida não entra na faixa, mas conta na demanda se ativa", () => {
    const linhas = calcularMercado(
      [
        vaga(1, { status: "arquivada" }),
        vaga(2, { expiresAt: dias(1) }),
        vaga(3, { nivel: null }),
        vaga(4, { faixaDe: 9000, faixaAte: 5000 }),
      ],
      [],
      [],
      [],
      NOW,
    );
    expect(linhas.filter((l) => l.metrica === "faixa_de")).toEqual([]);
    expect(linhas.find((l) => l.metrica === "demanda" && l.skillId === "aws")).toMatchObject({ n: 2 });
  });

  it("demanda com tendência de 30 dias, oferta e pretensão", () => {
    const recentes = [
      ...Array.from({ length: 6 }, () => ({ stack: [{ skillId: "aws" }], createdAt: dias(10) })),
      ...Array.from({ length: 2 }, () => ({ stack: [{ skillId: "aws" }], createdAt: dias(45) })),
      { stack: [{ skillId: "aws" }], createdAt: dias(90) },
    ];
    const fichas = Array.from({ length: 10 }, (_, i) => ({
      stack: [{ skillId: "aws" }, "linux"],
      senioridade: "pleno",
      pretensoes: [{ regime: "CLT", valor: 7000 + i * 1000, unidade: "mes", moeda: "BRL" }],
    }));
    const linhas = calcularMercado([vaga(1)], recentes, fichas, [], NOW);
    expect(linhas.find((l) => l.metrica === "demanda" && l.skillId === "aws")).toMatchObject({ n: 1, nRecentes: 6, nAnteriores: 2 });
    expect(linhas.find((l) => l.metrica === "oferta" && l.skillId === "linux")).toMatchObject({ n: 10 });
    const p = linhas.find((l) => l.metrica === "pretensao" && l.skillId === "aws" && l.nivel === "pleno" && l.regime === "CLT")!;
    expect(p).toMatchObject({ n: 10, nEmpresas: null, p50: 11500 });
  });

  it("tempo até a primeira resposta só com 10+ respostas de 3+ empresas nos últimos 90 dias", () => {
    const resp = (i: number, emp: string, idade = 5) => ({ companyId: emp, createdAt: dias(idade), respondidaEm: new Date(dias(idade).getTime() + (i + 1) * 36e5) });
    const ok = calcularMercado([], [], [], Array.from({ length: 10 }, (_, i) => resp(i, `e${i % 3}`)), NOW);
    expect(ok.find((l) => l.metrica === "resposta_horas")).toMatchObject({ n: 10, nEmpresas: 3, p50: 5.5 });
    const velhas = calcularMercado([], [], [], Array.from({ length: 10 }, (_, i) => resp(i, `e${i % 3}`, 100)), NOW);
    expect(velhas.find((l) => l.metrica === "resposta_horas")).toMatchObject({ n: 0, p50: null });
  });
});

describe("emAlta", () => {
  it("só com 5+ recentes, 3+ empresas e subindo", () => {
    const d = (skillId: string, recentes: number, anteriores: number, empresas = 3) => ({ skillId, vagas: recentes, empresas, recentes, anteriores, fichas: 0 });
    expect(emAlta([d("a", 10, 2), d("b", 4, 0), d("c", 6, 6), d("d", 8, 1), d("e", 9, 0, 2)]).map((x) => x.skillId)).toEqual(["d", "a"]);
  });
});
