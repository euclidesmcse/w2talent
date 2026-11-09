"use client";
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatFaixa, formatTempo, initials, maskEmail, maskPhone } from "@/lib/format";
import { buttonClasses } from "@/components/ui/button";
import { SkillChips } from "@/components/skill-chips";

export type CandidateRow = {
  id: string;
  nome: string;
  fotoUrl?: string | null;
  titulo: string;
  stack: Array<{ skillId: string } | string>;
  localidade?: string | null;
  modo?: string | null;
  regimePreferido?: string[] | string | null;
  pretensaoDe?: number | null;
  pretensaoAte?: number | null;
  pretensaoMoeda?: string | null;
  faixaDe?: number | null;
  faixaAte?: number | null;
  updatedAt?: string | Date | null;
  createdAt?: string | Date | null;
  contato?: { email?: string; telefone?: string; celular?: string };
  email?: string;
  /** Da API de busca: contatos já mascarados (o completo não sai na busca). */
  emailMasked?: string;
  celularMasked?: string;
  celular?: string;
  telefone?: string;
  status?: string;
};

function getSkillIds(row: CandidateRow): string[] {
  if (!Array.isArray(row.stack)) return [];
  return row.stack.map((s) => (typeof s === "string" ? s : (s as any).skillId ?? (s as any).id ?? "")).filter(Boolean);
}

export function CandidateTable({
  items,
  selectedIds,
  onToggle,
  onOpenDetail,
}: {
  items: CandidateRow[];
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
  // Coluna "Pretensão" só aparece quando alguma linha tem valor.
  const showPretensao = items.some((r: any) => r.pretensaoDe != null || r.pretensaoAte != null || r.faixaDe != null || r.faixaAte != null);

  return (
    <table aria-label={t("candidatos.tableLabel")} className="candidate-table w-full min-w-[760px] border-collapse text-sm tabular-nums">
      <thead>
        <tr className="text-left text-xs text-muted [&>th]:px-2 [&>th]:py-2.5 [&>th]:font-medium [&>th:first-child]:pl-4 [&>th:last-child]:pr-4">
          <th scope="col"><span className="sr-only">{t("table.selection")}</span></th>
          <th scope="col">{t("candidatos.colCandidato")}</th>
          <th scope="col">{t("table.skills")}</th>
          <th scope="col">{t("table.modelo")}</th>
          {showPretensao ? <th scope="col">{t("candidatos.colPretensao")}</th> : null}
          <th scope="col">{t("candidatos.colAtualizado")}</th>
          <th scope="col"><span className="sr-only">{t("table.action")}</span></th>
        </tr>
      </thead>
      <tbody>
        {items.map((row) => {
          const skillIds = getSkillIds(row);
          const faixa = formatFaixa(row.pretensaoDe ?? row.faixaDe ?? null, row.pretensaoAte ?? row.faixaAte ?? null, row.pretensaoMoeda ?? "BRL", locale);
          const tempo = formatTempo((row.updatedAt ?? row.createdAt) as any, locale);
          // a busca às vezes devolve só userId (sem id)
          const rid = String(row.id ?? (row as any).userId ?? "");
          const isSelected = selectedSet.has(rid);
          const emailRaw = row.email ?? row.contato?.email ?? "";
          const telRaw = row.celular ?? row.telefone ?? row.contato?.celular ?? row.contato?.telefone ?? "";
          const contatoMascarado = [row.emailMasked ?? (emailRaw ? maskEmail(emailRaw) : ""), row.celularMasked ?? (telRaw ? maskPhone(telRaw) : "")].filter(Boolean).join(" · ");
          const regime = Array.isArray(row.regimePreferido) ? row.regimePreferido.join(", ") : row.regimePreferido ?? "";
          return (
            <tr
              key={rid}
              data-candidate-id={rid}
              onClick={(e) => { if ((e.target as HTMLElement).closest("button, a, input, label")) return; onToggle?.(rid); }}
              className={`cursor-pointer border-t border-line-soft ${isSelected ? "selected bg-[#F5F8FF]" : "bg-surface hover:bg-canvas"}`}
            >
              <td className="py-3.5 pl-4 pr-2 align-top">
                <input type="checkbox" aria-label={t("table.selectItem", { name: row.nome })}
                  data-select-id={rid} checked={isSelected} onChange={() => onToggle?.(rid)} className="mt-1.5 h-5 w-5 cursor-pointer accent-brand" />
              </td>
              <td className="px-2 py-3.5 align-top">
                <div className="cand-identidade flex items-center gap-3">
                  {row.fotoUrl ? (
                    <img src={row.fotoUrl} alt={row.nome} width={32} height={32} className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-line text-xs font-semibold text-ink-soft">
                      {initials(row.nome)}
                    </span>
                  )}
                  <div className="min-w-0">
                    <button type="button" onClick={() => onOpenDetail?.(rid)} className="text-left font-semibold text-ink hover:text-brand">
                      {row.nome}
                    </button>
                    <div className="text-[13px] text-muted">
                      {row.titulo}
                      {contatoMascarado ? (
                        <span aria-label="contato mascarado" title={t("candidatos.contactHint", { contact: contatoMascarado })}> · {t("table.contatoProtegido")}</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-2 py-3.5 align-top text-ink-soft">
                <SkillChips ids={skillIds} limit={3} />
              </td>
              <td className="px-2 py-3.5 align-top text-ink-soft">{[row.localidade ?? row.modo, regime].filter(Boolean).join(" · ") || "—"}</td>
              {showPretensao ? <td className="whitespace-nowrap px-2 py-3.5 align-top text-ink-soft">{faixa}</td> : null}
              <td className="whitespace-nowrap px-2 py-3.5 align-top text-[13px] text-muted">{tempo}</td>
              <td className="py-3 pl-2 pr-4 text-right align-top">
                <button type="button" data-detail-id={rid} onClick={() => onOpenDetail?.(rid)} className={buttonClasses("secondary", "sm")}>
                  {t("common.view")}
                </button>
              </td>
            </tr>
          );
        })}
        {items.length === 0 ? (
          <tr>
            <td colSpan={showPretensao ? 7 : 6} className="empty px-4 py-8 text-center text-muted">
              {t("candidatos.empty")}
            </td>
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}

export default CandidateTable;
