// 3.2a — Inteligência de mercado: GET /api/mercado (lerMercado sobre uma tabela MarketStat simulada)
// e a tela que desenha a resposta (grupos com poucos dados, "faltam N", sem mínimo/máximo).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { renderToStaticMarkup } = require("react-dom/server") as { renderToStaticMarkup: (el: unknown) => string };
import { NextRequest } from "next/server";
import { NextIntlClientProvider } from "next-intl";

type Linha = {
  semana: Date; skillId: string; nivel: string; regime: string; modo: string; moeda: string; metrica: string;
  n: number; nEmpresas: number | null; nRecentes: number | null; nAnteriores: number | null; p25: number | null; p50: number | null; p75: number | null;
};
const SEMANA = new Date("2026-11-16T00:00:00Z");
const linha = (x: Partial<Linha>): Linha => ({
  semana: SEMANA, skillId: "", nivel: "", regime: "", modo: "", moeda: "", metrica: "demanda",
  n: 0, nEmpresas: null, nRecentes: null, nAnteriores: null, p25: null, p50: null, p75: null, ...x,
});
let linhas: Linha[] = [];
let falhar = false;

const bate = (l: Linha, where: Record<string, any> = {}) =>
  Object.entries(where).every(([k, v]) => {
    const atual = (l as any)[k];
    if (v instanceof Date) return atual.getTime() === v.getTime();
    if (v && typeof v === "object" && Array.isArray(v.in)) return v.in.includes(atual);
    return atual === v;
  });
const marketStat = {
  findFirst: jest.fn(async (q: { where?: Record<string, unknown> } = {}) => {
    if (falhar) throw new Error("sem banco");
    const xs = linhas.filter((l) => bate(l, q.where)).sort((a, b) => b.semana.getTime() - a.semana.getTime());
    return xs[0] ?? null;
  }),
  findMany: jest.fn(async (q: { where?: Record<string, unknown> } = {}) => linhas.filter((l) => bate(l, q.where))),
};
jest.mock("@/lib/prisma", () => ({ prisma: { marketStat }, getPrisma: () => ({ marketStat }) }));

import { GET } from "../app/api/mercado/route";
import { MercadoResultado } from "../components/mercado";
import type { MercadoApi } from "../lib/mercado-tela";
import { tempoLegivel, vagasPorFicha, variacaoPct } from "../lib/mercado-tela";

const pedir = (qs = "") => GET(new NextRequest(`http://x/api/mercado${qs}`));
const msgs = (loc: string) => require(`../messages/${loc}.json`);
const render = (el: unknown, loc = "pt-BR") =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale={loc} messages={msgs(loc)} timeZone="America/Sao_Paulo">
      {el as any}
    </NextIntlClientProvider>,
  );

const faixa = (skillId: string, nivel: string, regime: string, n: number, nEmpresas: number, valores: [number, number, number] | null, metrica: string, modo = "") =>
  linha({ skillId, nivel, regime, modo, moeda: "BRL", metrica, n, nEmpresas, ...(valores ? { p25: valores[0], p50: valores[1], p75: valores[2] } : {}) });

function semear() {
  linhas = [
    faixa("python", "senior", "CLT", 12, 4, [12000, 14000, 16000], "faixa_de"),
    faixa("python", "senior", "CLT", 12, 4, [16000, 18000, 21000], "faixa_ate"),
    faixa("python", "pleno", "PJ", 6, 1, null, "faixa_de"),
    faixa("python", "pleno", "PJ", 6, 1, null, "faixa_ate"),
    faixa("python", "senior", "CLT", 10, 3, [13000, 15000, 17000], "faixa_de", "remoto"),
    faixa("python", "senior", "CLT", 10, 3, [17000, 19000, 22000], "faixa_ate", "remoto"),
    linha({ skillId: "python", nivel: "senior", regime: "CLT", moeda: "BRL", metrica: "pretensao", n: 3 }),
    linha({ skillId: "python", nivel: "pleno", regime: "PJ", moeda: "BRL", metrica: "pretensao", n: 11, p25: 9000, p50: 10000, p75: 12000 }),
    linha({ skillId: "python", metrica: "demanda", n: 20, nEmpresas: 5, nRecentes: 8, nAnteriores: 2 }),
    linha({ skillId: "aws", metrica: "demanda", n: 30, nEmpresas: 6, nRecentes: 6, nAnteriores: 6 }),
    linha({ skillId: "rust", metrica: "demanda", n: 2, nEmpresas: 1, nRecentes: 1, nAnteriores: 0 }),
    linha({ skillId: "python", metrica: "oferta", n: 10 }),
    linha({ skillId: "aws", metrica: "oferta", n: 0 }),
    linha({ metrica: "resposta_horas", n: 40, nEmpresas: 5, p25: 12, p50: 60, p75: 120 }),
  ];
}

beforeEach(() => {
  falhar = false;
  semear();
});

