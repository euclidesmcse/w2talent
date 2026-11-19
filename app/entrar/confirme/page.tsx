"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { TelaConta, useVolta } from "@/components/tela-conta";

/** Depois de criar conta: tela neutra (não diz se o e-mail já tinha conta). */
export default function ConfirmePage() {
  const t = useTranslations("conta");
  const volta = useVolta() ?? "/vagas";
  const titulo = React.useRef<HTMLHeadingElement>(null);
  React.useEffect(() => { titulo.current?.focus(); }, []);
  return (
    <TelaConta titulo={t("checkEmailTitle")} tituloRef={titulo}>
      <p role="status" className="text-sm">{t("signUpSent")}</p>
      <p className="text-[13px] text-muted">{t("checkEmailHint")}</p>
      <a href={`/entrar?volta=${encodeURIComponent(volta)}`} className="text-sm font-semibold">{t("backToSignIn")}</a>
    </TelaConta>
  );
}
