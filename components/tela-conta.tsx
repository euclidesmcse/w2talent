"use client";
import * as React from "react";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui";
import { voltaSegura } from "@/lib/conta-client";

/** Moldura das telas de entrar/conta (1.5.5): cabeçalho público e um cartão no meio. */
export function TelaConta({ titulo, children, tituloRef }: { titulo: string; children: React.ReactNode; tituloRef?: React.Ref<HTMLHeadingElement> }) {
  return (
    <div className="min-h-screen">
      <AppHeader area="publico" />
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-8 md:py-12">
        <Card className="flex flex-col gap-4 p-5 md:p-6">
          <h1 ref={tituloRef} tabIndex={-1} className="text-xl font-semibold outline-none">
            {titulo}
          </h1>
          {children}
        </Card>
      </main>
    </div>
  );
}

/**
 * O "?volta=" da tela (só caminhos internos). Lido depois de montar, para não quebrar a
 * pré-renderização: null até lá (quem redireciona espera o valor).
 */
export function useVolta(padrao = "/vagas"): string | null {
  const [volta, setVolta] = React.useState<string | null>(null);
  React.useEffect(() => {
    try { setVolta(voltaSegura(new URLSearchParams(window.location.search).get("volta"), padrao)); } catch { setVolta(padrao); }
  }, [padrao]);
  return volta;
}
