/** Importar CV no estilo JobLeads (plano 2026-11-20): etapas em NDJSON, passos da conferência e dicas de hunter. Sem rede. */
import { NextRequest } from "next/server";

jest.mock("../lib/sessao", () => require("./helpers/sessao-mock").sessaoMock());
import { dicasFicha, lerRespostaEmEtapas, passoDoCampo, tituloRuidoso, type EtapaLeitura } from "../lib/importar-cv";
import { sanitizeFicha, type Ficha } from "../lib/ficha";

const NOW = new Date("2026-11-20T12:00:00Z");

function ficha(over: Record<string, unknown> = {}): Ficha {
  return sanitizeFicha({
    nome: "Ana Maria Silva",
    titulo: "Arquiteta Cloud",
    stack: [{ skillId: "aws", anos: 4 }],
    experiencias: [
      { cargo: "Arquiteta Cloud", empresa: "Fintech", inicio: "2022-03", atual: true, funcoes: ["Desenhou a landing zone"] },
      { cargo: "Analista", empresa: "Varejo", inicio: "2019-01", fim: "2022-02", funcoes: ["Migrou 40 servidores"] },
    ],
    formacao: [{ curso: "Sistemas de Informação", instituicao: "USP", ano: "2018" }],
    ...over,
  });
}

function ndjson(linhas: string[], partir = 7): Response {
  const txt = linhas.join("\n") + "\n";
  const enc = new TextEncoder().encode(txt);
  // corta em pedaços pequenos para testar linhas quebradas entre leituras
  const corpo = new ReadableStream<Uint8Array>({
    start(c) {
      for (let i = 0; i < enc.length; i += partir) c.enqueue(enc.slice(i, i + partir));
      c.close();
    },
  });
  return new Response(corpo, { headers: { "content-type": "application/x-ndjson" } });
}

describe("passos da conferência", () => {
  it("cada campo mínimo mora num passo", () => {
    expect(passoDoCampo("nome")).toBe("pessoais");
    expect(passoDoCampo("pretensao")).toBe("pessoais");
    expect(passoDoCampo("experiencia")).toBe("experiencia");
    expect(passoDoCampo("idiomas")).toBe("formacao");
    expect(passoDoCampo("stack")).toBe("competencias");
  });
});

describe("leitura em etapas", () => {
  it("chama onEtapa por linha e devolve o resultado, mesmo com linhas partidas", async () => {
    const vistas: EtapaLeitura[] = [];
    const r = await lerRespostaEmEtapas(
      ndjson(['{"etapa":"arquivo"}', '{"etapa":"contatos"}', '{"etapa":"desconhecida"}', '{"etapa":"ia"}', '{"etapa":"organizar"}', '{"ficha":{"nome":"Ana"},"origem":"ia"}']),
      (e) => vistas.push(e),
    );
    expect(vistas).toEqual(["arquivo", "contatos", "ia", "organizar"]);
    expect(r).toEqual({ ficha: { nome: "Ana" }, origem: "ia" });
  });

  it("devolve o erro da última linha e ignora lixo", async () => {
    const r = await lerRespostaEmEtapas(ndjson(['{"etapa":"arquivo"}', "não é json", '{"error":"geral"}']), () => {});
    expect(r).toEqual({ error: "geral" });
  });

  it("sem NDJSON, lê o JSON comum", async () => {
    const onEtapa = jest.fn();
    const r = await lerRespostaEmEtapas(new Response(JSON.stringify({ error: "texto_curto" }), { headers: { "content-type": "application/json" } }), onEtapa);
    expect(r).toEqual({ error: "texto_curto" });
    expect(onEtapa).not.toHaveBeenCalled();
  });
});

