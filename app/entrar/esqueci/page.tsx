"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { Button, Field, Input } from "@/components/ui";
import { TelaConta, useVolta } from "@/components/tela-conta";
import { useTurnstile } from "@/components/turnstile";
import { postAuth, useConta } from "@/lib/conta-client";
import { useOnline } from "@/lib/pwa-client";

/**
 * Esqueci a senha: manda o link para criar uma senha nova. Também serve para quem entra com
 * Google/Microsoft criar uma senha. A resposta é sempre a mesma (não diz se o e-mail tem conta).
 */
export default function EsqueciPage() {
  const t = useTranslations("conta");
  const online = useOnline();
  const info = useConta({ fresco: true });
  const volta = useVolta() ?? "/vagas";
  const captcha = useTurnstile(info.config?.turnstileSiteKey);
  const [email, setEmail] = React.useState("");
  const [ocupado, setOcupado] = React.useState(false);
  const [enviado, setEnviado] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const titulo = React.useRef<HTMLHeadingElement>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setOcupado(true);
    setErro(null);
    const r = await postAuth("/request-password-reset", { email: email.trim(), redirectTo: "/entrar/nova-senha" }, captcha.headers()).catch(() => null);
    captcha.reset();
    setOcupado(false);
    if (r?.ok) {
      setEnviado(true);
      titulo.current?.focus();
      return;
    }
    setErro(r?.status === 429 ? t("errorTooMany") : t("errorGeneric"));
  }

  const desligado = info.estado !== "carregando" && !info.config?.senha;
  const entrarHref = `/entrar?volta=${encodeURIComponent(volta)}`;

  return (
    <TelaConta titulo={t("forgotTitle")} tituloRef={titulo}>
      {desligado ? (
        <p role="status" className="rounded-card border border-warning bg-warning-soft px-3.5 py-2.5 text-[13px] text-warning-ink">
          {info.estado === "erro" ? t("errorLoad") : t("emailNotConfigured")}
        </p>
      ) : enviado ? (
        <p role="status" className="text-sm">{t("forgotSent")}</p>
      ) : (
        <form onSubmit={enviar} className="flex flex-col gap-4">
          <p className="text-sm text-muted">{t("forgotBody")}</p>
          <Field label={t("emailLabel")}>
            <Input type="email" name="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          {captcha.caixa}
          {erro ? <p role="alert" className="text-sm text-danger">{erro}</p> : null}
          <Button type="submit" size="lg" data-action="pedir-link-senha" disabled={!online || ocupado || !captcha.pronto || !email.trim()}>
            {ocupado ? t("sending") : t("forgotSend")}
          </Button>
          {!online ? <p className="text-[13px] text-muted">{t("needsInternet")}</p> : null}
          <p className="text-[13px] text-muted">{t("forgotSocialHint")}</p>
        </form>
      )}
      <a href={entrarHref} className="text-sm font-semibold">{t("backToSignIn")}</a>
    </TelaConta>
  );
}
