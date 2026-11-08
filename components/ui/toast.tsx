"use client";

import * as React from "react";
import { cn } from "./cn";

export type ToastTone = "success" | "info" | "warning" | "error";
type ToastItem = { id: number; tone: ToastTone; message: string };

const toneCls: Record<ToastTone, string> = {
  success: "border-[#A7F3D0] bg-[#ECFDF5] text-[#065F46]",
  info: "border-line bg-surface text-ink",
  warning: "border-[#F59E0B] bg-[#FFFBEB] text-[#92400E]",
  error: "border-[#FECDCA] bg-danger-soft text-danger-ink",
};

const ToastContext = React.createContext<{ show: (message: string, tone?: ToastTone) => void } | null>(null);

/** Avisos curtos no canto da tela. Somem sozinhos em 4 s; erros ficam até fechar. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const nextId = React.useRef(1);

  const dismiss = React.useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const show = React.useCallback(
    (message: string, tone: ToastTone = "info") => {
      const id = nextId.current++;
      setItems((xs) => [...xs.slice(-2), { id, tone, message }]);
      if (tone !== "error") setTimeout(() => dismiss(id), 4000);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 pb-safe-bottom md:inset-x-auto md:right-6">
        {items.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={cn("pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-card border px-4 py-3 text-sm shadow-sm", toneCls[t.tone])}
          >
            <span className="flex-1">{t.message}</span>
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Fechar aviso" className="leading-none opacity-70 hover:opacity-100">
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast precisa do <ToastProvider> no layout.");
  return ctx;
}
