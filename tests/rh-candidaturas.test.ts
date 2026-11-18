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
