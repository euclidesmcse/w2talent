/**
 * 2.3b Exportar a comparação (plano 2.3, D4): os arquivos são montados no navegador, a partir das
 * mesmas linhas da tela, e nada fica guardado no servidor. Uma linha por candidato (D2).
 * Funções puras, sem dependência: CSV com BOM e um .xlsx mínimo (zip sem compressão).
 */

export type Tabela = { cabecalho: string[]; linhas: string[][] };

/** Da tela (campos em linhas, candidatos em colunas) para planilha (uma linha por candidato). */
export function tabelaPorCandidato(nomeRotulo: string, nomes: string[], campos: { rotulo: string; valores: string[] }[]): Tabela {
  return {
    cabecalho: [nomeRotulo, ...campos.map((c) => c.rotulo)],
    linhas: nomes.map((nome, i) => [nome, ...campos.map((c) => (c.valores[i] === "—" ? "" : c.valores[i] ?? ""))]),
  };
}

/** Texto vindo da ficha que começa como fórmula (=, +, -, @) não pode virar fórmula na planilha. */
export function semFormula(v: string): string {
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

/** Excel em português e espanhol abre CSV com ";"; em inglês, com ",". */
export function separadorCsv(locale: string): string {
  return locale.startsWith("en") ? "," : ";";
}

export function gerarCsv(t: Tabela, sep: string): string {
  const celula = (v: string) => {
    const s = semFormula(v.replace(/\r\n?/g, "\n"));
    return /["\n]/.test(s) || s.includes(sep) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // BOM: o Excel lê os acentos como UTF-8.
  return "﻿" + [t.cabecalho, ...t.linhas].map((l) => l.map(celula).join(sep)).join("\r\n") + "\r\n";
}

// ── .xlsx mínimo ─────────────────────────────────────────────────────

function xml(s: string): string {
  return s
    // caracteres que o XML não aceita
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function colunaExcel(i: number): string {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** Nome de aba: até 31 caracteres, sem []:*?/\ */
export function nomeAba(nome: string): string {
  return nome.replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 31) || "W2Talent";
}

function planilhaXml(t: Tabela): string {
  const linhas = [t.cabecalho, ...t.linhas].map((l, r) => {
    const cels = l
      .map((v, c) => `<c r="${colunaExcel(c)}${r + 1}" t="inlineStr" s="${r === 0 ? 2 : 1}"><is><t xml:space="preserve">${xml(v)}</t></is></c>`)
      .join("");
    return `<row r="${r + 1}">${cels}</row>`;
  });
  const cols = t.cabecalho.map((_, i) => `<col min="${i + 1}" max="${i + 1}" width="${i === 0 ? 24 : 32}" customWidth="1"/>`).join("");
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    `<cols>${cols}</cols><sheetData>${linhas.join("")}</sheetData></worksheet>`
  );
}

const CRC_TABELA = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABELA[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Zip sem compressão (método 0): suficiente para um .xlsx pequeno e sem biblioteca. */
export function zipSemCompressao(arquivos: { nome: string; dados: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder();
  const partes: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const a of arquivos) {
    const nome = enc.encode(a.nome);
    const crc = crc32(a.dados);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // nomes em UTF-8
    local.setUint16(8, 0, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, a.dados.length, true);
    local.setUint32(22, a.dados.length, true);
    local.setUint16(26, nome.length, true);
    partes.push(new Uint8Array(local.buffer), nome, a.dados);
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(8, 0x0800, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, a.dados.length, true);
    cd.setUint32(24, a.dados.length, true);
    cd.setUint16(28, nome.length, true);
    cd.setUint32(42, offset, true);
    central.push(new Uint8Array(cd.buffer), nome);
    offset += 30 + nome.length + a.dados.length;
  }
  const tamCentral = central.reduce((s, p) => s + p.length, 0);
  const fim = new DataView(new ArrayBuffer(22));
  fim.setUint32(0, 0x06054b50, true);
  fim.setUint16(8, arquivos.length, true);
  fim.setUint16(10, arquivos.length, true);
  fim.setUint32(12, tamCentral, true);
  fim.setUint32(16, offset, true);
  const todas = [...partes, ...central, new Uint8Array(fim.buffer)];
  const out = new Uint8Array(todas.reduce((s, p) => s + p.length, 0));
  let i = 0;
  for (const p of todas) {
    out.set(p, i);
    i += p.length;
  }
  return out;
}

export function gerarXlsx(t: Tabela, aba: string): Uint8Array {
  const enc = new TextEncoder();
  const f = (nome: string, s: string) => ({ nome, dados: enc.encode(s) });
  const cab = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  return zipSemCompressao([
    f(
      "[Content_Types].xml",
      cab +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        "</Types>",
    ),
    f(
      "_rels/.rels",
      cab +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        "</Relationships>",
    ),
    f(
      "xl/workbook.xml",
      cab +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        `<sheets><sheet name="${xml(nomeAba(aba))}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    ),
    f(
      "xl/_rels/workbook.xml.rels",
      cab +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        "</Relationships>",
    ),
    f(
      "xl/styles.xml",
      cab +
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
        '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
        '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
        '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs>' +
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
        "</styleSheet>",
    ),
    f("xl/worksheets/sheet1.xml", planilhaXml(t)),
  ]);
}

/** Nome do arquivo: w2talent-candidatos-2026-11-18.csv */
export function nomeArquivo(ext: "csv" | "xlsx", hoje: Date = new Date()): string {
  return `w2talent-candidatos-${hoje.toISOString().slice(0, 10)}.${ext}`;
}
