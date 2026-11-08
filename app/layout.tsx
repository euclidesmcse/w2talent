import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getLocale, getTranslations } from "next-intl/server";
import { defaultLocale } from "@/i18n";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta").catch(() => null);
  return {
    title: "W2Talent",
    description: t ? t("description") : "Encontre vagas, confira cada uma e envie em lote só as que você aprovou.",
    manifest: "/manifest.json",
    icons: { icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }, { url: "/icons/icon-192.png", sizes: "192x192" }], apple: "/icons/apple-touch-icon.png" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F7F8FA",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale().catch(() => defaultLocale);
  const messages = await getMessages().catch(async () => {
    const { default: ptBR } = await import("@/messages/pt-BR.json");
    return ptBR as any;
  });

  return (
    <html lang={locale}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        {/* Fonte do logo: só as letras de "W2Talent" (arquivo de poucos KB) */}
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700&text=W2Talent&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-canvas font-sans text-ink antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ToastProvider>{children}</ToastProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
