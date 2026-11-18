import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

// Lista pessoal (só com login): fora dos buscadores.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("minhasConversas");
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

export default function MinhasConversasLayout({ children }: { children: React.ReactNode }) {
  return children;
}
