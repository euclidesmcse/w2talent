// 2.1b: leitura do texto colado da vaga (IA com regras de reserva) e limpeza do rascunho.
import { faixaDoTexto, lerVaga, sanitizarRascunho, type ChatVagaFn } from "../lib/vaga-ai";
import { localidadeDaVaga, rascunhoVazio } from "../lib/vaga-campos";

const TEXTO = `Engenheiro(a) Cloud Sênior
Empresa: Acme. Contato: rh@acme.com.br ou (11) 98765-4321
Regime CLT, híbrido em São Paulo.
Salário: R$ 14.000 a R$ 19.000
Requisitos:
- Experiência com AWS e Terraform
- Kubernetes em produção
Benefícios:
- Plano de saúde
- Vale-refeição`;

const respondeCom = (obj: unknown): ChatVagaFn => async () => ({ text: JSON.stringify(obj), model: "teste" }) as any;

describe("lerVaga", () => {
  it("usa a resposta da IA, limpa e normaliza os campos", async () => {
    const chat = respondeCom({
      titulo: "Engenheiro Cloud Sênior",
      nivel: "senior",
      regime: "CLT",
      cidade: "São Paulo",
      modo: "hybrid",
      stack: ["AWS", "terraform", "Kubernetes", "coisa-que-nao-existe"],
      faixaDe: "19.000",
      faixaAte: 14000,
      faixaMoeda: "brl",
      descricaoBullets: ["- Experiência com AWS", "Experiência com AWS", ""],
      beneficios: ["Plano de saúde"],
    });
    const r = await lerVaga(TEXTO, chat);
    expect(r.origem).toBe("ia");
    expect(r.vaga).toMatchObject({
      titulo: "Engenheiro Cloud Sênior",
      nivel: "Sênior",
      regime: "CLT",
      cidade: "São Paulo",
      modo: "hibrido",
      stack: ["aws", "terraform", "kubernetes"],
      faixaDe: 14000,
      faixaAte: 19000,
      faixaMoeda: "BRL",
      descricaoBullets: ["Experiência com AWS"],
      beneficios: ["Plano de saúde"],
    });
  });

  it("tira e-mail e telefone antes de mandar para a IA", async () => {
    let enviado = "";
    const chat: ChatVagaFn = async (_t, req) => {
      enviado = String(req.messages[1].content);
      return { text: JSON.stringify({ titulo: "X" }) } as any;
    };
    await lerVaga(TEXTO, chat);
    expect(enviado).not.toContain("rh@acme.com.br");
    expect(enviado).not.toContain("98765-4321");
  });

  it("sem IA (ou com resposta ruim), lê pelas regras", async () => {
    for (const chat of [null, respondeCom("não é json"), (async () => { throw new Error("fora"); }) as ChatVagaFn]) {
      const r = await lerVaga(TEXTO, chat);
      expect(r.origem).toBe("regras");
      expect(r.vaga.titulo).toBe("Engenheiro(a) Cloud Sênior");
      expect(r.vaga.nivel).toBe("Sênior");
      expect(r.vaga.regime).toBe("CLT");
      expect(r.vaga.modo).toBe("hibrido");
      expect(r.vaga.cidade).toBe("São Paulo");
      expect(r.vaga.stack).toEqual(expect.arrayContaining(["aws", "terraform", "kubernetes"]));
      expect(r.vaga.faixaDe).toBe(14000);
      expect(r.vaga.faixaAte).toBe(19000);
      expect(r.vaga.descricaoBullets).toEqual(["Experiência com AWS e Terraform", "Kubernetes em produção"]);
      expect(r.vaga.beneficios).toEqual(["Plano de saúde", "Vale-refeição"]);
      expect(JSON.stringify(r.vaga)).not.toContain("rh@acme");
    }
  });
});

describe("faixaDoTexto", () => {
  it.each([
    ["Salário: R$ 8.000 a R$ 12.000", 8000, 12000],
    ["Faixa: 8k - 12k", 8000, 12000],
    ["Salary: US$ 5,000 to 7,000", 5000, 7000],
    ["Remuneração: até R$ 10 mil", null, 10000],
    ["Salário: R$ 6.500", 6500, 6500],
    ["Sem salário informado", null, null],
  ])("%s", (texto, de, ate) => {
    expect(faixaDoTexto(texto)).toEqual({ de, ate });
  });
});

describe("sanitizarRascunho", () => {
  it("o que não serve vira vazio", () => {
    expect(sanitizarRascunho({ nivel: "chefe", regime: "x", modo: 1, faixaDe: -5, faixaAte: "abc", faixaMoeda: "XYZ", stack: "aws" })).toEqual(rascunhoVazio());
    expect(sanitizarRascunho(null)).toEqual(rascunhoVazio());
  });
  it("limita tamanhos e quantidades", () => {
    const r = sanitizarRascunho({ titulo: "a".repeat(500), descricaoBullets: Array.from({ length: 30 }, (_, i) => `item ${i}`), faixaAte: 5_000_000 });
    expect(r.titulo).toHaveLength(120);
    expect(r.descricaoBullets).toHaveLength(12);
    expect(r.faixaAte).toBeNull();
  });
});

describe("localidadeDaVaga", () => {
  it("monta como as vagas guardam", () => {
    expect(localidadeDaVaga("", "remoto")).toBe("Remoto");
    expect(localidadeDaVaga("São Paulo", "hibrido")).toBe("São Paulo (Híbrido)");
    expect(localidadeDaVaga("Curitiba", "")).toBe("Curitiba");
    expect(localidadeDaVaga(" ", "")).toBeNull();
  });
});
