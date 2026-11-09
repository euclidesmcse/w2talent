import * as React from "react";
import { cn } from "./cn";

export type ChipTone = "brand" | "neutral" | "add";

const chipTones: Record<ChipTone, string> = {
  brand: "bg-brand-soft text-brand-ink",
  neutral: "bg-neutral-soft text-ink-soft",
  add: "bg-surface text-muted border border-dashed border-[#9CA3AF]",
};

/** Etiqueta arredondada: filtros, competências, "A IA entendeu". */
export function Chip({
  tone = "brand",
  onRemove,
  removeLabel,
  children,
  className,
}: {
  tone?: ChipTone;
  onRemove?: () => void;
  /** Nome acessível do ×, já traduzido. */
  removeLabel?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium", chipTones[tone], className)}>
      {children}
      {onRemove ? (
        <button type="button" onClick={onRemove} aria-label={removeLabel ?? `Remover ${typeof children === "string" ? children : "filtro"}`} className="-mr-1 rounded-full px-1 leading-none hover:bg-black/5">
          ×
        </button>
      ) : null}
    </span>
  );
}

/** Estados da candidatura do protótipo: selecionada → revisada → aprovada → enviada. */
export type ApplicationStatus = "selecionada" | "revisada" | "aprovada" | "enviada" | "reaprovar";

const statusStyle: Record<ApplicationStatus, { cls: string; label: string }> = {
  selecionada: { cls: "bg-neutral-soft text-ink-soft", label: "Selecionada" },
  revisada: { cls: "bg-brand-soft text-brand-ink", label: "Revisada" },
  aprovada: { cls: "bg-success-soft text-success-ink", label: "Aprovada" },
  enviada: { cls: "border border-line-strong bg-surface text-ink", label: "Enviada" },
  reaprovar: { cls: "bg-warning-soft text-warning-ink", label: "Vaga mudou · reaprovar" },
};

export function StatusBadge({ status, children }: { status: ApplicationStatus; children?: React.ReactNode }) {
  const s = statusStyle[status];
  return (
    <span className={cn("inline-flex h-7 items-center gap-1.5 rounded-control px-2.5 text-[13px] font-medium", s.cls)}>
      {children ?? s.label}
    </span>
  );
}

/** Barra de match (0–100): o detalhe-assinatura do W2Talent.
 *  Sempre no mesmo formato: barra fina na cor da marca, número em mono e a palavra "match" apagada.
 *  Sem semáforo (verde/âmbar): o comprimento da barra já diz o quanto combina. */
export function MatchBar({ value, label = "match" }: { value: number; label?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <span className="inline-flex items-center gap-2 text-[13px] text-muted">
      <span className="inline-block h-1.5 w-20 overflow-hidden rounded-[3px] bg-line" aria-hidden>
        <span className="block h-1.5 bg-brand" style={{ width: `${v}%` }} />
      </span>
      <strong className="font-mono font-medium tabular-nums text-ink">{v}%</strong> {label}
    </span>
  );
}
