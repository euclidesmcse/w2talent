import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppHeader } from "@/components/app-header";
import { MercadoTela } from "@/components/mercado";

/**
 * 3.2a Inteligência de mercado (plano 3.2, D1–D7): página pública, sem login.
 * Faixa salarial das vagas, pretensão das fichas, competências mais pedidas e em alta e o tempo até a
 * primeira resposta, tirados de lib/mercado.ts (MarketStat, recalculado pelo Cron diário) por GET /api/mercado.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("mercado");
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function MercadoPage() {
  const t = await getTranslations("mercado");
  return (
    <div className="min-h-screen">
      <AppHeader area="publico" active="/mercado" />
      <main>
        <section className="voltagem">
          <div className="mx-auto flex max-w-page flex-col gap-3 px-4 py-8 md:px-6 md:py-10">
            <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em] md:text-[36px]">{t("title")}</h1>
            <p className="voltagem-apoio max-w-[68ch] text-[17px]">{t("lead")}</p>
            <p className="voltagem-apoio max-w-[68ch] text-[14px]">
              {t("explicacao")}{" "}
              <Link href="/ajuda/mercado" className="font-medium text-white underline underline-offset-2 hover:text-white focus-visible:outline-white">{t("ajudaLink")}</Link>
            </p>
          </div>
        </section>
        <MercadoTela />
      </main>
    </div>
  );
}
