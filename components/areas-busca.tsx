"use client";
/**
 * Áreas em pílulas, abaixo da busca de vagas (ideia do portal emagine, aprovada em 2026-11-12).
 * Clicar numa área abre as competências mais pedidas dela; marcar uma escreve na busca
 * (vira chip na caixa) e desmarcar tira o chip. Uma área aberta por vez.
 */
import * as React from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/components/ui/cn";
import { getSkill } from "@/lib/taxonomy";
import { AREAS, skillsDaAreaNaBusca, type AreaId } from "@/lib/areas";

export function AreasDeBusca({
  skillsNaBusca,
  onAdicionar,
  onTirar,
  disabled,
}: {
  /** Competências que a busca atual já tem (ids da taxonomia). */
  skillsNaBusca: string[];
  onAdicionar: (skillId: string) => void;
  onTirar: (skillId: string) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("areas");
  const [aberta, setAberta] = React.useState<AreaId | null>(null);
  const area = AREAS.find((a) => a.id === aberta) ?? null;

  return (
    <div className="flex flex-col gap-3" data-testid="areas-busca">
      <div role="group" aria-label={t("title")} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
        {AREAS.map((a) => {
          const n = skillsDaAreaNaBusca(a, skillsNaBusca);
          const on = aberta === a.id;
          return (
            <button
              key={a.id}
              type="button"
              aria-expanded={on}
              aria-controls="area-competencias"
              data-area={a.id}
              onClick={() => setAberta(on ? null : a.id)}
              className={cn(
                "inline-flex h-11 shrink-0 items-center md:h-9 gap-2 whitespace-nowrap rounded-pill border px-3.5 text-[13px] font-medium",
                on ? "border-ink bg-ink text-white" : n ? "border-brand bg-brand-soft text-brand-ink" : "border-line-strong bg-surface text-ink hover:border-brand",
              )}
            >
              <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: a.cor }} />
              {t(a.id)}
              {n ? <span className="tabular-nums">({n})</span> : null}
            </button>
          );
        })}
      </div>
      {area ? (
        <div id="area-competencias" className="flex flex-col gap-2 rounded-card border border-line bg-surface p-4" data-testid="area-competencias">
          <p className="text-[13px] text-muted">{t("escolha", { area: t(area.id) })}</p>
          <div className="flex flex-wrap gap-2">
            {area.skills.map((id) => {
              const marcada = skillsNaBusca.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={marcada}
                  disabled={disabled}
                  data-skill={id}
                  onClick={() => (marcada ? onTirar(id) : onAdicionar(id))}
                  className={cn(
                    "inline-flex h-11 items-center rounded-pill md:h-9 border px-3.5 text-[13px] font-medium disabled:cursor-not-allowed disabled:opacity-50",
                    marcada ? "border-brand bg-brand text-white" : "border-line-strong bg-surface text-ink hover:border-brand",
                  )}
                >
                  {getSkill(id)?.label ?? id}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
