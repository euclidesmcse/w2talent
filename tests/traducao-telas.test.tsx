// 2.7a — Tradução automática nas telas de vagas: as rotas anexam `traducao` (sem mexer no original)
// e a tela mostra a tradução com o aviso e o botão "Ver original". lib/traducao fica simulada aqui.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { renderToStaticMarkup } = require("react-dom/server") as { renderToStaticMarkup: (el: unknown) => string };
import { NextRequest } from "next/server";
import { NextIntlClientProvider } from "next-intl";

const traducoesDasVagas = jest.fn();
const pedirTraducaoVagas = jest.fn();
const prismaFalso: Record<string, unknown> = { vacancy: { findUnique: jest.fn(async () => { throw new Error("sem banco"); }) } };

jest.mock("@/lib/traducao", () => ({
  idiomaValido: (v: unknown) => v === "pt-BR" || v === "en" || v === "es",
  traducoesDasVagas: (...a: unknown[]) => traducoesDasVagas(...a),
  pedirTraducaoVagas: (...a: unknown[]) => pedirTraducaoVagas(...a),
}));
jest.mock("@/lib/prisma", () => ({ prisma: prismaFalso, getPrisma: () => prismaFalso }));
jest.mock("@/lib/empresa", () => ({ anexarEmpresas: async (_db: unknown, itens: unknown[]) => itens }));
jest.mock("@/lib/search", () => ({
  PAGE_SIZE: 20,
  searchVacancies: async () => ({
    items: [
      { id: "v1", titulo: "Engenheiro de Dados", descricaoBullets: ["Pipelines em Spark"], stack: [], faixaDe: null, faixaAte: null },
      { id: "v2", titulo: "Data Analyst", descricaoBullets: [], stack: [], faixaDe: null, faixaAte: null },
    ],
    total: 2,
    page: 1,
    pageSize: 20,
    totalPages: 1,
    entendeu: [],
  }),
}));

import { GET as buscar } from "../app/api/search/vacancies/route";
import { GET as parecidas } from "../app/api/vacancies/[id]/parecidas/route";
import { TraducaoAviso, textoExibido } from "../components/traducao-aviso";
import { VacancyTable } from "../components/vacancy-table";

const tradV1 = { titulo: "Data Engineer", descricaoBullets: ["Spark pipelines"], beneficios: [], idiomaOrigem: "pt-BR" };
const esperar = () => new Promise((r) => setTimeout(r, 0));

const msgs = (loc: string) => require(`../messages/${loc}.json`);
const render = (el: unknown, loc = "pt-BR") =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale={loc} messages={msgs(loc)} timeZone="America/Sao_Paulo">
      {el as any}
    </NextIntlClientProvider>,
  );

beforeEach(() => {
  traducoesDasVagas.mockReset();
  pedirTraducaoVagas.mockReset();
  pedirTraducaoVagas.mockResolvedValue(undefined);
});

describe("GET /api/search/vacancies — tradução anexada", () => {
  it("anexa a tradução do idioma pedido sem trocar os campos originais e pede as que faltam", async () => {
    traducoesDasVagas.mockResolvedValue(new Map([["v1", tradV1]]));
    const res = await buscar(new NextRequest("http://x/api/search/vacancies?q=dados&lang=en"));
    const j = await res.json();
    expect(traducoesDasVagas).toHaveBeenCalledWith(prismaFalso, ["v1", "v2"], "en");
    expect(j.items[0].titulo).toBe("Engenheiro de Dados");
    expect(j.items[0].descricaoBullets).toEqual(["Pipelines em Spark"]);
    expect(j.items[0].traducao).toEqual({ idioma: "en", idiomaOrigem: "pt-BR", titulo: "Data Engineer", descricaoBullets: ["Spark pipelines"], beneficios: [] });
    expect(j.items[1].traducao).toBeNull();
    await esperar();
    expect(pedirTraducaoVagas).toHaveBeenCalledWith(prismaFalso, ["v1", "v2"], 3);
  });

  it("usa o cabeçalho x-locale quando não há ?lang=", async () => {
    traducoesDasVagas.mockResolvedValue(new Map());
    await buscar(new NextRequest("http://x/api/search/vacancies", { headers: { "x-locale": "es" } }));
    expect(traducoesDasVagas.mock.calls[0][2]).toBe("es");
  });

  it("banco fora do ar: a busca responde e as vagas ficam sem tradução", async () => {
    traducoesDasVagas.mockRejectedValue(new Error("sem banco"));
    const res = await buscar(new NextRequest("http://x/api/search/vacancies?lang=en"));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.items.map((i: { traducao: unknown }) => i.traducao)).toEqual([null, null]);
    await esperar();
    expect(pedirTraducaoVagas).not.toHaveBeenCalled();
  });
});

