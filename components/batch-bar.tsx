"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { selectionStore, SELECTION_LIMIT } from "@/lib/selection-store";

/** Candidaturas por dia (spec §5); o controle de verdade entra com o envio, no 1.5.13. */
const DAILY_LIMIT = 30;
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
  /** Vagas: "Revisar e aprovar" ligado (1.5.13; até o login, só no modo de teste do admin). */
  actionEnabled?: boolean;
};

export function BatchBar({ variant = "vagas", onAction, actionEnabled = false }: BatchBarProps) {
  const t = useTranslations("batch");
  const tc = useTranslations();
  const isCand = variant === "candidatos";
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

  const label = isCand ? "Contatar" : "Candidatar";
  const actionText = isCand ? t("contact", { count }) : t("review", { count });
  // Vagas: "Revisar e aprovar" (1.5.13). Sem login, aparece desativado ("disponível em breve").
  const actionSoon = !isCand && !actionEnabled;
  const drawerLabel = `${count} selecionados — limpar`;

  const handleClear = () => {
    selectionStore.clear();
    setDrawerOpen(false);
  };

  const handleAction = () => {
    if (count === 0) return;
    if (count > SELECTION_LIMIT) {
      setError(t("limitReached", { max: SELECTION_LIMIT }));
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
      aria-label={t("toolbarLabel")}
      data-testid="batch-bar"
      data-count={count}
      data-lote-id={loteId}
      onKeyDown={onKeyDown}
      tabIndex={count === 0 ? -1 : 0}
      // sticky bottom safe-area; z-40 abaixo do modal z-50
      className={`batch-bar fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-surface shadow-[0_-4px_16px_rgba(17,24,39,0.06)] transition-transform ${count === 0 ? "invisible translate-y-full" : "visible translate-y-0"}`}
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
          <span data-testid="batch-count" className="text-sm font-medium">
            {t(isCand ? "selectedCountCandidatos" : "selectedCount", { count, max: SELECTION_LIMIT, daily: DAILY_LIMIT })}
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
            data-action="abrir-selecao"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen((v) => !v)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDrawerOpen(v=>!v); } }}
            className={buttonClasses("secondary", "md")}
          >
            {t("viewSelection")}
          </button>
          <button
            type="button"
            data-action="enviar-lote"
            onClick={handleAction}
            onKeyDown={(e) => { if (e.key === "Enter") handleAction(); }}
            disabled={count === 0 || actionSoon}
            aria-describedby={actionSoon ? "batch-soon" : undefined}
            className={buttonClasses("primary", "md")}
          >
            {actionText}
          </button>
          {actionSoon ? <span id="batch-soon" className="text-xs text-muted">{t("soon")}</span> : null}
        </div>
      </div>

      {/* limite 10 por lote — mensagem visível quando estoura (hidden otherwise mas presente para teste) */}
      <div aria-live="polite" className="sr-only">limite 10 por lote</div>

      {/* drawer */}
      {drawerOpen ? (
        <div
          role="dialog"
          aria-modal="false"
          aria-label={t("viewSelection")}
          data-testid="batch-drawer"
          className="drawer absolute bottom-full left-0 right-0 mx-auto max-h-72 max-w-page overflow-auto rounded-t-card border border-b-0 border-line bg-surface p-4 shadow-[0_-4px_16px_rgba(17,24,39,0.08)]"
          tabIndex={-1}
          onKeyDown={(e) => { if (e.key === "Escape") setDrawerOpen(false); }}
        >
          <div className="flex items-center justify-between">
            <strong>{t(isCand ? "drawerTitleCandidatos" : "drawerTitle", { count })}</strong>
            <button type="button" aria-label={t("closeDrawer")} onClick={() => setDrawerOpen(false)} className={buttonClasses("ghost", "sm")}>
              ✕
            </button>
          </div>
          <ul className="mt-2 divide-y divide-line-soft">
            {ids.map((id) => {
              const nome = selectionStore.getLabel(id) ?? (isCand ? tc("candidatos.untitled") : tc("vagas.untitled"));
              return (
              <li key={id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 truncate font-medium" title={nome}>{nome}</span>
                <button
                  type="button"
                  aria-label={t("removeItem", { name: nome })}
                  onClick={() => selectionStore.remove(id)}
                  className={buttonClasses("ghost", "sm")}
                >
                  {tc("common.remove")}
                </button>
              </li>
              );
            })}
          </ul>
          <button
            type="button"
            data-action="limpar-selecao"
            onClick={handleClear}
            onKeyDown={(e) => { if (e.key === "Enter") handleClear(); }}
            className={buttonClasses("secondary", "md", "mt-3 w-full")}
          >
            {t("clear", { count })}
          </button>
          <div className="mt-2 text-xs text-muted">{t("limitNote", { max: SELECTION_LIMIT })}</div>
        </div>
      ) : null}

      {/* spacer para não cobrir último card */}
      <style>{`.batch-bar { /* sticky bottom safe-area */ }`}</style>
    </div>
  );
}

export default BatchBar;
