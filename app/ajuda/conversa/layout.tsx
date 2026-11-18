import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

// O link tem o código de acesso: fora dos buscadores e sem mandar o endereço para outros sites.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("conversa");
  return { title: t("metaTitle"), robots: { index: false, follow: false }, referrer: "no-referrer" };
}

export default function ConversaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
