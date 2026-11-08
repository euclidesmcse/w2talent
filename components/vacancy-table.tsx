"use client";
import * as React from "react";
import { formatFaixa, formatTempo, skillsDisplay, maskEmail, maskPhone } from "@/lib/format";
import { formatCurrencyWithLocale, formatDateByLocale } from "@/i18n";
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

  return (
    <table aria-label="Lista de vagas" className="vacancy-table w-full text-sm">
      <thead>
        <tr>
          <th scope="col"><span aria-label="seleção">☐</span></th>
          <th scope="col">Vaga</th>
          <th scope="col">Skills</th>
          <th scope="col">Local / Remoto</th>
          <th scope="col">Regime</th>
          <th scope="col">Faixa</th>
          <th scope="col">Atualização</th>
          <th scope="col">Contato</th>
          <th scope="col">Ação</th>
        </tr>
      </thead>
      <tbody>
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
            <tr key={row.id} data-vacancy-id={row.id} className={isSelected ? "selected" : ""}>
              <td>
                <input
                  type="checkbox"
                  aria-label={`selecionar-${row.id}`}
                  checked={isSelected}
                  onChange={() => onToggle?.(row.id)}
                />
              </td>
              <td>
                <div className="vacancy-identidade">
                  <strong>{row.titulo}</strong>
                  {row.company?.nome ? <span className="company"> — {row.company.nome}</span> : null}
                  {row.nivel ? <span className="nivel"> · {row.nivel}</span> : null}
                </div>
              </td>
              <td>
                <span aria-label="skills" title={skillIds.join(", ")}>
                  {skillsLabel}
                </span>
              </td>
              <td>{row.localidade ?? "remoto"}</td>
              <td>{row.regime ?? "—"}</td>
              <td>{faixa}</td>
              <td>{tempo}</td>
              <td>
                <span title="Contato mascarado — LGPD (liberado ao responder no proxy)" aria-label="contato mascarado">
                  {emailMasked} {telMasked !== "—" ? `· ${telMasked}` : ""} 🔒
                </span>
              </td>
              <td>
                <button type="button" aria-label={`lupa-${row.id}`} onClick={() => onOpenDetail?.(row.id)}>
                  🔍
                </button>
              </td>
            </tr>
          );
        })}
        {items.length === 0 ? (
          <tr>
            <td colSpan={9} className="empty">
              Nenhuma vaga encontrada. Tente ajustar os filtros ou buscar por outro termo.
            </td>
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}

export default VacancyTable;
