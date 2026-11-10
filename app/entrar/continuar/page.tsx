"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { TelaConta, useVolta } from "@/components/tela-conta";
import { destinoDoEstado, recarregarConta } from "@/lib/conta-client";

/** Volta do Google/Microsoft (1.5.5): lê o login de novo e leva para o código, o perfil ou a tela de origem. */
export default function ContinuarPage() {
  const t = useTranslations("conta");
  const router = useRouter();
  const volta = useVolta();
  const [falhou, setFalhou] = React.useState(false);
  React.useEffect(() => {
    if (!volta) return;
    let vivo = true;
    recarregarConta().then((info) => {
      if (!vivo) return;
      const d = destinoDoEstado(info.estado, volta);
      if (d) router.replace(d);
      else setFalhou(true);
    });
    return () => { vivo = false; };
  }, [volta, router]);
  return (
    <TelaConta titulo={falhou ? t("errorProvider") : t("continuing")}>
      {falhou ? (
        <a href={`/entrar?volta=${encodeURIComponent(volta ?? "/vagas")}`} className="text-sm font-semibold">{t("tryAgain")}</a>
      ) : (
        <p aria-busy="true" className="text-sm text-muted">{t("continuingBody")}</p>
      )}
    </TelaConta>
  );
}
