"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Field, Input } from "@/components/ui";
import { CampoSenha } from "@/components/campo-senha";
import { TelaConta, useVolta } from "@/components/tela-conta";
import { useTurnstile } from "@/components/turnstile";
import { SENHA_MAX, SENHA_MIN, destinoDoEstado, linkContinuar, postAuth, useConta } from "@/lib/conta-client";
import { useOnline } from "@/lib/pwa-client";

/**
 * Criar conta com e-mail e senha. A resposta é sempre a mesma tela neutra (/entrar/confirme):
 * nunca dizemos se o e-mail já tem conta.
 */
export default function CriarContaPage() {
  const t = useTranslations("conta");
  const router = useRouter();
  const online = useOnline();
  const info = useConta({ fresco: true });
  const voltaLida = useVolta();
  const volta = voltaLida ?? "/vagas";
  const v = encodeURIComponent(volta);
  const captcha = useTurnstile(info.config?.turnstileSiteKey);
  const [nome, setNome] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [senha, setSenha] = React.useState("");
  const [ocupado, setOcupado] = React.useState(false);
  const [erroSenha, setErroSenha] = React.useState<string | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);
  const campoSenha = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!voltaLida) return;
    const d = destinoDoEstado(info.estado, voltaLida);
    if (d) router.replace(d);
  }, [info.estado, voltaLida, router]);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setErroSenha(null);
    if (senha.length < SENHA_MIN) {
      setErroSenha(t("errorPasswordShort"));
      campoSenha.current?.focus();
      return;
    }
    setOcupado(true);
    const r = await postAuth("/sign-up/email", { name: nome.trim(), email: email.trim(), password: senha, callbackURL: linkContinuar(volta) }, captcha.headers()).catch(() => null);
    captcha.reset();
    // Conta já existente também cai na tela neutra (o servidor responde 200; isto é só reserva).
    if (r?.ok || r?.code.startsWith("USER_ALREADY_EXISTS")) {
      router.push(`/entrar/confirme?volta=${v}`);
      return;
    }
    setOcupado(false);
    if (r?.code === "PASSWORD_COMPROMISED") {
      setErroSenha(t("errorPasswordCompromised"));
      campoSenha.current?.focus();
    } else if (r?.code === "PASSWORD_TOO_SHORT") {
      setErroSenha(t("errorPasswordShort"));
      campoSenha.current?.focus();
    } else setErro(r?.status === 429 ? t("errorTooMany") : t("errorGeneric"));
  }

  const desligado = info.estado !== "carregando" && !info.config?.senha;

  return (
    <TelaConta titulo={t("signUpTitle")}>
      {desligado ? (
        <>
          <p role="status" className="rounded-card border border-warning bg-warning-soft px-3.5 py-2.5 text-[13px] text-warning-ink">
            {info.estado === "erro" ? t("errorLoad") : t("emailNotConfigured")}
          </p>
          <a href={`/entrar?volta=${v}`} className="text-sm font-semibold">{t("backToSignIn")}</a>
        </>
      ) : (
        <form onSubmit={criar} className="flex flex-col gap-4">
          <p className="text-sm text-muted">{t("signUpBody")}</p>
          <Field label={t("nameLabel")}>
            <Input name="name" autoComplete="name" required maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)} />
          </Field>
          <Field label={t("emailLabel")}>
            <Input type="email" name="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <CampoSenha
            ref={campoSenha}
            label={t("passwordLabel")}
            hint={t("passwordRule")}
            error={erroSenha ?? undefined}
            mostrar={t("showPassword")}
            esconder={t("hidePassword")}
            name="password"
            autoComplete="new-password"
            maxLength={SENHA_MAX}
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
          {captcha.caixa}
          {erro ? <p role="alert" className="text-sm text-danger">{erro}</p> : null}
          <Button type="submit" size="lg" data-action="criar-conta" disabled={!online || ocupado || !captcha.pronto || !nome.trim() || !email.trim() || !senha}>
            {ocupado ? t("saving") : t("createAccount")}
          </Button>
          {!online ? <p className="text-[13px] text-muted">{t("needsInternet")}</p> : null}
          <p className="text-[13px] text-muted">{t("signInPrivacy")}</p>
          <p className="text-sm">
            {t("haveAccount")} <a href={`/entrar?volta=${v}`} className="font-semibold">{t("signIn")}</a>
          </p>
        </form>
      )}
    </TelaConta>
  );
}
