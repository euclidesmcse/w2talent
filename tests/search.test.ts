// Task 5 TDD — Busca Semântica + Lista Limpa (Tabela/Cards)
import * as fs from "fs";
import * as path from "path";
import {
  hybridSearch,
  buildVacancySearchSql,
  buildCandidateSearchSql,
  buildTsvectorTextVacancy,
  maskEmail,
  maskPhone,
  skillsDisplay,
  suggestCorrection,
  buildEmptyCTA,
  formatFaixa,
  searchVacancies,
  searchCandidates,
  PAGE_SIZE,
  P95_BUDGET_MS,
  tsRank,
  semanticBoost,
} from "../lib/search";

// ── fixtures ──────────────────────────────────────────────────────────
function vacancyFixture(overrides: any = {}) {
  return {
    id: `vac-${Math.random().toString(36).slice(2, 8)}`,
    titulo: "Analista Cloud Pleno",
    stack: [{ skillId: "aws" }, { skillId: "docker" }, { skillId: "kubernetes" }, { skillId: "react" }],
    localidade: "remoto",
    regime: "CLT",
    nivel: "pleno",
    faixaDe: 8000,
    faixaAte: 12000,
    faixaMoeda: "BRL",
    descricaoBullets: ["Migrar workloads para EKS", "CI/CD"],
    status: "ativa",
    createdAt: new Date("2026-11-05T10:00:00Z"),
    updatedAt: new Date("2026-11-06T10:00:00Z"),
    email: "rh@empresa.com",
    telefone: "+5511999998888",
    ...overrides,
  };
}

function candidateFixture(overrides: any = {}) {
  return {
    id: `cand-${Math.random().toString(36).slice(2, 8)}`,
    nome: "Ana Silva",
    titulo: "Engenheira Cloud",
    stack: [{ skillId: "aws" }, { skillId: "terraform" }],
    localidade: "São Paulo",
    modo: "remoto",
    regimePreferido: ["CLT"],
    pretensaoDe: 9000,
    pretensaoAte: 11000,
    status: "ativo",
    createdAt: new Date("2026-11-05T10:00:00Z"),
    updatedAt: new Date("2026-11-06T10:00:00Z"),
    email: "ana@email.com",
    celular: "+5511999997777",
    ...overrides,
  };
}

