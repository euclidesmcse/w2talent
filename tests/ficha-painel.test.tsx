// 2.2c — Ficha W2 ao lado: painel no computador, linha "Para a vaga X: 87%" com as lacunas.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { renderToStaticMarkup } = require("react-dom/server") as { renderToStaticMarkup: (el: unknown) => string };
import { NextIntlClientProvider } from "next-intl";
import { MatchDaVaga } from "../components/candidato-match";
import { FichaPainel } from "../components/ficha-painel";

const msgs = (loc: string) => require(`../messages/${loc}.json`);
const render = (el: unknown, loc = "pt-BR") =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale={loc} messages={msgs(loc)} timeZone="America/Sao_Paulo">
      {el as any}
    </NextIntlClientProvider>,
  );

describe("MatchDaVaga", () => {
  it("mostra a vaga, o número e todas as lacunas", () => {
    const html = render(
      <MatchDaVaga vaga="Engenheiro de Dados" match={87.4} gaps={[{ kind: "skill", skill: "kubernetes" }, { kind: "skill", skill: "kubernetes", proxima: "openshift" } as any]} />,
    );
    expect(html).toContain("Para a vaga Engenheiro de Dados: 87%");
    expect(html).toContain("falta: Kubernetes");
    expect(html).toContain("(próxima)");
  });

  it("sem lacunas diz que atende tudo; sem match não aparece", () => {
    expect(render(<MatchDaVaga vaga="X" match={100} gaps={[]} />)).toContain("Atende tudo o que a vaga pede.");
    expect(render(<MatchDaVaga vaga="X" match={null} gaps={[]} />)).toBe("");
  });

  it("existe em inglês e espanhol", () => {
    expect(render(<MatchDaVaga vaga="Data Engineer" match={50} gaps={[]} />, "en")).toContain("For the Data Engineer job: 50%");
    expect(render(<MatchDaVaga vaga="Data Engineer" match={50} gaps={[]} />, "es")).toContain("Para la vacante Data Engineer: 50%");
  });
});

describe("FichaPainel", () => {
  it("é um painel com título e botão de fechar, não uma janela modal", () => {
    const html = render(
      <FichaPainel item={{ id: "c1", nome: "Ana Souza", titulo: "Engenheira de Dados", stack: [] }} titulo="Ana Souza" antes={<p>topo</p>} onClose={() => {}} />,
    );
    expect(html).toContain('data-testid="ficha-painel"');
    expect(html).toContain('<aside');
    expect(html).not.toContain('aria-modal');
    expect(html).toContain('id="ficha-painel-titulo"');
    expect(html).toContain('aria-label="Fechar detalhes"');
    expect(html.indexOf("topo")).toBeLessThan(html.indexOf("Engenheira de Dados"));
  });
});
