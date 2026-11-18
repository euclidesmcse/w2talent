// 2.1b: aviso de vaga duplicada (D4) e faixa sugerida (D6), regras puras.
import { faixaDaBase, mediana, pareceDuplicada, semelhancaTitulo, MIN_BASE_FAIXA } from "../lib/vaga-conferir";

describe("semelhança de título", () => {
  it("ignora acento, caixa, pontuação e palavras vazias", () => {
    expect(semelhancaTitulo("Engenheiro de Cloud Sênior", "engenheiro cloud senior")).toBe(1);
    expect(semelhancaTitulo("Analista Cloud Pleno — AWS", "Analista Cloud Pleno AWS")).toBe(1);
    expect(semelhancaTitulo("Analista Cloud Pleno", "Analista Cloud Sênior")).toBeCloseTo(0.5);
    expect(semelhancaTitulo("", "x")).toBe(0);
  });
});

describe("pareceDuplicada", () => {
  const r = { titulo: "Analista Cloud Pleno", stack: ["aws", "terraform"] };
  it("mesmo título é duplicada", () => {
    expect(pareceDuplicada(r, { titulo: "Analista de Cloud Pleno", stack: [] }, null)).toBe(true);
  });
  it("título parecido com as mesmas competências é duplicada", () => {
    expect(pareceDuplicada(r, { titulo: "Analista Cloud Sênior", stack: [{ skillId: "aws" }, { skillId: "terraform" }] }, null)).toBe(true);
  });
  it("título parecido com outras competências não é", () => {
    expect(pareceDuplicada(r, { titulo: "Analista Cloud Sênior", stack: [{ skillId: "azure" }] }, null)).toBe(false);
  });
  it("vetor muito próximo é duplicada mesmo com outro título", () => {
    expect(pareceDuplicada(r, { titulo: "Cloud Engineer", stack: [] }, 0.95)).toBe(true);
    expect(pareceDuplicada(r, { titulo: "Cloud Engineer", stack: [] }, 0.8)).toBe(false);
  });
});

describe("faixa sugerida", () => {
  it("mediana", () => {
    expect(mediana([3, 1, 2])).toBe(2);
    expect(mediana([4, 1, 2, 3])).toBe(2.5);
  });
  it("só com 5 ou mais vagas de base, arredondada a 100", () => {
    const base = [
      { faixaDe: 8000, faixaAte: 12000 },
      { faixaDe: 9000, faixaAte: 13000 },
      { faixaDe: 10050, faixaAte: 14000 },
      { faixaDe: 11000, faixaAte: 15000 },
    ];
    expect(MIN_BASE_FAIXA).toBe(5);
    expect(faixaDaBase(base, "BRL")).toBeNull();
    // vaga sem faixa completa não conta
    expect(faixaDaBase([...base, { faixaDe: null, faixaAte: 9000 }], "BRL")).toBeNull();
    expect(faixaDaBase([...base, { faixaDe: 12000, faixaAte: 18000 }], "BRL")).toEqual({ de: 10100, ate: 14000, base: 5, moeda: "BRL" });
  });
});
