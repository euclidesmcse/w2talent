"use client";
import * as React from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { AppHeader } from "@/components/app-header";
import { buttonClasses } from "@/components/ui/button";
import { diaMes, postEnvio } from "@/lib/envio-client";
import { contaRecusada, ehCandidato, linkEntrar, useConta } from "@/lib/conta-client";
import { dataHoraCurta, lerCopia, salvarCopia } from "@/lib/pwa-client";

/** Última lista de candidaturas, para ver sem internet (1.5.14). Fica só neste navegador. */
const COPIA_ENVIADAS = "w2talent:candidaturas-copia";

type AppRow = {
  id: string;
  vacancyId: string | null;
  proxyThreadId: string;
  status: "enviado" | "visualizado" | "respondido" | "arquivado";
  origem?: string;
  titulo?: string;
  empresa?: string;
  companyId?: string;
  createdAt?: string;
};

const STATUS_ORDER: Record<string, number> = { enviado: 0, visualizado: 1, respondido: 2, arquivado: 3 };

const STATUS_KEYS = ["enviado", "visualizado", "respondido", "arquivado"] as const;

export default function MinhasCandidaturasPage() {
  const t = useTranslations("minhas");
  const tp = useTranslations("pwa");
  const locale = useLocale();
  const [copiaDe, setCopiaDe] = React.useState<string | null>(null);
  const statusLabel = (s: string) => ((STATUS_KEYS as readonly string[]).includes(s) ? t(s as (typeof STATUS_KEYS)[number]) : s);
  const [items, setItems] = React.useState<AppRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [needsLogin, setNeedsLogin] = React.useState(false);
  const conta = useConta();
  const jaConferiu = React.useRef(false);

  // 1.5.5: as candidaturas da conta logada (candidato). Sem internet, a última lista salva neste navegador.
  React.useEffect(() => {
    if (conta.estado === "carregando") return;
    let vivo = true;
    (async () => {
      if (!navigator.onLine || conta.estado === "erro") {
        const copia = lerCopia<{ applications: AppRow[] }>(COPIA_ENVIADAS);
        if (copia) {
          if (!vivo) return;
          setNeedsLogin(false);
          setItems(copia.dados.applications ?? []);
          setCopiaDe(copia.salvoEm);
          return;
        }
      }
      if (!ehCandidato(conta)) {
        if (vivo) { setNeedsLogin(true); setItems([]); }
        return;
      }
      const r = await postEnvio("enviadas", {});
      if (!vivo) return;
      if (!r.ok) {
        // Uma vez por tela: a sessão pode ter acabado; a nova leitura roda este efeito de novo.
        if ((r.status === 401 || r.status === 403) && !jaConferiu.current) { jaConferiu.current = true; contaRecusada(); }
        setNeedsLogin(r.status === 401 || r.status === 403);
        setItems([]);
        return;
      }
      const j = (await r.json()) as { applications: AppRow[] };
      if (!vivo) return;
      setNeedsLogin(false);
      setItems(j.applications ?? []);
      setCopiaDe(null);
      salvarCopia(COPIA_ENVIADAS, { applications: j.applications ?? [] });
    })()
      .catch(() => { if (vivo) setItems([]); })
      .finally(() => { if (vivo) setLoading(false); });
    return () => { vivo = false; };
  }, [conta]);

  if (loading)
    return (
      <div className="min-h-screen">
        <AppHeader area="candidato" active="/minhas-candidaturas" />
        <main className="mx-auto max-w-page px-4 py-6 md:px-6 text-muted">{t("loading")}</main>
      </div>
    );

  return (
    <div className="min-h-screen">
      <AppHeader area="candidato" active="/minhas-candidaturas" />
      <main className="minhas-candidaturas mx-auto flex max-w-page flex-col gap-4 px-4 py-6 md:px-6">
        <div>
          <h1 className="text-xl font-semibold">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted">
            {t("subtitle", { count: items.length })}
          </p>
        </div>
        {copiaDe ? (
          <div role="status" data-testid="copia-candidaturas" className="rounded-card border border-warning bg-warning-soft px-3.5 py-2.5 text-[13px] text-warning-ink">
            {tp("savedCopy", { date: dataHoraCurta(copiaDe, locale) })}
          </div>
        ) : null}
        {needsLogin ? (
          <div role="status" className="rounded-card border border-line bg-surface px-6 py-10 text-center">
            <p className="font-semibold">{t("loginTitle")}</p>
            <p className="mt-1 text-sm text-muted">{t("loginBody")}</p>
            <Link href={linkEntrar("/minhas-candidaturas")} className={buttonClasses("primary", "md", "mt-4 hover:no-underline hover:text-white")}>
              {t("loginCta")}
            </Link>
          </div>
        ) : items.length === 0 ? (
          <div role="status" className="empty rounded-card border border-line bg-surface px-6 py-10 text-center">
            <p className="font-semibold">{t("emptyTitle")}</p>
            <p className="mt-1 text-sm text-muted">{t("emptyBody")}</p>
            <Link href={linkEntrar("/minhas-candidaturas")} className={buttonClasses("primary", "md", "mt-4 hover:no-underline hover:text-white")}>
              {t("emptyCta")}
            </Link>
          </div>
        ) : (
          <>
          {/* Celular (1.5.14): um cartão por candidatura, sem rolar para o lado */}
          <ul aria-label={t("tableLabel")} className="flex flex-col gap-2.5 md:hidden">
            {items.map((app) => (
              <li key={app.id} data-testid={`card-${app.id}`} className="rounded-card border border-line bg-surface p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold">{app.titulo || app.vacancyId || "—"}</div>
                    {app.empresa || app.createdAt ? (
                      <div className="text-[13px] text-muted">
                        {[app.empresa, app.createdAt ? t("sentOn", { date: diaMes(app.createdAt, locale) }) : ""].filter(Boolean).join(" · ")}
                      </div>
                    ) : null}
                  </div>
                  <span className={`inline-flex h-7 shrink-0 items-center rounded-control px-2.5 text-[13px] font-medium ${app.status === "respondido" ? "bg-success-soft text-success-ink" : app.status === "visualizado" ? "bg-brand-soft text-brand-ink" : "bg-neutral-soft text-ink-soft"}`}>
                    {statusLabel(app.status)}
                  </span>
                </div>
                <div className="mt-1 font-mono text-xs text-muted" title={t("proxyHint")}>{app.proxyThreadId}</div>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto rounded-card border border-line bg-surface md:block">
            <table aria-label={t("tableLabel")} className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs text-muted [&>th]:px-2 [&>th]:py-2.5 [&>th]:font-medium [&>th:first-child]:pl-4 [&>th:last-child]:pr-4">
                  <th scope="col">{t("colVaga")}</th>
                  <th scope="col">{t("colStatus")}</th>
                  <th scope="col">{t("colAndamento")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((app) => (
                  <tr key={app.id} data-testid={`app-${app.id}`} data-status={app.status} data-proxy={app.proxyThreadId} className="border-t border-line-soft">
                    <td className="py-3.5 pl-4 pr-2">
                      <div className="font-semibold">{app.titulo || app.vacancyId || "—"}</div>
                      {app.empresa || app.createdAt ? (
                        <div className="text-[13px] text-muted">
                          {[app.empresa, app.createdAt ? t("sentOn", { date: diaMes(app.createdAt, locale) }) : ""].filter(Boolean).join(" · ")}
                        </div>
                      ) : null}
                      <div className="font-mono text-xs text-muted" title={t("proxyHint")}>{app.proxyThreadId}</div>
                    </td>
                    <td className="px-2 py-3.5">
                      <span
                        data-status-badge={app.status}
                        className={`badge badge-${app.status} inline-flex h-7 items-center rounded-control px-2.5 text-[13px] font-medium ${
                          app.status === "respondido" ? "bg-success-soft text-success-ink" : app.status === "visualizado" ? "bg-brand-soft text-brand-ink" : "bg-neutral-soft text-ink-soft"
                        }`}
                      >
                        {statusLabel(app.status)}
                      </span>
                    </td>
                    <td data-progress={app.status} className="py-3.5 pl-2 pr-4">
                      <ol className="flex items-center gap-2 text-[13px]">
                        {["enviado", "visualizado", "respondido"].map((s, i) => {
                          const done = STATUS_ORDER[app.status] >= STATUS_ORDER[s];
                          return (
                            <li key={s} className="flex items-center gap-2">
                              {i > 0 ? <span aria-hidden className={`h-px w-5 ${done ? "bg-brand" : "bg-line-strong"}`} /> : null}
                              <span data-active={done ? "true" : "false"} data-step={s} className={done ? "font-medium text-ink" : "text-muted-soft"}>
                                <span aria-hidden className={`mr-1 inline-block h-2 w-2 rounded-full ${done ? "bg-brand" : "bg-line-strong"}`} />
                                {statusLabel(s)}
                              </span>
                            </li>
                          );
                        })}
                      </ol>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
        <p className="text-xs text-muted">{t("footnote")}</p>
      </main>
    </div>
  );
}
