"use client";
/**
 * Painel do candidato (ideia trazida do portal emagine, aprovada em 2026-11-12).
 * Mostra quanto da ficha está pronto, o que falta para publicar, as candidaturas e a seleção.
 * A ficha vem do rascunho deste navegador (como na "Minha ficha"); publicada e candidaturas, da conta.
 */
import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AppHeader } from "@/components/app-header";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { postEnvio } from "@/lib/envio-client";
import { ehCandidato, linkEntrar, useConta } from "@/lib/conta-client";
import { selectionStore } from "@/lib/selection-store";
import { contarCandidaturas, resumoDoTexto, type ResumoFicha } from "@/lib/painel";

const CHAVE_FICHA = "w2talent:ficha";

function Marca({ feito, n }: { feito: boolean; n?: number }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-bold",
        feito ? "bg-success-soft text-success-ink" : "bg-warning-soft text-warning-ink",
      )}
    >
      {feito ? "✓" : n ?? "•"}
    </span>
  );
}

export default function PainelPage() {
  const t = useTranslations("painel");
  const tf = useTranslations("ficha");
  const conta = useConta();
  const candidato = ehCandidato(conta);
  const [ficha, setFicha] = React.useState<ResumoFicha | null>(null);
  const [publicada, setPublicada] = React.useState<boolean | null>(null);
  const [apps, setApps] = React.useState<{ total: number; vistas: number; respondidas: number } | null>(null);
  const [selecionadas, setSelecionadas] = React.useState(0);

  React.useEffect(() => {
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(CHAVE_FICHA);
    } catch {
      /* navegador sem armazenamento */
    }
    setFicha(resumoDoTexto(raw));
    const sync = () => setSelecionadas(selectionStore.getState().selectedIds.length);
    sync();
    const unsub = selectionStore.subscribe?.(sync);
    return () => { unsub?.(); };
  }, []);

  React.useEffect(() => {
    if (!candidato) return;
    let vivo = true;
    fetch("/api/ficha/publicar")
      .then((r) => r.json())
      .then((j: { publicado?: boolean }) => { if (vivo) setPublicada(j.publicado === true); })
      .catch(() => {});
    postEnvio("enviadas", {})
      .then((r) => (r.ok ? (r.json() as Promise<{ applications?: { status?: string }[] }>) : null))
      .then((j) => { if (vivo && j) setApps(contarCandidaturas(j.applications ?? [])); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [candidato]);

  const primeiroNome = conta.conta?.nome?.trim().split(/\s+/)[0];
  const pct = ficha ? Math.round((ficha.feitos / ficha.total) * 100) : 0;
  const resumo = !ficha
    ? ""
    : publicada
      ? t("leadPublicada")
      : !ficha.comecou
        ? t("leadVazia")
        : ficha.faltas.length
          ? t("leadFaltam", { feitos: ficha.feitos, total: ficha.total, n: ficha.faltas.length })
          : t("leadCompleta");

  const etapas: { chave: string; feito: boolean }[] = ficha
    ? [
        { chave: "etapaCv", feito: ficha.etapas.cv },
        { chave: "etapaCampos", feito: ficha.etapas.campos },
        { chave: "etapaW2", feito: ficha.etapas.w2 },
        { chave: "etapaPublicada", feito: publicada === true },
      ]
    : [];

  return (
    <div className="min-h-screen">
      <AppHeader area="candidato" active="/painel" />
      <main>
        <section className="voltagem">
          <div className="mx-auto flex max-w-page flex-col gap-1 px-4 py-8 md:px-6 md:py-10">
            <h1 className="text-[28px] font-semibold leading-tight md:text-[32px]">
              {primeiroNome && candidato ? t("titleNome", { nome: primeiroNome }) : t("title")}
            </h1>
            <p className="voltagem-apoio min-h-[3em] text-[15px] md:min-h-[1.5em]" aria-live="polite">{resumo}</p>
          </div>
        </section>

        {/* Os cartões só aparecem depois de ler a ficha deste navegador: aparecer não desloca a tela, trocar de conteúdo sim. */}
        {ficha ? (
        <div className="mx-auto grid max-w-page gap-4 px-4 py-6 md:px-6 lg:grid-cols-[5fr_7fr]">
          {/* Sua ficha: progresso e as quatro etapas da "Minha ficha" */}
          <section aria-labelledby="painel-ficha" className="flex flex-col gap-4 self-start rounded-card border border-line bg-surface p-5">
            <h2 id="painel-ficha" className="text-lg font-semibold">{t("fichaTitle")}</h2>
            <div className="flex flex-col gap-2">
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={ficha?.total ?? 12}
                aria-valuenow={ficha?.feitos ?? 0}
                aria-label={t("progressoLabel")}
                className="h-2 overflow-hidden rounded-full bg-line"
              >
                <div className="relevo-barra h-full rounded-full" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-[13px] text-muted tabular-nums" data-testid="painel-progresso">
                {ficha ? t("progresso", { feitos: ficha.feitos, total: ficha.total }) : "…"}
              </p>
            </div>
            <ol className="flex flex-col">
              {etapas.map((e) => (
                <li key={e.chave} data-etapa={e.chave} data-feito={e.feito ? "true" : "false"} className="flex items-center gap-3 border-t border-line-soft py-2.5 text-sm first:border-t-0">
                  <Marca feito={e.feito} />
                  <span className={e.feito ? "text-ink" : "text-muted"}>{t(e.chave)}</span>
                  <span className="sr-only">{e.feito ? t("feito") : t("pendente")}</span>
                </li>
              ))}
            </ol>
            <Link href="/minha-ficha" className={buttonClasses("primary", "md", "self-start hover:no-underline hover:text-white")}>
              {ficha?.comecou ? t("continuarFicha") : t("comecarFicha")}
            </Link>
          </section>

          <div className="flex min-w-0 flex-col gap-4">
            {/* O que falta: os campos obrigatórios da ficha mínima, na ordem da tela */}
            <section aria-labelledby="painel-falta" className="flex flex-col gap-3 rounded-card border border-line bg-surface p-5">
              <h2 id="painel-falta" className="text-lg font-semibold">{t("faltaTitle")}</h2>
              {!ficha ? null : ficha.faltas.length ? (
                <>
                  <p className="text-sm text-muted">{t("faltaLead")}</p>
                  <ul className="flex flex-col" data-testid="painel-faltas">
                    {ficha.faltas.map((c, i) => (
                      <li key={c} className="flex items-center gap-3 border-t border-line-soft py-2.5 text-sm first:border-t-0">
                        <Marca feito={false} n={i + 1} />
                        <span className="min-w-0 first-letter:uppercase">{tf(`campo_${c}`)}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/minha-ficha" className={buttonClasses("secondary", "md", "self-start hover:no-underline")}>{t("preencher")}</Link>
                </>
              ) : (
                <p className="text-sm text-success-ink" data-testid="painel-completa">{t("faltaNada")}</p>
              )}
            </section>

            {/* Candidaturas e seleção: o resto do caminho (selecionar, aprovar, enviar) */}
            <section aria-labelledby="painel-envios" className="flex flex-col gap-3 rounded-card border border-line bg-surface p-5">
              <h2 id="painel-envios" className="text-lg font-semibold">{t("enviosTitle")}</h2>
              {candidato ? (
                <dl className="grid grid-cols-3 gap-3" data-testid="painel-numeros">
                  {[
                    ["enviadas", apps?.total],
                    ["vistas", apps?.vistas],
                    ["respondidas", apps?.respondidas],
                  ].map(([k, v]) => (
                    <div key={k as string} className="flex flex-col gap-0.5">
                      <dt className="text-[13px] text-muted">{t(k as string)}</dt>
                      <dd className="font-display text-[28px] font-semibold leading-none tabular-nums">{v ?? "…"}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-sm text-muted">{t("entrarParaVer")}</p>
              )}
              <p className="text-sm text-muted" data-testid="painel-selecao">
                {selecionadas ? t("selecionadas", { n: selecionadas }) : t("nenhumaSelecionada")}
              </p>
              <div className="flex flex-wrap gap-2">
                {selecionadas ? (
                  <Link href="/vagas/aprovar" className={buttonClasses("primary", "md", "hover:no-underline hover:text-white")}>{t("revisar")}</Link>
                ) : (
                  <Link href="/vagas" className={buttonClasses("primary", "md", "hover:no-underline hover:text-white")}>{t("buscar")}</Link>
                )}
                {candidato ? (
                  <Link href="/minhas-candidaturas" className={buttonClasses("secondary", "md", "hover:no-underline")}>{t("verCandidaturas")}</Link>
                ) : (
                  <Link href={linkEntrar("/painel")} className={buttonClasses("secondary", "md", "hover:no-underline")}>{t("entrar")}</Link>
                )}
              </div>
            </section>
          </div>
        </div>
        ) : null}
      </main>
    </div>
  );
}