describe("GET /api/mercado", () => {
  it("competência desconhecida → 400", async () => {
    const res = await pedir("?skill=nao-existe");
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBeTruthy();
  });

  it("devolve a visão da competência com nomes, demanda e cache público", async () => {
    const res = await pedir("?skill=python");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, max-age=300");
    const j = (await res.json()) as MercadoApi;
    expect(j.semana).toBe("2026-11-16");
    expect(j.skill).toEqual({ id: "python", label: "Python" });
    expect(j.modo).toBeNull();
    expect(j.faixas).toHaveLength(2);
    const pleno = j.faixas.find((g) => g.nivel === "pleno")!;
    expect(pleno.de).toBeNull();
    expect(pleno.faltam).toEqual({ registros: 4, empresas: 2 });
    const senior = j.faixas.find((g) => g.nivel === "senior")!;
    expect(senior.de).toEqual({ p25: 12000, p50: 14000, p75: 16000 });
    expect(senior.ate?.p50).toBe(18000);
    expect(j.pretensoes.map((p) => [p.nivel, p.valor?.p50 ?? null])).toEqual([["pleno", 10000], ["senior", null]]);
    expect(j.demanda).toMatchObject({ skillId: "python", vagas: 20, fichas: 10 });
    expect(j.demandaFaltamEmpresas).toBe(0);
    // Rust tem 1 empresa: fica fora das listas
    expect(j.maisPedidas.map((d) => d.skillId)).toEqual(["aws", "python"]);
    expect(j.emAlta.map((d) => d.skillId)).toEqual(["python"]);
    expect(j.nomes).toMatchObject({ python: "Python", aws: "AWS" });
    expect(j.respostaHoras).toEqual({ p25: 12, p50: 60, p75: 120 });
    // nunca mínimo nem máximo
    expect(JSON.stringify(j)).not.toMatch(/"(min|max|minimo|maximo)"/);
  });

  it("com modo filtra as faixas e mantém a pretensão de todos os modos; modo inválido é ignorado", async () => {
    const j = (await (await pedir("?skill=python&modo=remoto")).json()) as MercadoApi;
    expect(j.modo).toBe("remoto");
    expect(j.faixas.map((g) => [g.nivel, g.modo, g.de?.p50])).toEqual([["senior", "remoto", 15000]]);
    expect(j.pretensoes).toHaveLength(2);
    expect(j.pretensoesTodosModos).toBe(true);
    const k = (await (await pedir("?skill=python&modo=lua")).json()) as MercadoApi;
    expect(k.modo).toBeNull();
    expect(k.faixas).toHaveLength(2);
  });

  it("demanda de competência com menos de 3 empresas não sai, só quanto falta", async () => {
    const j = (await (await pedir("?skill=rust")).json()) as MercadoApi;
    expect(j.demanda).toBeNull();
    expect(j.demandaFaltamEmpresas).toBe(2);
  });

  it("sem competência: visão geral; banco vazio: semana null", async () => {
    const j = (await (await pedir()).json()) as MercadoApi;
    expect(j.skill).toBeNull();
    expect(j.demanda).toBeNull();
    linhas = [];
    const v = (await (await pedir()).json()) as MercadoApi;
    expect(v.semana).toBeNull();
    expect(v.faixas).toEqual([]);
  });

  it("banco fora do ar → 503 com {error}", async () => {
    falhar = true;
    const erro = jest.spyOn(console, "error").mockImplementation(() => {});
    const res = await pedir("?skill=python");
    erro.mockRestore();
    expect(res.status).toBe(503);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect((await res.json()).error).toBeTruthy();
  });
});

describe("tela /mercado", () => {
  it("mostra faixas, poucos dados com quanto falta, listas e resposta em dias", async () => {
    const j = (await (await pedir("?skill=python")).json()) as MercadoApi;
    const html = render(<MercadoResultado dados={j} />);
    expect(html).toContain("Atualizado na semana de 16 de novembro de 2026");
    expect(html).toContain("Python no W2Talent");
    expect(html).toContain("<caption");
    expect(html).toContain('scope="row"');
    expect(html).toContain("R$ 14.000");
    expect(html).toContain("R$ 12.000 – R$ 16.000");
    expect(html).toContain("Ainda poucos dados");
    expect(html).toContain("faltam 4 vagas · faltam 2 empresas");
    expect(html).toContain("faltam 7 fichas");
    expect(html).toContain('data-skill="aws"');
    expect(html).toContain("+300%");
    // 60 h → 3 dias (≥ 48 h vira dias); 12 h fica em horas
    expect(html).toContain("3 dias");
    expect(html).toContain("12 h");
  });

  it("banco vazio → estado vazio amigável; em inglês e espanhol os textos existem", () => {
    const vazio: MercadoApi = { semana: null, skillId: null, skill: null, modo: null, faixas: [], pretensoes: [], maisPedidas: [], emAlta: [], demanda: null, demandaFaltamEmpresas: 0, pretensoesTodosModos: false, nomes: {}, respostaHoras: null };
    expect(render(<MercadoResultado dados={vazio} />)).toContain("Ainda não há números de mercado");
    expect(render(<MercadoResultado dados={vazio} />, "en")).toContain("No market numbers yet");
    expect(render(<MercadoResultado dados={vazio} />, "es")).toContain("Todavía no hay números del mercado");
  });

  it("os três idiomas têm as mesmas chaves no grupo mercado", () => {
    const chaves = (loc: string) => Object.keys(msgs(loc).mercado).sort();
    expect(chaves("en")).toEqual(chaves("pt-BR"));
    expect(chaves("es")).toEqual(chaves("pt-BR"));
  });
});

describe("contas da tela", () => {
  it("horas, vagas por ficha e aumento", () => {
    expect(tempoLegivel(12)).toEqual({ unidade: "horas", valor: 12 });
    expect(tempoLegivel(47.9)).toEqual({ unidade: "horas", valor: 47.9 });
    expect(tempoLegivel(48)).toEqual({ unidade: "dias", valor: 2 });
    expect(vagasPorFicha({ vagas: 20, fichas: 10 })).toBe(2);
    expect(vagasPorFicha({ vagas: 5, fichas: 0 })).toBeNull();
    expect(variacaoPct({ recentes: 8, anteriores: 2 })).toBe(300);
    expect(variacaoPct({ recentes: 8, anteriores: 0 })).toBeNull();
  });
});
