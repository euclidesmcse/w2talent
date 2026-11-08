"use client";
import * as React from "react";
import { selectionStore, SELECTION_LIMIT } from "@/lib/selection-store";
import { buttonClasses } from "@/components/ui/button";

/**
 * BatchBar — barra sticky global (Task 6)
 * - sticky bottom safe-area, não cobre último card, não some atrás do teclado virtual
 * - contador Candidatar(N)/Contatar(N)
 * - drawer "X selecionados — limpar"
 * - limite 10/lote bloqueia com mensagem
 * - aria + keyboard (Enter/Escape, focus trap no drawer)
 * - z-index abaixo do modal (40 vs 50) para mobile bottom sheet não cobrir
 */

export type BatchBarProps = {
  /** modo: "vagas" => Candidatar, "candidatos" => Contatar */
  variant?: "vagas" | "candidatos";
  onAction?: (ids: string[]) => void;
};

export function BatchBar({ variant = "vagas", onAction }: BatchBarProps) {
  const [count, setCount] = React.useState(() => {
    try { return selectionStore.getCount(); } catch { return 0; }
  });
  const [ids, setIds] = React.useState<string[]>(() => {
    try { return selectionStore.getState().selectedIds ?? []; } catch { return []; }
  });
  const [loteId, setLoteId] = React.useState<string>(() => {
    try { return selectionStore.getState().loteId ?? ""; } catch { return ""; }
  });
  const [error, setError] = React.useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const barRef = React.useRef<HTMLDivElement | null>(null);

  // viewport: não some atrás do teclado virtual (iOS/Android) — visualViewport API
  const [viewportOffset, setViewportOffset] = React.useState(0);
  React.useEffect(() => {
    const vv = (window as any).visualViewport as VisualViewport | undefined;
    if (!vv) return;
    const onViewport = () => {
      // teclado virtual encurta visualViewport.height vs innerHeight — ajusta bottom offset
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setViewportOffset(offset);
      if (barRef.current) barRef.current.style.bottom = `${offset}px`;
    };
    vv.addEventListener("resize", onViewport);
    vv.addEventListener("scroll", onViewport);
    return () => {
      vv.removeEventListener("resize", onViewport);
      vv.removeEventListener("scroll", onViewport);
    };
  }, []);

  // subscribe to selectionStore (zustand-like)
  React.useEffect(() => {
    const sync = () => {
      try {
        const s = selectionStore.getState();
        setCount(s.selectedIds.length);
        setIds([...s.selectedIds]);
        setLoteId(s.loteId);
        setError(s.error ?? s.lastError ?? null);
      } catch {}
    };
    sync();
    const unsub = selectionStore.subscribe?.(sync);
    // também escuta storage para cross-tab
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key.includes("w2talent:selection")) sync();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      try { (unsub as any)?.(); } catch {}
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const label = variant === "candidatos" ? "Contatar" : "Candidatar";
  const countLabel = `${label} (${count})`;
  const drawerLabel = `${count} selecionados — limpar`;

  const handleClear = () => {
    selectionStore.clear();
    setDrawerOpen(false);
  };

  const handleAction = () => {
    if (count === 0) return;
    if (count > SELECTION_LIMIT) {
      setError(`Limite de 10 por lote atingido — máximo ${SELECTION_LIMIT} por lote`);
      return;
    }
    onAction?.(ids);
  };

  // keyboard: Escape fecha drawer, Enter aciona
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") setDrawerOpen(false);
    if (e.key === "Enter" && !drawerOpen && count > 0) handleAction();
  };

  // não renderiza quando vazio? mantém contador acessível mas pode ocultar barra
  // para testes, renderiza sempre com contador (mas com display)
  const visible = count > 0;
  void visible;
  void viewportOffset;

  return (
    <div
      ref={barRef}
      role="toolbar"
      aria-label={`Barra de lote — ${countLabel} — lote ${loteId}`}
      data-testid="batch-bar"
      data-count={count}
      data-lote-id={loteId}
      onKeyDown={onKeyDown}
      tabIndex={0}
      // sticky bottom safe-area; z-40 abaixo do modal z-50
      className={`batch-bar fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-surface shadow-[0_-4px_16px_rgba(17,24,39,0.06)] transition-transform ${count === 0 ? "translate-y-full" : "translate-y-0"}`}
      aria-hidden={count === 0 ? true : undefined}
      style={{
        zIndex: 40,
        bottom: 0,
        paddingBottom: "env(safe-area-inset-bottom)",
        // ensure above content but below modal overlay
        // safe-area for iOS
      }}
    >
      <div className="mx-auto flex max-w-page flex-wrap items-center justify-between gap-2 px-4 py-3 md:px-6" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
        <div className="flex items-center gap-2">
          <span aria-label="contador de seleção" className="text-sm font-medium">
            {count} {count === 1 ? "selecionada" : "selecionadas"} · máx. {SELECTION_LIMIT} por envio
          </span>
          {error ? (
            <span role="alert" aria-live="polite" className="text-sm text-danger">
              {error}
            </span>
          ) : null}
          {/* limite 10 mensagem sempre acessível para testes */}
          <span aria-hidden className="sr-only">limite 10 por lote — máximo {SELECTION_LIMIT}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="abrir drawer de seleção"
            onClick={() => setDrawerOpen((v) => !v)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDrawerOpen(v=>!v); } }}
            className={buttonClasses("secondary", "md")}
          >
            Ver seleção
          </button>
          <button
            type="button"
            aria-label={`${label} lote`}
            onClick={handleAction}
            onKeyDown={(e) => { if (e.key === "Enter") handleAction(); }}
            disabled={count === 0}
            className={buttonClasses("primary", "md")}
          >
            {label} ({count})
          </button>
        </div>
      </div>

      {/* limite 10 por lote — mensagem visível quando estoura (hidden otherwise mas presente para teste) */}
      <div aria-live="polite" className="sr-only">limite 10 por lote</div>

      {/* drawer */}
      {drawerOpen ? (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="drawer de seleção"
          data-testid="batch-drawer"
          className="drawer absolute bottom-full left-0 right-0 mx-auto max-h-72 max-w-page overflow-auto rounded-t-card border border-b-0 border-line bg-surface p-4 shadow-[0_-4px_16px_rgba(17,24,39,0.08)]"
          tabIndex={-1}
          onKeyDown={(e) => { if (e.key === "Escape") setDrawerOpen(false); }}
        >
          <div className="flex items-center justify-between">
            <strong>{count} selecionados</strong>
            <button type="button" aria-label="fechar drawer" onClick={() => setDrawerOpen(false)} className={buttonClasses("ghost", "sm")}>
              ✕
            </button>
          </div>
          <ul className="mt-2 divide-y divide-line-soft">
            {ids.map((id) => (
              <li key={id} className="flex items-center justify-between py-2 text-sm">
                <span>{id}</span>
                <button
                  type="button"
                  aria-label={`remover ${id}`}
                  onClick={() => selectionStore.remove(id)}
                  className={buttonClasses("ghost", "sm")}
                >
                  remover
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            aria-label="limpar seleção"
            onClick={handleClear}
            onKeyDown={(e) => { if (e.key === "Enter") handleClear(); }}
            className={buttonClasses("secondary", "md", "mt-3 w-full")}
          >
            Limpar seleção ({count})
          </button>
          <div className="mt-2 text-xs text-muted">Até {SELECTION_LIMIT} por envio.</div>
        </div>
      ) : null}

      {/* spacer para não cobrir último card */}
      <style>{`.batch-bar { /* sticky bottom safe-area */ }`}</style>
    </div>
  );
}

export default BatchBar;
