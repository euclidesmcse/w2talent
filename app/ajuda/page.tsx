import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { AjudaPergunta } from "@/components/ajuda-pergunta";
import { AppHeader } from "@/components/app-header";
import { organizarAjuda, type ArtigoBruto } from "@/lib/ajuda";
import { EMAIL_REVISAO } from "@/lib/ia-transparencia";

/** 2.6a Ajuda: artigos curtos por área; os da tela de onde a pessoa veio (?de=) aparecem primeiro. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ajuda");
  return { title: t("metaTitle"), description: t("metaDescription") };
}

function Lista({ id, titulo, artigos }: { id: string; titulo: string; artigos: ArtigoBruto[] }) {
  if (!artigos.length) return null;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="text-xl font-semibold">{titulo}</h2>
      <ul className="grid gap-3 md:grid-cols-2">
        {artigos.map((a) => (
          <li key={a.slug}>
            <Link href={`/ajuda/${a.slug}`} data-ajuda-artigo={a.slug} className="relevo-cartao block h-full rounded-card border border-line bg-surface p-4 text-ink hover:border-brand hover:no-underline">
              <span className="block font-semibold text-brand">{a.titulo}</span>
              <span className="mt-1 block text-sm text-muted">{a.resumo}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function AjudaPage({ searchParams }: { searchParams: Promise<{ de?: string | string[] }> }) {
  const t = await getTranslations("ajuda");
  const locale = await getLocale();
  const sp = await searchParams;
  const de = Array.isArray(sp.de) ? sp.de[0] : sp.de;
  const g = organizarAjuda(locale, de);
  return (
    <div className="min-h-screen">
      <AppHeader area="publico" />
      <main className="mx-auto flex max-w-page flex-col gap-10 px-6 py-10 md:py-14">
        <header className="flex max-w-[68ch] flex-col gap-3">
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em] md:text-[36px]">{t("title")}</h1>
          <p className="text-[17px] text-ink">{t("lead")}</p>
        </header>
        <AjudaPergunta de={g.tela} />
        <Lista id="ajuda-tela" titulo={t("sobreEstaTela")} artigos={g.destaque} />
        <Lista id="ajuda-comecar" titulo={t("grupoComecar")} artigos={g.comecar} />
        <Lista id="ajuda-candidato" titulo={t("grupoCandidato")} artigos={g.candidato} />
        <Lista id="ajuda-recrutador" titulo={t("grupoRecrutador")} artigos={g.recrutador} />
        <p className="max-w-[68ch] text-ink">
          {t.rich("naoAchou", {
            email: () => <a href={`mailto:${EMAIL_REVISAO}`} className="font-medium underline underline-offset-2">{EMAIL_REVISAO}</a>,
          })}
        </p>
      </main>
    </div>
  );
}
