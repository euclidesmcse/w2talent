import * as React from "react";
import { cn } from "./cn";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("relevo-cartao rounded-card border border-line bg-surface", className)} {...props} />;
}

export function CardHeader({ title, action, className }: { title: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 border-b border-line-soft px-4 py-3.5", className)}>
      <strong className="text-[15px] font-semibold">{title}</strong>
      <span className="flex-1" />
      {action}
    </div>
  );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}

/** Número grande com legenda (cartões de métrica do painel). */
export function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="text-[13px] text-muted">{label}</div>
      <div className="mt-1 text-[28px] font-semibold leading-tight tabular-nums">{value}</div>
    </Card>
  );
}
