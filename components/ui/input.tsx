import * as React from "react";
import { cn } from "./cn";

export const fieldClasses =
  "h-10 w-full rounded-control border border-line-strong bg-surface px-3 text-[15px] text-ink placeholder:text-muted-soft " +
  "focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-canvas aria-[invalid=true]:border-danger";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref
) {
  return <input ref={ref} className={cn(fieldClasses, className)} {...props} />;
});

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, ...props },
  ref
) {
  return <select ref={ref} className={cn(fieldClasses, "px-2.5", className)} {...props} />;
});

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(fieldClasses, "h-auto py-2.5 leading-normal", className)} {...props} />;
  }
);

/** Rótulo + campo + ajuda/erro, no padrão do protótipo (rótulo 13/500 acima do campo). */
export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5 text-[13px] font-medium text-ink", className)}>
      {label}
      {children}
      {error ? (
        <span role="alert" className="font-normal text-danger">
          {error}
        </span>
      ) : hint ? (
        <span className="font-normal text-muted">{hint}</span>
      ) : null}
    </label>
  );
}
