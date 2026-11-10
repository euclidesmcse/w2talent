import * as React from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "inverse" | "inverseOutline";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-pill font-sans whitespace-nowrap " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white font-semibold relevo-primario focus-visible:outline-brand",
  secondary: "bg-surface text-ink font-medium border border-line-strong relevo-secundario focus-visible:outline-brand",
  ghost: "bg-transparent text-brand font-medium hover:bg-brand-soft focus-visible:outline-brand",
  danger: "bg-danger text-white font-semibold hover:opacity-90 focus-visible:outline-brand",
  // Sobre o bloco azul do herói (visual "voltagem azul", 2026-11-10)
  inverse: "bg-surface text-brand-ink font-semibold border border-white relevo-secundario focus-visible:outline-white",
  inverseOutline: "bg-transparent text-white font-medium border border-white/70 hover:bg-white/10 focus-visible:outline-white",
};

// Alturas: 32 (compacto), 40 (padrão; 44 no celular, alvo de toque — 1.5.14), 48 (ação principal, pílula com 24 px de lado).
const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3.5 text-[13px]",
  md: "h-11 px-5 text-sm md:h-10",
  lg: "h-12 px-6 text-[15px]",
};

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra?: string): string {
  return cn(base, variants[variant], sizes[size], extra);
}

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className, type = "button", ...props },
  ref
) {
  return <button ref={ref} type={type} className={buttonClasses(variant, size, className)} {...props} />;
});
