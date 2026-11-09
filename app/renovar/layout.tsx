import type { Metadata } from "next";

export const metadata: Metadata = { title: "W2Talent", robots: { index: false, follow: false } };

export default function RenovarLayout({ children }: { children: React.ReactNode }) {
  return children;
}
