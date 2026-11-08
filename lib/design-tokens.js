// Design system v2 — fonte única dos tokens (Tailwind + componentes + testes).
// Origem: protótipo aprovado, tela "Design system v2" (Inter · grade 4/8 px · raio 6).

const colors = {
  brand: { DEFAULT: "#1F4FD8", hover: "#163B9F", soft: "#EEF2FF", ink: "#1F3A93" },
  ink: { DEFAULT: "#111827", soft: "#374151" },
  muted: { DEFAULT: "#4B5563", soft: "#6B7280" },
  line: { DEFAULT: "#E5E7EB", strong: "#D1D5DB", soft: "#F0F1F3" },
  canvas: "#F7F8FA",
  surface: "#FFFFFF",
  success: { DEFAULT: "#157F3C", soft: "#ECFDF3", ink: "#11622F" },
  warning: { DEFAULT: "#B45309", soft: "#FFF7ED", ink: "#8A3B06" },
  danger: { DEFAULT: "#B42318", soft: "#FEF3F2", ink: "#912018" },
  neutral: { soft: "#F3F4F6" },
};

const fontFamily = {
  sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
  mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
  // só o nome da marca (logo); carregado com subset text=W2Talent
  display: ["Space Grotesk", "Inter", "system-ui", "sans-serif"],
};

const radius = { control: "6px", card: "8px" };

module.exports = { colors, fontFamily, radius };
