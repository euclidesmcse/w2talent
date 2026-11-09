/** 1.5.12: "A IA entendeu" (regras), match com os pesos da spec §7.2 e busca de vagas ordenada por match. */
import { parseQueryIntent, removeChipFromQuery, skillTextTerms } from "../lib/query-intent";
import { matchVacancy, hasCriteria, vacancyModo, MATCH_WEIGHTS } from "../lib/match";
import { searchVacancies } from "../lib/search";
import { buildVacancySearchSql } from "../lib/search-db";

const kinds = (q: string) => parseQueryIntent(q).chips.map((c) => `${c.kind}:${c.value}`);

describe("parseQueryIntent", () => {
  it("lê o exemplo do protótipo", () => {
    const i = parseQueryIntent("DevOps remoto PJ 15k inglês");
    expect(i.modo).toBe("remoto");
    expect(i.regime).toBe("PJ");
    expect(i.faixaMin).toBe(15000);
    expect(i.idiomas).toEqual(["en"]);
    // DevOps não é competência da taxonomia: segue no texto. Inglês não filtra (vaga não tem idioma).
    expect(i.rest).toBe("DevOps");
    expect(kinds("DevOps remoto PJ 15k inglês")).toEqual(["texto:DevOps", "modo:remoto", "regime:PJ", "faixa:15000", "idioma:en"]);
  });

  it("entende PT, EN e ES", () => {
    expect(parseQueryIntent("remote senior python over $5000")).toMatchObject({ modo: "remoto", nivel: "Sênior", skills: ["python"], faixaMin: 5000 });
    expect(parseQueryIntent("desarrollador híbrido 12 mil")).toMatchObject({ modo: "hibrido", faixaMin: 12000, rest: "desarrollador" });
    expect(parseQueryIntent("pasantía aws")).toMatchObject({ regime: "Estágio", skills: ["aws"] });
    expect(parseQueryIntent("trabajo home office junior")).toMatchObject({ modo: "remoto", nivel: "Júnior" });
  });

  it("faixa em vários formatos, e ano não é faixa", () => {
    expect(parseQueryIntent("R$ 15.000").faixaMin).toBe(15000);
    expect(parseQueryIntent("acima de 8 mil").faixaMin).toBe(8000);
    expect(parseQueryIntent("12000 aws").faixaMin).toBe(12000);
    expect(parseQueryIntent("12,5k").faixaMin).toBe(12500);
    expect(parseQueryIntent("nuvem 2024").faixaMin).toBeUndefined();
    expect(parseQueryIntent("aws 3").faixaMin).toBeUndefined();
  });

  it("competências com nome de palavra comum só contam com contexto", () => {
    expect(parseQueryIntent("go").skills).toEqual([]);
    expect(parseQueryIntent("Go").skills).toEqual(["go"]);
    expect(parseQueryIntent("aws go").skills).toEqual(["aws", "go"]);
    expect(parseQueryIntent("chef de cozinha").skills).toEqual([]);
    expect(parseQueryIntent("chef de cozinha").rest).toBe("chef de cozinha");
  });

  it("aspas, exclusão e 'or' ficam como estão", () => {
    const i = parseQueryIntent('"cloud engineer" -azure clt');
    expect(i.regime).toBe("CLT");
    expect(i.skills).toEqual([]);
    expect(i.rest).toBe('"cloud engineer" -azure');
    expect(parseQueryIntent("aws or gcp")).toMatchObject({ rest: "aws or gcp", chips: [], skills: [] });
  });

  it("só palavras de ligação sobrando: sem texto", () => {
    expect(parseQueryIntent("remoto de PJ").rest).toBe("");
  });

  it("o × do chip tira o trecho do texto", () => {
    const q = "DevOps remoto PJ 15k inglês";
    const chip = parseQueryIntent(q).chips.find((c) => c.kind === "regime")!;
    expect(removeChipFromQuery(q, chip)).toBe("DevOps remoto 15k inglês");
  });

  it("o × tira o trecho exato, mesmo quando um termo contém o outro", () => {
    const q = "javascript java";
    const java = parseQueryIntent(q).chips.find((c) => c.kind === "skill" && c.value === "java")!;
    expect(removeChipFromQuery(q, java)).toBe("javascript");
  });

  it("aspas protegem números da faixa", () => {
    const i = parseQueryIntent('"ISO 27001" aws');
    expect(i.faixaMin).toBeUndefined();
    expect(i.rest).toBe('"ISO 27001"');
    const chip = i.chips.find((c) => c.kind === "texto")!;
    expect(removeChipFromQuery('"ISO 27001" aws', chip)).toBe("aws");
  });

  it("palavras como constructor e __proto__ não viram critério", () => {
    for (const w of ["constructor", "__proto__", "toString", "hasOwnProperty"]) {
      const i = parseQueryIntent(`${w} remoto`);
      expect(i.regime).toBeUndefined();
      expect(i.nivel).toBeUndefined();
      expect(i.idiomas).toEqual([]);
      expect(i.modo).toBe("remoto");
    }
  });

  it("termos de texto de uma competência", () => {
    expect(skillTextTerms("nodejs")).toEqual(expect.arrayContaining(["nodejs"]));
  });
});

