/** 2.6b-1 Atendimento: partes puras (validação, e-mails). */
import { emailParaEquipe, emailValido, linkDaConversa, textoValido, TEXTO_MAX } from "../lib/atendimento";
import { renderAtendimentoEmail } from "../lib/email-templates";

describe("atendimento: validação", () => {
  it("mensagem de 1 a 2000 caracteres (sem contar espaços nas pontas)", () => {
    expect(textoValido("")).toBe(false);
    expect(textoValido("   ")).toBe(false);
    expect(textoValido("oi")).toBe(true);
    expect(textoValido("x".repeat(TEXTO_MAX))).toBe(true);
    expect(textoValido("x".repeat(TEXTO_MAX + 1))).toBe(false);
    expect(textoValido(` ${"x".repeat(TEXTO_MAX)} `)).toBe(true);
    expect(textoValido(42)).toBe(false);
  });

  it("e-mail", () => {
    expect(emailValido("ana@exemplo.com")).toBe(true);
    expect(emailValido("ana@exemplo")).toBe(false);
    expect(emailValido("<a>@x.com")).toBe(false);
  });

  it("link da conversa", () => {
    expect(linkDaConversa("https://w2.test/", "abc")).toBe("https://w2.test/ajuda/conversa?c=abc");
  });
});

describe("atendimento: e-mails", () => {
  it("para a equipe: o texto como foi escrito (escapado), a tela e o tipo de conta; nunca o e-mail da pessoa", () => {
    const m = emailParaEquipe(
      { conversaId: "c1", mensagemId: "m1", nova: true, texto: "<b>oi</b> me liga 11 99999-0000", tela: "/vagas", perfil: "candidato", idioma: "pt-BR" },
      "contato@w2talent.com",
      "https://w2.test",
    );
    expect(m.to).toBe("contato@w2talent.com");
    expect(m.html).toContain("&lt;b&gt;");
    expect(m.html).not.toContain("<b>oi");
    // D4: canal humano, o texto fica como a pessoa escreveu.
    expect(m.text).toContain("11 99999-0000");
    expect(m.text).toContain("Candidato logado");
    expect(m.text).toContain("/vagas");
    expect(m.text).toContain("https://w2.test/admin/atendimento?id=c1");
    expect(m.idempotencyKey).toBe("atendimento:m1");
    expect(m.subject.startsWith("Atendimento:")).toBe(true);
  });

  it.each(["pt-BR", "en", "es"] as const)("aviso de resposta em %s: só o link, sem o texto da resposta", (locale) => {
    const e = renderAtendimentoEmail({ locale, url: "https://w2.test/ajuda/conversa?c=XYZ" });
    expect(e.subject.length).toBeGreaterThan(5);
    expect(e.text).toContain("https://w2.test/ajuda/conversa?c=XYZ");
    expect(e.html).toContain(`lang="${locale}"`);
    expect(e.html).toContain("https://w2.test/ajuda/conversa?c=XYZ");
  });
});
