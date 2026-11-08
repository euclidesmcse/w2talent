"use client";
import * as React from "react";
import { formatFaixa, formatTempo, skillsDisplay, maskEmail, maskPhone } from "@/lib/format";
import type { CandidateRow } from "./candidate-table";

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

  if (items.length === 0) {
    return (
      <div className="candidate-cards empty" role="status">
        Nenhum candidato encontrado. Tente ajustar os filtros.
      </div>
    );
  }

  return (
    <ul aria-label="Lista de candidatos em cards" className="candidate-cards">
      {items.map((row) => {
        const skillIds = getSkillIds(row);
        const skillsLabel = skillIds.length ? skillsDisplay(skillIds, 3) : "—";
        const faixa = formatFaixa(row.pretensaoDe ?? row.faixaDe ?? null, row.pretensaoAte ?? row.faixaAte ?? null, row.pretensaoMoeda ?? "BRL");
        const tempo = formatTempo((row.updatedAt ?? row.createdAt) as any);
        const isSelected = selectedSet.has(row.id);
        const emailRaw = row.email ?? row.contato?.email ?? "";
        const telRaw = row.celular ?? row.telefone ?? row.contato?.celular ?? "";
        const emailMasked = emailRaw ? maskEmail(emailRaw) : "—";
        const telMasked = telRaw ? maskPhone(telRaw) : "—";
        const regime = Array.isArray(row.regimePreferido) ? row.regimePreferido.join(", ") : row.regimePreferido ?? "—";
        return (
          <li key={row.id} data-candidate-id={row.id} aria-label={`candidato ${row.nome}`} className={`candidate-card ${isSelected ? "selected" : ""}`}>
            <div className="card-header">
              <input type="checkbox" aria-label={`selecionar-${row.id}`} checked={isSelected} onChange={() => onToggle?.(row.id)} />
              <strong>{row.nome}</strong> — {row.titulo}
              <button type="button" aria-label={`lupa-${row.id}`} onClick={() => onOpenDetail?.(row.id)}>
                🔍
              </button>
            </div>
            <div className="card-body">
              <div aria-label="skills" title={skillIds.join(", ")}>
                Skills: {skillsLabel}
              </div>
              <div>Local: {row.localidade ?? row.modo ?? "—"}</div>
              <div>Regime: {regime}</div>
              <div>Faixa: {faixa}</div>
              <div>Atualização: {tempo}</div>
              <div aria-label="contato mascarado">Contato: {emailMasked} {telMasked !== "—" ? `· ${telMasked}` : ""} 🔒</div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default CandidateCards;