describe("matchVacancy", () => {
  const now = new Date("2026-11-09T12:00:00Z").getTime();
  const base = {
    stack: [{ skillId: "aws" }, { skillId: "terraform" }],
    nivel: "Sênior",
    regime: "PJ",
    localidade: "Remoto",
    faixaDe: 15000,
    faixaAte: 20000,
    descricaoBullets: ["x"],
    updatedAt: new Date(now - 86_400_000).toISOString(),
  };

  it("vaga completa e recente que atende tudo = 100", () => {
    const r = matchVacancy(base, { skills: ["aws"], modo: "remoto", regime: "PJ", nivel: "Sênior", faixaMin: 15000 }, now);
    expect(r).toEqual({ pct: 100, gaps: [] });
  });

  it("falta competência: perde a fração dos 40", () => {
    const r = matchVacancy(base, { skills: ["aws", "kubernetes"] }, now);
    expect(r.pct).toBe(100 - MATCH_WEIGHTS.skills / 2);
    expect(r.gaps).toEqual([{ kind: "skill", skill: "kubernetes" }]);
  });

  it("modelo, regime e faixa dividem os 20", () => {
    const v = { ...base, localidade: "São Paulo (Híbrido)" };
    const r = matchVacancy(v, { skills: [], modo: "remoto", regime: "PJ" }, now);
    expect(r.pct).toBe(90);
    expect(r.gaps).toEqual([{ kind: "modo", want: "remoto", have: "hibrido" }]);
  });

  it("faixa não informada é lacuna e tira completude", () => {
    const v = { ...base, faixaDe: null, faixaAte: null };
    const r = matchVacancy(v, { skills: [], faixaMin: 15000 }, now);
    expect(r.gaps).toEqual([{ kind: "faixa", want: 15000, have: null, moeda: "BRL" }]);
    expect(r.pct).toBe(80 - 2); // condições 0 de 20; completude 5/6 de 10
  });

  it("nível diferente e vaga antiga", () => {
    const v = { ...base, nivel: "Pleno", updatedAt: new Date(now - 90 * 86_400_000).toISOString() };
    const r = matchVacancy(v, { skills: [], nivel: "Sênior" }, now);
    expect(r.pct).toBe(70);
    expect(r.gaps[0]).toMatchObject({ kind: "nivel", want: "Sênior", have: "Pleno" });
  });

  it("modelo a partir da localidade", () => {
    expect(vacancyModo(null)).toBe("remoto");
    expect(vacancyModo("Remoto")).toBe("remoto");
    expect(vacancyModo("São Paulo (Remoto parcial)")).toBe("hibrido");
    expect(vacancyModo("Curitiba (Presencial)")).toBe("presencial");
    expect(vacancyModo("Curitiba")).toBeNull();
  });

  it("sem critério não há match", () => {
    expect(hasCriteria(parseQueryIntent("nuvem"))).toBe(false);
    expect(hasCriteria(parseQueryIntent("nuvem remoto"))).toBe(true);
  });
});

