"use client";
/**
 * 2.3a Comparar candidatos (plano 2.3, aprovado pelo Euclides em 2026-11-18): os selecionados em
 * Candidatos (até 10) lado a lado, candidatos em colunas e campos da Ficha W2 em linhas (D2),
 * com o match da vaga de referência escolhida. Contato só mascarado (D3).
 * 2.3b: exporta a mesma tabela em CSV, Excel ou PDF (impressão), tudo no navegador (D4).
 * Link compartilhado (#link=...): a mesma tabela para quem é da empresa que criou o link, por 14 dias;
 * a vaga vem do link e "Tirar" só tira da tela (a seleção de quem abre não muda).
 */
import * as React from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { AppHeader } from "@/components/app-header";
import { Button, Field, Select } from "@/components/ui";
import { buttonClasses } from "@/components/ui/button";
import { linkEntrar, useConta } from "@/lib/conta-client";
import { selectionStore } from "@/lib/selection-store";
import { useLinhasComparacao } from "@/components/comparar-linhas";
import { aplicarTraducaoFicha, TraducaoFichaAviso } from "@/components/traducao-ficha";
import type { VagaOpcao } from "@/components/candidatos-filtros";
import type { ItemComparacao } from "@/lib/comparar";
import { gerarCsv, gerarXlsx, nomeArquivo, separadorCsv, tabelaPorCandidato } from "@/lib/exportar";
import { AvisoLinkComparacao, CompartilharComparacao, guardarTokenParaLogin, tokenDoEndereco, useDataLonga, type ErroLink } from "@/components/comparar-compartilhar";

type Estado =
  | { t: "carregando" }
  | { t: "vazio" }
  | { t: "erro" }
  | { t: "link"; erro: ErroLink }
  | { t: "pronto"; itens: ItemComparacao[]; fora: number; vaga: { id: string; titulo: string } | null };

