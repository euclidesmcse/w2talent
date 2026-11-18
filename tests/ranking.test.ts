/** 3.1a Ranking adaptativo: contas sem banco. */
import { calcularPesos, escolherPesos, exemplosDosSinais, partesDoSinal, partesParaSinal, PESOS_PADRAO, type Exemplo } from "../lib/ranking";
import { notaComPesos } from "../lib/match";

const p = (skills: number, nivel = 1, condicoes = 1, recencia = 1, completude = 1) => ({ skills, nivel, condicoes, recencia, completude });
const soma = (w: Record<string, number>) => Object.values(w).reduce((a, b) => a + b, 0);

describe("partes no sinal", () => {
  it("ida e volta, e rejeita o que falta ou sai de 0..1", () => {
    const d = { de: "nova", para: "entrevista", ...partesParaSinal(p(0.6667, 0, 0.5, 0.25, 1)) };
    expect(partesDoSinal(d)).toEqual(p(0.667, 0, 0.5, 0.25, 1));
    expect(partesDoSinal({ de: "nova", para: "entrevista" })).toBeNull();
    expect(partesDoSinal({ ...d, p_nivel: 2 })).toBeNull();
    expect(partesDoSinal(null)).toBeNull();
  });
  it("a nota com os pesos padrão é a de sempre", () => {
    expect(notaComPesos(p(0.5, 1, 0.5, 0, 1))).toBe(20 + 20 + 10 + 0 + 10);
  });
});

describe("calcularPesos", () => {
  it("sem positivos ou sem negativos fica no padrão", () => {
    expect(calcularPesos([{ partes: p(1), positivo: true }]).pesos).toEqual(PESOS_PADRAO);
    expect(calcularPesos([]).n).toBe(0);
  });

  it("a parte que separa quem avança sobe, soma 100 e respeita ±50%", () => {
    // Quem avança tem competências; quem não segue, não. O resto é igual.
    const ex: Exemplo[] = [
      ...Array.from({ length: 100 }, () => ({ partes: p(1), positivo: true })),
      ...Array.from({ length: 100 }, () => ({ partes: p(0), positivo: false })),
    ];
    const r = calcularPesos(ex);
    expect(r).toMatchObject({ n: 200, nPositivos: 100, nNegativos: 100 });
    expect(r.pesos.skills).toBeGreaterThan(40);
    expect(r.pesos.skills).toBeLessThanOrEqual(60);
    expect(r.pesos.nivel).toBeLessThan(20);
    expect(r.pesos.nivel).toBeGreaterThanOrEqual(10);
    expect(soma(r.pesos)).toBeCloseTo(100, 0);
  });

  it("separação perfeita pesa mais que uma separação pela metade (o limite é no peso, não na diferença)", () => {
    const com = (alto: number, baixo: number): Exemplo[] => [
      ...Array.from({ length: 100 }, () => ({ partes: p(alto), positivo: true })),
      ...Array.from({ length: 100 }, () => ({ partes: p(baixo), positivo: false })),
    ];
    const inteira = calcularPesos(com(1, 0)).pesos.skills;
    const metade = calcularPesos(com(0.75, 0.25)).pesos.skills;
    expect(inteira).toBeGreaterThan(metade);
    expect(inteira).toBeLessThanOrEqual(60);
  });

  it("com poucos exemplos mexe pouco", () => {
    const poucos: Exemplo[] = [{ partes: p(1), positivo: true }, { partes: p(0), positivo: false }];
    const muitos: Exemplo[] = [...Array(50)].flatMap(() => poucos);
    const a = calcularPesos(poucos).pesos.skills - 40;
    const b = calcularPesos(muitos).pesos.skills - 40;
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(b / 4);
  });

  it("parte que pesa contra quem avança desce, sem passar de -50%", () => {
    const ex: Exemplo[] = [
      ...Array.from({ length: 300 }, () => ({ partes: p(1, 1, 1, 0), positivo: true })),
      ...Array.from({ length: 300 }, () => ({ partes: p(1, 1, 1, 1), positivo: false })),
    ];
    const r = calcularPesos(ex).pesos;
    expect(r.recencia).toBeGreaterThanOrEqual(5);
    expect(r.recencia).toBeLessThan(10);
    expect(soma(r)).toBeCloseTo(100, 0);
  });
});

describe("escolherPesos", () => {
  const w = { ...PESOS_PADRAO, skills: 50, completude: 0 };
  it("empresa com 30+ usa os próprios; com menos, o global; global com menos, o padrão", () => {
    const g = { escopo: "global", escopoId: "", pesos: { ...PESOS_PADRAO, nivel: 25, recencia: 5 }, n: 40, desligado: false };
    expect(escolherPesos([g, { escopo: "empresa", escopoId: "e1", pesos: w, n: 30, desligado: false }], "e1")).toEqual({ pesos: w, escopo: "empresa" });
    expect(escolherPesos([g, { escopo: "empresa", escopoId: "e1", pesos: w, n: 29, desligado: false }], "e1").escopo).toBe("global");
    expect(escolherPesos([{ ...g, n: 10 }], "e1")).toEqual({ pesos: PESOS_PADRAO, escopo: "padrao" });
  });
  it("desligado volta ao padrão (global desligado vale para todos)", () => {
    const g = { escopo: "global", escopoId: "", pesos: w, n: 99, desligado: false };
    expect(escolherPesos([g, { escopo: "empresa", escopoId: "e1", pesos: w, n: 99, desligado: true }], "e1").escopo).toBe("padrao");
    expect(escolherPesos([{ ...g, desligado: true }, { escopo: "empresa", escopoId: "e1", pesos: w, n: 99, desligado: false }], "e1").escopo).toBe("padrao");
  });
});

describe("exemplosDosSinais", () => {
  const t = (min: number) => new Date(Date.UTC(2026, 10, 18, 12, min));
  const s = (app: string, para: string, min: number, partes = p(0.5), companyId = "e1") => ({
    applicationId: app, createdAt: t(min), vacancy: { companyId }, dados: { de: "x", para, ...partesParaSinal(partes) },
  });
  it("positivo vence; negativo só se nunca chegou à Entrevista; sinal sem partes não conta", () => {
    const r = exemplosDosSinais([
      s("a", "nao_seguiu", 1, p(0)), s("a", "entrevista", 2, p(1)),
      s("b", "entrevista", 1, p(1)), s("b", "nao_seguiu", 5, p(0)),
      s("c", "em_analise", 1), s("c", "nao_seguiu", 2, p(0.2)),
      { applicationId: "d", createdAt: t(1), vacancy: { companyId: "e1" }, dados: { de: "nova", para: "entrevista" } },
      s("e", "em_analise", 1),
    ]);
    expect(r.get("a")).toMatchObject({ positivo: true, partes: { skills: 1 } });
    expect(r.get("b")).toMatchObject({ positivo: true });
    expect(r.get("c")).toMatchObject({ positivo: false, partes: { skills: 0.2 }, companyId: "e1" });
    expect(r.has("d")).toBe(false);
    expect(r.has("e")).toBe(false);
  });
});
