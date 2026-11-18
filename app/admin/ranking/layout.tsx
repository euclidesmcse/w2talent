import type { Metadata } from "next";

// Painel interno: fora dos buscadores.
export const metadata: Metadata = { title: "Ranking · Admin · W2Talent", robots: { index: false, follow: false } };

export default function AdminRankingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
