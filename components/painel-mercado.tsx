"use client";
/**
 * 3.2b "Sua pretensão e o mercado" no painel do candidato (plano 3.2, D5).
 * A conta é feita no servidor (GET /api/painel/mercado) com os números já calculados do Mercado de TI,
 * sem IA e sem guardar nada. Grupo abaixo do mínimo mostra "Ainda poucos dados" e o link para /mercado.
 */
import * as React from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/components/ui/cn";
import { nomeRegime } from "@/lib/format";
import { formatMoney } from "@/lib/locale";
import type { PainelMercado as Dados, Posicao } from "@/lib/mercado-tela";

type Estado = { t: "carregando" } | { t: "erro" } | { t: "pronto"; d: Dados };

/** Pretensão não é "certa" nem "errada": fora da faixa fica neutro, dentro fica verde. */
const TOM: Record<Posicao, string> = {
  abaixo: "bg-neutral-soft text-ink-soft",
  dentro: "bg-success-soft text-success-ink",
  acima: "bg-neutral-soft text-ink-soft",
};

export function PainelMercado() {
  const t = useTranslations("painel");
  const tf = useTranslations("ficha");
  const locale = useLocale();
  const [estado, setEstado] = React.useState<Estado>({ t: "carregando" });

  React.useEffect(() => {
    let vivo = true;
    fetch("/api/painel/mercado")
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        return (await r.json()) as Dados;
      })
      .then((d) => { if (vivo) setEstado({ t: "pronto", d }); })
      .catch(() => { if (vivo) setEstado({ t: "erro" }); });
    return () => { vivo = false; };
  }, []);

  const dinheiro = (v: number, moeda: string) => formatMoney(v, locale, moeda);
  const linkMercado = (skillId?: string) => (
    <Link href={skillId ? `/mercado?skill=${encodeURIComponent(skillId)}` : "/mercado"} className="self-start text-[13px] font-medium text-brand underline underline-offset-2">
      {t("mercadoVer")}
    </Link>
  );

  return (
    <section aria-labelledby="painel-mercado" className="flex flex-col gap-3 rounded-card border border-line bg-surface p-5" data-testid="painel-mercado">
      <h2 id="painel-mercado" className="text-lg font-semibold">{t("mercadoTitulo")}</h2>
      <div aria-live="polite" className="flex flex-col gap-4" data-mercado={estado.t === "pronto" ? (estado.d.estado === "ok" ? (estado.d.principal ? "ok" : "poucos") : estado.d.estado) : estado.t}>
        {estado.t === "carregando" && <p className="text-sm text-muted">{t("mercadoCarregando")}</p>}
        {estado.t === "erro" && <p className="text-sm text-muted">{t("mercadoErro")}</p>}
        {estado.t === "pronto" && estado.d.estado === "sem_ficha" && <p className="text-sm text-muted">{t("mercadoSemFicha")}</p>}
        {estado.t === "pronto" && estado.d.estado === "ok" && (() => {
          const d = estado.d;
          return (
            <>
              {d.principal ? (
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-muted">{t("mercadoLead", { skill: d.principal.label, nivel: tf(`sen_${d.principal.nivel}`) })}</p>
                  <ul className="flex flex-col" data-testid="painel-mercado-comparacoes">
                    {d.principal.comparacoes.map((c) => (
                      <li key={`${c.regime}|${c.moeda}`} data-regime={c.regime} data-posicao={c.posicao} className="flex flex-col gap-1.5 border-t border-line-soft py-2.5 text-sm first:border-t-0">
                        <span>
                          {t("mercadoPagam", {
                            regime: c.moeda !== "BRL" ? `${nomeRegime(c.regime, locale)} (${c.moeda})` : nomeRegime(c.regime, locale),
                            de: dinheiro(c.faixa.de, c.moeda),
                            ate: dinheiro(c.faixa.ate, c.moeda),
                            mediana: dinheiro(c.faixa.mediana, c.moeda),
                          })}
                        </span>
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="tabular-nums text-ink-soft">{t("mercadoSua", { valor: dinheiro(c.valor, c.moeda) })}</span>
                          <span className={cn("inline-flex h-6 items-center rounded-control px-2 text-[12px] font-medium", TOM[c.posicao])}>{t(`mercadoPos_${c.posicao}`)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  {linkMercado(d.principal.skillId)}
                </div>
              ) : (
                <div className="flex flex-col gap-1.5" data-testid="painel-mercado-poucos">
                  <p className="text-sm">
                    <span className="font-medium text-ink-soft">{t("mercadoPoucos")}</span>
                    {d.semPretensao ? <span className="text-muted"> · {t("mercadoSemPretensao")}</span> : null}
                  </p>
                  {linkMercado()}
                </div>
              )}

              <div className="flex flex-col gap-1">
                <h3 className="text-[15px] font-semibold">{t("mercadoAltaTitulo")}</h3>
                {d.emAlta.length ? (
                  <ul className="flex flex-col" data-testid="painel-mercado-alta">
                    {d.emAlta.map((s) => (
                      <li key={s.skillId} data-skill={s.skillId} className="flex flex-wrap items-baseline gap-x-2 border-t border-line-soft py-2 text-sm first:border-t-0">
                        <Link href={`/mercado?skill=${encodeURIComponent(s.skillId)}`} aria-label={t("mercadoVerSkill", { skill: s.label })} className="font-medium text-brand underline underline-offset-2">
                          {s.label}
                        </Link>
                        {s.tem ? <span className="text-success-ink" data-tem="">{t("mercadoTem")}</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted">{t("mercadoAltaVazio")}</p>
                )}
              </div>
            </>
          );
        })()}
      </div>
      <p className="text-xs text-muted">{t("mercadoRodape")}</p>
    </section>
  );
}

export default PainelMercado;
