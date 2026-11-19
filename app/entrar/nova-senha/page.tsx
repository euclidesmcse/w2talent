"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { Button, buttonClasses } from "@/components/ui";
import { CampoSenha } from "@/components/campo-senha";
import { TelaConta } from "@/components/tela-conta";
import { SENHA_MAX, SENHA_MIN, limparDadosLocais, postAuth } from "@/lib/conta-client";
import { useOnline } from "@/lib/pwa-client";

type Estado = "lendo" | "form" | "vencido" | "salva";

/**
 * Nova senha pelo link do e-mail (?token=). O Better Auth manda ?error=INVALID_TOKEN quando o
 * link venceu ou já foi usado. Salvar encerra todas as sessões da conta.
 */
export default function NovaSenhaPage() {
  const t = useTranslations("conta");
  const online = useOnline();
  const [estado, setEstado] = React.useState<Estado>("lendo");
  const [token, setToken] = React.useState("");
  const [senha, setSenha] = React.useState("");
  const [ocupado, setOcupado] = React.useState(false);
  const [erroSenha, setErroSenha] = React.useState<string | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);
  const titulo = React.useRef<HTMLHeadingElement>(null);
  const campo = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      const tk = q.get("token");
      if (q.get("error") || !tk) return setEstado("vencido");
      setToken(tk);
      setEstado("form");
    } catch {
      setEstado("vencido");
    }
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setErroSenha(null);
    if (senha.length < SENHA_MIN) {
      setErroSenha(t("errorPasswordShort"));
      campo.current?.focus();
      return;
    }
    setOcupado(true);
    const r = await postAuth("/reset-password", { newPassword: senha, token }).catch(() => null);
    setOcupado(false);
    if (r?.ok) {
      limparDadosLocais();
      setSenha("");
      setEstado("salva");
      titulo.current?.focus();
      return;
    }
    if (r?.code === "INVALID_TOKEN") {
      setEstado("vencido");
      titulo.current?.focus();
    } else if (r?.code === "PASSWORD_COMPROMISED") {
      setErroSenha(t("errorPasswordCompromised"));
      campo.current?.focus();
    } else if (r?.code === "PASSWORD_TOO_SHORT") {
      setErroSenha(t("errorPasswordShort"));
      campo.current?.focus();
    } else setErro(r?.status === 429 ? t("errorTooMany") : t("errorGeneric"));
  }

  return (
    <TelaConta titulo={estado === "vencido" ? t("errorLinkExpired") : t("newPasswordTitle")} tituloRef={titulo}>
      {estado === "lendo" ? <p aria-busy="true" className="text-sm text-muted">{t("continuingBody")}</p> : null}
      {estado === "vencido" ? (
        <>
          <p className="text-sm text-muted">{t("errorLinkExpiredBody")}</p>
          <a href="/entrar/esqueci" className={buttonClasses("primary", "lg", "hover:no-underline hover:text-white")}>{t("requestNewLink")}</a>
        </>
      ) : null}
      {estado === "salva" ? (
        <>
          <p role="status" className="text-sm">{t("newPasswordSaved")}</p>
          <a href="/entrar" className={buttonClasses("primary", "lg", "hover:no-underline hover:text-white")}>{t("signIn")}</a>
        </>
      ) : null}
      {estado === "form" ? (
        <form onSubmit={salvar} className="flex flex-col gap-4">
          <CampoSenha
            ref={campo}
            label={t("newPasswordLabel")}
            hint={t("passwordRule")}
            error={erroSenha ?? undefined}
            mostrar={t("showPassword")}
            esconder={t("hidePassword")}
            name="new-password"
            autoComplete="new-password"
            maxLength={SENHA_MAX}
            required
            autoFocus
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
          {erro ? <p role="alert" className="text-sm text-danger">{erro}</p> : null}
          <Button type="submit" size="lg" data-action="salvar-senha" disabled={!online || ocupado || !senha}>
            {ocupado ? t("saving") : t("newPasswordSave")}
          </Button>
          {!online ? <p className="text-[13px] text-muted">{t("needsInternet")}</p> : null}
        </form>
      ) : null}
    </TelaConta>
  );
}
