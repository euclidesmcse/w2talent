import type { Metadata } from "next";

export const metadata: Metadata = { title: "Minha empresa · W2Talent", robots: { index: false, follow: false } };

export default function EmpresaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
