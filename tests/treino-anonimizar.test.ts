/** 3.6a (D3): anonimização dos exemplos de treino e a rede de segurança que recusa sobras. */
import { anonimizar, anonimizarValor, cpfValido, partesDoNome, sobras, sobrasValor, type Conhecidos } from "../lib/ai/anonimizar";

const MARIA: Conhecidos = {
  nomes: ["Maria da Conceição Silva"],
  emails: ["maria.silva@gmail.com"],
  telefones: ["+55 11 98765-4321"],
  empresas: ["Acme Tecnologia"],
};

const limpo = (t: string, c: Conhecidos = {}) => {
  const a = anonimizar(t, c);
  expect(sobras(a, c)).toEqual([]);
  return a;
};

describe("anonimizar: e-mails", () => {
  it.each([
    ["Contato: joao.souza+cv@empresa.com.br", "Contato: [EMAIL]"],
    ["Email: JOHN_DOE@example.co.uk.", "Email: [EMAIL]."],
    ["correo: ana(arroba)correo(punto)es", "correo: [EMAIL]"],
    ["mail me: john [at] gmail [dot] com", "mail me: [EMAIL]"],
  ])("%s", (entrada, esperado) => expect(limpo(entrada)).toBe(esperado));
});

describe("anonimizar: links", () => {
  it.each([
    ["Portfólio: https://maria.dev/projetos?x=1", "Portfólio: [LINK]"],
    ["linkedin.com/in/maria-silva-123", "[LINK]"],
    ["Veja www.meusite.com.br", "Veja [LINK]"],
    ["github.com/msilva e gitlab.com/ms", "[LINK] e [LINK]"],
    ["Mi web: juanperez.es", "Mi web: [LINK]"],
  ])("%s", (entrada, esperado) => expect(limpo(entrada)).toBe(esperado));

  it("não confunde tecnologias com links", () => {
    const t = "ASP.NET Core, VB.NET, Node.js, Vue.js, Socket.io e .NET 8";
    expect(limpo(t)).toBe(t);
  });
});

describe("anonimizar: documentos", () => {
  it.each([
    ["CPF: 529.982.247-25", "CPF: [DOCUMENTO]"],
    ["cpf 52998224725", "cpf: [DOCUMENTO]"],
    ["Meu CPF é 52998224725.", "Meu CPF é [DOCUMENTO]."],
    ["CNPJ 11.222.333/0001-81", "CNPJ: [DOCUMENTO]"],
    ["Empresa 11222333000181", "Empresa [DOCUMENTO]"],
    ["RG 12.345.678-9", "RG: [DOCUMENTO]"],
    ["DNI 12345678Z", "DNI: [DOCUMENTO]"],
    ["NIE X1234567L", "NIE: [DOCUMENTO]"],
    ["SSN 123-45-6789", "SSN: [DOCUMENTO]"],
    ["Passport number: AB1234567", "Passport number: [DOCUMENTO]"],
    ["CURP GODE561231HDFRRN09", "CURP: [DOCUMENTO]"],
  ])("%s", (entrada, esperado) => expect(limpo(entrada)).toBe(esperado));

  it("não troca o rótulo sem número", () => {
    expect(limpo("Envie RG e CPF no primeiro dia")).toBe("Envie RG e CPF no primeiro dia");
  });

  it("confere o dígito do CPF", () => {
    expect(cpfValido("52998224725")).toBe(true);
    expect(cpfValido("52998224724")).toBe(false);
    expect(cpfValido("11111111111")).toBe(false);
  });
});

describe("anonimizar: telefones", () => {
  it.each([
    ["Cel: +55 (11) 98765-4321", "Cel: [TELEFONE]"],
    ["(21) 3456-7890", "[TELEFONE]"],
    ["11987654321", "[TELEFONE]"],
    ["WhatsApp 98765-4321", "WhatsApp [TELEFONE]"],
    ["Phone: +1 (415) 555-0100", "Phone: [TELEFONE]"],
    ["Tel. +44 20 7946 0958", "Tel. [TELEFONE]"],
    ["Móvil: +34 612 345 678", "Móvil: [TELEFONE]"],
    ["Móvil 612 345 678", "Móvil [TELEFONE]"],
    ["Cel +52 55 1234 5678", "Cel [TELEFONE]"],
  ])("%s", (entrada, esperado) => expect(limpo(entrada)).toBe(esperado));

  it("não troca anos, períodos e salários", () => {
    const t = "2019-2023 na área; 2015 - 2019; R$ 12.000,00 a 15.000,00; 120 horas; 5 anos";
    expect(limpo(t)).toBe(t);
  });
});

