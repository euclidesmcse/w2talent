"use client";
/**
 * B1 "O que falta para as vagas" no painel do candidato (plano B1, aprovado em 2026-11-18).
 * Mostra o que mais falta na ficha publicada para as vagas abertas mais parecidas com ela.
 * A conta é feita no servidor (GET /api/painel/lacunas), sem IA e sem guardar nada.
 */
import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { IaLink } from "@/components/ia-link";
import { buttonClasses } from "@/components/ui/button";
import type { CondicaoLacuna, LacunasVagas } from "@/lib/painel-lacunas";

type Estado = { t: "carregando" } | { t: "erro" } | { t: "pronto"; l: LacunasVagas };

function linkBusca(label: string): string {
  return `/vagas?q=${encodeURIComponent(label)}`;
}

export function PainelLacunas() {
  const t = useTranslations("painel");
  const tf = useTranslations("ficha");
  const [estado, setEstado] = React.useState<Estado>({ t: "carregando" });

  React.useEffect(() => {
    let vivo = true;
    fetch("/api/painel/lacunas")
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        return (await r.json()) as LacunasVagas;
      })
      .then((l) => { if (vivo) setEstado({ t: "pronto", l }); })
      .catch(() => { if (vivo) setEstado({ t: "erro" }); });
    return () => { vivo = false; };
  }, []);

  function condicao(c: CondicaoLacuna, total: number): string {
    if (c.kind === "nivel") {
      const want = tf(`sen_${c.want}`);
      return c.have ? t("vagasNivel", { n: c.n, total, want, have: tf(`sen_${c.have}`) }) : t("vagasNivelSem", { n: c.n, total, want });
    }
    if (c.kind === "regime") {
      return c.have.length ? t("vagasRegime", { n: c.n, total, want: c.want, have: c.have.join(", ") }) : t("vagasRegimeSem", { n: c.n, total, want: c.want });
    }
    const want = tf(`modo_${c.want}`);
    return c.have ? t("vagasModo", { n: c.n, total, want, have: tf(`modo_${c.have}`) }) : t("vagasModoSem", { n: c.n, total, want });
  }

  return (
    <section aria-labelledby="painel-vagas" className="flex flex-col gap-3 rounded-card border border-line bg-surface p-5" data-testid="painel-lacunas">
      <h2 id="painel-vagas" className="text-lg font-semibold">{t("vagasTitle")}</h2>
      <div aria-live="polite" className="flex flex-col gap-3" data-lacunas={estado.t === "pronto" ? estado.l.estado : estado.t}>
        {estado.t === "carregando" && <p className="text-sm text-muted">{t("vagasCarregando")}</p>}
        {estado.t === "erro" && <p className="text-sm text-muted">{t("vagasErro")}</p>}
        {estado.t === "pronto" && estado.l.estado === "sem_ficha" && (
          <>
            <p className="text-sm text-muted">{t("vagasSemFicha")}</p>
            <Link href="/minha-ficha" className={buttonClasses("secondary", "md", "self-start hover:no-underline")}>{t("vagasPublicar")}</Link>
          </>
        )}
        {estado.t === "pronto" && estado.l.estado === "poucas" && <p className="text-sm text-muted">{t("vagasPoucas")}</p>}
        {estado.t === "pronto" && estado.l.estado === "ok" && (() => {
          const l = estado.l;
          const total = l.vagas;
          return (
            <>
              <p className="text-sm text-muted">{t("vagasLead", { n: total })}</p>
              <div className="flex flex-col gap-1">
                <h3 className="text-[15px] font-semibold">{t("vagasFaltamTitulo")}</h3>
                {l.faltam.length ? (
                  <ul className="flex flex-col" data-testid="painel-lacunas-faltam">
                    {l.faltam.map((s) => (
                      <li key={s.skill} className="flex flex-wrap items-baseline gap-x-2 border-t border-line-soft py-2 text-sm first:border-t-0">
                        <Link href={linkBusca(s.label)} aria-label={t("vagasBuscarSkill", { skill: s.label })} className="font-medium text-brand underline underline-offset-2">
                          {s.label}
                        </Link>
                        <span className="text-muted tabular-nums">{t("vagasFalta", { n: s.n, total })}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-success-ink">{t("vagasNadaFalta")}</p>
                )}
              </div>
              {l.proximas.length > 0 && (
                <div className="flex flex-col gap-1">
                  <h3 className="text-[15px] font-semibold">{t("vagasProximasTitulo")}</h3>
                  <ul className="flex flex-col" data-testid="painel-lacunas-proximas">
                    {l.proximas.map((s) => (
                      <li key={s.skill} className="flex flex-wrap items-baseline gap-x-2 border-t border-line-soft py-2 text-sm first:border-t-0">
                        <Link href={linkBusca(s.label)} aria-label={t("vagasBuscarSkill", { skill: s.label })} className="font-medium text-brand underline underline-offset-2">
                          {s.label}
                        </Link>
                        <span className="text-muted tabular-nums">{t("vagasProxima", { tem: s.temLabel, n: s.n, total })}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {l.condicoes.length > 0 && (
                <ul className="flex flex-col gap-1 text-sm text-ink" data-testid="painel-lacunas-condicoes">
                  {l.condicoes.map((c) => <li key={c.kind}>{condicao(c, total)}</li>)}
                </ul>
              )}
            </>
          );
        })()}
      </div>
      <p className="text-xs text-muted">
        {t("vagasRodape")} <IaLink ancora="match" className="text-xs" />
      </p>
    </section>
  );
}

export default PainelLacunas;
