import type { Metadata } from "next";

export const metadata: Metadata = { title: "Publicar vaga · W2Talent", robots: { index: false, follow: false } };

export default function PublicarLayout({ children }: { children: React.ReactNode }) {
  return children;
}
