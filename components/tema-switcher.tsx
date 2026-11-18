"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { TEMA_CHAVE, TEMA_EVENTO, aplicarTema, escolherTema, lerTema, proximoTema, type Tema } from "@/lib/tema";

function assinar(avisar: () => void) {
  const noStorage = (e: StorageEvent) => {
    if (e.key === TEMA_CHAVE || e.key === null) {
      aplicarTema(lerTema());
      avisar();
    }
  };
  window.addEventListener(TEMA_EVENTO, avisar);
  window.addEventListener("storage", noStorage);
  return () => {
    window.removeEventListener(TEMA_EVENTO, avisar);
    window.removeEventListener("storage", noStorage);
  };
}

/** Botão do topo: Seguir o sistema → Claro → Escuro. A escolha fica neste navegador (lib/tema.ts). */
export function TemaSwitcher() {
  const t = useTranslations("tema");
  // No servidor e na hidratação vale "sistema"; depois, o que estiver guardado (sem piscar: o data-theme já veio do <head>).
  const tema = React.useSyncExternalStore(assinar, lerTema, () => "sistema" as Tema);
  // Metas theme-color chegam depois do script do <head>: acerta a cor da barra quando a escolha é fixa.
  // Lê do armazenamento (não do `tema` da hidratação, que é sempre "sistema") para não trocar o tema por um instante.
  React.useEffect(() => {
    aplicarTema(lerTema());
  }, [tema]);
  const proximo = proximoTema(tema);
  const rotulo = t("botao", { atual: t(tema), proximo: t(proximo) });
  return (
    <button
      type="button"
      onClick={() => escolherTema(proximo)}
      aria-label={rotulo}
      title={rotulo}
      data-tema={tema}
      className="relevo-caixa inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-control border border-line text-ink hover:text-brand"
    >
      <IconeTema tema={tema} />
    </button>
  );
}

function IconeTema({ tema }: { tema: Tema }) {
  const comum = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (tema === "claro")
    return (
      <svg {...comum}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    );
  if (tema === "escuro")
    return (
      <svg {...comum}>
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
      </svg>
    );
  // sistema: círculo meio cheio (segue o claro ou o escuro do aparelho)
  return (
    <svg {...comum}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" stroke="none" />
    </svg>
  );
}
