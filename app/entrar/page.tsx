"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import { TelaConta, useVolta } from "@/components/tela-conta";
import { destinoDoEstado, useConta } from "@/lib/conta-client";
import { useOnline } from "@/lib/pwa-client";

type Provedor = "google" | "microsoft";
type Turnstile = { render: (el: HTMLElement, o: Record<string, unknown>) => string; reset: (id?: string) => void };

/**
 * Entrar (1.5.5): Google ou Microsoft (contas pessoais e de empresa). Sem senha por enquanto.
 * Com TURNSTILE_SITE_KEY, o desafio da Cloudflare aparece antes dos botões.
 */
export default function EntrarPage() {
  const t = useTranslations("conta");
  const router = useRouter();
  const online = useOnline();
  const info = useConta();
  const voltaLida = useVolta();
  const volta = voltaLida ?? "/vagas";
  const [erro, setErro] = React.useState<string | null>(null);
  const [indo, setIndo] = React.useState<Provedor | null>(null);
  const [captcha, setCaptcha] = React.useState<string | null>(null);
  const caixa = React.useRef<HTMLDivElement>(null);
  const widget = React.useRef<string | null>(null);
  const siteKey = info.config?.turnstileSiteKey ?? null;

  // Já entrou: segue para o próximo passo (código, perfil) ou para onde ia.
  React.useEffect(() => {
    if (!voltaLida) return;
    const d = destinoDoEstado(info.estado, voltaLida);
    if (d) router.replace(d);
  }, [info.estado, voltaLida, router]);

  React.useEffect(() => {
    try { if (new URLSearchParams(window.location.search).get("erro")) setErro(t("errorProvider")); } catch {}
  }, [t]);

  React.useEffect(() => {
    if (!siteKey || !caixa.current) return;
    const w = window as unknown as { turnstile?: Turnstile };
    const desenhar = () => {
      if (!w.turnstile || !caixa.current || widget.current) return;
      widget.current = w.turnstile.render(caixa.current, {
        sitekey: siteKey,
        callback: (tk: string) => setCaptcha(tk),
        "expired-callback": () => setCaptcha(null),
        "error-callback": () => setCaptcha(null),
      });
    };
    if (w.turnstile) return desenhar();
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = desenhar;
    document.head.appendChild(s);
  }, [siteKey]);

  async function entrar(provider: Provedor) {
    setErro(null);
    setIndo(provider);
    try {
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (captcha) headers["x-captcha-response"] = captcha;
      const r = await fetch("/api/auth/sign-in/social", {
        method: "POST",
        headers,
        body: JSON.stringify({
          provider,
          callbackURL: `/entrar/continuar?volta=${encodeURIComponent(volta)}`,
          errorCallbackURL: `/entrar?erro=1&volta=${encodeURIComponent(volta)}`,
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
    setCaptcha(null);
    try { (window as unknown as { turnstile?: Turnstile }).turnstile?.reset(widget.current ?? undefined); } catch {}
  }

  const p = info.config?.provedores;
  const nenhum = info.estado !== "carregando" && !p?.google && !p?.microsoft;
  const travado = !online || !!indo || (!!siteKey && !captcha);

  return (
    <TelaConta titulo={t("signInTitle")}>
      <p className="text-sm text-muted">{t("signInBody")}</p>
      {nenhum ? (
        <p role="status" className="rounded-card border border-warning bg-warning-soft px-3.5 py-2.5 text-[13px] text-warning-ink">
          {info.estado === "erro" ? t("errorLoad") : t("notConfigured")}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {siteKey ? <div ref={caixa} data-testid="turnstile" className="min-h-[65px]" /> : null}
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
          {!online ? <p className="text-[13px] text-muted">{t("needsInternet")}</p> : null}
        </div>
      )}
      {erro ? <p role="alert" className="text-sm text-danger">{erro}</p> : null}
      <p className="text-[13px] text-muted">{t("signInPrivacy")}</p>
    </TelaConta>
  );
}
