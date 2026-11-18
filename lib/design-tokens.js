// Design system v2 — fonte única dos tokens (Tailwind + componentes + testes).
// Origem: protótipo aprovado, tela "Design system v2" (Inter · grade 4/8 px · raio 6).
// 2026-11-10: visual "voltagem azul" (inspirado no design system que o Euclides trouxe, adaptado à marca):
// títulos em Space Grotesk, cards com canto de 4 px e botões em pílula.
// 2026-11-18: tema escuro. Cada cor tem o valor do tema claro (`claro`, o de sempre) e o do escuro (`escuro`).
// O Tailwind usa variáveis CSS (`--cor-*`, escritas pelo plugin do tailwind.config.js a partir destas tabelas),
// então `bg-surface`, `text-muted` etc. trocam sozinhos quando o <html> tem data-theme="dark".
// Escuro escolhido para AA: texto ≥ 6,5:1 sobre fundo/cartão; `brand` vira azul claro (texto, borda, foco)
// e `brand-solid` continua o azul da marca, para fundo com texto branco (botão principal, etiqueta).

const claro = {
  brand: { DEFAULT: "#1F4FD8", hover: "#163B9F", soft: "#EEF2FF", ink: "#1F3A93", faint: "#F5F8FF", solid: "#1F4FD8" },
  ink: { DEFAULT: "#111827", soft: "#374151" },
  muted: { DEFAULT: "#4B5563", soft: "#6B7280" },
  line: { DEFAULT: "#E5E7EB", strong: "#D1D5DB", soft: "#F0F1F3", dashed: "#9CA3AF" },
  canvas: "#F7F8FA",
  surface: "#FFFFFF",
  success: { DEFAULT: "#157F3C", soft: "#ECFDF3", ink: "#11622F" },
  warning: { DEFAULT: "#B45309", soft: "#FFF7ED", ink: "#8A3B06" },
  danger: { DEFAULT: "#B42318", soft: "#FEF3F2", ink: "#912018", solid: "#B42318" },
  neutral: { soft: "#F3F4F6" },
};

const escuro = {
  brand: { DEFAULT: "#8EADFF", hover: "#B3C8FF", soft: "#1C2A52", ink: "#BCCDFF", faint: "#18223C", solid: "#1F4FD8" },
  ink: { DEFAULT: "#E8ECF4", soft: "#CBD2DE" },
  muted: { DEFAULT: "#A6AFBF", soft: "#98A2B4" },
  line: { DEFAULT: "#2C3447", strong: "#414B61", soft: "#1F2636", dashed: "#5B6579" },
  canvas: "#0E1320",
  surface: "#161C2B",
  success: { DEFAULT: "#5CD18E", soft: "#11291D", ink: "#8FE3B0" },
  warning: { DEFAULT: "#E39A3B", soft: "#2E2010", ink: "#F8C07A" },
  danger: { DEFAULT: "#FF8F84", soft: "#341619", ink: "#FFB5AC", solid: "#B42318" },
  neutral: { soft: "#222A3B" },
};

/** "brand.soft" → "--cor-brand-soft"; DEFAULT some do nome. */
function nomeVar(caminho) {
  return "--cor-" + caminho.filter((p) => p !== "DEFAULT").join("-");
}

function rgb(hex) {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(" ");
}

/**
 * Tabela de cores → { "--cor-brand": "31 79 216", ... } (canais separados, para o Tailwind aplicar opacidade).
 * @param {object} tabela
 * @param {string[]} [caminho]
 * @returns {Record<string, string>}
 */
function variaveis(tabela, caminho = []) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const [k, v] of Object.entries(tabela)) {
    if (typeof v === "string") out[nomeVar([...caminho, k])] = rgb(v);
    else Object.assign(out, variaveis(v, [...caminho, k]));
  }
  return out;
}

/** Mesma forma de `claro`, mas cada cor aponta para a variável: rgb(var(--cor-brand) / <alpha-value>). */
function paraTailwind(tabela, caminho = []) {
  const out = {};
  for (const [k, v] of Object.entries(tabela)) {
    out[k] = typeof v === "string" ? `rgb(var(${nomeVar([...caminho, k])}) / <alpha-value>)` : paraTailwind(v, [...caminho, k]);
  }
  return out;
}

const colors = {
  ...paraTailwind(claro),
  // Véu atrás de janelas: igual nos dois temas.
  scrim: "#111827",
};

const fontFamily = {
  sans: ["var(--font-inter)", "Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
  mono: ["var(--font-mono)", "JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
  // logo e títulos (h1, h2)
  display: ["var(--font-grotesk)", "Space Grotesk", "var(--font-inter)", "Inter", "system-ui", "sans-serif"],
};

const radius = { control: "6px", card: "4px", pill: "9999px" };

module.exports = { colors, claro, escuro, variaveis, fontFamily, radius };
