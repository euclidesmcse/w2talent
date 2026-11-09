"use client";
/**
 * "Continuo procurando" (1.5.15): página do link do e-mail. Renova o perfil por 180 dias ao apertar o botão.
 */
import * as React from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { AppHeader } from "@/components/app-header";
import { Button, Card, CardBody, buttonClasses } from "@/components/ui";
import { intlTag } from "@/lib/locale";

type Estado = { tipo: "pronto" } | { tipo: "enviando" } | { tipo: "ok"; ate: string } | { tipo: "erro"; codigo: string };

export default function RenovarPage() {
  const t = useTranslations("renovar");
  const locale = useLocale();
  const [token, setToken] = React.useState<string | null>(null);
  const [estado, setEstado] = React.useState<Estado>({ tipo: "pronto" });

  React.useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("t"));
  }, []);

  async function renovar() {
    if (!token) return;
    setEstado({ tipo: "enviando" });
    try {
      const r = await fetch("/api/perfil/renovar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t: token }) });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; ate?: string; error?: string };
      if (r.ok && j.ok && j.ate) setEstado({ tipo: "ok", ate: j.ate });
      else setEstado({ tipo: "erro", codigo: j.error ?? "erro" });
    } catch {
      setEstado({ tipo: "erro", codigo: "erro" });
    }
  }

  const erroTexto = (codigo: string) =>
    codigo === "link_vencido" ? t("erroVencido") : codigo === "perfil_nao_encontrado" ? t("erroPerfil") : codigo === "link_invalido" ? t("erroInvalido") : t("erroGeral");

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-lg px-4 py-12">
        <Card>
          <CardBody className="space-y-4 p-6">
            <h1 className="text-xl font-semibold text-ink">{t("title")}</h1>
            {estado.tipo === "ok" ? (
              <>
                <p role="status" className="text-muted">
                  {t("ok", { data: new Date(estado.ate).toLocaleDateString(intlTag(locale), { day: "numeric", month: "long", year: "numeric" }) })}
                </p>
                <Link href="/vagas" className={buttonClasses("secondary")}>
                  {t("verVagas")}
                </Link>
              </>
            ) : token === null ? (
              <p className="text-muted">{t("semLink")}</p>
            ) : (
              <>
                <p className="text-muted">{t("lead")}</p>
                <Button data-action="renovar" onClick={renovar} disabled={estado.tipo === "enviando"}>
                  {estado.tipo === "enviando" ? t("enviando") : t("botao")}
                </Button>
                {estado.tipo === "erro" && (
                  <p role="alert" className="text-sm text-danger">
                    {erroTexto(estado.codigo)}
                  </p>
                )}
              </>
            )}
          </CardBody>
        </Card>
      </main>
    </>
  );
}
