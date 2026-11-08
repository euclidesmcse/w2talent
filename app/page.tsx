import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppHeader } from "@/components/app-header";
import { buttonClasses, Card, Chip, MatchBar, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const t = await getTranslations("home");
  const tn = await getTranslations("nav");
  const ts = await getTranslations("status");
  const PASSOS = [1, 2, 3, 4].map((n) => ({ n: String(n), titulo: t(`step${n}Title`), texto: t(`step${n}Text`) }));
  const PERGUNTAS = [1, 2, 3, 4].map((n) => ({ p: t(`faq${n}q`), r: t(`faq${n}a`) }));
  return (
    <div className="min-h-screen">
      <AppHeader
        nav={[
          { href: "/vagas", label: tn("vagas") },
          { href: "/candidatos", label: tn("recrutadores") },
        ]}
        navLabel={tn("main")}
        right={
          <Link href="/vagas" className={buttonClasses("primary", "sm", "hover:no-underline hover:text-white")}>
            {tn("verVagas")}
          </Link>
        }
      />

      <main className="mx-auto flex max-w-page flex-col gap-16 px-6 py-12 md:py-16">
        <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
          <div className="flex flex-col gap-5">
            <h1 className="text-[32px] font-bold leading-[1.15] tracking-[-0.02em] md:text-[40px]">
              {t("title")}
            </h1>
            <p className="max-w-[56ch] text-[17px] text-muted">
              {t("lead")}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/vagas" className={buttonClasses("primary", "lg", "hover:no-underline hover:text-white")}>
                {t("ctaBuscar")}
              </Link>
              <Link href="/candidatos" className={buttonClasses("secondary", "lg", "hover:no-underline")}>
                {t("ctaRecrutador")}
              </Link>
            </div>
          </div>

          {/* Amostra do produto, no visual do protótipo */}
          <Card className="flex flex-col gap-4 p-5" aria-label={t("sampleLabel")}>
            <div className="flex h-10 items-center rounded-control border border-line-strong px-3 text-[15px]">{t("sampleQuery")}</div>
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
              {t("sampleUnderstood")}
              <Chip>DevOps</Chip>
              <Chip>{t("sampleRemote")}</Chip>
              <Chip>PJ</Chip>
              <Chip>{t("sampleMin")}</Chip>
            </div>
            {[
              { t: "DevOps Sênior", e: `${t("sampleRemote")} · PJ · R$ 16–20k`, m: 87, s: "aprovada" as const },
              { t: "SRE Pleno", e: `${t("sampleRemote")} · PJ · R$ 14–17k`, m: 74, s: "revisada" as const },
              { t: "Platform Engineer", e: `${t("sampleRemote")} · CLT · R$ 15–19k`, m: 69, s: "enviada" as const },
            ].map((v) => (
              <div key={v.t} className="flex flex-wrap items-center gap-3 border-t border-line-soft pt-3">
                <div className="min-w-[160px] flex-1">
                  <div className="font-semibold">{v.t}</div>
                  <div className="text-[13px] text-muted">{v.e}</div>
                </div>
                <MatchBar value={v.m} label={ts("match")} />
                <StatusBadge status={v.s}>{v.s === "enviada" ? t("sampleSent") : ts(v.s)}</StatusBadge>
              </div>
            ))}
          </Card>
        </section>

        <section aria-labelledby="como-funciona" className="flex flex-col gap-5">
          <h2 id="como-funciona" className="text-xl font-semibold">
            {t("howTitle")}
          </h2>
          <ol className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {PASSOS.map((p) => (
              <li key={p.n}>
                <Card className="flex h-full flex-col gap-2 p-5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-soft text-[13px] font-semibold text-brand-ink">
                    {p.n}
                  </span>
                  <strong className="font-semibold">{p.titulo}</strong>
                  <span className="text-sm text-muted">{p.texto}</span>
                </Card>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="recrutadores" className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-3">
            <h2 id="recrutadores" className="text-xl font-semibold">
              {t("recruitersTitle")}
            </h2>
            <p className="text-muted">
              {t("recruitersText")}
            </p>
            <div>
              <Link href="/candidatos" className={buttonClasses("secondary", "md", "hover:no-underline")}>
                {t("recruitersCta")}
              </Link>
            </div>
          </div>
          <Card className="p-5">
            <dl className="flex flex-col divide-y divide-line-soft text-sm">
              {PERGUNTAS.map((q) => (
                <div key={q.p} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                  <dt className="font-semibold">{q.p}</dt>
                  <dd className="text-muted">{q.r}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </section>
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-page flex-wrap justify-between gap-2 px-6 py-5 text-[13px] text-muted">
          <span>{t("footer")}</span>
          <span>© 2026</span>
        </div>
      </footer>
    </div>
  );
}
