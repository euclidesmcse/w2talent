import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getLocale, getTranslations } from "next-intl/server";
import { defaultLocale } from "@/i18n";
import { ToastProvider } from "@/components/ui/toast";
import { OfflineBanner, PwaInit } from "@/components/pwa";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

// Fontes servidas pelo próprio site (next/font baixa no build): sem CSS de terceiro bloqueando a
// primeira pintura. Antes vinham do fonts.googleapis.com e o tempo até esse servidor fazia o
// Lighthouse do CI oscilar (FCP 1,5 s ↔ 2,8 s) e cair abaixo de 90 em telas sorteadas.
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap", variable: "--font-inter" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], display: "swap", variable: "--font-mono", preload: false });
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"], display: "swap", variable: "--font-grotesk" });

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta").catch(() => null);
  return {
    title: "W2Talent",
    description: t ? t("description") : "Encontre vagas, confira cada uma e envie em lote só as que você aprovou.",
    manifest: "/manifest.json",
    icons: { icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }, { url: "/icons/icon-192.png", sizes: "192x192" }], apple: "/icons/apple-touch-icon.png" },
    // iPhone/iPad: abre como app (sem a barra do Safari) quando instalado pela Tela de Início (1.5.14)
    appleWebApp: { capable: true, title: "W2Talent", statusBarStyle: "default" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F7F8FA",
  // Ocupa a tela toda no app instalado; as bordas usam env(safe-area-inset-*) (entalhe e barra de gestos)
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale().catch(() => defaultLocale);
  const messages = await getMessages().catch(async () => {
    const { default: ptBR } = await import("@/messages/pt-BR.json");
    return ptBR as any;
  });

  return (
    <html lang={locale} className={`${inter.variable} ${mono.variable} ${grotesk.variable}`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="bg-canvas font-sans text-ink antialiased [padding-left:env(safe-area-inset-left)] [padding-right:env(safe-area-inset-right)]">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <PwaInit />
          <OfflineBanner />
          <ToastProvider>{children}</ToastProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
