"use client";
import * as React from "react";
import { formatFaixa, formatTempo, skillsDisplay, maskEmail, maskPhone } from "@/lib/format";
import type { VacancyRow } from "./vacancy-table";
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
      <div className="vacancy-cards empty" role="status">
        Nenhuma vaga encontrada. Tente ajustar os filtros ou buscar por outro termo.
      </div>
    );
  }

  return (
    <ul aria-label="Lista de vagas em cards" className="vacancy-cards">
      {items.map((row) => {
        const skillIds = getSkillIds(row);
        const skillsLabel = skillIds.length ? skillsDisplay(skillIds, 3) : "—";
        const faixa = formatFaixa(row.faixaDe, row.faixaAte, row.faixaMoeda ?? "BRL");
        const tempo = formatTempo((row.updatedAt ?? row.createdAt) as any);
        const isSelected = selectedSet.has(row.id);
        const emailRaw = row.email ?? row.contato?.email ?? "";
        const telRaw = row.telefone ?? row.contato?.telefone ?? "";
        const emailMasked = emailRaw ? maskEmail(emailRaw) : "—";
        const telMasked = telRaw ? maskPhone(telRaw) : "—";
        return (
          <li
            key={row.id}
            data-vacancy-id={row.id}
            aria-label={`vaga ${row.titulo}`}
            className={`vacancy-card ${isSelected ? "selected" : ""}`}
          >
            <div className="card-header">
              <input type="checkbox" aria-label={`selecionar-${row.id}`} checked={isSelected} onChange={() => onToggle?.(row.id)} />
              <strong>{row.titulo}</strong>
              <button type="button" aria-label={`lupa-${row.id}`} onClick={() => onOpenDetail?.(row.id)}>
                🔍
              </button>
            </div>
            <div className="card-body">
              <div aria-label="skills" title={skillIds.join(", ")}>
                Skills: {skillsLabel}
              </div>
              <div>Local: {row.localidade ?? "remoto"}</div>
              <div>Regime: {row.regime ?? "—"}</div>
              <div>Faixa: {faixa}</div>
              <div>Atualização: {tempo}</div>
              <div aria-label="contato mascarado" title="Contato mascarado — LGPD">
                Contato: {emailMasked} {telMasked !== "—" ? `· ${telMasked}` : ""} 🔒
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default VacancyCards;