function baixar(dados: BlobPart, tipo: string, nome: string) {
  const url = URL.createObjectURL(new Blob([dados], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

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
  const locale = useLocale();
  const conta = useConta();
  const liberado = conta.estado === "ok" && conta.conta?.perfil === "recrutador";
  const [vaga, setVaga] = React.useState<string | undefined>(undefined);
  const [pronto, setPronto] = React.useState(false);
  const [vagas, setVagas] = React.useState<VagaOpcao[] | null>(null);
  const [vagaSumiu, setVagaSumiu] = React.useState(false);
  const [estado, setEstado] = React.useState<Estado>({ t: "carregando" });
  // Link compartilhado: token do "#link=" e até quando vale.
  const [link, setLink] = React.useState<string | null>(null);
  const [linkExpira, setLinkExpira] = React.useState<string | null>(null);
  const dataLonga = useDataLonga();

  React.useEffect(() => {
    const token = tokenDoEndereco();
    setLink(token);
    if (!token) {
      try {
        setVaga(new URLSearchParams(window.location.search).get("vaga") || undefined);
      } catch {}
    }
    setPronto(true);
  }, []);

  // A vaga escolhida fica na URL, como em Candidatos (no link compartilhado, a vaga vem do link).
  React.useEffect(() => {
    if (!pronto || link) return;
    try {
      const url = new URL(window.location.href);
      if (vaga) url.searchParams.set("vaga", vaga);
      else url.searchParams.delete("vaga");
      window.history.replaceState(null, "", url.toString());
    } catch {}
  }, [vaga, pronto, link]);

  React.useEffect(() => {
    if (!liberado || link) return;
    fetch("/api/conta/empresa/vagas", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { vagas: [] }))
      .then((d) => setVagas(Array.isArray(d.vagas) ? d.vagas : []))
      .catch(() => setVagas([]));
  }, [liberado, link]);

  const ultimo = React.useRef(0);
  React.useEffect(() => {
    if (!liberado || !pronto) return;
    if (link) {
      const meu = ++ultimo.current;
      fetch("/api/candidates/comparar/link/abrir", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ t: link, lang: locale }),
      })
        .then(async (r) => {
          if (meu !== ultimo.current) return;
          const j = (await r.json().catch(() => ({}))) as {
            error?: string;
            itens?: ItemComparacao[];
            fora?: string[];
            vaga?: { id: string; titulo: string } | null;
            vagaSumiu?: boolean;
            expira?: string;
          };
          if (meu !== ultimo.current) return;
          if (j.error === "link_vencido" || j.error === "link_invalido" || j.error === "sem_acesso") return setEstado({ t: "link", erro: j.error });
          if (!r.ok || !j.itens) return setEstado({ t: "erro" });
          setVagaSumiu(!!j.vagaSumiu);
          setLinkExpira(j.expira ?? null);
          setEstado(j.itens.length ? { t: "pronto", itens: j.itens, fora: j.fora?.length ?? 0, vaga: j.vaga ?? null } : { t: "vazio" });
        })
        .catch(() => { if (meu === ultimo.current) setEstado({ t: "erro" }); });
      return;
    }
    const ids = lerSelecao();
    if (!ids.length) return setEstado({ t: "vazio" });
    const meu = ++ultimo.current;
    setEstado((e) => (e.t === "pronto" ? e : { t: "carregando" }));
    fetch("/api/candidates/comparar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids, vaga, lang: locale }),
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
        // Quem foi tirado enquanto o pedido estava a caminho não volta para a tabela.
        const atual = new Set(lerSelecao());
        const itensAtuais = j.itens.filter((it) => atual.has(it.id));
        setEstado(itensAtuais.length ? { t: "pronto", itens: itensAtuais, fora: j.fora.length, vaga: j.vaga } : { t: "vazio" });
      })
      .catch(() => { if (meu === ultimo.current) setEstado({ t: "erro" }); });
  }, [liberado, pronto, vaga, locale, link]);

  const itens = estado.t === "pronto" ? estado.itens : [];
  const comVaga = estado.t === "pronto" && !!estado.vaga;
  // Os arquivos (CSV, Excel) saem com o texto original: são o registro. A tela mostra a tradução (2.7b).
  const linhas = useLinhasComparacao(itens, comVaga);
  const [verOriginal, setVerOriginal] = React.useState(false);
  const traduzidos = itens.filter((it) => it.traducao);
  const itensTela = React.useMemo(() => (verOriginal ? itens : itens.map((it) => aplicarTraducaoFicha(it))), [itens, verOriginal]);
  const linhasTela = useLinhasComparacao(itensTela, comVaga);
  const voltar = `/candidatos${vaga ? `?vaga=${encodeURIComponent(vaga)}` : ""}`;

  // 2.3b: o sinal "exportou" vai em segundo plano; o arquivo não depende dele.
  const avisarExportou = (formato: "csv" | "xlsx" | "pdf") => {
    if (estado.t !== "pronto") return;
    fetch("/api/candidates/exportou", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: estado.itens.map((it) => it.id), vaga: estado.vaga?.id, formato }),
      keepalive: true,
    }).catch(() => {});
  };
  const tabela = () => tabelaPorCandidato(t("campo_nome"), itens.map((it) => it.nome), linhas);
  const exportar = (formato: "csv" | "xlsx" | "pdf") => {
    if (formato === "csv") baixar(gerarCsv(tabela(), separadorCsv(locale)), "text/csv;charset=utf-8", nomeArquivo("csv"));
    else if (formato === "xlsx") baixar(gerarXlsx(tabela(), estado.t === "pronto" && estado.vaga ? estado.vaga.titulo : t("title")), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", nomeArquivo("xlsx"));
    else window.print();
    avisarExportou(formato);
  };

  const tirar = (id: string) => {
    if (!link) {
      try { selectionStore.remove(id); } catch {}
    }
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
              {link ? <p className="mt-1 text-sm text-muted">{t("link.gate")}</p> : null}
              {conta.estado !== "ok" ? (
                <a
                  href={link ? linkEntrar("/candidatos/comparar?compartilhado=1") : linkEntrar("/candidatos")}
                  onClick={() => { if (link) guardarTokenParaLogin(link); }}
                  className={buttonClasses("primary", "md", "mt-4 hover:no-underline hover:text-white")}
                >
                  {tr("conta.signIn")}
                </a>
              ) : null}
            </div>
          )}
        </main>
      </div>
    );
  }

  return (
    <div>
      <div className="print:hidden"><AppHeader area="recrutador" active="/candidatos" /></div>
      {/* PDF: a impressão sai deitada, só com o título, a vaga e a tabela. */}
      <style>{"@media print{@page{size:A4 landscape;margin:12mm}}"}</style>
      <main className="mx-auto max-w-[1480px] px-4 py-6 md:px-6 print:max-w-none print:p-0">
        <Link href={voltar} className="text-[13px] font-medium text-brand underline underline-offset-2 print:hidden">{t("voltar")}</Link>
        <h1 className="mt-2 text-xl font-semibold">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted" aria-live="polite">
          {estado.t === "pronto" ? t("lead", { n: estado.itens.length }) : estado.t === "carregando" ? tr("common.loading") : ""}
        </p>

        {estado.t === "pronto" && estado.vaga ? <p className={`mt-1 text-sm print:block ${link ? "" : "hidden"}`}>{t("paraVaga", { vaga: estado.vaga.titulo })}</p> : null}
        {link && linkExpira && estado.t === "pronto" ? (
          <p className="mt-1 text-[13px] text-muted print:hidden" data-testid="comparar-compartilhado">{t("link.aberto", { data: dataLonga(linkExpira) })}</p>
        ) : null}
        <div className="mt-4 flex flex-wrap items-end gap-3 print:hidden">
          {link ? null : <Field label={tr("candidatos.filtros.vaga")} className="min-w-0 max-w-[420px] flex-[1_1_260px]">
            <Select data-testid="comparar-vaga" value={vaga ?? ""} onChange={(e) => { setVagaSumiu(false); setVaga(e.target.value || undefined); }} disabled={!vagas?.length}>
              <option value="">{tr("candidatos.filtros.vagaNenhuma")}</option>
              {(vagas ?? []).map((v) => (
                <option key={v.id} value={v.id}>{v.titulo}</option>
              ))}
            </Select>
          </Field>}
          {estado.t === "pronto" ? (
            <div role="group" aria-label={t("exportar")} className="flex flex-wrap gap-2" data-testid="comparar-exportar">
              <Button variant="secondary" size="md" data-action="exportar-csv" onClick={() => exportar("csv")}>{t("baixarCsv")}</Button>
              <Button variant="secondary" size="md" data-action="exportar-xlsx" onClick={() => exportar("xlsx")}>{t("baixarXlsx")}</Button>
              <Button variant="secondary" size="md" data-action="exportar-pdf" onClick={() => exportar("pdf")}>{t("imprimirPdf")}</Button>
            </div>
          ) : null}
        </div>
        {estado.t === "pronto" ? (
          <div className="mt-3">
            <CompartilharComparacao ids={estado.itens.map((it) => it.id)} vaga={estado.vaga?.id ?? null} />
          </div>
        ) : null}
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
        {estado.t === "link" && <AvisoLinkComparacao erro={estado.erro} />}

        {estado.t === "pronto" && (
          <>
            {traduzidos.length ? (
              <div className="mt-4 print:hidden">
                <TraducaoFichaAviso texto="avisoVarias" idiomaOrigem={traduzidos[0].traducao?.idiomaOrigem ?? ""} original={verOriginal} onAlternar={() => setVerOriginal((v) => !v)} />
              </div>
            ) : null}
            <div className="mt-5 overflow-x-auto rounded-card border border-line bg-surface print:overflow-visible print:border-0" data-testid="comparar-tabela">
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
                        <Button variant="ghost" size="sm" className="-ml-2 mt-1 print:hidden" aria-label={t("tirar", { nome: it.nome })} onClick={() => tirar(it.id)}>
                          {t("tirarCurto")}
                        </Button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {linhasTela.map((l, k) => (
                    <tr key={l.chave} className="border-t border-line-soft" data-linha={l.chave}>
                      <th scope="row" className="sticky left-0 z-10 bg-surface px-3 py-3 text-left align-top text-[13px] font-medium text-muted">{l.rotulo}</th>
                      {l.valores.map((v, i) => {
                        // O PDF (impressão) sai com o texto original, como os outros arquivos.
                        const orig = linhas[k]?.valores[i] ?? v;
                        return (
                          <td key={itens[i].id} className="whitespace-pre-line px-3 py-3 align-top text-ink">
                            {orig === v ? v : <><span className="print:hidden">{v}</span><span className="hidden print:inline">{orig}</span></>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[13px] text-muted print:hidden">
              {t("rodape")}{" "}
              {comVaga ? <a href="/ia#match" className="text-brand underline">{tr("candidatos.match.comoFunciona")}</a> : null}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
