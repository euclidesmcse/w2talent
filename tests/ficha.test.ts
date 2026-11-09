/** Ficha do candidato (1.5.10 + 1.5.11): formato, ficha mínima, leitura do CV e Ficha W2. Sem rede. */
import { NextRequest } from "next/server";
import {
  anosExperiencia,
  camposFaltando,
  fichaToProfile,
  fichaVazia,
  nomeCurto,
  sanitizeFicha,
  sanitizeFichaW2,
  topSkills,
  type Ficha,
} from "../lib/ficha";
import { contatosDoTexto, gerarFichaW2, nomeDoTexto, lerCv, MAX_CV_CHARS, parseJsonObject, type ChatFn } from "../lib/ficha-ai";
import { DEMO_CANDIDATES, DEMO_FICHAS } from "../lib/demo-data";

const NOW = new Date("2026-11-09T12:00:00Z");

function fichaCompleta(over: Partial<Ficha> = {}): Ficha {
  return sanitizeFicha({
    nome: "Ana Maria Silva",
    email: "ana@exemplo.com",
    celular: "(11) 98765-4321",
    titulo: "Analista Cloud",
    senioridade: "pleno",
    stack: [{ skillId: "aws", anos: 4 }, { nome: "Terraform", anos: 3 }],
    experiencias: [
      { cargo: "Analista Cloud", empresa: "Fintech", inicio: "2022-03", fim: "", atual: true },
      { cargo: "Suporte", empresa: "Varejo", inicio: "2019-01", fim: "2022-02" },
    ],
    localidade: "São Paulo, SP",
    modo: "remoto",
    regimes: ["CLT"],
    pretensoes: [{ regime: "CLT", valor: 9000 }],
    idiomas: [{ idioma: "Inglês", nivel: "avancado" }],
    disponibilidade: "30d",
    ...over,
  });
}

/** Chat falso que guarda o que recebeu. */
function fakeChat(resposta: string | Error) {
  const calls: { task: string; req: Parameters<ChatFn>[1] }[] = [];
  const fn: ChatFn = async (task, req) => {
    calls.push({ task, req });
    if (resposta instanceof Error) throw resposta;
    return { text: resposta, model: "modelo-teste" } as any;
  };
  return { fn, calls };
}

