// 1.5.4 — design system v2: tokens iguais ao protótipo e componentes base renderizando.
import * as fs from "fs";
import * as path from "path";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { renderToStaticMarkup } = require("react-dom/server") as { renderToStaticMarkup: (el: unknown) => string };
import { colors, fontFamily, radius } from "../lib/design-tokens";
import { Button, buttonClasses, Card, Chip, Field, Input, MatchBar, StatusBadge, Table, THead, Th, Tr, Td, ToastProvider } from "../components/ui";

describe("tokens do protótipo aprovado", () => {
  it("cor de ação, fundo, bordas, texto e fonte", () => {
    expect(colors.brand.DEFAULT).toBe("#1F4FD8");
    expect(colors.canvas).toBe("#F7F8FA");
    expect(colors.line.DEFAULT).toBe("#E5E7EB");
    expect(colors.ink.DEFAULT).toBe("#111827");
    expect(fontFamily.sans[0]).toBe("Inter");
    expect(radius.control).toBe("6px");
  });

  it("Tailwind lê os tokens da mesma fonte", () => {
    const cfg = require("../tailwind.config.js");
    expect(cfg.theme.extend.colors.brand.DEFAULT).toBe("#1F4FD8");
    expect(cfg.theme.extend.fontFamily.sans[0]).toBe("Inter");
  });

  it("o visual antigo saiu da landing e das listas", () => {
    for (const f of ["app/page.tsx", "app/vagas/page.tsx", "app/candidatos/page.tsx", "app/layout.tsx", "app/globals.css"]) {
      const src = fs.readFileSync(path.join(__dirname, "..", f), "utf-8");
      expect(src).not.toMatch(/Bodoni|Jost|#2c3620|#b7c8be|#d6c4b8|picsum\.photos/i);
    }
  });
});

describe("componentes base", () => {
  it("Button: variantes e type=button por padrão", () => {
    const html = renderToStaticMarkup(<Button>Enviar</Button>);
    expect(html).toContain('type="button"');
    expect(html).toContain("bg-brand");
    expect(buttonClasses("secondary")).toContain("border-line-strong");
    expect(buttonClasses("ghost")).toContain("text-brand");
    expect(buttonClasses("primary", "lg")).toContain("h-11");
  });

  it("Field + Input: rótulo envolve o campo e erro vira alerta", () => {
    const html = renderToStaticMarkup(
      <Field label="E-mail" error="E-mail inválido.">
        <Input aria-invalid="true" defaultValue="ana@" />
      </Field>
    );
    expect(html).toMatch(/^<label[^>]*>E-mail<input/);
    expect(html).toContain('role="alert"');
    expect(html).toContain("E-mail inválido.");
  });

  it("Chip removível tem botão com nome acessível", () => {
    const html = renderToStaticMarkup(<Chip onRemove={() => {}}>Remoto</Chip>);
    expect(html).toContain('aria-label="Remover Remoto"');
  });

  it("StatusBadge cobre o fluxo selecionada → enviada", () => {
    for (const [s, label] of [
      ["selecionada", "Selecionada"],
      ["revisada", "Revisada"],
      ["aprovada", "Aprovada"],
      ["enviada", "Enviada"],
      ["reaprovar", "Vaga mudou · reaprovar"],
    ] as const) {
      expect(renderToStaticMarkup(<StatusBadge status={s} />)).toContain(label);
    }
  });

  it("MatchBar limita 0–100 e muda de cor pelo valor", () => {
    expect(renderToStaticMarkup(<MatchBar value={140} />)).toContain("100%");
    expect(renderToStaticMarkup(<MatchBar value={87} />)).toContain("bg-success");
    expect(renderToStaticMarkup(<MatchBar value={60} />)).toContain("bg-warning");
  });

  it("Table com cabeçalho em coluna e linha selecionada destacada", () => {
    const html = renderToStaticMarkup(
      <Table>
        <THead>
          <Th>Vaga</Th>
        </THead>
        <tbody>
          <Tr selected>
            <Td>DevOps</Td>
          </Tr>
        </tbody>
      </Table>
    );
    expect(html).toContain('scope="col"');
    expect(html).toContain("bg-[#F5F8FF]");
  });

  it("Card e ToastProvider renderizam (região de avisos acessível)", () => {
    const html = renderToStaticMarkup(
      <ToastProvider>
        <Card>oi</Card>
      </ToastProvider>
    );
    expect(html).toContain("rounded-card");
    expect(html).toContain('aria-live="polite"');
  });
});

// Melhorias de 08/11: nomes legíveis nas competências e títulos na gaveta da seleção.
import { SkillChips, skillName } from "../components/skill-chips";
import { selectionStore } from "../lib/selection-store";

describe("melhorias de leitura", () => {
  it("competências aparecem com o nome da taxonomia e +N acima do limite", () => {
    expect(skillName("csharp")).toBe("C#");
    expect(skillName("nao-existe")).toBe("nao-existe");
    const html = renderToStaticMarkup(<SkillChips ids={["typescript", "csharp", "python", "go", "rust"]} limit={3} />);
    expect(html).toContain("TypeScript");
    expect(html).toContain("C#");
    expect(html).toContain("+2");
    expect(html).not.toContain(">go<");
  });

  it("seleção guarda o título legível só dos itens ainda selecionados", () => {
    const mem = new Map<string, string>();
    (globalThis as any).localStorage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
    };
    selectionStore.clear();
    selectionStore.rememberLabel("v1", "DevOps Sênior");
    selectionStore.toggle("v1");
    expect(selectionStore.getLabel("v1")).toBe("DevOps Sênior");
    selectionStore.remove("v1");
    selectionStore.rememberLabel("v2", "SRE Pleno");
    expect(selectionStore.getLabel("v1")).toBeUndefined();
    expect(selectionStore.getLabel("v2")).toBe("SRE Pleno");
    selectionStore.clear();
    delete (globalThis as any).localStorage;
  });
});