describe("dicas de hunter", () => {
  it("ficha boa só leva as dicas fixas (nenhuma por regra)", () => {
    expect(dicasFicha(ficha(), "texto curto", NOW)).toEqual([]);
  });

  it("título ruidoso", () => {
    expect(tituloRuidoso("ARQUITETO CLOUD")).toBe(true);
    expect(tituloRuidoso("Cloud | DevOps | SRE")).toBe(true);
    expect(tituloRuidoso("Arquiteto de Soluções Cloud")).toBe(false);
    expect(tituloRuidoso("AWS / Azure")).toBe(false);
    const d = dicasFicha(ficha({ titulo: "ARQUITETO CLOUD" }), null, NOW);
    expect(d).toContainEqual({ codigo: "titulo_ruidoso", passo: "pessoais", n: 1 });
  });

  it("dois integrais ao mesmo tempo por 3 meses ou mais", () => {
    const f = ficha({
      experiencias: [
        { cargo: "Arquiteta", empresa: "A", inicio: "2024-01", atual: true, funcoes: ["x"] },
        { cargo: "Consultora", empresa: "B", inicio: "2023-06", fim: "2024-06", funcoes: ["y"] },
        { cargo: "Freela", empresa: "C", inicio: "2024-01", atual: true, tipo: "freelance", funcoes: ["z"] },
      ],
    });
    const sim = dicasFicha(f, null, NOW).filter((d) => d.codigo === "simultaneos");
    expect(sim).toEqual([{ codigo: "simultaneos", passo: "experiencia", a: "A", b: "B" }]);
    // dois meses de sobreposição não contam
    const curta = ficha({
      experiencias: [
        { cargo: "X", empresa: "A", inicio: "2024-01", fim: "2024-12", funcoes: ["x"] },
        { cargo: "Y", empresa: "B", inicio: "2024-11", fim: "2025-06", funcoes: ["y"] },
      ],
    });
    expect(dicasFicha(curta, null, NOW).some((d) => d.codigo === "simultaneos")).toBe(false);
  });

  it("sem data, funções vazias, CV longo, formação vazia e competências sem anos", () => {
    const f = ficha({
      formacao: [],
      stack: [{ skillId: "aws", anos: 0 }, { skillId: "terraform", anos: 2 }],
      experiencias: [
        { cargo: "Arquiteta", empresa: "A", inicio: "", atual: true, funcoes: [] },
        { cargo: "Analista", empresa: "B", inicio: "2019-01", fim: "2022-02", funcoes: [" "] },
      ],
    });
    const d = dicasFicha(f, "palavra ".repeat(2100), NOW);
    expect(d).toEqual(
      expect.arrayContaining([
        { codigo: "sem_data", passo: "experiencia", n: 1 },
        { codigo: "funcoes_vazias", passo: "experiencia", n: 2 },
        { codigo: "cv_longo", passo: "experiencia", n: 4 },
        { codigo: "formacao_vazia", passo: "formacao" },
        { codigo: "sem_anos", passo: "competencias", n: 1 },
      ]),
    );
  });
});

describe("rota de leitura com etapas", () => {
  const post = (body: unknown, accept?: string) =>
    new NextRequest("http://w2.test/api/ficha/ler", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json", ...(accept ? { accept } : {}) },
    });

  it("manda as etapas na ordem e por último a ficha", async () => {
    const { POST } = await import("../app/api/ficha/ler/route");
    const res = await POST(post({ aceiteIa: true, texto: "Ana Maria Silva\nana@exemplo.com\nArquiteta Cloud na Fintech desde 2022, AWS e Terraform." }, "application/x-ndjson"));
    expect(res.headers.get("content-type")).toContain("application/x-ndjson");
    const vistas: EtapaLeitura[] = [];
    const r = await lerRespostaEmEtapas(res, (e) => vistas.push(e));
    expect(vistas).toEqual(["arquivo", "contatos", "ia", "organizar"]);
    expect(r.ficha).toBeTruthy();
    expect(String(r.cvTexto)).not.toContain("ana@exemplo.com");
  });

  it("texto curto vira a linha de erro, sem etapas", async () => {
    const { POST } = await import("../app/api/ficha/ler/route");
    const vistas: EtapaLeitura[] = [];
    const r = await lerRespostaEmEtapas(await POST(post({ aceiteIa: true, texto: "oi" }, "application/x-ndjson")), (e) => vistas.push(e));
    expect(vistas).toEqual([]);
    expect(r).toEqual({ error: "texto_curto" });
  });
});