describe("searchVacancies com match", () => {
  const now = Date.now();
  const day = 86_400_000;
  const vagas = [
    { id: "a", titulo: "DevOps Sênior", status: "ativa", stack: [{ skillId: "aws" }], localidade: "Remoto", regime: "PJ", nivel: "Sênior", faixaDe: 16000, faixaAte: 20000, descricaoBullets: ["x"], updatedAt: new Date(now - day) },
    { id: "b", titulo: "DevOps Pleno", status: "ativa", stack: [{ skillId: "gcp" }], localidade: "São Paulo (Híbrido)", regime: "CLT", nivel: "Pleno", faixaDe: 9000, faixaAte: 12000, descricaoBullets: ["x"], updatedAt: new Date(now - day) },
    { id: "c", titulo: "Cozinheiro", status: "ativa", stack: [], localidade: "Remoto", regime: "PJ", descricaoBullets: [], updatedAt: new Date(now - day) },
  ];

  it("ordena por match e devolve chips e lacunas", async () => {
    const r = await searchVacancies({ q: "DevOps remoto PJ 15k", page: 1, pageSize: 20 }, vagas as any);
    expect(r.entendeu.map((c) => c.kind)).toEqual(["texto", "modo", "regime", "faixa"]);
    expect(r.items.map((i: any) => i.id)).toEqual(["a", "b"]);
    expect(r.items[0].match).toBeGreaterThan(r.items[1].match);
    expect(r.items[1].gaps.map((g: any) => g.kind)).toEqual(["regime", "modo", "faixa"]);
  });

  it("idioma sozinho não filtra o texto", async () => {
    const r = await searchVacancies({ q: "DevOps inglês", page: 1, pageSize: 20 }, vagas as any);
    expect(r.items.map((i: any) => i.id).sort()).toEqual(["a", "b"]);
    expect(r.items.every((i: any) => i.match === null)).toBe(true);
    expect(r.entendeu.map((c) => c.kind)).toEqual(["texto", "idioma"]);
  });

  it("só texto livre: sem match", async () => {
    const r = await searchVacancies({ q: "devops", page: 1, pageSize: 20 }, vagas as any);
    expect(r.items.every((i: any) => i.match === null)).toBe(true);
  });

  it("só critérios: lista tudo, ordenado por match", async () => {
    const r = await searchVacancies({ q: "remoto PJ", page: 1, pageSize: 20 }, vagas as any);
    expect(r.items.map((i: any) => i.id).slice(0, 2).sort()).toEqual(["a", "c"]);
    expect(r.items[2].id).toBe("b");
  });

  it("paginação depois de reordenar", async () => {
    const r = await searchVacancies({ q: "remoto PJ", page: 2, pageSize: 2 }, vagas as any);
    expect(r.total).toBe(3);
    expect(r.totalPages).toBe(2);
    expect(r.items.map((i: any) => i.id)).toEqual(["b"]);
  });
});

describe("SQL da busca com competências", () => {
  it("competências viram 'qualquer uma destas' e o resto vai para o websearch", () => {
    const q = buildVacancySearchSql({ q: "aws kubernetes remoto", textQ: "", anyTerms: ["aws", "kubernetes"], page: 1, pageSize: 200 }, null);
    expect(q.sql).toContain("phraseto_tsquery");
    expect(q.sql).not.toContain("websearch_to_tsquery");
    expect(q.values).toEqual(expect.arrayContaining(["aws", "kubernetes"]));
  });

  it("sem texto e sem competências: lista por data", () => {
    const q = buildVacancySearchSql({ q: "remoto pj", textQ: "", anyTerms: [], page: 1, pageSize: 200 }, null);
    expect(q.sql).toContain('ORDER BY v."updatedAt" DESC');
    expect(q.sql).not.toContain("tsquery");
  });
});
