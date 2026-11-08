import * as React from "react";
import { cn } from "@/components/ui/cn";

/**
 * Logo W2Talent (escolhido em 08/11): símbolo "onda de envio" (W de traço único,
 * gradiente azul → ciano) + nome "W2" escuro e "Talent" azul em Space Grotesk.
 * O mesmo desenho está em public/icons/icon.svg (aba e app).
 */
export function BrandMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={cn("shrink-0", className)}>
      <defs>
        <linearGradient id="w2-brand-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1F4FD8" />
          <stop offset="1" stopColor="#22D3EE" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#w2-brand-grad)" />
      <path d="M13 20 L22 44 L32 26 L42 44 L51 20" fill="none" stroke="#fff" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Nome da marca: "W2" na cor do texto e "Talent" no azul da marca. */
export function BrandWordmark({ className, suffix }: { className?: string; suffix?: string }) {
  return (
    <span className={cn("font-display font-bold tracking-[-0.02em]", className)}>
      W2<span className="text-brand">Talent</span>
      {suffix ? <span className="font-sans text-[15px] font-semibold tracking-normal text-muted"> · {suffix}</span> : null}
    </span>
  );
}
