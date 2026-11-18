// Auditoria de acessibilidade (axe) nas telas principais, nos três idiomas (pt-BR, en, es) e nos dois temas.
// Falha (exit 1) se qualquer tela tiver ao menos uma violação.
// Tema escuro (2026-11-18): cada tela roda de novo com o sistema em escuro (colorScheme "dark"; o script do
// <head> segue o sistema e põe data-theme="dark"), para o CI conferir o contraste nos dois temas. As cores não
// mudam com o idioma, então o escuro roda por padrão só em pt-BR (IDIOMAS_ESCURO=pt-BR,en,es para todos).
// Uso: BASE_URL=http://localhost:3999 node scripts/axe-check.mjs   (TEMAS=light ou TEMAS=dark para um só)
// Navegador: CHROME_PATH, se definido; senão o Google Chrome do sistema.
import { chromium } from "playwright-core";
import { AxeBuilder } from "@axe-core/playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3999";
const TELAS = process.env.TELAS ? process.env.TELAS.split(",") : ["/", "/vagas", "/candidatos", "/empresa", "/publicar", "/minha-ficha", "/minhas-candidaturas", "/ia", "/mercado", "/ajuda", "/ajuda/match", "/ajuda/conversa", "/ajuda/minhas-conversas", "/entrar", "/entrar/perfil", "/entrar/codigo"];
const LARGURAS = [1280, 390]; // computador e celular
const IDIOMAS = (process.env.IDIOMAS ?? "pt-BR,en,es").split(",");
const TEMAS = (process.env.TEMAS ?? "light,dark").split(",");
const IDIOMAS_ESCURO = (process.env.IDIOMAS_ESCURO ?? "pt-BR").split(",");
const TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "best-practice"];

const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: "chrome" }
);
let total = 0;
for (const tema of TEMAS) {
for (const idioma of IDIOMAS) {
if (tema === "dark" && !IDIOMAS_ESCURO.includes(idioma)) continue;
for (const tela of TELAS) {
  for (const largura of LARGURAS) {
    const ctx = await browser.newContext({ viewport: { width: largura, height: 900 }, colorScheme: tema });
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
    const aplicado = await page.getAttribute("html", "data-theme");
    if (aplicado !== tema) { console.log(`✗ ${tela} [${tema}]: data-theme veio "${aplicado}"`); total++; }
    console.log(`${r.violations.length ? "✗" : "✓"} ${tela} @${largura}px [${idioma}] ${tema === "dark" ? "escuro" : "claro"}: ${r.violations.length} violações`);
    for (const v of r.violations) {
      console.log(`    [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length}x) ${v.helpUrl}`);
      for (const n of v.nodes.slice(0, 3)) console.log(`      ${n.target.join(" ")}`);
    }
    await ctx.close();
  }
}
}
}
await browser.close();
if (total > 0) {
  console.error(`\naxe: ${total} violações de acessibilidade. Corrija antes do merge.`);
  process.exit(1);
}
console.log(`\naxe: nenhuma violação em ${TELAS.length} telas, idiomas ${IDIOMAS.join(", ")}, temas ${TEMAS.join(" e ")}.`);
