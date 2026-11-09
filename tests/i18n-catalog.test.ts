// 1.5.6 — catálogos PT/EN/ES completos e coerentes; toda chave usada nas telas existe.
import * as fs from "fs";
import * as path from "path";
import { resolveLocale, localeFromAcceptLanguage, normalizeLocale } from "../lib/locale";
import { formatFaixa, formatTempo } from "../lib/format";

const ROOT = path.join(__dirname, "..");
const load = (l: string) => JSON.parse(fs.readFileSync(path.join(ROOT, "messages", `${l}.json`), "utf-8"));
const flat = (o: any, p = ""): Record<string, string> =>
  Object.entries(o).reduce((acc, [k, v]) => (typeof v === "object" ? { ...acc, ...flat(v, `${p}${k}.`) } : { ...acc, [`${p}${k}`]: String(v) }), {});
const placeholders = (s: string) => new Set((s.match(/\{(\w+)[,}]/g) ?? []).map((m) => m.slice(1, -1)));

const pt = flat(load("pt-BR"));
const catalogs = { en: flat(load("en")), es: flat(load("es")) };

describe("catálogos de idioma", () => {
  it.each(Object.entries(catalogs))("%s tem exatamente as mesmas chaves do pt-BR, sem texto vazio", (_l, cat) => {
    expect(Object.keys(cat).sort()).toEqual(Object.keys(pt).sort());
    for (const [k, v] of Object.entries(cat)) expect([k, v.trim().length > 0]).toEqual([k, true]);
  });

  it.each(Object.entries(catalogs))("%s usa as mesmas variáveis ({count}, {name}…) do pt-BR", (_l, cat) => {
    for (const [k, v] of Object.entries(pt)) expect([k, [...placeholders(cat[k])].sort()]).toEqual([k, [...placeholders(v)].sort()]);
  });

  it("toda chave usada nas telas existe no catálogo", () => {
    const files = [
      "app/page.tsx",
      "app/vagas/page.tsx",
      "app/vagas/aprovar/page.tsx",
      "app/candidatos/page.tsx",
      "app/(app)/minhas-candidaturas/page.tsx",
      "components/vacancy-table.tsx",
      "components/vacancy-cards.tsx",
      "components/candidate-table.tsx",
      "components/candidate-cards.tsx",
      "components/batch-bar.tsx",
      "components/detail-modal.tsx",
      "components/language-switcher.tsx",
      "components/pwa.tsx",
      "components/install-app.tsx",
      "app/offline/page.tsx",
      "app/minha-ficha/page.tsx",
    ];
    // namespaces passados para useTranslations/getTranslations em cada arquivo
    const missing: string[] = [];
    for (const f of files) {
      const src = fs.readFileSync(path.join(ROOT, f), "utf-8");
      const nsByVar: Record<string, string> = {};
      for (const m of src.matchAll(/const (\w+) = (?:await )?(?:useTranslations|getTranslations)\((?:"([\w.]+)")?\)/g)) nsByVar[m[1]] = m[2] ?? "";
      for (const [v, ns] of Object.entries(nsByVar)) {
        for (const m of src.matchAll(new RegExp(`\\b${v}\\("([\\w.-]+)"`, "g"))) {
          const key = ns ? `${ns}.${m[1]}` : m[1];
          if (!(key in pt)) missing.push(`${f}: ${key}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});

describe("escolha do idioma (mesmo endereço)", () => {
  it("escolha salva vence o navegador; sem escolha vale o navegador; sem nada, português", () => {
    expect(resolveLocale("es", "en-US,en;q=0.9")).toBe("es");
    expect(resolveLocale(undefined, "en-US,en;q=0.9")).toBe("en");
    expect(resolveLocale(undefined, "fr-FR,es;q=0.8,en;q=0.5")).toBe("es");
    expect(resolveLocale(undefined, "fr-FR")).toBe("pt-BR");
    expect(resolveLocale("xx", null)).toBe("pt-BR");
    expect(localeFromAcceptLanguage("pt-PT;q=0.2,en;q=0.9")).toBe("en");
    expect(normalizeLocale("es-AR")).toBe("es");
  });
});

describe("formatação por idioma", () => {
  it("faixa e tempo nos três idiomas", () => {
    expect(formatFaixa(8000, null, "BRL", "pt-BR")).toMatch(/^a partir de R\$/);
    expect(formatFaixa(null, 9000, "BRL", "en")).toMatch(/^up to R\$/);
    expect(formatFaixa(8000, null, "BRL", "es")).toMatch(/^desde/);
    expect(formatFaixa(9000, 13000, "BRL", "es")).toBe("R$9,000 – R$13,000");
    expect(formatFaixa(9000, 13000, "BRL", "es")).not.toMatch(/BRL/);
    const d = new Date(Date.now() - 3 * 86400000);
    expect(formatTempo(d, "pt-BR")).toBe("há 3 dias");
    expect(formatTempo(d, "en")).toBe("3 days ago");
    expect(formatTempo(d, "es")).toBe("hace 3 días");
    expect(formatTempo(new Date(), "es")).toBe("hoy");
  });
});
