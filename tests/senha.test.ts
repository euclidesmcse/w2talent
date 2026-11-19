/** Login com e-mail e senha: hash PBKDF2 (D3) e textos dos e-mails (D7/D8). */
import { hashSenha, verificarSenha, SENHA_RODADAS } from "../lib/senha";
import { renderLoginEmail } from "../lib/email-templates";
import { localeDoPedido } from "../lib/login-email";

describe("hash da senha", () => {
  it("confere a senha certa e recusa a errada", async () => {
    const h = await hashSenha("cavalo correto bateria", 1000);
    expect(h).toMatch(/^pbkdf2-sha256\$1000\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]{43}$/);
    expect(await verificarSenha({ hash: h, password: "cavalo correto bateria" })).toBe(true);
    expect(await verificarSenha({ hash: h, password: "cavalo correto baterIa" })).toBe(false);
  });

  it("usa sal novo a cada hash e guarda as rodadas", async () => {
    const a = await hashSenha("mesma senha longa", 1000);
    const b = await hashSenha("mesma senha longa", 1000);
    expect(a).not.toBe(b);
    expect(await verificarSenha({ hash: b, password: "mesma senha longa" })).toBe(true);
  });

  it("o padrão respeita o teto de rodadas do Worker", () => {
    expect(SENHA_RODADAS).toBeLessThanOrEqual(100_000);
  });

  it("normaliza acentos (NFC e NFD dão a mesma senha)", async () => {
    const h = await hashSenha("açúcar e café 2026".normalize("NFC"), 1000);
    expect(await verificarSenha({ hash: h, password: "açúcar e café 2026".normalize("NFD") })).toBe(true);
  });

  it("recusa hash adulterado, de outro formato ou com rodadas demais", async () => {
    const h = await hashSenha("senha de teste 123", 1000);
    const [p, , sal, hh] = h.split("$");
    expect(await verificarSenha({ hash: `${p}$1001$${sal}$${hh}`, password: "senha de teste 123" })).toBe(false);
    expect(await verificarSenha({ hash: `${p}$5000000$${sal}$${hh}`, password: "senha de teste 123" })).toBe(false);
    expect(await verificarSenha({ hash: `scrypt$${sal}$${hh}`, password: "senha de teste 123" })).toBe(false);
    expect(await verificarSenha({ hash: `${p}$1000$${sal}$${hh.slice(0, 20)}`, password: "senha de teste 123" })).toBe(false);
    expect(await verificarSenha({ hash: `${p}$1000$!!$${hh}`, password: "senha de teste 123" })).toBe(false);
    expect(await verificarSenha({ hash: "", password: "" })).toBe(false);
  });
});

describe("e-mails do login", () => {
  it("cada tipo tem botão com o link e escapa o nome", () => {
    for (const tipo of ["confirmar", "redefinir", "ja_tem_conta", "senha_trocada"] as const) {
      for (const locale of ["pt-BR", "en", "es"] as const) {
        const r = renderLoginEmail({ locale, tipo, nome: "<b>Ana</b> Silva", url: "https://w2.test/x?a=1&b=2" });
        expect(r.subject.length).toBeGreaterThan(5);
        expect(r.html).toContain('href="https://w2.test/x?a=1&amp;b=2"');
        expect(r.html).not.toContain("<b>Ana</b>");
        expect(r.text).toContain("https://w2.test/x?a=1&b=2");
      }
    }
  });

  it("idioma do e-mail: cookie da tela, senão o do navegador", () => {
    expect(localeDoPedido(new Request("https://w2.test", { headers: { cookie: "a=1; NEXT_LOCALE=es" } }))).toBe("es");
    expect(localeDoPedido(new Request("https://w2.test", { headers: { "accept-language": "en-GB,en;q=0.8" } }))).toBe("en");
    expect(localeDoPedido(null)).toBe("pt-BR");
  });
});
