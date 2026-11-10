// Auditoria de acessibilidade (axe) nas quatro telas principais, nos três idiomas (pt-BR, en, es).
// Falha (exit 1) se qualquer tela tiver ao menos uma violação.
// Uso: BASE_URL=http://localhost:3999 node scripts/axe-check.mjs
// Navegador: CHROME_PATH, se definido; senão o Google Chrome do sistema.
import { chromium } from "playwright-core";
import { AxeBuilder } from "@axe-core/playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3999";
const TELAS = ["/", "/vagas", "/candidatos", "/minha-ficha", "/minhas-candidaturas", "/entrar", "/entrar/perfil", "/entrar/codigo"];
const LARGURAS = [1280, 390]; // computador e celular
const IDIOMAS = (process.env.IDIOMAS ?? "pt-BR,en,es").split(",");
const TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "best-practice"];

const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: "chrome" }
);
let total = 0;
for (const idioma of IDIOMAS) {
for (const tela of TELAS) {
  for (const largura of LARGURAS) {
    const ctx = await browser.newContext({ viewport: { width: largura, height: 900 } });
    // idioma escolhido fica no cookie NEXT_LOCALE (mesmo endereço nos três idiomas)
    await ctx.addCookies([{ name: "NEXT_LOCALE", value: idioma, url: BASE }]);
    const page = await ctx.newPage();
    // "load", não "networkidle": Minhas candidaturas faz polling
    await page.goto(BASE + tela, { waitUntil: "load" });
    await page.waitForTimeout(1500);
    // Desde o login (1.5.5) marcar uma vaga sem conta leva para /entrar, que também é auditada.
    const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    total += r.violations.length;
    const lang = await page.getAttribute("html", "lang");
    if (lang !== idioma) { console.log(`✗ ${tela} [${idioma}]: página veio em "${lang}"`); total++; }
    console.log(`${r.violations.length ? "✗" : "✓"} ${tela} @${largura}px [${idioma}]: ${r.violations.length} violações`);
    for (const v of r.violations) {
      console.log(`    [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length}x) ${v.helpUrl}`);
      for (const n of v.nodes.slice(0, 3)) console.log(`      ${n.target.join(" ")}`);
    }
    await ctx.close();
  }
}
}
await browser.close();
if (total > 0) {
  console.error(`\naxe: ${total} violações de acessibilidade. Corrija antes do merge.`);
  process.exit(1);
}
console.log(`\naxe: nenhuma violação nas quatro telas em ${IDIOMAS.join(", ")}.`);
