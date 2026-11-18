import type { Metadata } from "next";

// Painel interno: fora dos buscadores.
export const metadata: Metadata = { title: "Empresas · Admin · W2Talent", robots: { index: false, follow: false } };

export default function AdminEmpresasLayout({ children }: { children: React.ReactNode }) {
  return children;
}
