/** @type {import('tailwindcss').Config} */
// Tokens do design system v2 (protótipo aprovado em 2026-11-08). Os valores vivem em
// lib/design-tokens.js para o código e os testes usarem a mesma fonte.
const { colors, claro, escuro, variaveis, fontFamily, radius } = require("./lib/design-tokens");

module.exports = {
  // Tema escuro (2026-11-18): o script do <head> (lib/tema.ts) põe data-theme="light|dark" no <html> antes da
  // primeira pintura, seguindo o sistema ou a escolha da pessoa. Quase tudo troca pelas variáveis --cor-*;
  // `dark:` fica para as poucas exceções.
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}", "./lib/**/*.{js,ts}"],
  theme: {
    screens: {
      xs: "360px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
    },
    extend: {
      colors,
      fontFamily,
      borderRadius: { DEFAULT: radius.control, control: radius.control, card: radius.card, pill: radius.pill },
      maxWidth: { page: "1180px" },
      spacing: {
        "safe-bottom": "env(safe-area-inset-bottom)",
      },
    },
  },
  plugins: [
    // Variáveis das cores: valores do claro em :root, do escuro com data-theme="dark".
    function ({ addBase }) {
      addBase({
        ":root": { ...variaveis(claro), "color-scheme": "light" },
        ':root[data-theme="dark"]': { ...variaveis(escuro), "color-scheme": "dark" },
      });
    },
  ],
};
