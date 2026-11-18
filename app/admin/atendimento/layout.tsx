import type { Metadata } from "next";

// Painel interno: fora dos buscadores.
export const metadata: Metadata = { title: "Atendimento · Admin · W2Talent", robots: { index: false, follow: false } };

export default function AdminAtendimentoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
