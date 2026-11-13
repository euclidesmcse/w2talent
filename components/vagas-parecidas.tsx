"use client";
/**
 * Dentro do detalhe da vaga (ideia do portal emagine, aprovada em 2026-11-12):
 * aviso de vaga já enviada e até 5 vagas parecidas (GET /api/vacancies/[id]/parecidas).
 */
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatFaixa } from "@/lib/format";
import { diaMes } from "@/lib/envio-client";
import type { VagaResumo } from "@/lib/parecidas";

export function AvisoEnviada({ em }: { em?: string }) {
  const t = useTranslations("vagas");
  const locale = useLocale();
  if (!em) return null;
  return (
    <p role="status" data-testid="aviso-enviada" className="flex items-center gap-2 rounded-card border border-success/30 bg-success-soft px-3.5 py-2.5 text-[13px] font-medium text-success-ink">
      <span aria-hidden>✓</span>
      {t("jaEnviada", { date: diaMes(em, locale) })}
    </p>
  );
}

export function VagasParecidas({ id, sentAt, onAbrir }: { id: string; sentAt?: Record<string, string>; onAbrir: (v: VagaResumo) => void }) {
  const t = useTranslations("vagas");
  const locale = useLocale();
  const [itens, setItens] = React.useState<VagaResumo[] | null>(null);

  React.useEffect(() => {
    let vivo = true;
    setItens(null);
    fetch(`/api/vacancies/${encodeURIComponent(id)}/parecidas`)
      .then((r) => (r.ok ? (r.json() as Promise<{ items?: VagaResumo[] }>) : { items: [] }))
      .then((j) => { if (vivo) setItens(j.items ?? []); })
      .catch(() => { if (vivo) setItens([]); });
    return () => { vivo = false; };
  }, [id]);

  if (!itens?.length) return null;
  return (
    <section aria-labelledby="parecidas-titulo" className="flex flex-col gap-2 border-t border-line-soft pt-4" data-testid="vagas-parecidas">
      <h3 id="parecidas-titulo" className="text-[13px] font-medium text-ink">{t("parecidas")}</h3>
      <ul className="flex flex-col gap-2">
        {itens.map((v) => {
          const linha = [v.nivel, [v.localidade, v.regime].filter(Boolean).join(" · "), formatFaixa(v.faixaDe, v.faixaAte, v.faixaMoeda ?? "BRL", locale)]
            .filter((x) => x && x !== "—")
            .join(" · ");
          const enviada = sentAt?.[v.id];
          return (
            <li key={v.id}>
              <button
                type="button"
                data-parecida={v.id}
                onClick={(e) => {
                  // A lista some enquanto busca as parecidas da nova vaga: leva o foco e a rolagem ao topo
                  // do detalhe (o próprio diálogo), para a nova vaga aparecer e o foco não sair do diálogo.
                  const dialogo = e.currentTarget.closest<HTMLElement>('[role="dialog"]');
                  dialogo?.focus({ preventScroll: true });
                  onAbrir(v);
                  requestAnimationFrame(() => dialogo?.scrollTo({ top: 0 }));
                }}
                className="flex w-full flex-col gap-0.5 rounded-card border border-line bg-surface px-3.5 py-2.5 text-left hover:border-brand"
              >
                <span className="font-semibold text-ink">{v.titulo}</span>
                <span className="text-[13px] text-muted">{linha}</span>
                {enviada ? <span className="text-xs font-medium text-success-ink">{t("sentOn", { date: diaMes(enviada, locale) })}</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
