"use client";
import * as React from "react";
import { formatFaixa, formatTempo, maskEmail, maskPhone } from "@/lib/format";
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
    <table aria-label="Lista de candidatos" className="candidate-table w-full min-w-[760px] border-collapse text-sm">
      <thead>
        <tr className="text-left text-xs uppercase tracking-[0.04em] text-muted [&>th]:px-2 [&>th]:py-2.5 [&>th]:font-semibold [&>th:first-child]:pl-4 [&>th:last-child]:pr-4">
          <th scope="col"><span className="sr-only">Seleção</span></th>
          <th scope="col">Candidato</th>
          <th scope="col">Competências</th>
          <th scope="col">Modelo · regime</th>
          <th scope="col">Pretensão</th>
          <th scope="col">Atualizado</th>
          <th scope="col"><span className="sr-only">Ação</span></th>
        </tr>
      </thead>
      <tbody>
        {items.map((row) => {
          const skillIds = getSkillIds(row);
          const faixa = formatFaixa(row.pretensaoDe ?? row.faixaDe ?? null, row.pretensaoAte ?? row.faixaAte ?? null, row.pretensaoMoeda ?? "BRL");
          const tempo = formatTempo((row.updatedAt ?? row.createdAt) as any);
          // a busca às vezes devolve só userId (sem id)
          const rid = String(row.id ?? (row as any).userId ?? "");
          const isSelected = selectedSet.has(rid);
          const emailRaw = row.email ?? row.contato?.email ?? "";
          const telRaw = row.celular ?? row.telefone ?? row.contato?.celular ?? row.contato?.telefone ?? "";
          const contatoMascarado = [emailRaw ? maskEmail(emailRaw) : "", telRaw ? maskPhone(telRaw) : ""].filter(Boolean).join(" · ");
          const regime = Array.isArray(row.regimePreferido) ? row.regimePreferido.join(", ") : row.regimePreferido ?? "";
          return (
            <tr
              key={rid}
              data-candidate-id={rid}
              onClick={(e) => { if ((e.target as HTMLElement).closest("button, a, input, label")) return; onToggle?.(rid); }}
              className={`cursor-pointer border-t border-line-soft ${isSelected ? "selected bg-[#F5F8FF]" : "bg-surface hover:bg-canvas"}`}
            >
              <td className="py-3.5 pl-4 pr-2 align-top">
                <input type="checkbox" aria-label={`selecionar-${rid}`} checked={isSelected} onChange={() => onToggle?.(rid)} className="mt-1.5 h-5 w-5 cursor-pointer accent-brand" />
              </td>
              <td className="px-2 py-3.5 align-top">
                <div className="cand-identidade flex items-center gap-3">
                  {row.fotoUrl ? (
                    <img src={row.fotoUrl} alt={row.nome} width={32} height={32} className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-line text-xs font-semibold text-ink-soft">
                      {row.nome.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0">
                    <button type="button" onClick={() => onOpenDetail?.(rid)} className="text-left font-semibold text-ink hover:text-brand">
                      {row.nome}
                    </button>
                    <div className="text-[13px] text-muted">
                      {row.titulo}
                      {contatoMascarado ? (
                        <span aria-label="contato mascarado" title={`Contato protegido até o candidato responder: ${contatoMascarado}`}> · contato protegido</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-2 py-3.5 align-top text-ink-soft">
                <SkillChips ids={skillIds} limit={3} />
              </td>
              <td className="px-2 py-3.5 align-top text-ink-soft">{[row.localidade ?? row.modo, regime].filter(Boolean).join(" · ") || "—"}</td>
              <td className="whitespace-nowrap px-2 py-3.5 align-top text-ink-soft">{faixa}</td>
              <td className="whitespace-nowrap px-2 py-3.5 align-top text-[13px] text-muted">{tempo}</td>
              <td className="py-3 pl-2 pr-4 text-right align-top">
                <button type="button" aria-label={`lupa-${rid}`} onClick={() => onOpenDetail?.(rid)} className={buttonClasses("secondary", "sm")}>
                  Ver
                </button>
              </td>
            </tr>
          );
        })}
        {items.length === 0 ? (
          <tr>
            <td colSpan={7} className="empty px-4 py-8 text-center text-muted">
              Nenhum candidato encontrado. Tente ajustar os filtros.
            </td>
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}

export default CandidateTable;
