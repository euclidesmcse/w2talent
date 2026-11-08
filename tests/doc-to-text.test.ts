import { docToText, markdownToPlain } from "@/lib/doc-to-text";

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
