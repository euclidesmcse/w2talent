/** 3.6b: prova fixa determinística, formato JSONL e nota da comparação de modelos. Contas puras. */
import { createHash } from "crypto";
import { naProva, PROVA_EM_CADA, sha256 } from "../lib/treino";
import { f1, jaccard, jsonl, linhaJsonl, notaCamposVaga, notaDaTarefa, notaFicha, notaVaga, palavras } from "../lib/treino-nota";

describe("prova fixa (D5)", () => {
  it("só depende do hash: mesmo hash, mesma resposta", async () => {
    const h = await sha256("exemplo qualquer");
    expect(h).toBe(createHash("sha256").update("exemplo qualquer").digest("hex"));
    expect(naProva(h)).toBe(naProva(h));
    expect(naProva("0000000a" + "f".repeat(56))).toBe(true); // 10 % 10 = 0
    expect(naProva("0000000b" + "f".repeat(56))).toBe(false);
  });

  it("separa perto de 1 em cada 10", async () => {
    let n = 0;
    const total = 2000;
    for (let i = 0; i < total; i++) if (naProva(await sha256(`ex-${i}`))) n++;
    expect(PROVA_EM_CADA).toBe(10);
    expect(n / total).toBeGreaterThan(0.08);
    expect(n / total).toBeLessThan(0.12);
  });
});

describe("JSONL (formato de chat)", () => {
  it("uma linha por exemplo com system/user/assistant; o assistant é a versão corrigida", () => {
    const ex = { sistema: "Extraia a vaga.", entrada: "Vaga de [EMPRESA]\ncom \"aspas\"", saidaFinal: '{"titulo":"Dev"}' };
    const linha = linhaJsonl(ex);
    expect(linha).not.toContain("\n");
    expect(JSON.parse(linha)).toEqual({
      messages: [
        { role: "system", content: "Extraia a vaga." },
        { role: "user", content: "Vaga de [EMPRESA]\ncom \"aspas\"" },
        { role: "assistant", content: '{"titulo":"Dev"}' },
      ],
    });
    const arquivo = jsonl([ex, ex]);
    expect(arquivo.split("\n")).toHaveLength(3);
    expect(arquivo.endsWith("\n")).toBe(true);
    expect(jsonl([])).toBe("");
  });
});

describe("nota da comparação", () => {
  it("palavras, F1 e Jaccard", () => {
    expect(palavras("Ação em AWS, a Kubernetes!")).toEqual(["acao", "em", "aws", "kubernetes"]);
    expect(f1([], [])).toBe(1);
    expect(f1(["a1"], [])).toBe(0);
    expect(f1(["aa", "bb"], ["aa", "bb"])).toBe(1);
    expect(f1(["aa", "bb"], ["aa", "cc"])).toBeCloseTo(0.5);
    expect(jaccard(["aws", "gcp"], ["aws"])).toBeCloseTo(0.5);
    expect(jaccard([], [])).toBe(1);
  });

  const vaga = {
    titulo: "Engenheiro de Dados Pleno",
    nivel: "Pleno",
    regime: "CLT",
    modo: "remoto",
    cidade: "",
    faixaDe: 9000,
    faixaAte: 12000,
    faixaMoeda: "BRL",
    stack: ["python", "sql"],
    descricaoBullets: ["Pipelines em Python"],
    beneficios: ["Plano de saúde"],
  };

  it("vaga: campo a campo", () => {
    expect(notaVaga(vaga, vaga)).toBe(1);
    const campos = notaCamposVaga({ ...vaga, regime: "PJ", stack: ["python"], faixaAte: null }, vaga);
    expect(campos.regime).toBe(0);
    expect(campos.faixaAte).toBe(0);
    expect(campos.stack).toBeCloseTo(0.5);
    expect(campos.titulo).toBe(1);
    expect(notaVaga({ ...vaga, regime: "PJ", stack: ["python"], faixaAte: null }, vaga)).toBeCloseTo(8.5 / 11);
    expect(notaVaga({}, vaga)).toBeLessThan(0.2);
  });

  it("ficha: sobreposição de palavras do resumo e destaques", () => {
    const esp = { resumo: "Analista cloud com 5 anos em AWS.", destaques: ["Migrou 40 servidores"] };
    expect(notaFicha(esp, esp)).toBe(1);
    expect(notaFicha({ resumo: "Analista cloud com 5 anos.", destaques: [] }, esp)).toBeGreaterThan(0.5);
    expect(notaFicha({ resumo: "Texto sem relação.", destaques: [] }, esp)).toBeLessThan(0.2);
    expect(notaDaTarefa("ficha_w2", esp, esp)).toBe(1);
    expect(notaDaTarefa("extract_vacancy", vaga, vaga)).toBe(1);
  });
});