describe("GET /api/vacancies/[id]/parecidas — tradução anexada", () => {
  it("lê ?lang= e anexa a tradução também nos dados de demonstração", async () => {
    traducoesDasVagas.mockImplementation(async (_db: unknown, ids: string[]) => new Map([[ids[0], tradV1]]));
    const res = await parecidas(new NextRequest("http://x/api/vacancies/demo-v-01/parecidas?lang=es"), { params: Promise.resolve({ id: "demo-v-01" }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("vary")).toBe("x-locale");
    const j = await res.json();
    expect(traducoesDasVagas.mock.calls[0][2]).toBe("es");
    expect(j.items.length).toBeGreaterThan(0);
    expect(j.items[0].traducao.titulo).toBe("Data Engineer");
    expect(j.items[0].titulo).not.toBe("Data Engineer");
  });
});

describe("Aviso de tradução automática", () => {
  const vaga = { titulo: "Engenheiro de Dados", descricaoBullets: ["Pipelines em Spark"], beneficios: ["VR"], traducao: { idioma: "en" as const, ...tradV1, beneficios: ["Meal voucher"] } };

  it("textoExibido: tradução por padrão, original a pedido (com o idioma dele)", () => {
    expect(textoExibido(vaga, false)).toEqual({ titulo: "Data Engineer", descricaoBullets: ["Spark pipelines"], beneficios: ["Meal voucher"], traduzida: true });
    expect(textoExibido(vaga, true)).toEqual({ titulo: "Engenheiro de Dados", descricaoBullets: ["Pipelines em Spark"], beneficios: ["VR"], traduzida: true, lang: "pt-BR" });
    expect(textoExibido({ ...vaga, traducao: null }, false)).toMatchObject({ titulo: "Engenheiro de Dados", traduzida: false });
  });

  it("botão Ver original / Ver tradução (rótulo muda, sem aria-pressed), nos três idiomas", () => {
    const html = render(<TraducaoAviso verOriginal={false} onAlternar={() => {}} />);
    expect(html).toContain('data-action="ver-original"');
    expect(html).not.toContain("aria-pressed");
    expect(html).toContain("Tradução automática");
    expect(html).toContain("Ver original");
    expect(html).toContain('href="/ia#traducao"');
    const aberto = render(<TraducaoAviso verOriginal onAlternar={() => {}} />);
    expect(aberto).toContain("Ver tradução");
    expect(render(<TraducaoAviso verOriginal={false} onAlternar={() => {}} />, "en")).toContain("Show original");
    expect(render(<TraducaoAviso verOriginal={false} onAlternar={() => {}} />, "es")).toContain("Traducción automática");
  });

  it("a lista de vagas mostra o título traduzido com o aviso; sem tradução, nada muda", () => {
    const html = render(<VacancyTable items={[{ id: "v1", stack: [], faixaDe: null, faixaAte: null, ...vaga }]} />, "en");
    expect(html).toContain("Data Engineer");
    expect(html).not.toContain("Engenheiro de Dados");
    expect(html).toContain('data-action="ver-original"');
    const sem = render(<VacancyTable items={[{ id: "v1", stack: [], faixaDe: null, faixaAte: null, ...vaga, traducao: null }]} />, "en");
    expect(sem).toContain("Engenheiro de Dados");
    expect(sem).not.toContain("data-traducao-aviso");
  });
});
