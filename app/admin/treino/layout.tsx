import type { Metadata } from "next";

// Painel interno: fora dos buscadores.
export const metadata: Metadata = { title: "Dados de treino · Admin · W2Talent", robots: { index: false, follow: false } };

export default function AdminTreinoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
