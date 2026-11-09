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

/**
 * O toMarkdown abre o PDF com "# <nome do arquivo>", uma seção "## Metadata" e só depois
 * "## Contents", com "### Page N" entre as páginas. Fica só o conteúdo: o nome do arquivo
 * virava cargo ("FULANO CV (1).") e os metadados não são do CV.
 */
export function stripToMarkdownWrapper(md: string, fileName: string): string {
  let out = md;
  const contents = /^#{1,6}\s*Contents\s*$/im.exec(out);
  if (contents) out = out.slice(contents.index + contents[0].length);
  else {
    const first = out.match(/^\s*#\s+(.+)\n/);
    const base = fileName.trim().replace(/\.[a-z0-9]+$/i, "");
    const titulo = first?.[1].trim() ?? "";
    if (first && (titulo === fileName.trim() || titulo === base || /\.(pdf|docx?|odt|html?)$/i.test(titulo))) {
      out = out.slice(first[0].length);
    }
  }
  return out.replace(/^#{1,6}\s*Page\s+\d+\s*$/gim, "");
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
  return markdownToPlain(stripToMarkdownWrapper(res.data, fileName));
}
