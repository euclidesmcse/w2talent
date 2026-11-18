import type { Metadata } from "next";

export const metadata: Metadata = { title: "W2Talent", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default function AgendarLayout({ children }: { children: React.ReactNode }) {
  return children;
}