describe("anonimizar: endereços", () => {
  it.each([
    ["Moro na Rua das Flores, 123", "Moro na [ENDERECO]"],
    ["Av. Paulista 1000, São Paulo", "[ENDERECO], São Paulo"],
    ["CEP 01310-100", "[ENDERECO]"],
    ["Vivo en Calle Mayor 15, Madrid", "Vivo en [ENDERECO], Madrid"],
    ["I live at 742 Evergreen Terrace Road", "I live at [ENDERECO]"],
  ])("%s", (entrada, esperado) => expect(limpo(entrada)).toBe(esperado));

  it("mantém a cidade", () => expect(limpo("São Paulo, SP (Híbrido)")).toBe("São Paulo, SP (Híbrido)"));
});

describe("anonimizar: valores conhecidos", () => {
  it("troca nome inteiro e partes, sem maiúsculas nem acentos", () => {
    const t = "MARIA DA CONCEICAO SILVA trabalhou com Maria e a sra. Silva. Conceição liderou.";
    expect(limpo(t, MARIA)).toBe("[NOME] trabalhou com [NOME] e a sra. [NOME]. [NOME] liderou.");
  });

  it("não troca partículas nem pedaço de palavra", () => {
    expect(partesDoNome("Maria da Silva")).toEqual(["Maria da Silva", "Maria", "Silva"]);
    expect(limpo("Silvana fez parte da equipe", MARIA)).toBe("Silvana fez parte da equipe");
  });

  it("troca empresa, e-mail e telefone conhecidos em qualquer formato", () => {
    const t = "Acme Tecnologia (ACME TECNOLOGIA). E-mail maria.silva@gmail.com, fone 11 98765 4321 ou 987654321.";
    expect(limpo(t, MARIA)).toBe("[EMPRESA] ([EMPRESA]). E-mail [EMAIL], fone [TELEFONE] ou [TELEFONE].");
  });

  it("razão social com Ltda/S.A./Inc vira [EMPRESA] mesmo sem ser conhecida", () => {
    expect(limpo("Trabalhei na Beta Sistemas Ltda e na Gamma Inc.")).toBe("Trabalhei na [EMPRESA] e na [EMPRESA]");
    expect(limpo("Banco Exemplo S.A. contrata")).toBe("[EMPRESA] contrata");
  });

  it("texto em inglês e espanhol", () => {
    const john: Conhecidos = { nomes: ["John Smith"], empresas: ["Globex"], emails: ["john@globex.com"] };
    expect(limpo("John Smith led the Globex data team. Reach John at john@globex.com", john)).toBe("[NOME] led the [EMPRESA] data team. Reach [NOME] at [EMAIL]");
    const juan: Conhecidos = { nomes: ["Juan Pérez"], empresas: ["Telefónica"] };
    expect(limpo("Juan Perez trabajó en Telefonica como ingeniero; tel. +34 612 345 678", juan)).toBe("[NOME] trabajó en [EMPRESA] como ingeniero; tel. [TELEFONE]");
  });

  it("anonimizarValor percorre objetos e listas", () => {
    const v = { titulo: "Dev", experiencias: [{ empresa: "Acme Tecnologia", cargo: "Dev de Maria" }], anos: 5 };
    expect(anonimizarValor(v, MARIA)).toEqual({ titulo: "Dev", experiencias: [{ empresa: "[EMPRESA]", cargo: "Dev de [NOME]" }], anos: 5 });
  });
});

describe("sobras (rede de segurança)", () => {
  it("acha o que a troca deixaria passar", () => {
    expect(sobras("escreva para maria@@gmail.com")).toContain("email");
    expect(sobras("escreva para maria @ gmail.com")).toContain("email");
    expect(sobras("http://intranet/maria")).toContain("link");
    expect(sobras("fone 11.9.8765.4321.0")).toContain("telefone");
    expect(sobras("529.982.247-25")).toContain("documento");
    expect(sobras("52998224725")).toContain("documento");
    expect(sobras("A Maria fez", MARIA)).toEqual(["conhecido"]);
    expect(sobras("987654321", MARIA)).toContain("conhecido");
  });

  it("texto limpo não tem sobras", () => {
    expect(sobras("[NOME] trabalhou 5 anos com AWS e Terraform em 2019-2023.", MARIA)).toEqual([]);
  });

  it("sobrasValor olha cada campo", () => {
    expect(sobrasValor({ a: "ok", b: ["mande para x@y.com"] })).toContain("email");
    expect(sobrasValor({ inicio: "2019-03", fim: "2023-05", anos: 4 })).toEqual([]);
  });
});
