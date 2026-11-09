import * as React from "react";
import { cn } from "./cn";

/** Tabela densa do protótipo: cabeçalho 12px em caixa normal, linhas com borda #F0F1F3, rolagem horizontal no celular. */
export function Table({ className, minWidth = 560, ...props }: React.TableHTMLAttributes<HTMLTableElement> & { minWidth?: number }) {
  return (
    <div className="relative overflow-x-auto">
      <table className={cn("w-full border-collapse text-sm tabular-nums", className)} style={{ minWidth }} {...props} />
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead>
      <tr className="text-left text-xs text-muted">{children}</tr>
    </thead>
  );
}

export function Th({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th scope="col" className={cn("px-2 py-2.5 font-medium first:pl-4 last:pr-4", className)} {...props} />;
}

export function Tr({ className, selected, ...props }: React.HTMLAttributes<HTMLTableRowElement> & { selected?: boolean }) {
  return <tr className={cn("border-t border-line-soft", selected ? "bg-[#F5F8FF]" : "bg-surface", className)} {...props} />;
}

export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-2 py-3 align-middle first:pl-4 last:pr-4", className)} {...props} />;
}