describe("formato da ficha", () => {
  it("limpa a entrada e aceita apelidos", () => {
    const f = sanitizeFicha({
      nome: "  Ana  ",
      email: "ANA@Exemplo.com",
      senioridade: "Sênior",
      modo: "Híbrido",
      regimePreferido: ["clt", "pj", "pj", "xyz"],
      stack: ["AWS", { nome: "Terraform", anos: 3 }, { nome: "habilidade que não existe" }, "aws"],
      experiencias: [{ cargo: "Dev", empresa: "X", inicio: "03/2020", fim: "atual" }, { cargo: "", empresa: "" }],
      idiomas: [{ idioma: "Inglês", nivel: "fluente" }, { idioma: "", nivel: "basico" }],
      objetivoCrescimento: "Liderar um time",
      pretensaoDe: 12000,
      pretensaoAte: 8000,
      lixo: "ignorado",
    });
    expect(f.nome).toBe("Ana");
    expect(f.email).toBe("ana@exemplo.com");
    expect(f.senioridade).toBe("senior");
    expect(f.modo).toBe("hibrido");
    expect(f.regimes).toEqual(["CLT", "PJ"]);
    expect(f.stack.map((s) => s.skillId)).toEqual(["aws", "terraform"]);
    expect(f.experiencias).toEqual([{ cargo: "Dev", empresa: "X", inicio: "2020-03", fim: "", atual: true }]);
    expect(f.idiomas).toEqual([{ idioma: "Inglês", nivel: "fluente" }]);
    expect(f.objetivo).toBe("Liderar um time");
    // formato antigo (um valor só): o menor vira o mínimo do primeiro regime
    expect(f.pretensoes).toEqual([
      { regime: "CLT", valor: 8000, unidade: "mes", moeda: "BRL" },
      { regime: "PJ", valor: null, unidade: "mes", moeda: "BRL" },
    ]);
    expect((f as any).lixo).toBeUndefined();
  });

  it("e-mail inválido some; lixo vira ficha vazia", () => {
    expect(sanitizeFicha({ email: "não é e-mail" }).email).toBe("");
    expect(sanitizeFicha(null)).toEqual(fichaVazia());
    expect(sanitizeFicha("texto")).toEqual(fichaVazia());
  });

  it("ficha mínima: diz o que falta, na ordem da tela", () => {
    expect(camposFaltando(fichaCompleta())).toEqual([]);
    expect(camposFaltando(fichaVazia())).toEqual([
      "nome", "email", "titulo", "senioridade", "stack", "experiencia", "localidade", "modo", "regimes", "pretensao", "idiomas", "disponibilidade",
    ]);
    // celular e objetivo não são obrigatórios
    expect(camposFaltando(fichaCompleta({ celular: "", objetivo: "" }))).toEqual([]);
    // competência sem anos não conta
    expect(camposFaltando(fichaCompleta({ stack: [{ skillId: "aws", anos: 0 }] }))).toEqual(["stack"]);
    // idioma sem nível não conta
    expect(camposFaltando(fichaCompleta({ idiomas: [{ idioma: "Inglês", nivel: "" }] }))).toEqual(["idiomas"]);
  });

  it("anos de experiência, top competências e nome curto", () => {
    const f = fichaCompleta();
    expect(anosExperiencia(f, NOW)).toBe(7);
    expect(anosExperiencia(fichaCompleta({ experiencias: [{ cargo: "A", empresa: "B", inicio: "2018-01", fim: "2020-06", atual: false }] }), NOW)).toBe(2);
    expect(anosExperiencia(fichaCompleta({ experiencias: [] }), NOW)).toBe(4);
    // intervalo sem emprego não conta; sobreposição conta uma vez
    const exp = (l: [string, string][]) => fichaCompleta({ experiencias: l.map(([inicio, fim]) => ({ cargo: "A", empresa: "B", inicio, fim, atual: false })) });
    expect(anosExperiencia(exp([["2015-01", "2016-01"], ["2024-01", "2025-01"]]), NOW)).toBe(2);
    expect(anosExperiencia(exp([["2015-01", "2019-01"], ["2017-01", "2021-01"]]), NOW)).toBe(6);
    // fim em branco sem "atual": não conta até hoje e a ficha mínima pede o fim
    expect(anosExperiencia(exp([["2015-01", ""], ["2024-01", "2025-01"]]), NOW)).toBe(1);
    expect(camposFaltando(exp([["2015-01", ""]]))).toEqual(["experiencia"]);
    expect(topSkills(f).map((s) => s.skillId)).toEqual(["aws", "terraform"]);
    expect(nomeCurto("Ana Maria Silva")).toBe("Ana S.");
    expect(nomeCurto("Ana")).toBe("Ana");
    expect(nomeCurto("  ")).toBe("");
  });

  it("Ficha W2: sem resumo não vale; destaques limitados", () => {
    expect(sanitizeFichaW2({ resumo: "  " })).toBeNull();
    expect(sanitizeFichaW2(null)).toBeNull();
    const w = sanitizeFichaW2({ resumo: "x".repeat(600), destaques: ["a", "", 3, "b", "c", "d"], editada: true })!;
    expect(w.resumo).toHaveLength(420);
    expect(w.destaques).toEqual(["a", "b", "c"]);
    expect(w.editada).toBe(true);
  });

  it("ficha → colunas do perfil (celular vazio vira null)", () => {
    const p = fichaToProfile(fichaCompleta({ celular: "", objetivo: "" }));
    expect(p.celular).toBeNull();
    expect(p.objetivoCrescimento).toBeNull();
    expect(p.regimePreferido).toEqual(["CLT"]);
    expect(p.senioridade).toBe("pleno");
  });

  it("pretensão por regime: unidade fixa onde não se escolhe, uma por regime, regime marcado junto", () => {
    const f = sanitizeFicha({
      regimes: ["CLT"],
      pretensoes: [
        { regime: "CLT", valor: 12000, unidade: "hora", moeda: "BRL" },
        { regime: "clt", valor: 1 },
        { regime: "freela", valor: 50, unidade: "hora", moeda: "USD" },
        { regime: "nada", valor: 3 },
      ],
    });
    expect(f.regimes).toEqual(["CLT", "Freelancer"]);
    expect(f.pretensoes).toEqual([
      { regime: "CLT", valor: 12000, unidade: "mes", moeda: "BRL" },
      { regime: "Freelancer", valor: 50, unidade: "hora", moeda: "USD" },
    ]);
  });

  it("pretensão: falta enquanto algum regime marcado estiver sem valor", () => {
    expect(camposFaltando(fichaCompleta())).not.toContain("pretensao");
    const dois = fichaCompleta({ regimes: ["CLT", "PJ"], pretensoes: [{ regime: "CLT", valor: 9000, unidade: "mes", moeda: "BRL" }] });
    expect(dois.pretensoes.map((p) => [p.regime, p.valor])).toEqual([["CLT", 9000], ["PJ", null]]);
    expect(camposFaltando(dois)).toContain("pretensao");
  });

  it("perfil guarda só pretensões com valor, e a coluna antiga fica com a primeira mensal", () => {
    const p = fichaToProfile(
      fichaCompleta({
        regimes: ["Freelancer", "PJ", "CLT"],
        pretensoes: [
          { regime: "Freelancer", valor: 60, unidade: "hora", moeda: "USD" },
          { regime: "PJ", valor: 18000, unidade: "mes", moeda: "BRL" },
          { regime: "CLT", valor: null, unidade: "mes", moeda: "BRL" },
        ],
      }),
    );
    expect(p.pretensoes.map((x) => x.regime)).toEqual(["Freelancer", "PJ"]);
    expect([p.pretensaoDe, p.pretensaoAte, p.pretensaoMoeda]).toEqual([18000, null, "BRL"]);
  });

  it("os candidatos de demonstração têm ficha mínima e Ficha W2", () => {
    for (const c of DEMO_CANDIDATES) {
      expect(DEMO_FICHAS[c.userId]).toBeDefined();
      expect(camposFaltando(sanitizeFicha({ ...c, idiomas: c.idiomas }))).toEqual([]);
      expect(sanitizeFichaW2(c.fichaW2)).not.toBeNull();
    }
  });
});

