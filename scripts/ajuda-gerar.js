/**
 * 2.6a: junta os artigos de ajuda (content/ajuda/<idioma>/*.md) num módulo TypeScript.
 * O Worker não lê arquivos em tempo de execução, então o texto vai junto no código.
 *   node scripts/ajuda-gerar.js        → grava lib/ajuda-conteudo.ts
 *   node scripts/ajuda-gerar.js --check → falha se o arquivo estiver desatualizado (o teste também confere)
 */
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const PASTA = path.join(RAIZ, "content", "ajuda");
const SAIDA = path.join(RAIZ, "lib", "ajuda-conteudo.ts");
const IDIOMAS = ["pt-BR", "en", "es"];

function lerArtigo(arquivo) {
  const bruto = fs.readFileSync(arquivo, "utf-8").replace(/\r\n/g, "\n");
  const m = bruto.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`${arquivo}: falta o cabeçalho entre ---`);
  const meta = {};
  for (const linha of m[1].split("\n")) {
    const i = linha.indexOf(":");
    if (i < 0) continue;
    meta[linha.slice(0, i).trim()] = linha.slice(i + 1).trim();
  }
  const lista = (s) => (s || "").split(",").map((x) => x.trim()).filter(Boolean);
  for (const k of ["titulo", "resumo", "areas", "telas", "ordem"]) if (!meta[k]) throw new Error(`${arquivo}: falta "${k}"`);
  return {
    slug: path.basename(arquivo, ".md"),
    titulo: meta.titulo,
    resumo: meta.resumo,
    areas: lista(meta.areas),
    telas: lista(meta.telas),
    ordem: Number(meta.ordem),
    corpo: m[2].trim(),
  };
}

function gerar() {
  const porIdioma = {};
  for (const idioma of IDIOMAS) {
    const dir = path.join(PASTA, idioma);
    porIdioma[idioma] = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .sort()
      .map((f) => lerArtigo(path.join(dir, f)))
      .sort((a, b) => a.ordem - b.ordem || a.slug.localeCompare(b.slug));
  }
  return (
    "// Gerado por scripts/ajuda-gerar.js a partir de content/ajuda. Não edite à mão: mude o .md e rode `node scripts/ajuda-gerar.js`.\n" +
    'import type { ArtigoBruto } from "./ajuda";\n\n' +
    `export const ARTIGOS: Record<"pt-BR" | "en" | "es", ArtigoBruto[]> = ${JSON.stringify(porIdioma, null, 2)};\n`
  );
}

module.exports = { gerar, SAIDA };

if (require.main === module) {
  const novo = gerar();
  if (process.argv.includes("--check")) {
    const atual = fs.existsSync(SAIDA) ? fs.readFileSync(SAIDA, "utf-8") : "";
    if (atual !== novo) {
      console.error("lib/ajuda-conteudo.ts está desatualizado: rode node scripts/ajuda-gerar.js");
      process.exit(1);
    }
    console.log("ajuda ok");
  } else {
    fs.writeFileSync(SAIDA, novo);
    console.log(`gravado ${path.relative(RAIZ, SAIDA)}`);
  }
}
