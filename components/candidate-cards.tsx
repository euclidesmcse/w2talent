"use client";
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatFaixa, formatTempo, maskEmail, maskPhone } from "@/lib/format";
import type { CandidateRow } from "./candidate-table";
import { buttonClasses } from "@/components/ui/button";
import { SkillChips } from "@/components/skill-chips";

function getSkillIds(row: CandidateRow): string[] {
  if (!Array.isArray(row.stack)) return [];
  return row.stack.map((s) => (typeof s === "string" ? s : (s as any).skillId ?? (s as any).id ?? "")).filter(Boolean);
}

export function CandidateCards({
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

  if (items.length === 0) {
    return (
      <div className="candidate-cards empty rounded-card border border-line bg-surface p-6 text-center text-muted" role="status">
        {t("candidatos.empty")}
      </div>
    );
  }

  return (
    <ul aria-label={t("candidatos.cardsLabel")} className="candidate-cards flex flex-col gap-3">
      {items.map((row) => {
        const skillIds = getSkillIds(row);
        const faixa = formatFaixa(row.pretensaoDe ?? row.faixaDe ?? null, row.pretensaoAte ?? row.faixaAte ?? null, row.pretensaoMoeda ?? "BRL", locale);
        const tempo = formatTempo((row.updatedAt ?? row.createdAt) as any, locale);
        // a busca às vezes devolve só userId (sem id)
          const rid = String(row.id ?? (row as any).userId ?? "");
          const isSelected = selectedSet.has(rid);
        const emailRaw = row.email ?? row.contato?.email ?? "";
        const telRaw = row.celular ?? row.telefone ?? row.contato?.celular ?? "";
        const contatoMascarado = [emailRaw ? maskEmail(emailRaw) : "", telRaw ? maskPhone(telRaw) : ""].filter(Boolean).join(" · ");
        const regime = Array.isArray(row.regimePreferido) ? row.regimePreferido.join(", ") : row.regimePreferido ?? "";
        return (
          <li
            key={rid}
            data-candidate-id={rid}
            aria-label={t("candidatos.itemLabel", { name: row.nome })}
            onClick={(e) => { if ((e.target as HTMLElement).closest("button, a, input, label")) return; onToggle?.(rid); }}
            className={`cursor-pointer candidate-card rounded-card border p-4 ${isSelected ? "selected border-brand bg-[#F5F8FF]" : "border-line bg-surface"}`}
          >
            <div className="card-header flex items-start gap-3">
              <input type="checkbox" aria-label={t("table.selectItem", { name: row.nome })}
                  data-select-id={rid} checked={isSelected} onChange={() => onToggle?.(rid)} className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-brand" />
              <div className="min-w-0 flex-1">
                <strong className="block font-semibold leading-snug">{row.nome}</strong>
                <span className="text-[13px] text-muted">{row.titulo}</span>
              </div>
              <button type="button" data-detail-id={rid} onClick={() => onOpenDetail?.(rid)} className={buttonClasses("secondary", "sm")}>
                {t("common.view")}
              </button>
            </div>
            <dl className="card-body mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
              <dt className="text-muted">{t("table.skills")}</dt>
              <dd><SkillChips ids={skillIds} limit={3} /></dd>
              <dt className="text-muted">{t("table.modeloShort")}</dt>
              <dd>{[row.localidade ?? row.modo, regime].filter(Boolean).join(" · ") || "—"}</dd>
              <dt className="text-muted">{t("candidatos.colPretensao")}</dt>
              <dd>{faixa}</dd>
              <dt className="text-muted">{t("candidatos.colAtualizado")}</dt>
              <dd>{tempo}</dd>
              {contatoMascarado ? (
                <>
                  <dt className="text-muted">{t("table.contato")}</dt>
                  <dd aria-label="contato mascarado" title={t("table.contatoProtegidoTitle")}>{t("table.protegido")}</dd>
                </>
              ) : null}
            </dl>
          </li>
        );
      })}
    </ul>
  );
}

export default CandidateCards;