describe("leitura do CV", () => {
  const CV = `Ana Maria Silva
ana.silva@gmail.com | +55 (11) 98765-4321 | linkedin.com/in/anasilva
Rua das Flores, 123 - São Paulo
Analista Cloud Pleno com AWS e Terraform desde 2022.`;

  it("lê contatos por regras", () => {
    expect(contatosDoTexto(CV)).toEqual({ email: "ana.silva@gmail.com", celular: "+55 (11) 98765-4321", links: ["linkedin.com/in/anasilva"] });
  });

  it("aceita JSON com cerca de código e texto em volta", () => {
    expect(parseJsonObject('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJsonObject('Aqui está: {"a":{"b":2}} pronto')).toEqual({ a: { b: 2 } });
    expect(parseJsonObject("[1,2]")).toBeNull();
    expect(parseJsonObject("sem json")).toBeNull();
    expect(parseJsonObject("{quebrado")).toBeNull();
  });

  it("a IA não recebe contatos nem endereço; os contatos voltam pelas regras", async () => {
    const chat = fakeChat(JSON.stringify({ nome: "Ana Maria Silva", titulo: "Analista Cloud", senioridade: "pleno", email: "inventado@ia.com", stack: [{ nome: "AWS", anos: 3 }] }));
    const r = await lerCv(CV, chat.fn);
    expect(r.origem).toBe("ia");
    expect(r.modelo).toBe("modelo-teste");
    expect(chat.calls).toHaveLength(1);
    expect(chat.calls[0].task).toBe("extract_cv");
    const enviado = chat.calls[0].req.messages.map((m) => m.content).join("\n");
    expect(enviado).not.toContain("ana.silva@gmail.com");
    expect(enviado).not.toContain("98765-4321");
    expect(enviado).not.toContain("linkedin.com/in/anasilva");
    expect(enviado).not.toContain("Rua das Flores");
    expect(chat.calls[0].req.messages[0].content).toMatch(/Never use, infer or mention age/);
    expect(r.ficha.email).toBe("ana.silva@gmail.com");
    expect(r.ficha.celular).toBe("+55 (11) 98765-4321");
    expect(r.ficha.stack).toEqual([{ skillId: "aws", anos: 3 }]);
  });

  it("corta o texto em 30 mil caracteres", async () => {
    const chat = fakeChat("{}");
    await lerCv("a ".repeat(40_000), chat.fn);
    expect(chat.calls[0].req.messages[1].content.length).toBeLessThanOrEqual(MAX_CV_CHARS);
  });

  it("sem IA, com erro ou com JSON ruim: volta para as regras", async () => {
    for (const chat of [null, fakeChat(new Error("fora do ar")).fn, fakeChat("não sei").fn]) {
      const r = await lerCv(CV, chat);
      expect(r.origem).toBe("regras");
      expect(r.aviso).toBe("confira_campos");
      expect(r.ficha.email).toBe("ana.silva@gmail.com");
      expect(r.ficha.nome).toBe("Ana Maria Silva");
    }
  });

  it("nome por regras só quando a primeira linha parece um nome", () => {
    expect(nomeDoTexto("\n  José D'Ávila Souza \nAnalista")).toBe("José D'Ávila Souza");
    expect(nomeDoTexto("Currículo 2026\nAna")).toBe("");
    expect(nomeDoTexto("ana@x.com")).toBe("");
    expect(nomeDoTexto("Ana")).toBe("");
  });
});

describe("Ficha W2 pela IA", () => {
  it("manda a ficha sem nome nem contatos e devolve resumo e até 3 destaques", async () => {
    const chat = fakeChat(JSON.stringify({ resumo: " Analista cloud com 7 anos. ", destaques: ["Migrou 40 servidores", "", 5, "b", "c", "d"] }));
    const w2 = await gerarFichaW2(fichaCompleta({ links: ["github.com/ana"] }), "en", chat.fn, NOW);
    expect(chat.calls[0].task).toBe("ficha_w2");
    const enviado = chat.calls[0].req.messages.map((m) => m.content).join("\n");
    expect(enviado).not.toMatch(/Ana Maria|ana@exemplo|98765|github\.com\/ana/);
    expect(enviado).toMatch(/Write in English/);
    expect(w2).toEqual({
      resumo: "Analista cloud com 7 anos.",
      destaques: ["Migrou 40 servidores", "b", "c"],
      idioma: "en",
      geradaEm: NOW.toISOString(),
      modelo: "modelo-teste",
      editada: false,
    });
  });

  it("idioma desconhecido vira pt-BR; resposta sem resumo lança", async () => {
    const ok = fakeChat('{"resumo":"Resumo."}');
    expect((await gerarFichaW2(fichaCompleta(), "fr", ok.fn, NOW)).idioma).toBe("pt-BR");
    await expect(gerarFichaW2(fichaCompleta(), "pt-BR", fakeChat('{"destaques":[]}').fn, NOW)).rejects.toThrow();
  });
});

describe("rotas da ficha (sem banco)", () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });
  const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
    new NextRequest(`http://w2.test${url}`, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", ...headers } });

  it("ler: exige o aceite, texto mínimo e a mesma origem", async () => {
    const { POST } = await import("../app/api/ficha/ler/route");
    const sem = await POST(post("/api/ficha/ler", { texto: "x".repeat(100) }));
    expect(sem.status).toBe(400);
    expect(await sem.json()).toEqual({ error: "aceite_ia_obrigatorio" });
    const curto = await POST(post("/api/ficha/ler", { texto: "oi", aceiteIa: true }));
    expect(curto.status).toBe(422);
    const fora = await POST(post("/api/ficha/ler", { texto: "x".repeat(100), aceiteIa: true }, { origin: "https://outro.site" }));
    expect(fora.status).toBe(403);
    // arquivo grande é recusado antes de contar o uso e antes de converter
    const fd = new FormData();
    fd.set("aceiteIa", "true");
    fd.set("arquivo", new File([new Uint8Array(5 * 1024 * 1024 + 1)], "cv.pdf", { type: "application/pdf" }));
    const grande = await POST(new NextRequest("http://w2.test/api/ficha/ler", { method: "POST", body: fd }));
    expect(grande.status).toBe(413);
  });

  it("w2: exige o aceite e a ficha mínima", async () => {
    const { POST } = await import("../app/api/ficha/w2/route");
    expect((await POST(post("/api/ficha/w2", { ficha: fichaCompleta() }))).status).toBe(400);
    const inc = await POST(post("/api/ficha/w2", { ficha: { nome: "Ana" }, aceiteIa: true }));
    expect(inc.status).toBe(422);
    const j = await inc.json();
    expect(j.error).toBe("ficha_incompleta");
    expect(j.falta).toContain("email");
  });

  it("publicar: só o admin", async () => {
    const { POST, GET } = await import("../app/api/ficha/publicar/route");
    delete process.env.ADMIN_SECRET;
    expect((await POST(post("/api/ficha/publicar", {}))).status).toBe(503);
    process.env.ADMIN_SECRET = "uma-senha-de-admin-bem-comprida-123";
    expect((await POST(post("/api/ficha/publicar", { ficha: fichaCompleta() }))).status).toBe(401);
    const g = await GET(new NextRequest("http://w2.test/api/ficha/publicar"));
    expect(await g.json()).toEqual({ podePublicar: false });
  });
});
