/** 2.4b: status que o candidato vê a partir da etapa (D3). */
import { ehEtapa, statusDaEtapa } from "../lib/rh-candidaturas";

describe("statusDaEtapa", () => {
  it("segue a etapa e não volta para trás", () => {
    expect(statusDaEtapa("enviado", "em_analise")).toBe("visualizado");
    expect(statusDaEtapa("enviado", "entrevista")).toBe("respondido");
    expect(statusDaEtapa("visualizado", "proposta")).toBe("respondido");
    expect(statusDaEtapa("respondido", "em_analise")).toBe("respondido");
    expect(statusDaEtapa("visualizado", "nova")).toBe("visualizado");
    expect(statusDaEtapa("enviado", "nova")).toBe("enviado");
  });

  it("Não seguiu encerra; voltar dele conta como vista", () => {
    expect(statusDaEtapa("respondido", "nao_seguiu")).toBe("arquivado");
    expect(statusDaEtapa("arquivado", "em_analise")).toBe("visualizado");
    expect(statusDaEtapa("arquivado", "nova")).toBe("visualizado");
    expect(statusDaEtapa("arquivado", "contratada")).toBe("respondido");
  });

  it("só aceita as seis etapas", () => {
    expect(ehEtapa("entrevista")).toBe(true);
    expect(ehEtapa("arquivado")).toBe(false);
    expect(ehEtapa(3)).toBe(false);
  });
});

describe("aviso de entrevista (2.4c)", () => {
  const { renderEntrevistaEmail } = require("../lib/email-templates") as typeof import("../lib/email-templates");
  it("diz quem chamou, que o contato foi liberado e escapa o HTML", () => {
    const m = renderEntrevistaEmail({ locale: "pt-BR", nome: "Ana Souza", empresa: "Acme <RH>", vagaTitulo: "Dev & Cloud", url: "https://w2talent.com/minhas-candidaturas" });
    expect(m.subject).toBe("Acme <RH> quer conversar com você");
    expect(m.text).toContain("Olá, Ana");
    expect(m.text).toContain("telefone");
    expect(m.html).toContain("Acme &lt;RH&gt;");
    expect(m.html).toContain("Dev &amp; Cloud");
    expect(m.html).not.toContain("<RH>");
    expect(renderEntrevistaEmail({ locale: "en", empresa: "Acme", vagaTitulo: "Dev", url: "x" }).subject).toBe("Acme wants to talk to you");
  });
});

describe("contato liberado (D4)", () => {
  const { ETAPAS_COM_CONTATO } = require("../lib/rh-candidaturas") as typeof import("../lib/rh-candidaturas");
  it("só a partir da Entrevista", () => {
    expect([...ETAPAS_COM_CONTATO].sort()).toEqual(["contratada", "entrevista", "proposta"]);
  });
});
