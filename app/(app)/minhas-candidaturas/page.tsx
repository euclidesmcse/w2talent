"use client";
import * as React from "react";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { buttonClasses } from "@/components/ui/button";

type AppRow = {
  id: string;
  vacancyId: string | null;
  proxyThreadId: string;
  status: "enviado" | "visualizado" | "respondido" | "arquivado";
  origem?: string;
  titulo?: string;
  companyId?: string;
  createdAt?: string;
};

const STATUS_LABEL: Record<string, string> = {
  enviado: "Enviada",
  visualizado: "Vista",
  respondido: "Respondida",
  arquivado: "Arquivada",
};

const STATUS_ORDER: Record<string, number> = { enviado: 0, visualizado: 1, respondido: 2, arquivado: 3 };

export default function MinhasCandidaturasPage() {
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

  const nav = [
    { href: "/vagas", label: "Vagas" },
    { href: "/candidatos", label: "Candidatos" },
    { href: "/minhas-candidaturas", label: "Minhas candidaturas", active: true },
  ];

  if (loading)
    return (
      <div className="min-h-screen">
        <AppHeader nav={nav} />
        <main className="mx-auto max-w-page px-6 py-6 text-muted">Carregando candidaturas…</main>
      </div>
    );

  return (
    <div className="min-h-screen">
      <AppHeader nav={nav} />
      <main className="minhas-candidaturas mx-auto flex max-w-page flex-col gap-4 px-6 py-6">
        <div>
          <h1 className="text-xl font-bold">Minhas candidaturas</h1>
          <p className="mt-1 text-sm text-muted">
            Acompanhe cada envio: enviada, vista pela empresa e respondida. {items.length} candidatura{items.length === 1 ? "" : "s"}.
          </p>
        </div>
        {needsLogin ? (
          <div role="status" className="rounded-card border border-line bg-surface px-6 py-10 text-center">
            <p className="font-semibold">Entre na sua conta para ver suas candidaturas.</p>
            <p className="mt-1 text-sm text-muted">O login com Google ou Microsoft chega em breve. Enquanto isso, explore as vagas.</p>
            <Link href="/vagas" className={buttonClasses("primary", "md", "mt-4 hover:no-underline hover:text-white")}>
              Ver vagas
            </Link>
          </div>
        ) : items.length === 0 ? (
          <div role="status" className="empty rounded-card border border-line bg-surface px-6 py-10 text-center">
            <p className="font-semibold">Nenhuma candidatura ainda.</p>
            <p className="mt-1 text-sm text-muted">Busque vagas, aprove as que fazem sentido e envie em lote.</p>
            <Link href="/vagas" className={buttonClasses("primary", "md", "mt-4 hover:no-underline hover:text-white")}>
              Buscar vagas
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-card border border-line bg-surface">
            <table aria-label="minhas candidaturas" className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.04em] text-muted [&>th]:px-2 [&>th]:py-2.5 [&>th]:font-semibold [&>th:first-child]:pl-4 [&>th:last-child]:pr-4">
                  <th scope="col">Vaga</th>
                  <th scope="col">Status</th>
                  <th scope="col">Andamento</th>
                </tr>
              </thead>
              <tbody>
                {items.map((app) => (
                  <tr key={app.id} data-testid={`app-${app.id}`} data-status={app.status} data-proxy={app.proxyThreadId} className="border-t border-line-soft">
                    <td className="py-3.5 pl-4 pr-2">
                      <div className="font-semibold">{app.titulo ?? app.vacancyId ?? "—"}</div>
                      <div className="font-mono text-xs text-muted" title="Endereço protegido da conversa">{app.proxyThreadId}</div>
                    </td>
                    <td className="px-2 py-3.5">
                      <span
                        aria-label={`status-${app.status}`}
                        className={`badge badge-${app.status} inline-flex h-[26px] items-center rounded-control px-2.5 text-[13px] font-medium ${
                          app.status === "respondido" ? "bg-success-soft text-success-ink" : app.status === "visualizado" ? "bg-brand-soft text-brand-ink" : "bg-neutral-soft text-ink-soft"
                        }`}
                      >
                        {STATUS_LABEL[app.status] ?? app.status}
                      </span>
                    </td>
                    <td aria-label={`progresso-${app.status}`} className="py-3.5 pl-2 pr-4">
                      <ol className="flex items-center gap-2 text-[13px]">
                        {["enviado", "visualizado", "respondido"].map((s, i) => {
                          const done = STATUS_ORDER[app.status] >= STATUS_ORDER[s];
                          return (
                            <li key={s} className="flex items-center gap-2">
                              {i > 0 ? <span aria-hidden className={`h-px w-5 ${done ? "bg-brand" : "bg-line-strong"}`} /> : null}
                              <span data-active={done ? "true" : "false"} aria-label={`etapa-${s}`} className={done ? "font-medium text-ink" : "text-muted-soft"}>
                                <span aria-hidden className={`mr-1 inline-block h-2 w-2 rounded-full ${done ? "bg-brand" : "bg-line-strong"}`} />
                                {STATUS_LABEL[s] ?? s}
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
        <p className="text-xs text-muted">Seu contato fica protegido: a empresa fala com você por um endereço do W2Talent até você responder.</p>
      </main>
    </div>
  );
}
