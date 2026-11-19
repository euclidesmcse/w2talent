"use client";
import * as React from "react";
import { Input } from "@/components/ui";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  hint?: string;
  error?: string;
  /** Textos do botão (vêm da tela, já traduzidos). */
  mostrar: string;
  esconder: string;
};

/**
 * Campo de senha com Mostrar/Esconder. O botão fica fora do <label> para o nome do campo
 * ser só o rótulo (leitores de tela).
 */
export const CampoSenha = React.forwardRef<HTMLInputElement, Props>(function CampoSenha(
  { label, hint, error, mostrar, esconder, id, ...props },
  ref,
) {
  const auto = React.useId();
  const campo = id ?? `senha-${auto}`;
  const nota = `${campo}-nota`;
  const [visivel, setVisivel] = React.useState(false);
  return (
    <div className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
      <label htmlFor={campo}>{label}</label>
      <div className="relative">
        <Input
          ref={ref}
          id={campo}
          type={visivel ? "text" : "password"}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? nota : undefined}
          className="pr-24"
          {...props}
        />
        <button
          type="button"
          aria-controls={campo}
          onClick={() => setVisivel((v) => !v)}
          className="absolute inset-y-0 right-0 rounded-control px-3 text-[13px] font-medium text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
        >
          {visivel ? esconder : mostrar}
        </button>
      </div>
      {error ? (
        <span id={nota} role="alert" className="font-normal text-danger">{error}</span>
      ) : hint ? (
        <span id={nota} className="font-normal text-muted">{hint}</span>
      ) : null}
    </div>
  );
});
