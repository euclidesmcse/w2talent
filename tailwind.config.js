/** @type {import('tailwindcss').Config} */
// Tokens do design system v2 (protótipo aprovado em 2026-11-08). Os valores vivem em
// lib/design-tokens.js para o código e os testes usarem a mesma fonte.
const { colors, fontFamily, radius } = require("./lib/design-tokens");

module.exports = {
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
  plugins: [],
};
