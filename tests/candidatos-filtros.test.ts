// 2.2b: filtros da tela Candidatos (na URL) e match do lado do recrutador.
import { contarFiltros, filtrosParaUrl, lerFiltros, passaNosFiltros } from "@/lib/candidatos-filtros";
import { matchCandidato, senioridadesDoNivel } from "@/lib/match-candidato";
import { atendemPorInteiro, PESO_PROXIMA } from "@/lib/taxonomia-proximas";
import { searchCandidates } from "@/lib/search";

const agora = new Date("2026-11-18T12:00:00Z").getTime();
const dias = (n: number) => new Date(agora - n * 86_400_000);

const ana = {
  id: "ana",
  nome: "Ana",
  email: "ana@exemplo.com",
  titulo: "Engenheira Cloud",
  senioridade: "pleno",
  stack: [{ skillId: "aws", anos: 5 }, { skillId: "openshift", anos: 2 }, { skillId: "typescript", anos: 3 }],
  experiencias: [{ cargo: "Eng", empresa: "X", inicio: "2020-01", fim: "", atual: true }],
  localidade: "São Paulo",
  modo: "remoto",
  regimePreferido: ["CLT", "PJ"],
  pretensoes: [{ regime: "CLT", valor: 12000, unidade: "mes", moeda: "BRL" }, { regime: "PJ", valor: 15000, unidade: "mes", moeda: "BRL" }],
  idiomas: [{ idioma: "Inglês", nivel: "avancado" }],
  disponibilidade: "30d",
  status: "ativo",
  updatedAt: dias(2),
};

describe("filtros na URL", () => {
  it("lê, ignora o que não existe e volta igual", () => {
    const f = lerFiltros(new URLSearchParams("vaga=v1&skills=aws,inexistente,aws&senioridade=pleno&modo=lua&regime=PJ&faixaAte=12000.4&idioma=en&idiomaNivel=avancado&disponibilidade=30d&atualizada=30"));
    expect(f).toEqual({
      vaga: "v1", skills: ["aws"], senioridade: "pleno", modo: undefined, regime: "PJ", faixaAte: 12000,
      idioma: "en", idiomaNivel: "avancado", disponibilidade: "30d", atualizadaDias: 30,
    });
    expect(lerFiltros(new URLSearchParams(new URLSearchParams(filtrosParaUrl(f)).toString()))).toEqual(f);
    expect(contarFiltros(f)).toBe(7);
  });

  it("3.1b: ordem=padrao vai e volta na URL e não conta como filtro", () => {
    const f = lerFiltros(new URLSearchParams("vaga=v1&ordem=padrao&skills=aws"));
    expect(f.ordem).toBe("padrao");
    expect(filtrosParaUrl(f)).toContainEqual(["ordem", "padrao"]);
    expect(lerFiltros(new URLSearchParams(new URLSearchParams(filtrosParaUrl(f)).toString()))).toEqual(f);
    expect(contarFiltros(f)).toBe(1);
    expect(lerFiltros(new URLSearchParams("ordem=outra")).ordem).toBeUndefined();
  });

  it("nível do idioma sem idioma não vale", () => {
    expect(lerFiltros(new URLSearchParams("idiomaNivel=fluente")).idiomaNivel).toBeUndefined();
  });

  it("filtros em memória", () => {
    const ok = (q: string) => passaNosFiltros(ana, lerFiltros(new URLSearchParams(q)), agora);
    expect(ok("skills=aws")).toBe(true);
    expect(ok("skills=javascript")).toBe(true); // TypeScript atende JavaScript por inteiro
    expect(ok("skills=kubernetes")).toBe(false); // OpenShift é próxima: conta no match, não no filtro
    expect(ok("skills=aws,typescript")).toBe(true);
    expect(ok("senioridade=senior")).toBe(false);
    expect(ok("idioma=en&idiomaNivel=avancado")).toBe(true);
    expect(ok("idioma=en&idiomaNivel=fluente")).toBe(false);
    expect(ok("idioma=es")).toBe(false);
    expect(ok("disponibilidade=15d")).toBe(false);
    expect(ok("disponibilidade=60d")).toBe(true);
    expect(passaNosFiltros({ ...ana, disponibilidade: null }, lerFiltros(new URLSearchParams("disponibilidade=imediata")), agora)).toBe(true);
    expect(ok("atualizada=7")).toBe(true);
    expect(passaNosFiltros({ ...ana, updatedAt: dias(40) }, lerFiltros(new URLSearchParams("atualizada=30")), agora)).toBe(false);
  });

  it("quem atende por inteiro", () => {
    expect(atendemPorInteiro("javascript")).toEqual(expect.arrayContaining(["javascript", "typescript"]));
    expect(atendemPorInteiro("kubernetes")).not.toContain("openshift");
    expect(atendemPorInteiro("abap")).toEqual(expect.arrayContaining(["abap", "sap-abap"]));
  });
});

