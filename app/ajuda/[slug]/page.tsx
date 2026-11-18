import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { AppHeader } from "@/components/app-header";
import { AjudaArtigo } from "@/components/ajuda-artigo";
import { artigo, artigosDe } from "@/lib/ajuda";

/** 2.6a: um artigo de ajuda, no idioma da tela. */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const a = artigo(await getLocale(), slug);
  if (!a) return {};
  const t = await getTranslations("ajuda");
  return { title: `${a.titulo} · ${t("title")}`, description: a.resumo };
}

export default async function AjudaArtigoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const locale = await getLocale();
  const a = artigo(locale, slug);
  if (!a) notFound();
  const t = await getTranslations("ajuda");
  // até 3 artigos da mesma área, para seguir lendo
  const outros = artigosDe(locale)
    .filter((x) => x.slug !== a.slug && x.areas.some((ar) => a.areas.includes(ar)))
    .slice(0, 3);
  return (
    <div className="min-h-screen">
      <AppHeader area="publico" />
      <main className="mx-auto flex max-w-page flex-col gap-8 px-6 py-10 md:py-14">
        <nav aria-label={t("trilha")} className="text-sm">
          <Link href="/ajuda" className="font-medium">{t("voltar")}</Link>
        </nav>
        <article className="flex max-w-[68ch] flex-col gap-4" data-ajuda-slug={a.slug}>
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em] md:text-[36px]">{a.titulo}</h1>
          <p className="text-[17px] text-muted">{a.resumo}</p>
          <AjudaArtigo corpo={a.corpo} />
        </article>
        {outros.length ? (
          <section aria-labelledby="ajuda-outros" className="flex max-w-[68ch] flex-col gap-3 border-t border-line pt-6">
            <h2 id="ajuda-outros" className="text-lg font-semibold">{t("outros")}</h2>
            <ul className="flex flex-col gap-2">
              {outros.map((o) => <li key={o.slug}><Link href={`/ajuda/${o.slug}`} className="font-medium">{o.titulo}</Link></li>)}
            </ul>
          </section>
        ) : null}
      </main>
    </div>
  );
}
