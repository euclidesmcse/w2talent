import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getLocale, getTranslations } from "next-intl/server";
import { defaultLocale } from "@/i18n";
import { ToastProvider } from "@/components/ui/toast";
import { OfflineBanner, PwaInit } from "@/components/pwa";
import localFont from "next/font/local";
import "./globals.css";

// Fontes servidas pelo próprio site: sem CSS de terceiro bloqueando a primeira pintura (antes vinham do
// fonts.googleapis.com e o Lighthouse do CI oscilava). Os arquivos ficam no repositório (app/fonts, versões
// variáveis do Fontsource, licença OFL, só o subconjunto latin): o build não depende do Google Fonts,
// que às vezes respondia fora do formato e quebrava o next/font/google no CI.
const inter = localFont({ src: "./fonts/inter-latin-wght-normal.woff2", weight: "100 900", display: "swap", variable: "--font-inter" });
const mono = localFont({ src: "./fonts/jetbrains-mono-latin-wght-normal.woff2", weight: "100 800", display: "swap", variable: "--font-mono", preload: false, fallback: ["ui-monospace", "monospace"] });
const grotesk = localFont({ src: "./fonts/space-grotesk-latin-wght-normal.woff2", weight: "300 700", display: "swap", variable: "--font-grotesk" });

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
