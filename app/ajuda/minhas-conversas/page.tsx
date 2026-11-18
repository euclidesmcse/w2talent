"use client";
/**
 * 2.6b-2 Minhas conversas (/ajuda/minhas-conversas): as conversas "Falar com uma pessoa" ligadas à
 * conta logada (candidato ou recrutador), atividade mais recente primeiro. Cada uma abre em
 * /ajuda/conversa?id=<id>, autorizada pela sessão, sem o link com código. Sem login (ou com a sessão
 * esperando o código do autenticador), pede para entrar.
 */
import * as React from "react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { AppHeader } from "@/components/app-header";
import { Card, CardBody, buttonClasses } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import { contaRecusada, linkEntrar, useConta } from "@/lib/conta-client";
import type { LinhaMinha } from "@/lib/atendimento";

type Estado = { t: "carregando" } | { t: "login" } | { t: "erro" } | { t: "ok"; conversas: LinhaMinha[] };

const LOGADO = new Set(["ok", "mfa_obrigatorio", "sem_perfil"]);

function situacao(c: LinhaMinha): { chave: "aguardando" | "respondida" | "encerrada"; cls: string } {
  if (c.status === "encerrada") return { chave: "encerrada", cls: "bg-neutral-soft text-ink-soft" };
  if (c.aguardando) return { chave: "aguardando", cls: "bg-brand-soft text-brand-ink" };
  return { chave: "respondida", cls: "bg-success-soft text-success-ink" };
}

function Lista() {
  const t = useTranslations("minhasConversas");
  const fmt = useFormatter();
  const conta = useConta();
  const [estado, setEstado] = React.useState<Estado>({ t: "carregando" });
  const [fuso, setFuso] = React.useState<string | undefined>(undefined);
  const jaConferiu = React.useRef(false);

  React.useEffect(() => {
    setFuso(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  React.useEffect(() => {
    if (conta.estado === "carregando") return;
    if (!LOGADO.has(conta.estado)) {
      setEstado(conta.estado === "erro" ? { t: "erro" } : { t: "login" });
      return;
    }
    let vivo = true;
    (async () => {
      const r = await fetch("/api/ajuda/conversa", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ acao: "minhas" }) });
      if (!vivo) return;
      if (r.status === 401) {
        // Uma vez por tela: a sessão pode ter acabado; a nova leitura roda este efeito de novo.
        if (!jaConferiu.current) { jaConferiu.current = true; contaRecusada(); }
        setEstado({ t: "login" });
        return;
      }
      const j = (await r.json().catch(() => ({}))) as { conversas?: LinhaMinha[] };
      if (!vivo) return;
      setEstado(r.ok && j.conversas ? { t: "ok", conversas: j.conversas } : { t: "erro" });
    })().catch(() => { if (vivo) setEstado({ t: "erro" }); });
    return () => { vivo = false; };
  }, [conta]);

  const quando = (iso: string) => fmt.dateTime(new Date(iso), { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: fuso });

  if (estado.t === "carregando") return <p aria-busy="true" className="text-muted">{t("carregando")}</p>;
  if (estado.t === "erro") return <p role="alert" className="text-ink">{t("erro")}</p>;
  if (estado.t === "login")
    return (
      <div role="status" className="rounded-card border border-line bg-surface px-6 py-8 text-center" data-minhas-login>
        <p className="font-semibold text-ink">{t("loginTitulo")}</p>
        <p className="mt-1 text-sm text-muted">{t("loginTexto")}</p>
        <Link href={linkEntrar("/ajuda/minhas-conversas")} className={buttonClasses("primary", "md", "mt-4 hover:no-underline hover:text-white")}>
          {t("entrar")}
        </Link>
      </div>
    );
  if (!estado.conversas.length)
    return (
      <div role="status" className="rounded-card border border-line bg-surface px-6 py-8 text-center" data-minhas-vazia>
        <p className="font-semibold text-ink">{t("vaziaTitulo")}</p>
        <p className="mt-1 text-sm text-muted">{t("vaziaTexto")}</p>
        <Link href="/ajuda/conversa" className={buttonClasses("primary", "md", "mt-4 hover:no-underline hover:text-white")}>
          {t("abrir")}
        </Link>
      </div>
    );
  return (
    <>
    <ul aria-label={t("lista")} className="flex flex-col gap-2.5">
      {estado.conversas.map((c) => {
        const s = situacao(c);
        return (
          <li key={c.id} data-minha-conversa={c.id} data-status={c.status}>
            <Link
              href={`/ajuda/conversa?id=${encodeURIComponent(c.id)}`}
              className="flex flex-col gap-2 rounded-card border border-line bg-surface p-4 text-ink hover:border-brand hover:no-underline md:flex-row md:items-center md:justify-between md:gap-4"
            >
              <span className="flex min-w-0 flex-col gap-1">
                <span className="break-words font-semibold">{c.assunto || t("semAssunto")}</span>
                <span className="text-[13px] text-muted">
                  {t("ultima")} <time dateTime={c.ultimaEm}>{quando(c.ultimaEm)}</time>
                </span>
              </span>
              <span className={cn("inline-flex h-7 w-fit shrink-0 items-center rounded-control px-2.5 text-[13px] font-medium", s.cls)} data-situacao={s.chave}>
                {t(s.chave)}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
    <div>
      <Link href="/ajuda/conversa" className={buttonClasses("secondary", "sm", "hover:no-underline")} data-action="nova-conversa">{t("nova")}</Link>
    </div>
    </>
  );
}

export default function MinhasConversasPage() {
  const t = useTranslations("minhasConversas");
  return (
    <>
      <AppHeader area="publico" />
      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-8 md:py-12">
        <Link href="/ajuda" className="w-fit text-[14px] font-medium text-brand underline underline-offset-2">{t("voltarAjuda")}</Link>
        <Card>
          <CardBody className="flex flex-col gap-4 p-6">
            <div className="flex flex-col gap-2">
              <h1 className="text-[24px] font-semibold leading-tight">{t("titulo")}</h1>
              <p className="text-ink">{t("lead")}</p>
              <p className="text-[13px] text-muted">{t("guarda")}</p>
            </div>
            <Lista />
          </CardBody>
        </Card>
      </main>
    </>
  );
}
