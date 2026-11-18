// 2.2a: competências próximas no match (mapa fixo, plano 2.2 D1–D3).
import { getSkill } from "@/lib/taxonomy";
import { PARES_PROXIMAS, PESO_PROXIMA, melhorCompetencia, pesoCompetencia, vizinhasDe } from "@/lib/taxonomia-proximas";
import { matchVacancy } from "@/lib/match";
import { searchVacancies } from "@/lib/search";

const ids = (lista: readonly (readonly [string, string])[]) => lista.flatMap(([a, b]) => [a, b]);

describe("mapa de competências próximas", () => {
  it("todo id existe na taxonomia", () => {
    const todos = [...ids(PARES_PROXIMAS.PROXIMAS), ...ids(PARES_PROXIMAS.COBRE), ...ids(PARES_PROXIMAS.IGUAIS)];
    expect(todos.filter((id) => !getSkill(id))).toEqual([]);
  });

  it("sem par repetido nem par de uma competência com ela mesma", () => {
    const vistos = new Set<string>();
    for (const [a, b] of [...PARES_PROXIMAS.PROXIMAS, ...PARES_PROXIMAS.COBRE, ...PARES_PROXIMAS.IGUAIS]) {
      expect(a).not.toBe(b);
      const k = [a, b].sort().join("|");
      expect(vistos.has(k)).toBe(false);
      vistos.add(k);
    }
  });

  it("próximas valem metade nos dois sentidos", () => {
    expect(pesoCompetencia("openshift", "kubernetes")).toBe(PESO_PROXIMA);
    expect(pesoCompetencia("kubernetes", "openshift")).toBe(PESO_PROXIMA);
    expect(pesoCompetencia("java", "cobol")).toBe(0);
    expect(pesoCompetencia("python", "python")).toBe(1);
  });

  it("quem tem a maior atende a menor; o contrário é próxima", () => {
    expect(pesoCompetencia("typescript", "javascript")).toBe(1);
    expect(pesoCompetencia("javascript", "typescript")).toBe(PESO_PROXIMA);
    expect(pesoCompetencia("nextjs", "react")).toBe(1);
    expect(pesoCompetencia("abap", "sap-abap")).toBe(1);
    expect(pesoCompetencia("sap-abap", "abap")).toBe(1);
  });

  it("ids iguais herdam as ligações um do outro", () => {
    expect(pesoCompetencia("playwright-test", "cypress")).toBe(PESO_PROXIMA);
    expect(pesoCompetencia("supabase", "postgresql")).toBe(1);
    expect(pesoCompetencia("supabase-db", "postgresql")).toBe(1);
    expect(vizinhasDe("playwright-test")).toEqual(expect.arrayContaining(["cypress", "playwright"]));
    expect(vizinhasDe("cypress")).toEqual(expect.arrayContaining(["playwright", "playwright-test"]));
  });

  it("melhor competência da pessoa para uma pedida", () => {
    expect(melhorCompetencia(["vue", "openshift"], "kubernetes")).toEqual({ skill: "openshift", peso: PESO_PROXIMA });
    expect(melhorCompetencia(["openshift", "eks"], "kubernetes")).toEqual({ skill: "eks", peso: 1 });
    expect(melhorCompetencia(["cobol"], "kubernetes")).toBeNull();
  });

  it("vizinhas começam pela própria competência", () => {
    const v = vizinhasDe("kubernetes");
    expect(v[0]).toBe("kubernetes");
    expect(v).toEqual(expect.arrayContaining(["openshift", "nomad", "docker"]));
  });
});

describe("match com competências próximas", () => {
  const agora = new Date("2026-11-18T12:00:00Z").getTime();
  const vaga = (stack: string[]) => ({ stack, updatedAt: new Date(agora) });
  const crit = (skills: string[]) => ({ skills, regime: undefined, modo: undefined, nivel: undefined, faixaMin: undefined }) as any;

  it("próxima conta metade e aparece depois do que falta", () => {
    const r = matchVacancy(vaga(["aws", "openshift"]), crit(["aws", "kubernetes", "cobol"]), agora);
    // competências: (1 + 0,5 + 0) / 3 de 40 = 20; nível 20; condições 20; recência 10; completude 1/6 de 10
    expect(r.pct).toBe(Math.round(20 + 20 + 20 + 10 + 10 / 6));
    expect(r.gaps).toEqual([
      { kind: "skill", skill: "cobol" },
      { kind: "skill", skill: "kubernetes", proxima: "openshift" },
    ]);
  });

  it("competência que cobre conta inteira, sem lacuna", () => {
    const r = matchVacancy(vaga(["javascript"]), crit(["typescript"]), agora);
    expect(r.gaps).toEqual([]);
  });

  it("busca em memória também traz a vaga com a vizinha, com metade dos pontos", async () => {
    const r = await searchVacancies({ q: "kubernetes" }, [
      { id: "exata", titulo: "Engenharia Kubernetes", stack: ["kubernetes"], status: "ativa", updatedAt: new Date() },
      { id: "proxima", titulo: "OpenShift specialist", stack: ["openshift"], status: "ativa", updatedAt: new Date() },
      { id: "nada", titulo: "Analista COBOL", stack: ["cobol"], status: "ativa", updatedAt: new Date() },
    ]);
    expect(r.items.map((i: any) => i.id)).toEqual(["exata", "proxima"]);
    expect(r.items[1].gaps).toEqual([{ kind: "skill", skill: "kubernetes", proxima: "openshift" }]);
  });
});
