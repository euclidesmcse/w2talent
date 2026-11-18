"use client";
/**
 * 2.4a Painel RH (plano 2.4 aprovado pelo Euclides em 2026-11-18).
 * Números da empresa (D5) e a lista das vagas com as candidaturas que chegaram.
 * 2.4b: cada vaga leva à tela das candidaturas (/rh/vagas/[id]), com as etapas.
 */
import * as React from "react";
import Link from "next/link";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { contaRecusada, linkEntrar, useConta } from "@/lib/conta-client";
import type { MetricasRh, SituacaoVaga, VagaRh } from "@/lib/painel-rh";
import { formatMoney } from "@/lib/locale";
import type { Posicao } from "@/lib/mercado-tela";

type Estado =
  | { t: "carregando" }
  | { t: "erro" }
  | { t: "sem_empresa" }
  | { t: "ok"; empresa: string; metricas: MetricasRh; vagas: VagaRh[] };

const TOM: Record<SituacaoVaga, string> = {
  ativa: "bg-success-soft text-success-ink",
  vencendo: "bg-warning-soft text-warning-ink",
  vencida: "bg-neutral-soft text-ink-soft",
  arquivada: "bg-neutral-soft text-ink-soft",
};

/** 3.2b: vaga abaixo do mercado tende a atrair menos gente; acima não é problema. */
const TOM_MERCADO: Record<Posicao, string> = {
  abaixo: "bg-warning-soft text-warning-ink",
  dentro: "bg-success-soft text-success-ink",
  acima: "bg-brand-soft text-brand-ink",
};

