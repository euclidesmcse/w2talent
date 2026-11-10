"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { buttonClasses } from "@/components/ui/button";
import { linkEntrar, sair, useConta } from "@/lib/conta-client";

/**
 * Conta no cabeçalho (1.5.5): "Entrar" sem login; com login, o nome e um menu com
 * Segurança e Sair. No celular vira só um ícone (w-8), como o "Instalar app".
 */
export function ContaMenu() {
  const t = useTranslations("conta");
  const info = useConta();
  const caminho = usePathname() ?? "/";
  const [aberto, setAberto] = React.useState(false);
  const [erroSair, setErroSair] = React.useState(false);
  const painel = React.useId();
  const raiz = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (!raiz.current?.contains(e.target as Node)) setAberto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false); };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", esc); };
  }, [aberto]);

  const icone = (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  const classes = buttonClasses("ghost", "sm", "w-8 px-0 md:w-auto md:px-3");

  if (info.estado === "carregando") return <span className="inline-block w-8" aria-hidden="true" />;
  if (info.estado === "erro") return null;
  if (info.estado === "anonimo" || !info.conta) {
    if (caminho.startsWith("/entrar")) return null;
    return (
      <Link href={linkEntrar()} data-action="entrar" className={`${classes} hover:no-underline`} aria-label={t("signIn")}>
        {icone}
        <span className="hidden md:inline">{t("signIn")}</span>
      </Link>
    );
  }

  const nome = info.conta.nome?.split(" ")[0] || t("account");
  return (
    <div ref={raiz} className="relative">
      <button type="button" data-action="conta" className={classes} aria-label={t("accountOf", { nome: info.conta.nome })} aria-expanded={aberto} aria-controls={painel} onClick={() => setAberto((v) => !v)}>
        {icone}
        <span className="hidden max-w-[10rem] truncate md:inline">{nome}</span>
      </button>
      {aberto ? (
        <div id={painel} role="region" aria-label={t("account")} className="absolute right-0 top-full z-50 mt-2 w-64 rounded-card border border-line bg-surface p-3 text-[13px] text-ink shadow-[0_8px_24px_rgba(17,24,39,0.12)]">
          <p className="truncate font-semibold">{info.conta.nome}</p>
          {info.conta.email ? <p className="truncate text-muted">{info.conta.email}</p> : null}
          {info.conta.perfil ? <p className="mt-1 text-muted">{t(info.conta.perfil === "recrutador" ? "perfilRecrutador" : "perfilCandidato")}</p> : null}
          <div className="mt-3 flex flex-col items-start gap-1">
            {info.estado === "ok" || info.estado === "mfa_obrigatorio" ? (
              <Link href="/conta/seguranca" className={buttonClasses("ghost", "sm", "-ml-2 hover:no-underline")} onClick={() => setAberto(false)}>
                {t("security")}
              </Link>
            ) : null}
            <button type="button" data-action="sair" className={buttonClasses("ghost", "sm", "-ml-2")} onClick={async () => { setErroSair(false); if (!(await sair())) setErroSair(true); }}>
              {t("signOut")}
            </button>
            {erroSair ? <p role="alert" className="text-danger">{t("signOutError")}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Link para a outra área: só para quem não entrou (com login, a área vem do perfil da conta). */
export function TrocaDeArea({ href, children }: { href: string; children: React.ReactNode }) {
  const info = useConta();
  if (info.estado === "ok" || info.estado === "mfa" || info.estado === "sem_perfil" || info.estado === "mfa_obrigatorio") return null;
  return (
    <Link href={href} data-area-switch={href} className="hidden text-sm text-brand md:inline">
      {children}
    </Link>
  );
}

/** Convite insistente para o candidato ligar o autenticador (decisão 2). Some só nesta aba ao fechar. */
export function ConviteAutenticador() {
  const t = useTranslations("conta");
  const info = useConta();
  const caminho = usePathname() ?? "/";
  const [fechado, setFechado] = React.useState(true);
  React.useEffect(() => {
    try { setFechado(window.sessionStorage.getItem("w2talent:convite-2fa") === "1"); } catch { setFechado(false); }
  }, []);
  if (fechado || info.estado !== "ok" || info.conta?.perfil !== "candidato" || info.conta?.mfaLigado) return null;
  if (caminho.startsWith("/conta/seguranca") || caminho.startsWith("/entrar")) return null;
  const fechar = () => {
    setFechado(true);
    try { window.sessionStorage.setItem("w2talent:convite-2fa", "1"); } catch {}
  };
  return (
    <div role="status" data-testid="convite-2fa" className="border-b border-line bg-brand-soft">
      <div className="mx-auto flex max-w-page flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-[13px] text-brand-ink md:px-6">
        <span>{t("inviteBody")}</span>
        <Link href="/conta/seguranca" className="font-semibold">{t("inviteCta")}</Link>
        <button type="button" className={buttonClasses("ghost", "sm", "ml-auto")} onClick={fechar}>{t("inviteLater")}</button>
      </div>
    </div>
  );
}
