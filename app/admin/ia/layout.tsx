import type { Metadata } from "next";

// Painel interno: fora dos buscadores.
export const metadata: Metadata = { title: "Admin de IA · W2Talent", robots: { index: false, follow: false } };

export default function AdminIaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
