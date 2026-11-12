// Painel do candidato (ideia do portal emagine, aprovada em 2026-11-12): progresso da ficha e o que falta.
import * as fs from "fs";
import * as path from "path";
import { CAMPOS_MINIMOS } from "../lib/ficha";
import { contarCandidaturas, resumoDaFicha, resumoDoTexto } from "../lib/painel";

const ROOT = path.join(__dirname, "..");

const fichaCompleta = {
  nome: "Ana Silva",
  email: "ana@example.com",
  titulo: "Engenheira DevOps",
  senioridade: "senior",
  stack: [{ skillId: "kubernetes", anos: 5 }],
  experiencias: [{ cargo: "DevOps", empresa: "Acme", inicio: "2020-01", fim: "", atual: true }],
  localidade: "São Paulo",
  modo: "remoto",
  regimes: ["PJ"],
  pretensoes: [{ regime: "PJ", valor: 15000, unidade: "mes", moeda: "BRL" }],
  idiomas: [{ idioma: "Inglês", nivel: "avancado" }],
  disponibilidade: "30d",
};
const w2 = { resumo: "DevOps sênior com 5 anos de Kubernetes.", destaques: [], idioma: "pt-BR", geradaEm: "2026-11-12T00:00:00Z", editada: false };

describe("resumo da ficha no painel", () => {
  it("sem rascunho: nada começado, tudo falta", () => {
    const r = resumoDoTexto(null);
    expect(r.comecou).toBe(false);
    expect(r.feitos).toBe(0);
    expect(r.total).toBe(CAMPOS_MINIMOS.length);
    expect(r.faltas).toEqual([...CAMPOS_MINIMOS]);
    expect(r.etapas).toEqual({ cv: false, campos: false, w2: false });
  });

  it("texto inválido no navegador vale como ficha vazia", () => {
    expect(resumoDoTexto("{não é json").comecou).toBe(false);
  });

  it("CV lido (passo conferir) conta como começado, mesmo com campos faltando", () => {
    const r = resumoDaFicha({ passo: "conferir", ficha: { nome: "Ana", email: "ana@example.com" } });
    expect(r.comecou).toBe(true);
    expect(r.feitos).toBe(2);
    expect(r.faltas).not.toContain("nome");
    expect(r.faltas[0]).toBe("titulo");
    expect(r.etapas).toEqual({ cv: true, campos: false, w2: false });
  });

  it("ficha completa sem Ficha W2: campos prontos, W2 pendente", () => {
    const r = resumoDaFicha({ passo: "conferir", ficha: fichaCompleta });
    expect(r.faltas).toEqual([]);
    expect(r.feitos).toBe(r.total);
    expect(r.etapas).toEqual({ cv: true, campos: true, w2: false });
  });

  it("Ficha W2 só conta com os campos completos", () => {
    expect(resumoDaFicha({ passo: "w2", ficha: fichaCompleta, w2 }).etapas.w2).toBe(true);
    expect(resumoDaFicha({ passo: "w2", ficha: { nome: "Ana" }, w2 }).etapas.w2).toBe(false);
  });
});

describe("candidaturas no painel", () => {
  it("respondida também conta como vista", () => {
    expect(contarCandidaturas([{ status: "enviado" }, { status: "visualizado" }, { status: "respondido" }, { status: "arquivado" }])).toEqual({
      total: 4,
      vistas: 2,
      respondidas: 1,
    });
    expect(contarCandidaturas([])).toEqual({ total: 0, vistas: 0, respondidas: 0 });
  });
});

describe("textos do painel", () => {
  const src = fs.readFileSync(path.join(ROOT, "app/painel/page.tsx"), "utf-8");
  // chaves montadas na tela (etapas e números) que o teste do catálogo não enxerga
  const dinamicas = ["etapaCv", "etapaCampos", "etapaW2", "etapaPublicada", "enviadas", "vistas", "respondidas"];

  it.each(["pt-BR", "en", "es"])("%s tem todas as chaves do painel", (loc) => {
    const cat = JSON.parse(fs.readFileSync(path.join(ROOT, "messages", `${loc}.json`), "utf-8"));
    const usadas = new Set([...dinamicas, ...[...src.matchAll(/\bt\("([\w]+)"/g)].map((m) => m[1])]);
    for (const k of usadas) expect([loc, k, typeof cat.painel[k]]).toEqual([loc, k, "string"]);
    for (const c of CAMPOS_MINIMOS) expect([loc, c, typeof cat.ficha[`campo_${c}`]]).toEqual([loc, c, "string"]);
  });
});
