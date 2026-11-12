// Vagas parecidas no detalhe (ideia do portal emagine, aprovada em 2026-11-12).
import { MAX_PARECIDAS, parecidasPorCompetencia, resumoDaVaga } from "../lib/parecidas";
import { DEMO_VACANCIES } from "../lib/demo-data";

const agora = new Date("2026-11-12T12:00:00Z");
const futuro = "2026-12-31T00:00:00Z";
const v = (id: string, skills: string[], extra: Record<string, unknown> = {}) => ({
  id, titulo: `Vaga ${id}`, status: "ativa", expiresAt: futuro, stack: skills.map((skillId) => ({ skillId })), updatedAt: "2026-11-10T00:00:00Z", ...extra,
});

describe("vagas parecidas por competência", () => {
  it("ordena por competências em comum e tira a própria vaga", () => {
    const alvo = v("a", ["aws", "terraform", "kubernetes"]);
    const lista = [alvo, v("b", ["aws"]), v("c", ["aws", "terraform", "kubernetes"]), v("d", ["react"]), v("e", ["aws", "terraform"])];
    expect(parecidasPorCompetencia(alvo, lista, 5, agora).map((x) => x.id)).toEqual(["c", "e", "b"]);
  });

  it("deixa de fora vaga arquivada, vencida e sem nada em comum", () => {
    const alvo = v("a", ["aws"]);
    const lista = [v("b", ["aws"], { status: "arquivada" }), v("c", ["aws"], { expiresAt: "2026-11-01T00:00:00Z" }), v("d", ["react"]), v("e", ["aws"])];
    expect(parecidasPorCompetencia(alvo, lista, 5, agora).map((x) => x.id)).toEqual(["e"]);
  });

  it("vaga sem competência não tem parecidas; empate vai para a mais recente", () => {
    expect(parecidasPorCompetencia(v("a", []), [v("b", ["aws"])], 5, agora)).toEqual([]);
    const alvo = v("a", ["aws"]);
    const lista = [v("velha", ["aws"], { updatedAt: "2026-10-01T00:00:00Z" }), v("nova", ["aws"], { updatedAt: "2026-11-11T00:00:00Z" })];
    expect(parecidasPorCompetencia(alvo, lista, 5, agora).map((x) => x.id)).toEqual(["nova", "velha"]);
  });

  it("no máximo cinco e só os campos da lista (sem contato)", () => {
    const alvo = DEMO_VACANCIES.find((x) => x.id === "demo-v-01")!;
    const r = parecidasPorCompetencia(alvo, DEMO_VACANCIES.map((x) => ({ ...x, email: "rh@empresa.com" })));
    expect(r.length).toBeGreaterThan(0);
    expect(r.length).toBeLessThanOrEqual(MAX_PARECIDAS);
    for (const x of r) expect(Object.keys(x).sort()).toEqual(["faixaAte", "faixaDe", "faixaMoeda", "id", "localidade", "nivel", "regime", "stack", "titulo"]);
    expect(resumoDaVaga({ id: 1, stack: ["aws"] }).stack).toEqual([{ skillId: "aws" }]);
  });
});
