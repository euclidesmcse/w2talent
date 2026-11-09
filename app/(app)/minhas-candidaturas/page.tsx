"use client";
import * as React from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { AppHeader } from "@/components/app-header";
import { buttonClasses } from "@/components/ui/button";
import { diaMes, emailDaFichaLocal, podeEnviar, postEnvio } from "@/lib/envio-client";

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
  const locale = useLocale();
  // 1.5.13: no modo de teste do admin, lê do banco as candidaturas do perfil de "Minha ficha".
  const [testeEmail, setTesteEmail] = React.useState("");
  const statusLabel = (s: string) => ((STATUS_KEYS as readonly string[]).includes(s) ? t(s as (typeof STATUS_KEYS)[number]) : s);
  const [items, setItems] = React.useState<AppRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [needsLogin, setNeedsLogin] = React.useState(false);
  const [candidateId, setCandidateId] = React.useState<string>("");

  React.useEffect(() => {
    const cid = (() => {
      try {
        const raw = typeof window !== "undefined" ? window.localStorage.getItem("w2talent:candidateId") : null;
        if (raw) return raw.replace(/"/g, "");
      } catch {}
      return "";
    })();
    if (cid) setCandidateId(cid);
  }, []);

  const fetchApps = React.useCallback(async () => {
    setLoading(true);
    try {
      const email = emailDaFichaLocal();
      if (email && (await podeEnviar())) {
        const r = await postEnvio("enviadas", { email });
        if (r.ok) {
          const j = (await r.json()) as { applications: AppRow[] };
          setTesteEmail(email);
          setNeedsLogin(false);
          setItems(j.applications ?? []);
          return;
        }
      }
      const qs = candidateId ? `?candidateId=${encodeURIComponent(candidateId)}` : "";
      // tenta api batch listing; fallback para mock
      const res = await fetch(`/api/applications/batch${qs}`, { method: "GET" }).catch(() => null as any);
      let data: any = null;
      setNeedsLogin(res?.status === 401);
      if (res && res.ok) data = await res.json().catch(() => null);
      if (data?.applications?.length) {
        setItems(data.applications);
      } else if (data?.results?.length) {
        setItems(
          data.results.map((r: any) => ({
            id: r.id ?? r.applicationId,
            vacancyId: r.vacancyId,
            proxyThreadId: r.proxyThreadId,
            status: r.status,
            origem: "candidaturaLote",
          }))
        );
      } else {
        setItems([]);
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [candidateId]);

  React.useEffect(() => {
    if (candidateId !== undefined) fetchApps();
  }, [fetchApps, candidateId]);

  if (loading)
    return (
      <div className="min-h-screen">
        <AppHeader area="candidato" active="/minhas-candidaturas" />
        <main className="mx-auto max-w-page px-6 py-6 text-muted">{t("loading")}</main>
      </div>
    );

  return (
    <div className="min-h-screen">
      <AppHeader area="candidato" active="/minhas-candidaturas" />
      <main className="minhas-candidaturas mx-auto flex max-w-page flex-col gap-4 px-6 py-6">
        <div>
          <h1 className="text-xl font-semibold">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted">
            {t("subtitle", { count: items.length })}
          </p>
        </div>
        {needsLogin ? (
          <div role="status" className="rounded-card border border-line bg-surface px-6 py-10 text-center">
            <p className="font-semibold">{t("loginTitle")}</p>
            <p className="mt-1 text-sm text-muted">{t("loginBody")}</p>
            <Link href="/vagas" className={buttonClasses("primary", "md", "mt-4 hover:no-underline hover:text-white")}>
              {t("loginCta")}
            </Link>
          </div>
        ) : items.length === 0 ? (
          <div role="status" className="empty rounded-card border border-line bg-surface px-6 py-10 text-center">
            <p className="font-semibold">{t("emptyTitle")}</p>
            <p className="mt-1 text-sm text-muted">{t("emptyBody")}</p>
            <Link href="/vagas" className={buttonClasses("primary", "md", "mt-4 hover:no-underline hover:text-white")}>
              {t("emptyCta")}
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-card border border-line bg-surface">
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
        )}
        <p className="text-xs text-muted">{t("footnote")}</p>
        {testeEmail ? <p className="text-xs text-muted">{t("testMode", { email: testeEmail })}</p> : null}
      </main>
    </div>
  );
}