export default function PainelRhPage() {
  const t = useTranslations("rh");
  const tr = useTranslations();
  const locale = useLocale();
  const fmt = useFormatter();
  const conta = useConta();
  const liberado = conta.estado === "ok" && conta.conta?.perfil === "recrutador";
  const [estado, setEstado] = React.useState<Estado>({ t: "carregando" });

  const carregar = React.useCallback(async () => {
    setEstado({ t: "carregando" });
    try {
      const r = await fetch("/api/rh", { cache: "no-store" });
      if (r.status === 401 || r.status === 403) {
        contaRecusada();
        return;
      }
      if (!r.ok) throw new Error(String(r.status));
      const j = (await r.json()) as { estado: "ok" | "sem_empresa"; empresa?: { nome: string }; metricas?: MetricasRh; vagas?: VagaRh[] };
      if (j.estado === "sem_empresa") setEstado({ t: "sem_empresa" });
      else setEstado({ t: "ok", empresa: j.empresa?.nome ?? "", metricas: j.metricas!, vagas: j.vagas ?? [] });
    } catch {
      setEstado({ t: "erro" });
    }
  }, []);

  React.useEffect(() => {
    if (liberado) void carregar();
  }, [liberado, carregar]);

  if (!liberado) {
    return (
      <div>
        <AppHeader area="recrutador" active="/rh" />
        <main className="mx-auto max-w-page px-4 py-6 md:px-6">
          <h1 className="text-xl font-semibold">{t("title")}</h1>
          {conta.estado === "carregando" ? (
            <p aria-busy="true" className="mt-4 text-sm text-muted">{tr("common.loading")}</p>
          ) : (
            <div role="status" className="mt-4 rounded-card border border-line bg-surface px-6 py-10 text-center" data-testid="so-recrutador">
              <p className="font-semibold">{t("gateTitle")}</p>
              <p className="mt-1 text-sm text-muted">{conta.estado === "ok" ? t("gateCandidate") : t("gateBody")}</p>
              {conta.estado !== "ok" ? (
                <a href={linkEntrar("/rh")} className={buttonClasses("primary", "md", "mt-4 hover:no-underline hover:text-white")}>{tr("conta.signIn")}</a>
              ) : null}
            </div>
          )}
        </main>
      </div>
    );
  }

  const tempo = (h: number | null) =>
    h == null ? t("semDado") : h < 48 ? t("horas", { n: fmt.number(Math.max(h, 0.1), { maximumFractionDigits: 1 }) }) : t("dias", { n: fmt.number(Math.round(h / 24)) });

  const numeros: [string, string][] =
    estado.t === "ok"
      ? [
          ["vagasAtivas", String(estado.metricas.vagasAtivas)],
          ["vencendo", String(estado.metricas.vencendo)],
          ["candidaturas", String(estado.metricas.candidaturas)],
          ["novas", String(estado.metricas.novas)],
          ["tempoMedio", tempo(estado.metricas.tempoMedioHoras)],
          ["taxaResposta", estado.metricas.taxaResposta == null ? t("semDado") : t("pct", { n: estado.metricas.taxaResposta })],
        ]
      : [];

  const situacao = (v: VagaRh) =>
    v.situacao === "vencendo" ? t("situacao_vencendo", { data: fmt.dateTime(new Date(v.expiresAt), { day: "numeric", month: "short" }) }) : t(`situacao_${v.situacao}`);

  return (
    <div className="min-h-screen">
      <AppHeader area="recrutador" active="/rh" />
      <main>
        <section className="voltagem">
          <div className="mx-auto flex max-w-page flex-col gap-1 px-4 py-8 md:px-6 md:py-10">
            <h1 className="text-[28px] font-semibold leading-tight md:text-[32px]">{t("title")}</h1>
            <p className="voltagem-apoio min-h-[1.5em] text-[15px]" aria-live="polite">
              {estado.t === "ok" ? t("lead", { empresa: estado.empresa }) : estado.t === "carregando" ? tr("common.loading") : ""}
            </p>
          </div>
        </section>

        <div className="mx-auto flex max-w-page flex-col gap-4 px-4 py-6 md:px-6">
          {estado.t === "erro" ? (
            <div role="alert" className="rounded-card border border-line bg-surface px-6 py-8 text-center">
              <p className="text-sm">{t("erro")}</p>
              <Button variant="secondary" size="md" className="mt-3" onClick={() => void carregar()}>{t("tentar")}</Button>
            </div>
          ) : estado.t === "sem_empresa" ? (
            <div role="status" className="rounded-card border border-line bg-surface px-6 py-10 text-center" data-testid="rh-sem-empresa">
              <p className="font-semibold">{t("semEmpresaTitle")}</p>
              <p className="mt-1 text-sm text-muted">{t("semEmpresaBody")}</p>
              <Link href="/empresa" className={buttonClasses("primary", "md", "mt-4 hover:no-underline hover:text-white")}>{t("irEmpresa")}</Link>
            </div>
          ) : estado.t === "ok" ? (
            <>
              <section aria-labelledby="rh-numeros" className="rounded-card border border-line bg-surface p-5">
                <h2 id="rh-numeros" className="text-lg font-semibold">{t("numerosTitle")}</h2>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-4 md:grid-cols-3 lg:grid-cols-6" data-testid="rh-numeros">
                  {numeros.map(([k, v]) => (
                    <div key={k} className="flex flex-col gap-1">
                      <dt className="text-[13px] text-muted">{t(k)}</dt>
                      <dd className="font-display text-[24px] font-semibold leading-none tabular-nums" data-numero={k}>{v}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              <section aria-labelledby="rh-vagas" className="rounded-card border border-line bg-surface p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 id="rh-vagas" className="text-lg font-semibold">{t("vagasTitle")}</h2>
                  <Link href="/publicar" className={buttonClasses("secondary", "md", "hover:no-underline")}>{t("publicar")}</Link>
                </div>
                {estado.vagas.length === 0 ? (
                  <div className="mt-4 text-center" data-testid="rh-sem-vagas">
                    <p className="font-semibold">{t("vagasVazioTitle")}</p>
                    <p className="mt-1 text-sm text-muted">{t("vagasVazioBody")}</p>
                  </div>
                ) : (
                  <ul className="mt-3 flex flex-col" data-testid="rh-vagas">
                    {estado.vagas.map((v) => (
                      <li key={v.id} data-vaga={v.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line-soft py-3 first:border-t-0">
                        <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-1">
                          <Link href={`/rh/vagas/${encodeURIComponent(v.id)}`} className="font-medium text-ink underline-offset-2 hover:underline">{v.titulo}</Link>
                          <span className="flex flex-wrap gap-1.5">
                            <span className={cn("inline-flex h-6 w-fit items-center rounded-control px-2 text-[12px] font-medium", TOM[v.situacao])}>{situacao(v)}</span>
                            {v.mercado ? (
                              <span
                                className={cn("inline-flex h-6 w-fit items-center rounded-control px-2 text-[12px] font-medium", TOM_MERCADO[v.mercado.posicao])}
                                title={t("mercadoDetalhe", { de: formatMoney(v.mercado.faixa.de, locale, v.mercado.moeda), ate: formatMoney(v.mercado.faixa.ate, locale, v.mercado.moeda) })}
                                data-mercado={v.mercado.posicao}
                              >
                                {t(`mercado_${v.mercado.posicao}`)}
                                <span className="sr-only"> · {t("mercadoDetalhe", { de: formatMoney(v.mercado.faixa.de, locale, v.mercado.moeda), ate: formatMoney(v.mercado.faixa.ate, locale, v.mercado.moeda) })}</span>
                              </span>
                            ) : null}
                          </span>
                        </div>
                        <dl className="flex gap-5 text-sm">
                          <div className="flex flex-col">
                            <dt className="text-[12px] text-muted">{t("colCandidaturas")}</dt>
                            <dd className="font-semibold tabular-nums">{v.total}</dd>
                          </div>
                          <div className="flex flex-col">
                            <dt className="text-[12px] text-muted">{t("colNovas")}</dt>
                            <dd className={cn("font-semibold tabular-nums", v.novas > 0 && "text-brand-ink")}>{v.novas}</dd>
                          </div>
                        </dl>
                        <Link
                          href={`/rh/vagas/${encodeURIComponent(v.id)}`}
                          aria-label={t("verCandidaturasLabel", { vaga: v.titulo })}
                          className={buttonClasses("secondary", "md", "hover:no-underline")}
                          data-action="ver-candidaturas"
                        >
                          {t("verCandidaturas")}
                        </Link>
                        {v.situacao === "ativa" || v.situacao === "vencendo" ? (
                          <Link
                            href={`/candidatos?vaga=${encodeURIComponent(v.id)}`}
                            aria-label={t("compativeisLabel", { vaga: v.titulo })}
                            className="text-[13px] font-medium text-brand underline underline-offset-2"
                          >
                            {t("compativeis")}
                          </Link>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}
