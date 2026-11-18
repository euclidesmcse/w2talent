// 2.1a — empresa do recrutador: validação dos dados e regras de acesso às vagas (sem banco).
import { cnpjValido, normalizarSite, podeMexer, validarEmpresa, type AcessoVaga } from "../lib/empresa";

describe("dados da empresa", () => {
  it("CNPJ confere os dígitos verificadores e ignora a pontuação", () => {
    expect(cnpjValido("11.222.333/0001-81")).toBe(true);
    expect(cnpjValido("11222333000181")).toBe(true);
    expect(cnpjValido("11222333000182")).toBe(false);
    expect(cnpjValido("00000000000000")).toBe(false);
    expect(cnpjValido("1122233300018")).toBe(false);
  });

  it("site sem esquema vira https e só http(s) é aceito", () => {
    expect(normalizarSite("empresa.com.br")).toBe("https://empresa.com.br");
    expect(normalizarSite("http://empresa.com/vagas/")).toBe("http://empresa.com/vagas");
    expect(normalizarSite("javascript:alert(1)")).toBeNull();
    expect(normalizarSite("ftp://empresa.com")).toBeNull();
    expect(normalizarSite("localhost")).toBeNull();
    expect(normalizarSite("https://user:senha@empresa.com")).toBeNull();
  });

  it("validarEmpresa limpa os campos e aponta o campo errado", () => {
    expect(validarEmpresa({ nome: "  Acme   Ltda ", site: "", cnpj: "11.222.333/0001-81", emailContato: " RH@Acme.com " })).toEqual({
      ok: true,
      dados: { nome: "Acme Ltda", site: null, cnpj: "11222333000181", emailContato: "rh@acme.com" },
    });
    expect(validarEmpresa({ nome: "A" })).toEqual({ ok: false, campo: "nome" });
    expect(validarEmpresa({ nome: "Acme", site: "javascript:x" })).toEqual({ ok: false, campo: "site" });
    expect(validarEmpresa({ nome: "Acme", cnpj: "123" })).toEqual({ ok: false, campo: "cnpj" });
    expect(validarEmpresa({ nome: "Acme", emailContato: "rh@" })).toEqual({ ok: false, campo: "emailContato" });
    expect(validarEmpresa(null)).toEqual({ ok: false, campo: "nome" });
  });
});

describe("quem mexe na vaga", () => {
  const empresa = { id: "c1", nome: "Acme", site: null, cnpj: null, emailContato: null, validacaoStatus: "pendente" as const };
  const conta = { id: "u1", nome: "u1", email: "u1@x.com", perfil: "recrutador" as const, mfaLigado: true, mfaPendente: false, sessaoId: "s" };
  it("recrutador só mexe nas vagas da própria empresa; admin em todas", () => {
    const rec: AcessoVaga = { tipo: "recrutador", conta, empresa };
    expect(podeMexer(rec, "c1")).toBe(true);
    expect(podeMexer(rec, "c2")).toBe(false);
    expect(podeMexer({ tipo: "admin" }, "c2")).toBe(true);
  });
});
