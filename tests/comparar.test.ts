// 2.3a Comparar candidatos: leitura dos ids e item sem contatos (plano 2.3, D3).
import * as fs from "fs";
import * as path from "path";
import { COMPARAR_MAX, idsDoPedido, itemDaComparacao } from "../lib/comparar";
import { withoutContacts } from "../lib/search";
import { SELECTION_LIMIT } from "../lib/selection-store";

const ROOT = path.join(__dirname, "..");

describe("idsDoPedido", () => {
  it("aceita de 1 a 10 ids de texto", () => {
    expect(idsDoPedido(["a"])).toEqual(["a"]);
    expect(idsDoPedido(Array.from({ length: COMPARAR_MAX }, (_, i) => `c${i}`))).toHaveLength(COMPARAR_MAX);
    expect(COMPARAR_MAX).toBe(SELECTION_LIMIT);
  });
  it("recusa vazio, mais de 10, repetidos, não texto e não lista", () => {
    expect(idsDoPedido([])).toBeNull();
    expect(idsDoPedido(Array.from({ length: COMPARAR_MAX + 1 }, (_, i) => `c${i}`))).toBeNull();
    expect(idsDoPedido(["a", "a"])).toBeNull();
    expect(idsDoPedido(["a", 3])).toBeNull();
    expect(idsDoPedido("a")).toBeNull();
    expect(idsDoPedido(["x".repeat(65)])).toBeNull();
  });
});

describe("itemDaComparacao", () => {
  const row = {
    id: "p1",
    userId: "u1",
    nome: "Ana Silva",
    titulo: "Engenheira DevOps",
    senioridade: "senior",
    email: "ana.silva@exemplo.com",
    celular: "+5511999990001",
    fotoUrl: "https://exemplo.com/ana.jpg",
    links: ["https://linkedin.com/in/ana"],
    stack: [{ skillId: "kubernetes", anos: 5 }, { skillId: "aws", anos: 3 }],
    experiencias: [{ cargo: "DevOps", empresa: "Acme", inicio: "2018-01", fim: "", atual: true }],
    localidade: "São Paulo",
    modo: "remoto",
    regimePreferido: ["PJ"],
    pretensoes: [{ regime: "PJ", valor: 15000, unidade: "mes", moeda: "BRL" }],
    idiomas: [{ idioma: "Inglês", nivel: "avancado" }],
    disponibilidade: "30d",
    fichaW2: { resumo: "DevOps sênior.", destaques: ["Migrou 40 serviços"], idioma: "pt-BR", geradaEm: "2026-11-01T00:00:00Z", editada: false },
    updatedAt: new Date("2026-11-10T00:00:00Z"),
  };

  it("leva os campos da Ficha W2 e só o contato mascarado", () => {
    const it = itemDaComparacao(withoutContacts(row), { match: 82, gaps: [] }, new Date("2026-11-18T00:00:00Z"));
    expect(it).toMatchObject({
      id: "p1",
      nome: "Ana Silva",
      senioridade: "senior",
      regimes: ["PJ"],
      resumo: "DevOps sênior.",
      destaques: ["Migrou 40 serviços"],
      match: 82,
      updatedAt: "2026-11-10T00:00:00.000Z",
    });
    expect(it.stack.map((s) => s.skillId)).toEqual(["kubernetes", "aws"]);
    expect(it.anos).toBeGreaterThanOrEqual(8);
    expect(it.emailMasked).not.toContain("ana.silva");
    const json = JSON.stringify(it);
    expect(json).not.toContain("ana.silva@exemplo.com");
    expect(json).not.toContain("999990001");
    expect(json).not.toContain("ana.jpg");
    expect(json).not.toContain("linkedin");
    expect(json).not.toContain("Acme");
  });

  it("sem vaga, match vazio", () => {
    expect(itemDaComparacao(withoutContacts(row), null)).toMatchObject({ match: null, gaps: [] });
  });
});

describe("tela e textos do 2.3a", () => {
  it("botão Comparar na barra de Candidatos leva a vaga escolhida", () => {
    const tela = fs.readFileSync(path.join(ROOT, "app/candidatos/page.tsx"), "utf8");
    expect(tela).toMatch(/compararHref=\{`\/candidatos\/comparar\$\{filtros\.vaga/);
  });
  it("textos nos três idiomas", () => {
    const chaves = Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, "messages/pt-BR.json"), "utf8")).comparar);
    for (const l of ["en", "es"]) {
      const m = JSON.parse(fs.readFileSync(path.join(ROOT, `messages/${l}.json`), "utf8"));
      expect(Object.keys(m.comparar).sort()).toEqual([...chaves].sort());
      expect(typeof m.batch.compare).toBe("string");
    }
  });
});