describe("match do lado do recrutador", () => {
  const vaga = { stack: [{ skillId: "aws" }, { skillId: "kubernetes" }, { skillId: "terraform" }], nivel: "Pleno", regime: "PJ", localidade: "Remoto", faixaDe: 10000, faixaAte: 14000, faixaMoeda: "BRL" };

  it("mesma conta, invertida: a vaga pede, a ficha atende", () => {
    const r = matchCandidato(ana, vaga, agora);
    // competências (1 + 0,5 + 0) / 3 de 40 = 20; nível 20; regime ok, modo ok, faixa PJ 15k > 14k: 2/3 de 20; recência 10; ficha completa 10
    expect(r.pct).toBe(Math.round(20 + 20 + (2 / 3) * 20 + 10 + 10));
    expect(r.gaps).toEqual([
      { kind: "skill", skill: "terraform" },
      { kind: "skill", skill: "kubernetes", proxima: "openshift" },
      { kind: "faixa", want: 14000, have: 15000, moeda: "BRL" },
    ]);
    expect(PESO_PROXIMA).toBe(0.5);
  });

  it("nível, regime e modelo que não batem viram lacuna", () => {
    const r = matchCandidato(ana, { ...vaga, stack: [], nivel: "Sênior", regime: "Estágio", localidade: "Curitiba (Presencial)" }, agora);
    expect(r.gaps.map((g) => g.kind)).toEqual(["nivel", "regime", "modo"]);
  });

  it("o que a vaga não informa não conta", () => {
    const r = matchCandidato(ana, { stack: [{ skillId: "aws" }], localidade: "" }, agora);
    expect(r.gaps).toEqual([]);
    expect(r.pct).toBe(100);
  });

  it("vaga sem local não pede modelo", () => {
    const r = matchCandidato({ ...ana, modo: "presencial" }, { stack: [], localidade: null }, agora);
    expect(r.gaps).toEqual([]);
  });

  it("nível escrito de vários jeitos", () => {
    expect(senioridadesDoNivel("Sênior")).toEqual(["senior", "especialista", "lideranca"]);
    expect(senioridadesDoNivel("Júnior")).toEqual(["junior"]);
    expect(senioridadesDoNivel("Tech Lead")).toEqual(["lideranca"]);
    expect(senioridadesDoNivel("qualquer")).toBeNull();
  });

  it("busca em memória com vaga: ordem pelo match e sem contatos", async () => {
    const beto = { ...ana, id: "beto", nome: "Beto", email: "beto@exemplo.com", stack: [{ skillId: "cobol", anos: 9 }], updatedAt: new Date() };
    const r = await searchCandidates({ filtros: { skills: [] } }, [beto, { ...ana, updatedAt: new Date() }], { stack: [{ skillId: "aws" }], localidade: "Remoto" });
    expect(r.items.map((i: any) => i.id)).toEqual(["ana", "beto"]);
    expect(r.items[0].match).toBeGreaterThan(r.items[1].match);
    expect(r.items[0].email).toBeUndefined();
    expect(r.items[1].gaps[0]).toEqual({ kind: "skill", skill: "aws" });
  });

  it("filtros também valem na busca em memória", async () => {
    const r = await searchCandidates({ filtros: { skills: ["cobol"] } }, [{ ...ana, updatedAt: new Date() }]);
    expect(r.items).toEqual([]);
  });
});
