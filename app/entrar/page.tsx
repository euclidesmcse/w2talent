"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Field, Input } from "@/components/ui";
import { CampoSenha } from "@/components/campo-senha";
import { TelaConta, useVolta } from "@/components/tela-conta";
import { useTurnstile } from "@/components/turnstile";
import { SENHA_MAX, destinoDoEstado, linkContinuar, postAuth, useConta } from "@/lib/conta-client";
import { useOnline } from "@/lib/pwa-client";

type Provedor = "google" | "microsoft";
/** O que deu errado no login por e-mail (cada um tem um texto e, às vezes, uma ação). */
type FalhaSenha = "senha" | "naoConfirmado" | "bloqueada" | "muitas" | "geral";

/**
 * Entrar (1.5.5): Google ou Microsoft (contas pessoais e de empresa) e, quando o envio de
 * e-mail está ligado (config.senha), e-mail e senha. Com TURNSTILE_SITE_KEY, o desafio da
 * Cloudflare aparece antes dos botões e vale para os dois jeitos.
 */
export default function EntrarPage() {
  const t = useTranslations("conta");
  const router = useRouter();
  const online = useOnline();
  const info = useConta({ fresco: true });
  const voltaLida = useVolta();
  const volta = voltaLida ?? "/vagas";
  const v = encodeURIComponent(volta);
  const [erro, setErro] = React.useState<string | null>(null);
  const [indo, setIndo] = React.useState<Provedor | null>(null);
  const captcha = useTurnstile(info.config?.turnstileSiteKey);

  const [email, setEmail] = React.useState("");
  const [senha, setSenha] = React.useState("");
  const [enviando, setEnviando] = React.useState(false);
  const [falha, setFalha] = React.useState<FalhaSenha | null>(null);
  const [reenvio, setReenvio] = React.useState<"enviando" | "enviado" | null>(null);

  // Já entrou: segue para o próximo passo (código, perfil) ou para onde ia.
  React.useEffect(() => {
    if (!voltaLida) return;
    const d = destinoDoEstado(info.estado, voltaLida);
    if (d) router.replace(d);
  }, [info.estado, voltaLida, router]);

  React.useEffect(() => {
    try { if (new URLSearchParams(window.location.search).get("erro")) setErro(t("errorProvider")); } catch {}
  }, [t]);

  async function entrar(provider: Provedor) {
    setErro(null);
    setIndo(provider);
    try {
      const r = await fetch("/api/auth/sign-in/social", {
        method: "POST",
        headers: captcha.headers(),
        body: JSON.stringify({
          provider,
          callbackURL: linkContinuar(volta),
          errorCallbackURL: `/entrar?erro=1&volta=${v}`,
        }),
      });
      const j = (await r.json().catch(() => ({}))) as { url?: string };
      if (r.ok && j.url) {
        window.location.href = j.url;
        return;
      }
      setErro(t("errorProvider"));
    } catch {
      setErro(t("errorProvider"));
    }
    setIndo(null);
    captcha.reset();
  }

  async function entrarComSenha(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !senha) return;
    setEnviando(true);
    setFalha(null);
    setReenvio(null);
    setErro(null);
    const r = await postAuth("/sign-in/email", { email: email.trim(), password: senha, callbackURL: linkContinuar(volta) }, captcha.headers()).catch(() => null);
    captcha.reset();
    if (r?.ok) {
      if (r.j.twoFactorRedirect) router.push(`/entrar/codigo?via=senha&volta=${v}`);
      else window.location.href = linkContinuar(volta);
      return;
    }
    setEnviando(false);
    if (!r) return setFalha("geral");
    if (r.status === 403 && r.code === "EMAIL_NOT_VERIFIED") setFalha("naoConfirmado");
    else if (r.status === 403 && r.code === "CONTA_BLOQUEADA") setFalha("bloqueada");
    else if (r.status === 401) setFalha("senha");
    else if (r.status === 429) setFalha("muitas");
    else setFalha("geral");
  }

  async function reenviarLink() {
    setReenvio("enviando");
    await postAuth("/send-verification-email", { email: email.trim(), callbackURL: linkContinuar(volta) }).catch(() => null);
    // Mesma resposta com ou sem conta: não contamos se o e-mail existe.
    setReenvio("enviado");
  }

  const p = info.config?.provedores;
  const temSocial = !!p?.google || !!p?.microsoft;
  const temSenha = !!info.config?.senha;
  const nenhum = info.estado !== "carregando" && !temSocial && !temSenha;
  const travado = !online || !!indo || enviando || !captcha.pronto;
  const esqueciHref = `/entrar/esqueci?volta=${v}`;

  const textoFalha: Record<FalhaSenha, string> = {
    senha: t("errorWrongPassword"),
    naoConfirmado: t("errorNotVerified"),
    bloqueada: t("errorLocked"),
    muitas: t("errorTooMany"),
    geral: t("errorGeneric"),
  };

  return (
    <TelaConta titulo={t("signInTitle")}>
      <p className="text-sm text-muted">{temSenha ? (temSocial ? t("signInBodyBoth") : t("signInBodyEmail")) : t("signInBody")}</p>
      {nenhum ? (
        <p role="status" className="rounded-card border border-warning bg-warning-soft px-3.5 py-2.5 text-[13px] text-warning-ink">
          {info.estado === "erro" ? t("errorLoad") : t("notConfigured")}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {captcha.caixa}
          {p?.google ? (
            <Button variant="secondary" size="lg" data-action="entrar-google" disabled={travado} onClick={() => entrar("google")}>
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.8Z" />
                <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z" />
                <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
                <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9Z" />
              </svg>
              {indo === "google" ? t("redirecting") : t("withGoogle")}
            </Button>
          ) : null}
          {p?.microsoft ? (
            <Button variant="secondary" size="lg" data-action="entrar-microsoft" disabled={travado} onClick={() => entrar("microsoft")}>
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#F25022" d="M1 1h10.5v10.5H1z" />
                <path fill="#7FBA00" d="M12.5 1H23v10.5H12.5z" />
                <path fill="#00A4EF" d="M1 12.5h10.5V23H1z" />
                <path fill="#FFB900" d="M12.5 12.5H23V23H12.5z" />
              </svg>
              {indo === "microsoft" ? t("redirecting") : t("withMicrosoft")}
            </Button>
          ) : null}
          {erro ? <p role="alert" className="text-sm text-danger">{erro}</p> : null}
          {temSenha ? (
            <form onSubmit={entrarComSenha} className="flex flex-col gap-3" aria-labelledby="entrar-email-titulo">
              {temSocial ? (
                <div className="flex items-center gap-3 pt-1 text-[13px] text-muted">
                  <span aria-hidden="true" className="h-px flex-1 bg-line" />
                  <h2 id="entrar-email-titulo" className="text-[13px] font-medium text-muted">{t("emailSignInTitle")}</h2>
                  <span aria-hidden="true" className="h-px flex-1 bg-line" />
                </div>
              ) : (
                <h2 id="entrar-email-titulo" className="sr-only">{t("emailSignInTitle")}</h2>
              )}
              <Field label={t("emailLabel")}>
                <Input type="email" name="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} required value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <CampoSenha
                label={t("passwordLabel")}
                mostrar={t("showPassword")}
                esconder={t("hidePassword")}
                name="password"
                autoComplete="current-password"
                maxLength={SENHA_MAX}
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
              {falha ? (
                <div role="alert" className="flex flex-col items-start gap-2 text-sm text-danger">
                  <p>{textoFalha[falha]}</p>
                  {falha === "bloqueada" ? <a href={esqueciHref} className="font-semibold">{t("forgotPassword")}</a> : null}
                  {falha === "naoConfirmado" && reenvio !== "enviado" ? (
                    <Button variant="secondary" size="sm" data-action="reenviar-link" disabled={!online || reenvio === "enviando"} onClick={reenviarLink}>
                      {reenvio === "enviando" ? t("sending") : t("resendLink")}
                    </Button>
                  ) : null}
                </div>
              ) : null}
              {reenvio === "enviado" ? <p role="status" className="text-sm text-success">{t("linkSentNeutral")}</p> : null}
              <Button type="submit" size="lg" data-action="entrar-senha" disabled={travado || !email.trim() || !senha}>
                {enviando ? t("checking") : t("signIn")}
              </Button>
              <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm">
                <a href={esqueciHref}>{t("forgotPassword")}</a>
                <a href={`/entrar/criar?volta=${v}`} className="font-semibold">{t("createAccount")}</a>
              </div>
            </form>
          ) : null}
          {!online ? <p className="text-[13px] text-muted">{t("needsInternet")}</p> : null}
        </div>
      )}
      {nenhum && erro ? <p role="alert" className="text-sm text-danger">{erro}</p> : null}
      <p className="text-[13px] text-muted">{t("signInPrivacy")}</p>
    </TelaConta>
  );
}
