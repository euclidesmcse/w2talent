"use client";
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatFaixa, formatTempo, maskEmail, maskPhone } from "@/lib/format";
import { buttonClasses } from "@/components/ui/button";
import { SkillChips } from "@/components/skill-chips";
import { MatchCell } from "@/components/vacancy-match";
import type { MatchGap } from "@/lib/match";
// breakpoints: 360 / 768 / 1024 / 1280 — Tailwind screens xs/md/lg/xl (see tailwind.config.js)
// next-intl: colunas via messages/pt-BR.json, en.json — fallback PT-BR (i18n.ts t())
// PWA: manifest.json linked in layout.tsx
// a11y WCAG 2.1 AA: <table><th scope>, aria-label, focus, keyboard

export type VacancyRow = {
  id: string;
  titulo: string;
  stack: Array<{ skillId: string } | string>;
  localidade?: string | null;
  regime?: string | null;
  nivel?: string | null;
  faixaDe: number | null;
  faixaAte: number | null;
  faixaMoeda?: string | null;
  updatedAt?: string | Date | null;
  createdAt?: string | Date | null;
  company?: { nome?: string };
  contato?: { email?: string; telefone?: string };
  email?: string;
  telefone?: string;
  status?: string;
  /** 1.5.12: match com a busca (null quando a busca não tem critério) e o que falta. */
  match?: number | null;
  gaps?: MatchGap[];
};

function getSkillIds(row: VacancyRow): string[] {
  if (!Array.isArray(row.stack)) return [];
  return row.stack.map((s) => (typeof s === "string" ? s : (s as any).skillId ?? (s as any).id ?? "")).filter(Boolean);
}

export function VacancyTable({
  items,
  selectedIds,
  onToggle,
  onOpenDetail,
}: {
  items: VacancyRow[];
  selectedIds?: Set<string> | string[];
  onToggle?: (id: string) => void;
  onOpenDetail?: (id: string) => void;
}) {
  const selectedSet = React.useMemo(() => {
    if (!selectedIds) return new Set<string>();
    return selectedIds instanceof Set ? selectedIds : new Set(selectedIds);
  }, [selectedIds]);
  const t = useTranslations();
  const locale = useLocale();
  const showMatch = items.some((r) => r.match != null);

  return (
    <table aria-label={t("vagas.tableLabel")} className="vacancy-table w-full min-w-[760px] border-collapse text-sm tabular-nums">
      <thead>
        <tr className="text-left text-xs text-muted [&>th]:px-2 [&>th]:py-2.5 [&>th]:font-medium [&>th:first-child]:pl-4 [&>th:last-child]:pr-4">
          <th scope="col"><span className="sr-only">{t("table.selection")}</span></th>
          <th scope="col">{t("vagas.colVaga")}</th>
          <th scope="col">{t("table.skills")}</th>
          <th scope="col">{t("table.modelo")}</th>
          <th scope="col">{t("vagas.colFaixa")}</th>
          {showMatch ? <th scope="col">{t("match.column")}</th> : null}
          <th scope="col">{t("vagas.colAtualizada")}</th>
          <th scope="col"><span className="sr-only">{t("table.action")}</span></th>
        </tr>
      </thead>
      <tbody>
        {items.map((row) => {
          const skillIds = getSkillIds(row);
          const faixa = formatFaixa(row.faixaDe, row.faixaAte, row.faixaMoeda ?? "BRL", locale);
          const tempo = formatTempo((row.updatedAt ?? row.createdAt) as any, locale);
          const isSelected = selectedSet.has(row.id);
          const emailRaw = row.email ?? row.contato?.email ?? "";
          const telRaw = row.telefone ?? row.contato?.telefone ?? "";
          const contatoMascarado = [emailRaw ? maskEmail(emailRaw) : "", telRaw ? maskPhone(telRaw) : ""].filter(Boolean).join(" · ");
          const subtitulo = [row.company?.nome, row.nivel].filter(Boolean).join(" · ");
          return (
            <tr
              key={row.id}
              data-vacancy-id={row.id}
              onClick={(e) => { if ((e.target as HTMLElement).closest("button, a, input, label")) return; onToggle?.(row.id); }}
              className={`cursor-pointer border-t border-line-soft ${isSelected ? "selected bg-[#F5F8FF]" : "bg-surface hover:bg-canvas"}`}
            >
              <td className="py-3.5 pl-4 pr-2 align-top">
                <input
                  type="checkbox"
                  aria-label={t("table.selectItem", { name: row.titulo })}
                  data-select-id={row.id}
                  checked={isSelected}
                  onChange={() => onToggle?.(row.id)}
                  className="h-5 w-5 cursor-pointer accent-brand"
                />
              </td>
              <td className="px-2 py-3.5 align-top">
                <button type="button" onClick={() => onOpenDetail?.(row.id)} className="vacancy-identidade text-left font-semibold text-ink hover:text-brand">
                  {row.titulo}
                </button>
                <div className="mt-0.5 text-[13px] text-muted">
                  {subtitulo}
                  {contatoMascarado ? (
                    <span aria-label="contato mascarado" title={t("vagas.contactHint", { contact: contatoMascarado })}>
                      {subtitulo ? " · " : ""}{t("table.contatoProtegido")}
                    </span>
                  ) : null}
                </div>
              </td>
              <td className="px-2 py-3.5 align-top text-ink-soft">
                <SkillChips ids={skillIds} limit={3} />
              </td>
              <td className="px-2 py-3.5 align-top text-ink-soft">
                {[row.localidade ?? t("table.remoto"), row.regime].filter(Boolean).join(" · ")}
              </td>
              <td className="whitespace-nowrap px-2 py-3.5 align-top text-ink-soft">{faixa}</td>
              {showMatch ? (
                <td className="px-2 py-3.5 align-top">
                  <MatchCell match={row.match} gaps={row.gaps} />
                </td>
              ) : null}
              <td className="whitespace-nowrap px-2 py-3.5 align-top text-[13px] text-muted">{tempo}</td>
              <td className="py-3 pl-2 pr-4 text-right align-top">
                <button
                  type="button"
                  data-detail-id={row.id}
                  onClick={() => onOpenDetail?.(row.id)}
                  className={buttonClasses("secondary", "sm")}
                >
                  {t("common.view")}
                </button>
              </td>
            </tr>
          );
        })}
        {items.length === 0 ? (
          <tr>
            <td colSpan={showMatch ? 8 : 7} className="empty px-4 py-8 text-center text-muted">
              {t("vagas.empty")}
            </td>
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}

export default VacancyTable;
