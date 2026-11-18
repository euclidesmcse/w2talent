"use client";
/**
 * 2.3 Link para compartilhar a comparação (vale 14 dias, só para quem é da mesma empresa).
 * - `CompartilharComparacao`: botão "Copiar link" na tela Comparar.
 * - `AvisoLinkComparacao`: tela de link vencido, inválido ou de outra empresa (sem nenhum dado de candidato).
 * O token vai depois do "#": não chega ao servidor no endereço nem aos logs.
 */
import * as React from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Button, Input, buttonClasses } from "@/components/ui";
import { intlTag } from "@/lib/locale";

/** Guarda o token durante o login (o "#" se perde no caminho até /entrar). Só nesta aba. */
export const LINK_GUARDADO = "w2_comparar_link";

export function tokenDoEndereco(): string | null {
  try {
    const m = /(?:^#|&)link=([A-Za-z0-9_.-]+)/.exec(window.location.hash);
    if (m) return m[1];
    if (new URLSearchParams(window.location.search).get("compartilhado") === "1") {
      const t = window.sessionStorage.getItem(LINK_GUARDADO);
      window.sessionStorage.removeItem(LINK_GUARDADO);
      if (t && /^[A-Za-z0-9_.-]+$/.test(t)) {
        window.history.replaceState(null, "", `${window.location.pathname}#link=${t}`);
        return t;
      }
    }
  } catch {}
  return null;
}

export function guardarTokenParaLogin(token: string) {
  try {
    window.sessionStorage.setItem(LINK_GUARDADO, token);
  } catch {}
}

export function useDataLonga() {
  const locale = useLocale();
  return (iso: string) => new Date(iso).toLocaleDateString(intlTag(locale), { day: "numeric", month: "long", year: "numeric" });
}

type Estado = { t: "pronto" } | { t: "criando" } | { t: "copiado"; expira: string } | { t: "copiar"; url: string; expira: string } | { t: "erro"; codigo: string };

export function CompartilharComparacao({ ids, vaga }: { ids: string[]; vaga?: string | null }) {
  const t = useTranslations("comparar.link");
  const data = useDataLonga();
  const [estado, setEstado] = React.useState<Estado>({ t: "pronto" });

  // Outra seleção ou outra vaga: o link antigo não vale para a tabela nova.
  const chave = `${ids.join(",")}|${vaga ?? ""}`;
  React.useEffect(() => setEstado({ t: "pronto" }), [chave]);

  async function criar() {
    setEstado({ t: "criando" });
    try {
      const r = await fetch("/api/candidates/comparar/link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids, vaga: vaga || undefined }),
      });
      const j = (await r.json().catch(() => ({}))) as { caminho?: string; expira?: string; error?: string };
      if (!r.ok || !j.caminho || !j.expira) return setEstado({ t: "erro", codigo: j.error ?? "erro" });
      const url = `${window.location.origin}${j.caminho}`;
      try {
        await navigator.clipboard.writeText(url);
        setEstado({ t: "copiado", expira: j.expira });
      } catch {
        // Sem acesso à área de transferência: mostra o link para copiar à mão.
        setEstado({ t: "copiar", url, expira: j.expira });
      }
    } catch {
      setEstado({ t: "erro", codigo: "erro" });
    }
  }

  return (
    <div className="print:hidden">
      <Button variant="secondary" size="md" data-action="compartilhar-link" onClick={criar} disabled={estado.t === "criando"}>
        {estado.t === "criando" ? t("criando") : t("copiar")}
      </Button>
      <div aria-live="polite" className="mt-2 max-w-[520px] text-[13px]">
        {estado.t === "copiado" ? <p className="text-ink" data-testid="link-copiado">{t("copiado", { data: data(estado.expira) })}</p> : null}
        {estado.t === "copiar" ? (
          <>
            <label htmlFor="comparar-link-url" className="block text-ink">{t("copieAbaixo", { data: data(estado.expira) })}</label>
            <Input id="comparar-link-url" readOnly value={estado.url} onFocus={(e) => e.currentTarget.select()} className="mt-1 text-[13px]" />
          </>
        ) : null}
        {estado.t === "erro" ? (
          <p role="alert" className="text-danger">
            {estado.codigo === "sem_empresa" ? t("semEmpresa") : t("erro")}
            {estado.codigo === "sem_empresa" ? <> <Link href="/empresa" className="underline">{t("irEmpresa")}</Link></> : null}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export type ErroLink = "link_vencido" | "link_invalido" | "sem_acesso";

export function AvisoLinkComparacao({ erro }: { erro: ErroLink }) {
  const t = useTranslations("comparar.link");
  const titulo = erro === "link_vencido" ? t("vencidoTitle") : erro === "sem_acesso" ? t("semAcessoTitle") : t("invalidoTitle");
  const corpo = erro === "link_vencido" ? t("vencidoBody") : erro === "sem_acesso" ? t("semAcessoBody") : t("invalidoBody");
  return (
    <div role="status" className="mt-6 rounded-card border border-line bg-surface px-6 py-10 text-center" data-testid={`comparar-${erro}`}>
      <p className="font-semibold">{titulo}</p>
      <p className="mt-1 text-sm text-muted">{corpo}</p>
      <Link href="/candidatos" className={buttonClasses("primary", "md", "mt-4 hover:no-underline hover:text-white")}>{t("irCandidatos")}</Link>
    </div>
  );
}
