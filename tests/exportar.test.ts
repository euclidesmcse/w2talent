// 2.3b Exportar a comparação: CSV e .xlsx montados no navegador (plano 2.3, D4).
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { execFileSync } from "child_process";
import { crc32, gerarCsv, gerarXlsx, nomeAba, nomeArquivo, semFormula, separadorCsv, tabelaPorCandidato } from "../lib/exportar";

const tabela = tabelaPorCandidato("Nome", ["Ana Silva", "Beto; \"Souza\""], [
  { rotulo: "Match", valores: ["87%", "—"] },
  { rotulo: "Competências", valores: ["Kubernetes (5 anos)\nAWS (3 anos)", "=HYPERLINK(\"x\")"] },
]);

describe("tabelaPorCandidato", () => {
  it("uma linha por candidato e traço vira vazio", () => {
    expect(tabela.cabecalho).toEqual(["Nome", "Match", "Competências"]);
    expect(tabela.linhas[0]).toEqual(["Ana Silva", "87%", "Kubernetes (5 anos)\nAWS (3 anos)"]);
    expect(tabela.linhas[1][1]).toBe("");
  });
});

describe("CSV", () => {
  it("BOM, separador por idioma, aspas e quebras de linha", () => {
    expect(separadorCsv("pt-BR")).toBe(";");
    expect(separadorCsv("es")).toBe(";");
    expect(separadorCsv("en")).toBe(",");
    const csv = gerarCsv(tabela, ";");
    expect(csv.startsWith("﻿Nome;Match;Competências\r\n")).toBe(true);
    expect(csv).toContain('Ana Silva;87%;"Kubernetes (5 anos)\nAWS (3 anos)"\r\n');
    expect(csv).toContain('"Beto; ""Souza""";;');
  });
  it("texto que parece fórmula não vira fórmula", () => {
    expect(semFormula("=1+1")).toBe("'=1+1");
    expect(semFormula("+55 11")).toBe("'+55 11");
    expect(semFormula("-x")).toBe("'-x");
    expect(semFormula("@x")).toBe("'@x");
    expect(semFormula("87%")).toBe("87%");
    expect(gerarCsv(tabela, ",")).toContain(`"'=HYPERLINK(""x"")"`);
  });
});

describe(".xlsx", () => {
  it("crc32 confere", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });
  it("zip válido com as partes da planilha", () => {
    const bytes = gerarXlsx(tabela, "Candidatos: [SRE]");
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const texto = new TextDecoder().decode(bytes);
    for (const parte of ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/worksheets/sheet1.xml", "xl/styles.xml"]) expect(texto).toContain(parte);
    expect(texto).toContain('<sheet name="Candidatos   SRE"');
    expect(texto).toContain("Beto; &quot;Souza&quot;");
    // Em .xlsx o texto vai como texto (inlineStr): "=..." não é fórmula.
    expect(texto).not.toContain("<f>");
    const arq = path.join(os.tmpdir(), `w2-teste-${process.pid}.xlsx`);
    fs.writeFileSync(arq, bytes);
    try {
      execFileSync("unzip", ["-tq", arq], { stdio: "pipe" });
    } catch (e: any) {
      if (e.code !== "ENOENT") throw new Error(String(e.stdout ?? e));
    } finally {
      if (process.env.W2_GUARDAR_XLSX) fs.copyFileSync(arq, process.env.W2_GUARDAR_XLSX);
      fs.unlinkSync(arq);
    }
  });
  it("nome da aba e do arquivo", () => {
    expect(nomeAba("a".repeat(40))).toHaveLength(31);
    expect(nomeAba("[]")).toBe("W2Talent");
    expect(nomeArquivo("xlsx", new Date("2026-11-18T12:00:00Z"))).toBe("w2talent-candidatos-2026-11-18.xlsx");
  });
});
