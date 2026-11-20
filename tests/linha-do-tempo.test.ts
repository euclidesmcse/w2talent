/** Linha do tempo da carreira (plano 2026-11-20, D5–D7): raias, números e "bate com a vaga". */
import { experienciaVazia, type Experiencia } from "../lib/ficha";
import { bateComVaga, duracaoMeses, janela, mesDe, montarCargos, numerosCarreira, skillsDaVaga } from "../lib/linha-do-tempo";

const HOJE = new Date(Date.UTC(2026, 10, 20)); // nov/2026
const cargo = (p: Partial<Experiencia>): Experiencia => ({ ...experienciaVazia(), cargo: "C", empresa: "E", ...p });

describe("linha do tempo", () => {
  it("lê meses e ignora datas inválidas ou futuras", () => {
    expect(mesDe("2022-03")).toBe(2022 * 12 + 2);
    expect(mesDe("2022-13")).toBeNull();
    expect(mesDe("")).toBeNull();
    const { cargos } = montarCargos([cargo({ inicio: "2030-01", fim: "2031-01" }), cargo({ inicio: "x" })], [], HOJE);
    expect(cargos).toHaveLength(0);
  });

  it("cargos ao mesmo tempo descem uma raia; o integral fica em cima", () => {
    const { cargos, raias } = montarCargos(
      [
        cargo({ empresa: "Nuvia", inicio: "2022-03", atual: true }),
        cargo({ empresa: "Instituto", inicio: "2024-02", atual: true, tipo: "meio" }),
        cargo({ empresa: "Freela", inicio: "2024-05", fim: "2024-06", tipo: "freelancer" }),
        cargo({ empresa: "Antiga", inicio: "2018-01", fim: "2022-02" }),
        cargo({ empresa: "Outra", inicio: "2022-03", fim: "2022-05", tipo: "projeto" }),
      ],
      [],
      HOJE,
    );
    const r = Object.fromEntries(cargos.map((c) => [c.empresa, c.raia]));
    expect(r).toEqual({ Antiga: 0, Nuvia: 0, Outra: 1, Instituto: 1, Freela: 2 });
    expect(raias).toBe(3);
    const nuvia = cargos.find((c) => c.empresa === "Nuvia")!;
    expect(nuvia.fim).toBe(2026 * 12 + 10);
    expect(nuvia.paralelo).toBe(false);
    expect(cargos.find((c) => c.empresa === "Instituto")!.paralelo).toBe(true);
  });

  it("sem fim e sem 'atual' vira um mês só", () => {
    const [c] = montarCargos([cargo({ inicio: "2020-05" })], [], HOJE).cargos;
    expect(duracaoMeses(c)).toBe(1);
  });

  it("números: sobreposições contam uma vez, empresas sem repetir, simultâneos", () => {
    const { cargos } = montarCargos(
      [
        cargo({ empresa: "Nuvia", inicio: "2020-01", fim: "2021-12", skills: ["azure"] }),
        cargo({ empresa: "nuvia ", inicio: "2021-06", fim: "2022-12", skills: ["python"] }),
        cargo({ empresa: "Instituto", inicio: "2022-01", fim: "2022-06", tipo: "meio", skills: ["figma"] }),
      ],
      ["azure"],
      HOJE,
    );
    const n = numerosCarreira(cargos, true);
    expect(n.mesesCarreira).toBe(36);
    expect(n.empresas).toBe(2);
    expect(n.mediaPorEmpresa).toBe(18);
    expect(n.mesesNaVaga).toBe(24);
    expect(n.simultaneos).toEqual({ n: 2, ano: 2021 });
    expect(numerosCarreira(cargos, false).mesesNaVaga).toBeNull();
  });

  it("bate com a vaga vale exata, que cobre e próxima; sem vaga, nada", () => {
    expect(bateComVaga(["azure"], ["azure"])).toBe(true);
    expect(bateComVaga(["typescript"], ["javascript"])).toBe(true);
    expect(bateComVaga(["cobol"], ["azure"])).toBe(false);
    expect(bateComVaga(["azure"], [])).toBe(false);
    expect(montarCargos([cargo({ inicio: "2020-01", skills: ["azure"] })], [], HOJE).cargos[0].casa).toBe(false);
  });

  it("competências da vaga em qualquer formato do campo stack", () => {
    expect(skillsDaVaga([{ skillId: "azure" }, "aws", { skillId: "azure" }, { x: 1 }, null])).toEqual(["azure", "aws"]);
    expect(skillsDaVaga("azure")).toEqual([]);
  });

  it("janela: carreira inteira com folga ou os últimos 10 anos", () => {
    const hoje = 2026 * 12 + 10;
    expect(janela([{ ini: 2010 * 12 }], [{ ano: "2008" } as never], "tudo", HOJE)).toEqual({ ini: 2008 * 12 - 6, fim: hoje + 6 });
    expect(janela([{ ini: 2010 * 12 }], [], "10", HOJE)).toEqual({ ini: hoje - 120, fim: hoje + 6 });
  });
});
