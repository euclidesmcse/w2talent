import { docToText, markdownToPlain, stripToMarkdownWrapper } from "@/lib/doc-to-text";

const bytes = (s: string) => new TextEncoder().encode(s).buffer as ArrayBuffer;

describe("docToText (Workers AI toMarkdown)", () => {
  it("PDF vai para o toMarkdown com o MIME certo e volta como texto", async () => {
    const calls: { name: string; type: string }[] = [];
    const ai = {
      toMarkdown: async (docs: { name: string; blob: Blob }[]) => {
        calls.push({ name: docs[0].name, type: docs[0].blob.type });
        return [{ name: docs[0].name, format: "markdown" as const, data: "# Ana Souza\n\n**DevOps** Sênior\n\n\n\n- AWS" }];
      },
    };
    const text = await docToText(bytes("%PDF-1.7"), "cv.pdf", ai);
    expect(calls).toEqual([{ name: "cv.pdf", type: "application/pdf" }]);
    expect(text).toBe("Ana Souza\n\nDevOps Sênior\n\n- AWS");
  });

  it("DOCX usa o MIME do Word", async () => {
    let type = "";
    const ai = {
      toMarkdown: async (docs: { name: string; blob: Blob }[]) => {
        type = docs[0].blob.type;
        return [{ name: "x", format: "markdown" as const, data: "ok" }];
      },
    };
    await docToText(bytes("PK"), "CV.DOCX", ai);
    expect(type).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  });

  it("erro do toMarkdown vira exceção (o ingest cai no fallback)", async () => {
    const ai = { toMarkdown: async () => [{ name: "x", format: "error" as const, error: "arquivo corrompido" }] };
    await expect(docToText(bytes("x"), "cv.pdf", ai)).rejects.toThrow("arquivo corrompido");
  });

  it("sem binding AI ou .txt usa utf-8", async () => {
    expect(await docToText(bytes("texto puro"), "cv.txt")).toBe("texto puro");
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    expect(await docToText(bytes("conteudo"), "cv.pdf", undefined)).toBe("conteudo");
    warn.mockRestore();
  });

  it("markdownToPlain tira marcação", () => {
    expect(markdownToPlain("## Título\n`code` __x__")).toBe("Título\ncode x");
  });
});

describe("stripToMarkdownWrapper", () => {
  it("tira o nome do arquivo, os metadados e os marcadores de página do PDF", () => {
    const md =
      "# FULANO DE TAL CV (1).pdf\n## Metadata\n- PDFFormatVersion=1.7\n- Author=Fulano\n## Contents\n### Page 1\nFulano de Tal\nArquiteto Cloud\n### Page 2\nExperiência";
    const out = stripToMarkdownWrapper(md, "FULANO DE TAL CV (1).pdf");
    expect(out).not.toMatch(/CV \(1\)|Metadata|PDFFormat|Page \d/);
    expect(out).toContain("Fulano de Tal\nArquiteto Cloud");
    expect(out).toContain("Experiência");
  });

  it("sem seção Contents, tira só o título que é o nome do arquivo", () => {
    expect(stripToMarkdownWrapper("# cv.docx\nAna Souza\nDevOps", "cv.docx").trim()).toBe("Ana Souza\nDevOps");
    expect(stripToMarkdownWrapper("# Ana Souza\nDevOps", "cv.docx")).toBe("# Ana Souza\nDevOps");
  });

  it("docToText devolve o CV sem o cabeçalho do toMarkdown", async () => {
    const ai = {
      toMarkdown: async () => [
        { name: "x", format: "markdown" as const, data: "# meu cv.pdf\n## Metadata\n- Title=x\n## Contents\n### Page 1\nAna Souza\n\nDevOps" },
      ],
    };
    expect(await docToText(bytes("%PDF"), "meu cv.pdf", ai)).toBe("Ana Souza\n\nDevOps");
  });
});
