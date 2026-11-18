"use client";
/**
 * 2.3a Comparar candidatos (plano 2.3, aprovado pelo Euclides em 2026-11-18): os selecionados em
 * Candidatos (até 10) lado a lado, candidatos em colunas e campos da Ficha W2 em linhas (D2),
 * com o match da vaga de referência escolhida. Contato só mascarado (D3).
 */
import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AppHeader } from "@/components/app-header";
import { Button, Field, Select } from "@/components/ui";
import { buttonClasses } from "@/components/ui/button";
import { linkEntrar, useConta } from "@/lib/conta-client";
import { selectionStore } from "@/lib/selection-store";
import { useLinhasComparacao } from "@/components/comparar-linhas";
import type { VagaOpcao } from "@/components/candidatos-filtros";
import type { ItemComparacao } from "@/lib/comparar";

type Estado =
  | { t: "carregando" }
  | { t: "vazio" }
  | { t: "erro" }
  | { t: "pronto"; itens: ItemComparacao[]; fora: number; vaga: { id: string; titulo: string } | null };

function lerSelecao(): string[] {
  try {
    return [...(selectionStore.getState().selectedIds ?? [])];
  } catch {
    return [];
  }
}

export default function CompararPage() {
  const t = useTranslations("comparar");
  const tr = useTranslations();
  const conta = useConta();
  const liberado = conta.estado === "ok" && conta.conta?.perfil === "recrutador";
  const [vaga, setVaga] = React.useState<string | undefined>(undefined);
  const [pronto, setPronto] = React.useState(false);
  const [vagas, setVagas] = React.useState<VagaOpcao[] | null>(null);
  const [vagaSumiu, setVagaSumiu] = React.useState(false);
  const [estado, setEstado] = React.useState<Estado>({ t: "carregando" });

  React.useEffect(() => {
    try {
      setVaga(new URLSearchParams(window.location.search).get("vaga") || undefined);
    } catch {}
    setPronto(true);
  }, []);

  // A vaga escolhida fica na URL, como em Candidatos.
  React.useEffect(() => {
    if (!pronto) return;
    try {
      const url = new URL(window.location.href);
      if (vaga) url.searchParams.set("vaga", vaga);
      else url.searchParams.delete("vaga");
      window.history.replaceState(null, "", url.toString());
    } catch {}
  }, [vaga, pronto]);

  React.useEffect(() => {
    if (!liberado) return;
    fetch("/api/conta/empresa/vagas", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { vagas: [] }))
      .then((d) => setVagas(Array.isArray(d.vagas) ? d.vagas : []))
      .catch(() => setVagas([]));
  }, [liberado]);

  const ultimo = React.useRef(0);
  React.useEffect(() => {
    if (!liberado || !pronto) return;
    const ids = lerSelecao();
    if (!ids.length) return setEstado({ t: "vazio" });
    const meu = ++ultimo.current;
    setEstado((e) => (e.t === "pronto" ? e : { t: "carregando" }));
    fetch("/api/candidates/comparar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids, vaga }),
    })
      .then(async (r) => {
        if (meu !== ultimo.current) return;
        if (r.status === 404 && vaga) {
          // Vaga vencida, arquivada ou de outra empresa: compara sem ela.
          setVagaSumiu(true);
          setVaga(undefined);
          return;
        }
        if (!r.ok) return setEstado({ t: "erro" });
        const j = (await r.json()) as { itens: ItemComparacao[]; fora: string[]; vaga: { id: string; titulo: string } | null };
        if (meu !== ultimo.current) return;
        setEstado(j.itens.length ? { t: "pronto", itens: j.itens, fora: j.fora.length, vaga: j.vaga } : { t: "vazio" });
      })
      .catch(() => { if (meu === ultimo.current) setEstado({ t: "erro" }); });
  }, [liberado, pronto, vaga]);

  const itens = estado.t === "pronto" ? estado.itens : [];
  const comVaga = estado.t === "pronto" && !!estado.vaga;
  const linhas = useLinhasComparacao(itens, comVaga);
  const voltar = `/candidatos${vaga ? `?vaga=${encodeURIComponent(vaga)}` : ""}`;

  const tirar = (id: string) => {
    try { selectionStore.remove(id); } catch {}
    setEstado((e) => {
      if (e.t !== "pronto") return e;
      const resto = e.itens.filter((it) => it.id !== id);
      return resto.length ? { ...e, itens: resto } : { t: "vazio" };
    });
  };

  if (!liberado) {
    return (
      <div>
        <AppHeader area="recrutador" active="/candidatos" />
        <main className="mx-auto max-w-page px-4 py-6 md:px-6">
          <h1 className="text-xl font-semibold">{t("title")}</h1>
          {conta.estado === "carregando" ? (
            <p aria-busy="true" className="mt-4 text-sm text-muted">{tr("common.loading")}</p>
          ) : (
            <div role="status" className="mt-4 rounded-card border border-line bg-surface px-6 py-10 text-center" data-testid="so-recrutador">
              <p className="font-semibold">{tr("candidatos.gateTitle")}</p>
              <p className="mt-1 text-sm text-muted">{conta.estado === "ok" ? tr("candidatos.gateCandidate") : tr("candidatos.gateBody")}</p>
              {conta.estado !== "ok" ? (
                <a href={linkEntrar("/candidatos")} className={buttonClasses("primary", "md", "mt-4 hover:no-underline hover:text-white")}>{tr("conta.signIn")}</a>
              ) : null}
            </div>
          )}
        </main>
      </div>
    );
  }

  return (
    <div>
      <AppHeader area="recrutador" active="/candidatos" />
      <main className="mx-auto max-w-[1480px] px-4 py-6 md:px-6">
        <Link href={voltar} className="text-[13px] font-medium text-brand underline underline-offset-2">{t("voltar")}</Link>
        <h1 className="mt-2 text-xl font-semibold">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted" aria-live="polite">
          {estado.t === "pronto" ? t("lead", { n: estado.itens.length }) : estado.t === "carregando" ? tr("common.loading") : ""}
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <Field label={tr("candidatos.filtros.vaga")} className="min-w-0 max-w-[420px] flex-[1_1_260px]">
            <Select data-testid="comparar-vaga" value={vaga ?? ""} onChange={(e) => { setVagaSumiu(false); setVaga(e.target.value || undefined); }} disabled={!vagas?.length}>
              <option value="">{tr("candidatos.filtros.vagaNenhuma")}</option>
              {(vagas ?? []).map((v) => (
                <option key={v.id} value={v.id}>{v.titulo}</option>
              ))}
            </Select>
          </Field>
        </div>
        {vagaSumiu ? <p role="status" className="mt-2 text-[13px] text-danger">{tr("candidatos.filtros.vagaSumiu")}</p> : null}
        {estado.t === "pronto" && estado.fora > 0 ? <p role="status" className="mt-2 text-[13px] text-muted">{t("fora", { n: estado.fora })}</p> : null}

        {estado.t === "vazio" && (
          <div role="status" className="mt-6 rounded-card border border-line bg-surface px-6 py-10 text-center" data-testid="comparar-vazio">
            <p className="font-semibold">{t("vazioTitle")}</p>
            <p className="mt-1 text-sm text-muted">{t("vazioBody")}</p>
            <Link href={voltar} className={buttonClasses("primary", "md", "mt-4 hover:no-underline hover:text-white")}>{t("irCandidatos")}</Link>
          </div>
        )}
        {estado.t === "erro" && <p role="alert" className="mt-6 text-sm text-danger">{t("erro")}</p>}

        {estado.t === "pronto" && (
          <>
            <div className="mt-5 overflow-x-auto rounded-card border border-line bg-surface" data-testid="comparar-tabela">
              <table className="w-full border-collapse text-sm">
                <caption className="sr-only">{t("caption", { n: itens.length })}</caption>
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className="sticky left-0 z-10 w-[140px] min-w-[120px] bg-surface px-3 py-3 text-left text-xs font-medium text-muted md:w-[180px]">
                      {t("campo")}
                    </th>
                    {itens.map((it) => (
                      <th key={it.id} scope="col" className="min-w-[200px] px-3 py-3 text-left align-top" data-comparar-id={it.id}>
                        <span className="block font-semibold text-ink">{it.nome}</span>
                        <Button variant="ghost" size="sm" className="-ml-2 mt-1" aria-label={t("tirar", { nome: it.nome })} onClick={() => tirar(it.id)}>
                          {t("tirarCurto")}
                        </Button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => (
                    <tr key={l.chave} className="border-t border-line-soft" data-linha={l.chave}>
                      <th scope="row" className="sticky left-0 z-10 bg-surface px-3 py-3 text-left align-top text-[13px] font-medium text-muted">{l.rotulo}</th>
                      {l.valores.map((v, i) => (
                        <td key={itens[i].id} className="whitespace-pre-line px-3 py-3 align-top text-ink">{v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[13px] text-muted">
              {t("rodape")}{" "}
              {comVaga ? <a href="/ia#match" className="text-brand underline">{tr("candidatos.match.comoFunciona")}</a> : null}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
