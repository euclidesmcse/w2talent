import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppHeader } from "@/components/app-header";
import { buttonClasses, Card, Chip, MatchBar, StatusBadge } from "@/components/ui";
import { initials } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const t = await getTranslations("home");
  const ts = await getTranslations("status");
  const PASSOS = [1, 2, 3, 4].map((n) => ({ n: String(n), titulo: t(`step${n}Title`), texto: t(`step${n}Text`) }));
  const PERGUNTAS = [1, 2, 3, 4].map((n) => ({ p: t(`faq${n}q`), r: t(`faq${n}a`) }));
  return (
    <div className="min-h-screen">
      <AppHeader area="publico" />

      <main className="mx-auto flex max-w-page flex-col gap-16 px-6 py-12 md:py-16">
        <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
          <div className="flex flex-col gap-5">
            <h1 className="text-[32px] font-semibold leading-[1.15] tracking-[-0.02em] md:text-[40px]">
              {t.rich("title", { destaque: (c) => <span className="relevo-texto">{c}</span> })}
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
          {/* Passos ligados por um traço: uma sequência, não quatro cartões iguais */}
          <ol className="grid gap-8 md:grid-cols-4 md:gap-6">
            {PASSOS.map((p, i) => (
              <li key={p.n} className="relative flex gap-4 md:flex-col md:gap-3">
                {i < PASSOS.length - 1 ? (
                  <span aria-hidden className="absolute left-4 top-10 h-[calc(100%-8px)] w-px bg-line md:left-10 md:top-4 md:h-px md:w-[calc(100%-16px)]" />
                ) : null}
                <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface font-mono text-[13px] font-medium tabular-nums text-ink">
                  {p.n}
                </span>
                <div className="flex flex-col gap-1">
                  <strong className="font-semibold">{p.titulo}</strong>
                  <span className="text-sm text-muted">{p.texto}</span>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="recrutadores" className="grid items-center gap-10 lg:grid-cols-[1fr_1.1fr]">
          <div className="flex flex-col gap-3">
            <h2 id="recrutadores" className="text-xl font-semibold">
              {t("recruitersTitle")}
            </h2>
            <p className="max-w-[56ch] text-muted">
              {t("recruitersText")}
            </p>
            <div>
              <Link href="/candidatos" className={buttonClasses("secondary", "md", "hover:no-underline")}>
                {t("recruitersCta")}
              </Link>
            </div>
          </div>

          {/* Amostra da Ficha W2: o que o recrutador recebe */}
          <Card className="flex flex-col gap-4 p-5" aria-label={t("ficha_label")}>
            <div className="flex flex-wrap items-center gap-3">
              <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-line text-sm font-semibold text-ink-soft">
                {initials(t("ficha_name"))}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{t("ficha_name")}</div>
                <div className="text-[13px] text-muted">{t("ficha_role")}</div>
              </div>
              <span className="w-full pl-[52px] md:w-auto md:pl-0">
                <MatchBar value={87} label={ts("match")} />
              </span>
            </div>
            <div className="text-[13px] text-muted">{t("ficha_vaga")}</div>
            <div className="flex flex-col gap-2 border-t border-line-soft pt-4">
              <div className="text-[13px] font-medium text-ink-soft">{t("ficha_why")}</div>
              <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
                {t("ficha_has")}
                <Chip>AWS</Chip>
                <Chip>Terraform</Chip>
                <Chip>Linux</Chip>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
                {t("ficha_missing")}
                <Chip tone="neutral">Kubernetes</Chip>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line-soft pt-4 text-sm md:grid-cols-4">
              {[
                [t("ficha_fieldModelo"), t("ficha_valModelo")],
                [t("ficha_fieldRegime"), t("ficha_valRegime")],
                [t("ficha_fieldPretensao"), t("ficha_valPretensao")],
                [t("ficha_fieldInicio"), t("ficha_valInicio")],
              ].map(([k, v]) => (
                <div key={k} className="flex flex-col gap-0.5">
                  <dt className="text-[13px] text-muted">{k}</dt>
                  <dd className="font-medium tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="border-t border-line-soft pt-3 text-[13px] text-muted">{t("ficha_contact")}</div>
          </Card>
        </section>

        <section aria-labelledby="perguntas" className="flex flex-col gap-5">
          <h2 id="perguntas" className="text-xl font-semibold">
            {t("faqTitle")}
          </h2>
          <dl className="grid gap-x-10 gap-y-6 md:grid-cols-2">
            {PERGUNTAS.map((q) => (
              <div key={q.p} className="flex flex-col gap-1 border-t border-line pt-4">
                <dt className="font-semibold">{q.p}</dt>
                <dd className="text-sm text-muted">{q.r}</dd>
              </div>
            ))}
          </dl>
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
