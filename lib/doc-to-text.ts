/**
 * Converte o arquivo do CV (PDF, DOCX…) em texto usando o `toMarkdown` do Workers AI
 * (binding `AI` no wrangler.jsonc). Substitui pdf-parse e mammoth, que ocupavam ~1 MB
 * no Worker e não funcionam bem no runtime da Cloudflare.
 *
 * Fora do Worker (dev sem binding, jest) cai no fallback utf-8 e avisa no log.
 */

type ToMarkdownResult = { name: string; format: "markdown" | "error"; data?: string; error?: string };
type AiBinding = {
  toMarkdown: (docs: { name: string; blob: Blob }[]) => Promise<ToMarkdownResult[]>;
};

export const DOC_MIME: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  odt: "application/vnd.oasis.opendocument.text",
  html: "text/html",
  txt: "text/plain",
};

function aiBinding(): AiBinding | undefined {
  const cf = (globalThis as Record<symbol, unknown>)[Symbol.for("__cloudflare-context__")] as
    | { env?: { AI?: AiBinding } }
    | undefined;
  return cf?.env?.AI;
}

/** Remove a marcação Markdown mais comum para o extrator receber texto corrido. */
export function markdownToPlain(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*|__|`/g, "")
    .replace(/^[ \t]*[-*][ \t]+/gm, "- ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function docToText(
  bytes: ArrayBuffer,
  fileName: string,
  ai: AiBinding | undefined = aiBinding(),
): Promise<string> {
  const ext = (fileName.split(".").pop() ?? "").toLowerCase();
  const mime = DOC_MIME[ext];
  const utf8 = () => new TextDecoder().decode(bytes);
  if (!mime || ext === "txt") return utf8();
  if (!ai) {
    // eslint-disable-next-line no-console
    console.warn("[doc-to-text] binding AI ausente (fora do Worker?), usando fallback utf-8");
    return utf8();
  }
  const [res] = await ai.toMarkdown([{ name: fileName, blob: new Blob([bytes], { type: mime }) }]);
  if (!res || res.format !== "markdown" || !res.data) {
    throw new Error(res?.error ?? "não foi possível ler o arquivo");
  }
  return markdownToPlain(res.data);
}