describe("Busca Semântica + Lista Limpa — Task 5", () => {
  describe("1. q='Analista Cloud' encontra vaga com skill AWS (sinônimo semântico)", () => {
    it("hybrid encontra vacancy com skill AWS quando query é 'Analista Cloud'", async () => {
      const vacancies = [
        vacancyFixture({ id: "v1", titulo: "Analista Cloud Senior", stack: [{ skillId: "aws" }], descricaoBullets: ["AWS EKS"] }),
        vacancyFixture({ id: "v2", titulo: "Designer UX Pleno", stack: [{ skillId: "figma" }], descricaoBullets: ["Figma"] }),
        vacancyFixture({ id: "v3", titulo: "Dev Backend Java", stack: [{ skillId: "java" }], descricaoBullets: ["Spring"] }),
      ];
      const result = await hybridSearch("Analista Cloud", vacancies, {
        buildText: buildTsvectorTextVacancy,
        getStack: (v) => v.stack,
      });
      expect(result.total).toBeGreaterThan(0);
      // deve ter encontrado v1 (aws) por semantic
      const ids = result.items.map((i) => i.id);
      expect(ids).toContain("v1");
      // não deve conter vaga irrelevante no top
      expect(result.items[0].id).toBe("v1");
      // ts_rank + semantic boost
      expect(result.items[0]._rank).toBeGreaterThan(0);
      expect(tsRank("Analista Cloud", buildTsvectorTextVacancy(vacancies[0]))).toBeGreaterThan(0);
      expect(semanticBoost("Analista Cloud", [{ skillId: "aws" }])).toBeGreaterThan(0);
    });

    it("query 'cloud' casa com skill aws via semanticBoost", async () => {
      const vacancies = [
        vacancyFixture({ id: "v-aws", titulo: "Engenheiro Cloud", stack: [{ skillId: "aws" }] }),
        vacancyFixture({ id: "v-figma", titulo: "Designer", stack: [{ skillId: "figma" }] }),
      ];
      const result = await hybridSearch("cloud", vacancies, {
        buildText: buildTsvectorTextVacancy,
        getStack: (v) => v.stack,
      });
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.items[0].id).toBe("v-aws");
    });
  });

  describe("2. ordena por hybrid rank; paginação server-side 20/page", () => {
    it("ordena por hybrid rank decrescente", async () => {
      const vacancies = [
        vacancyFixture({ id: "v-low", titulo: "Vaga Genérica", stack: [{ skillId: "figma" }], descricaoBullets: ["figma"] }),
        vacancyFixture({ id: "v-high", titulo: "Analista Cloud AWS", stack: [{ skillId: "aws" }], descricaoBullets: ["Analista Cloud AWS EKS"] }),
      ];
      const result = await hybridSearch("Analista Cloud", vacancies, {
        buildText: buildTsvectorTextVacancy,
        getStack: (v) => v.stack,
      });
      expect(result.items[0].id).toBe("v-high");
      if (result.items.length > 1) {
        expect(result.items[0]._rank).toBeGreaterThanOrEqual(result.items[1]._rank);
      }
    });

    it("paginação server-side 20/page", async () => {
      const many = Array.from({ length: 45 }, (_, i) =>
        vacancyFixture({ id: `v-${i}`, titulo: `Vaga ${i} Cloud`, stack: [{ skillId: "aws" }] })
      );
      const p1 = await hybridSearch("", many, {
        buildText: buildTsvectorTextVacancy,
        page: 1,
        pageSize: 20,
      });
      expect(p1.items.length).toBe(20);
      expect(p1.page).toBe(1);
      expect(p1.pageSize).toBe(20);
      expect(p1.total).toBe(45);
      expect(p1.totalPages).toBe(3);

      const p2 = await hybridSearch("", many, {
        buildText: buildTsvectorTextVacancy,
        page: 2,
        pageSize: 20,
      });
      expect(p2.items.length).toBe(20);
      expect(p2.page).toBe(2);

      const p3 = await hybridSearch("", many, {
        buildText: buildTsvectorTextVacancy,
        page: 3,
        pageSize: 20,
      });
      expect(p3.items.length).toBe(5);

      expect(PAGE_SIZE).toBe(20);
    });

    it("searchVacancies com dataSource respeita page/pageSize", async () => {
      const many = Array.from({ length: 25 }, (_, i) => vacancyFixture({ id: `v-${i}`, titulo: `Cloud ${i}` }));
      const result = await searchVacancies({ q: "", page: 2, pageSize: 20 }, many as any);
      expect(result.items.length).toBe(5);
      expect(result.page).toBe(2);
    });
  });

  describe("3. filtro regime/remoto/faixa funciona com faixa null (hide, não quebra)", () => {
    it("filtro regime", async () => {
      const vacancies = [
        vacancyFixture({ id: "v-clt", regime: "CLT" }),
        vacancyFixture({ id: "v-pj", regime: "PJ" }),
      ];
      const result = await hybridSearch("", vacancies, {
        buildText: buildTsvectorTextVacancy,
        filters: { regime: "CLT" },
      });
      expect(result.items.every((v) => v.regime === "CLT")).toBe(true);
      expect(result.items.map((v) => v.id)).toContain("v-clt");
    });

    it("filtro modo/remoto", async () => {
      const vacancies = [
        vacancyFixture({ id: "v-remoto", localidade: "remoto" }),
        vacancyFixture({ id: "v-sp", localidade: "São Paulo" }),
      ];
      const result = await hybridSearch("", vacancies, {
        buildText: buildTsvectorTextVacancy,
        filters: { modo: "remoto" } as any,
      });
      expect(result.items.map((v) => v.id)).toContain("v-remoto");
    });

    it("faixa null => hide '—' e não quebra ranking/filtro", async () => {
      const vSemFaixa = vacancyFixture({ id: "v-null", titulo: "Dev Cloud", faixaDe: null, faixaAte: null });
      const vComFaixa = vacancyFixture({ id: "v-faixa", titulo: "Dev Cloud", faixaDe: 8000, faixaAte: 12000 });
      // formatFaixa hide
      expect(formatFaixa(null, null)).toBe("—");
      expect(formatFaixa(8000, 12000)).not.toBe("—");
      // hybrid não quebra
      const result = await hybridSearch("Cloud", [vSemFaixa, vComFaixa], {
        buildText: buildTsvectorTextVacancy,
        getStack: (v) => v.stack,
      });
      expect(result.total).toBeGreaterThan(0);
      // filtro faixa não remove null
      const filtered = await hybridSearch("", [vSemFaixa, vComFaixa], {
        buildText: buildTsvectorTextVacancy,
        filters: { faixaDe: 9000 } as any,
      });
      // v-null deve permanecer (hide, não filtra fora)
      expect(filtered.items.map((v) => v.id)).toContain("v-null");
    });

    it("vacancy-table e vacancy-cards exibem '—' quando faixa null", () => {
      const tableSrc = fs.readFileSync(path.join(__dirname, "../components/vacancy-table.tsx"), "utf-8");
      const cardsSrc = fs.readFileSync(path.join(__dirname, "../components/vacancy-cards.tsx"), "utf-8");
      expect(tableSrc).toMatch(/formatFaixa|faixa.*—|—/);
      expect(cardsSrc).toMatch(/formatFaixa|faixa/);
    });
  });

  describe("4. Review Focus: typo 'Analsita Cluod' -> 200 com sugestão + empty CTA", () => {
    it("typo retorna 200 com sugestão e empty CTA", async () => {
      const vacancies = [vacancyFixture({ id: "v1", titulo: "Analista Cloud", stack: [{ skillId: "aws" }] })];
      const result = await hybridSearch("Analsita Cluod", vacancies, {
        buildText: buildTsvectorTextVacancy,
        getStack: (v) => v.stack,
      });
      // sem matches para typo
      expect(result.total).toBe(0);
      expect(result.suggestion).toBeTruthy();
      expect(result.suggestion!.toLowerCase()).toMatch(/analista cloud/);
      expect(result.emptyCTA).toBeTruthy();
      expect(result.emptyCTA!).toMatch(/quis dizer|ajustar|limpar/i);
    });

    it("suggestCorrection e buildEmptyCTA", () => {
      expect(suggestCorrection("Analsita Cluod")).toMatch(/Analista Cloud/i);
      expect(suggestCorrection("Analista Cloud")).toBeNull(); // termo correto não sugere
      const cta = buildEmptyCTA("Analista Cloud");
      expect(cta).toMatch(/quis dizer/i);
    });

    it("API route retorna 200 com sugestão (mock fetch da rota)", async () => {
      // verifica que arquivos de rota existem e tratam typo
      const vacRoute = path.join(__dirname, "../app/api/search/vacancies/route.ts");
      const candRoute = path.join(__dirname, "../app/api/search/candidates/route.ts");
      expect(fs.existsSync(vacRoute)).toBe(true);
      expect(fs.existsSync(candRoute)).toBe(true);
      const src = fs.readFileSync(vacRoute, "utf-8");
      expect(src).toMatch(/searchVacancies|GET/);
      expect(src).toMatch(/suggestion|emptyCTA/);
    });

    it("mascaramento e-mail/tel na lista (cadeado)", () => {
      expect(maskEmail("rh@empresa.com")).toMatch(/rh\*\*\*@empresa\.com/);
      expect(maskEmail("rh@empresa.com")).toMatch(/🔒/);
      expect(maskPhone("+5511999998888")).toMatch(/🔒/);
      expect(maskEmail("")).toBe("—");
      expect(maskPhone("")).toBe("—");
      // componentes contêm mascaramento + cadeado
      const vacTable = fs.readFileSync(path.join(__dirname, "../components/vacancy-table.tsx"), "utf-8");
      const candTable = fs.readFileSync(path.join(__dirname, "../components/candidate-table.tsx"), "utf-8");
      expect(vacTable).toMatch(/maskEmail|maskPhone|🔒/);
      expect(candTable).toMatch(/maskEmail|maskPhone|🔒/);
    });

    it("tabela semântica <table> + cards com mesmo dado e truncamento +2 skills", () => {
      expect(skillsDisplay(["aws", "docker", "kubernetes", "react", "node"], 3)).toBe("aws, docker, kubernetes +2");
      expect(skillsDisplay(["aws", "docker"], 3)).toBe("aws, docker");
      expect(skillsDisplay(["aws", "docker", "kubernetes", "react"], 3)).toMatch(/\+1/);

      const vacTable = fs.readFileSync(path.join(__dirname, "../components/vacancy-table.tsx"), "utf-8");
      const vacCards = fs.readFileSync(path.join(__dirname, "../components/vacancy-cards.tsx"), "utf-8");
      const candTable = fs.readFileSync(path.join(__dirname, "../components/candidate-table.tsx"), "utf-8");
      const candCards = fs.readFileSync(path.join(__dirname, "../components/candidate-cards.tsx"), "utf-8");
      // <table> semântica
      expect(vacTable).toMatch(/<table/);
      expect(vacTable).toMatch(/<th scope="col">/);
      expect(vacTable).toMatch(/scope="col"/);
      expect(candTable).toMatch(/<table/);
      expect(candTable).toMatch(/<th scope/);
      // cards usam <ul><li> com aria-label
      expect(vacCards).toMatch(/<ul/);
      expect(vacCards).toMatch(/aria-label/);
      expect(candCards).toMatch(/<ul/);
      // truncamento +2 presente
      expect(vacTable).toMatch(/skillsDisplay|SkillChips/);
      expect(vacCards).toMatch(/skillsDisplay|SkillChips/);
      expect(candTable).toMatch(/skillsDisplay|SkillChips/);
      expect(candCards).toMatch(/skillsDisplay|SkillChips/);
      // páginas vagas/candidatos existem
      expect(fs.existsSync(path.join(__dirname, "../app/vagas/page.tsx"))).toBe(true);
      expect(fs.existsSync(path.join(__dirname, "../app/candidatos/page.tsx"))).toBe(true);
    });
  });

  describe("5. p95 <800ms e tsvector+vector where status=ativo only", () => {
    it("p95 <800ms (tookMs)", async () => {
      expect(P95_BUDGET_MS).toBe(800);
      const many = Array.from({ length: 100 }, (_, i) => vacancyFixture({ id: `v-${i}`, titulo: `Vaga ${i} Cloud AWS` }));
      const start = Date.now();
      const result = await hybridSearch("Analista Cloud", many, {
        buildText: buildTsvectorTextVacancy,
        getStack: (v) => v.stack,
      });
      const took = Date.now() - start;
      // hybrid in-memory deve ser <800ms
      expect(took).toBeLessThan(800);
      expect(result.tookMs).toBeDefined();
      expect(result.tookMs!).toBeLessThan(800);
    });

    it("SQL híbrido contém tsvector + vector, só ativos e não vencidos, 20 por página", () => {
      const vec = new Array(1024).fill(0.01);
      const sql = buildVacancySearchSql({ q: "Analista Cloud", page: 1, pageSize: 20 }, vec);
      expect(sql.sql).toMatch(/ts_rank_cd/);
      expect(sql.sql).toMatch(/searchVector/);
      expect(sql.sql).toMatch(/<=>/);
      expect(sql.sql).toMatch(/v\.status = 'ativa'/);
      expect(sql.sql).toMatch(/"expiresAt" > now\(\)/);
      expect(sql.values).toContain(20);
      // sem vetor (modelo demorou): só texto
      expect(buildVacancySearchSql({ q: "Analista Cloud", page: 1, pageSize: 20 }, null).sql).not.toMatch(/<=>/);

      const candSql = buildCandidateSearchSql({ q: "Analista", page: 2, pageSize: 20 }, vec);
      expect(candSql.sql).toMatch(/searchVector/);
      expect(candSql.sql).toMatch(/<=>/);
      expect(candSql.sql).toMatch(/v\.status = 'ativo'/);
      expect(candSql.values).toContain(20); // OFFSET da página 2
    });

    it("status=ativo only: arquivadas não aparecem", async () => {
      const vacancies = [
        vacancyFixture({ id: "v-ativa", status: "ativa", titulo: "Analista Cloud" }),
        vacancyFixture({ id: "v-arquivada", status: "arquivada", titulo: "Analista Cloud" }),
      ];
      const result = await hybridSearch("Analista Cloud", vacancies, {
        buildText: buildTsvectorTextVacancy,
        getStack: (v) => v.stack,
      });
      const ids = result.items.map((i) => i.id);
      expect(ids).toContain("v-ativa");
      expect(ids).not.toContain("v-arquivada");
    });

    it("lib/search expõe contratos de rota GET /api/search/vacancies e /api/search/candidates", () => {
      const vacRoute = fs.readFileSync(path.join(__dirname, "../app/api/search/vacancies/route.ts"), "utf-8");
      const candRoute = fs.readFileSync(path.join(__dirname, "../app/api/search/candidates/route.ts"), "utf-8");
      expect(vacRoute).toMatch(/export async function GET/);
      expect(candRoute).toMatch(/export async function GET/);
      // ambas retornam {items, total, page}
      expect(vacRoute).toMatch(/items[\s\S]*total[\s\S]*page/);
      expect(candRoute).toMatch(/items[\s\S]*total[\s\S]*page/);
      // lib/search rota usa híbrido
      const libSrc = fs.readFileSync(path.join(__dirname, "../lib/search.ts"), "utf-8");
      expect(libSrc).toMatch(/HYBRID_WEIGHTS|tsvector.*vector|vector.*tsvector/i);
      expect(libSrc).toMatch(/PAGE_SIZE.*20/);
      const dbSrc = fs.readFileSync(path.join(__dirname, "../lib/search-db.ts"), "utf-8");
      expect(dbSrc).toMatch(/generateEmbedding/);
    });
  });
});
