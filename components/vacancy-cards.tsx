"use client";
import * as React from "react";
import { formatFaixa, formatTempo, maskEmail, maskPhone } from "@/lib/format";
import type { VacancyRow } from "./vacancy-table";
import { buttonClasses } from "@/components/ui/button";
import { SkillChips } from "@/components/skill-chips";
// breakpoints 360/768/1024/1280 — Tailwind xs/md/lg/xl; cards <ul><li aria-label> WCAG 2.1 AA

function getSkillIds(row: VacancyRow): string[] {
  if (!Array.isArray(row.stack)) return [];
  return row.stack.map((s) => (typeof s === "string" ? s : (s as any).skillId ?? (s as any).id ?? "")).filter(Boolean);
}

export function VacancyCards({
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

  if (items.length === 0) {
    return (
      <div className="vacancy-cards empty rounded-card border border-line bg-surface p-6 text-center text-muted" role="status">
        Nenhuma vaga encontrada. Tente ajustar os filtros ou buscar por outro termo.
      </div>
    );
  }

  return (
    <ul aria-label="Lista de vagas em cards" className="vacancy-cards flex flex-col gap-3">
      {items.map((row) => {
        const skillIds = getSkillIds(row);
        const faixa = formatFaixa(row.faixaDe, row.faixaAte, row.faixaMoeda ?? "BRL");
        const tempo = formatTempo((row.updatedAt ?? row.createdAt) as any);
        const isSelected = selectedSet.has(row.id);
        const emailRaw = row.email ?? row.contato?.email ?? "";
        const telRaw = row.telefone ?? row.contato?.telefone ?? "";
        const contatoMascarado = [emailRaw ? maskEmail(emailRaw) : "", telRaw ? maskPhone(telRaw) : ""].filter(Boolean).join(" · ");
        return (
          <li
            key={row.id}
            data-vacancy-id={row.id}
            aria-label={`vaga ${row.titulo}`}
            onClick={(e) => { if ((e.target as HTMLElement).closest("button, a, input, label")) return; onToggle?.(row.id); }}
            className={`cursor-pointer vacancy-card rounded-card border p-4 ${isSelected ? "selected border-brand bg-[#F5F8FF]" : "border-line bg-surface"}`}
          >
            <div className="card-header flex items-start gap-3">
              <input
                type="checkbox"
                aria-label={`selecionar-${row.id}`}
                checked={isSelected}
                onChange={() => onToggle?.(row.id)}
                className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-brand"
              />
              <div className="min-w-0 flex-1">
                <strong className="block font-semibold leading-snug">{row.titulo}</strong>
                <span className="text-[13px] text-muted">{[row.company?.nome, row.nivel].filter(Boolean).join(" · ")}</span>
              </div>
              <button type="button" aria-label={`lupa-${row.id}`} onClick={() => onOpenDetail?.(row.id)} className={buttonClasses("secondary", "sm")}>
                Ver
              </button>
            </div>
            <dl className="card-body mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
              <dt className="text-muted">Competências</dt>
              <dd><SkillChips ids={skillIds} limit={3} /></dd>
              <dt className="text-muted">Modelo</dt>
              <dd>{[row.localidade ?? "Remoto", row.regime].filter(Boolean).join(" · ")}</dd>
              <dt className="text-muted">Faixa</dt>
              <dd>{faixa}</dd>
              <dt className="text-muted">Atualizada</dt>
              <dd>{tempo}</dd>
              {contatoMascarado ? (
                <>
                  <dt className="text-muted">Contato</dt>
                  <dd aria-label="contato mascarado" title="Contato protegido até a empresa responder">protegido</dd>
                </>
              ) : null}
            </dl>
          </li>
        );
      })}
    </ul>
  );
}

export default VacancyCards;
