"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { iniciarPwa, useOnline } from "@/lib/pwa-client";

/** Registra o service worker (1.5.14). Fica no layout raiz e não desenha nada. */
export function PwaInit() {
  React.useEffect(() => { iniciarPwa(); }, []);
  return null;
}

/** Aviso global quando o aparelho está sem internet (D2). */
export function OfflineBanner() {
  const t = useTranslations("pwa");
  const online = useOnline();
  if (online) return null;
  return (
    <div role="status" data-testid="sem-conexao" className="border-b border-line bg-warning-soft px-4 py-2 text-center text-[13px] text-warning-ink md:px-6">
      <strong className="font-semibold">{t("offlineTitle")}</strong> {t("offlineBody")}
    </div>
  );
}
