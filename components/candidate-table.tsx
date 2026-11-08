"use client";
import * as React from "react";
import { formatFaixa, formatTempo, skillsDisplay, maskEmail, maskPhone } from "@/lib/format";

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

  return (
    <table aria-label="Lista de candidatos" className="candidate-table w-full text-sm">
      <thead>
        <tr>
          <th scope="col">☐</th>
          <th scope="col">Candidato</th>
          <th scope="col">Cargo</th>
          <th scope="col">Skills</th>
          <th scope="col">Local / Remoto</th>
          <th scope="col">Regime</th>
          <th scope="col">Faixa / Pretensão</th>
          <th scope="col">Atualização</th>
          <th scope="col">Contato</th>
          <th scope="col">Ação</th>
        </tr>
      </thead>
      <tbody>
        {items.map((row) => {
          const skillIds = getSkillIds(row);
          const skillsLabel = skillIds.length ? skillsDisplay(skillIds, 3) : "—";
          const faixa = formatFaixa(row.pretensaoDe ?? row.faixaDe ?? null, row.pretensaoAte ?? row.faixaAte ?? null, row.pretensaoMoeda ?? "BRL");
          const tempo = formatTempo((row.updatedAt ?? row.createdAt) as any);
          const isSelected = selectedSet.has(row.id);
          const emailRaw = row.email ?? row.contato?.email ?? "";
          const telRaw = row.celular ?? row.telefone ?? row.contato?.celular ?? row.contato?.telefone ?? "";
          const emailMasked = emailRaw ? maskEmail(emailRaw) : "—";
          const telMasked = telRaw ? maskPhone(telRaw) : "—";
          const regime = Array.isArray(row.regimePreferido) ? row.regimePreferido.join(", ") : row.regimePreferido ?? "—";
          return (
            <tr key={row.id} data-candidate-id={row.id} className={isSelected ? "selected" : ""}>
              <td>
                <input type="checkbox" aria-label={`selecionar-${row.id}`} checked={isSelected} onChange={() => onToggle?.(row.id)} />
              </td>
              <td>
                <div className="cand-identidade">
                  {row.fotoUrl ? <img src={row.fotoUrl} alt={row.nome} width={32} height={32} /> : <span aria-hidden>{row.nome.slice(0, 2).toUpperCase()}</span>}
                  <strong>{row.nome}</strong>
                </div>
              </td>
              <td>{row.titulo}</td>
              <td>
                <span aria-label="skills" title={skillIds.join(", ")}>
                  {skillsLabel}
                </span>
              </td>
              <td>{row.localidade ?? row.modo ?? "—"}</td>
              <td>{regime}</td>
              <td>{faixa}</td>
              <td>{tempo}</td>
              <td>
                <span aria-label="contato mascarado" title="Contato mascarado — LGPD">
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
            <td colSpan={10} className="empty">
              Nenhum candidato encontrado. Tente ajustar os filtros.
            </td>
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}

export default CandidateTable;
