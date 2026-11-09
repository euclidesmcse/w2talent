"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { buttonClasses } from "@/components/ui/button";
import { ehIosSafari, instalar, rodandoComoApp, useConviteInstalar } from "@/lib/pwa-client";

/**
 * "Instalar app" no cabeçalho (D4). Só aparece quando o navegador oferece a instalação
 * (Android, Chrome/Edge no computador). No iPhone/iPad (Safari), o mesmo botão mostra como
 * instalar pelo menu Compartilhar. Já instalado: não aparece. Nada de pop-up sozinho.
 */
export function InstallApp() {
  const t = useTranslations("pwa");
  const temConvite = useConviteInstalar();
  const [ios, setIos] = React.useState(false);
  const [ajuda, setAjuda] = React.useState(false);
  const painel = React.useId();
  React.useEffect(() => { setIos(!rodandoComoApp() && ehIosSafari()); }, []);
  if (!temConvite && !ios) return null;

  const icone = (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <path d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  const classes = buttonClasses("ghost", "sm", "w-8 px-0 md:w-auto md:px-3");

  if (temConvite)
    return (
      <button type="button" data-action="instalar-app" className={classes} aria-label={t("install")} onClick={() => { void instalar(); }}>
        {icone}
        <span className="hidden md:inline">{t("install")}</span>
      </button>
    );

  return (
    <div className="relative">
      <button type="button" data-action="instalar-app" className={classes} aria-label={t("install")} aria-expanded={ajuda} aria-controls={painel} onClick={() => setAjuda((v) => !v)}>
        {icone}
        <span className="hidden md:inline">{t("install")}</span>
      </button>
      {ajuda ? (
        <div id={painel} role="region" aria-label={t("install")} className="absolute right-0 top-full z-50 mt-2 w-64 rounded-card border border-line bg-surface p-3 text-[13px] text-ink shadow-[0_8px_24px_rgba(17,24,39,0.12)]">
          <p className="font-semibold">{t("iosTitle")}</p>
          <p className="mt-1 text-muted">{t("iosBody")}</p>
          <button type="button" className={buttonClasses("ghost", "sm", "mt-2 -ml-2")} onClick={() => setAjuda(false)}>{t("close")}</button>
        </div>
      ) : null}
    </div>
  );
}
