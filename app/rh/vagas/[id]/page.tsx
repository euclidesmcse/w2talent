"use client";
/**
 * 2.4b Candidaturas da vaga (plano 2.4 aprovado pelo Euclides em 2026-11-18).
 * As candidaturas que chegaram, da maior para a menor compatibilidade, com a etapa de cada uma
 * (1 clique, sem arrastar: D2). Abrir a ficha marca a candidatura como vista para o candidato (D3).
 * Marcar até 10 leva à tela Comparar do 2.3, que também exporta.
 * 2.5a: com o contato liberado (Entrevista em diante), cada linha oferece horários de entrevista.
 * 3.1b: a ordem usa os pesos que a empresa sustenta; ?ordem=padrao (na URL) volta à ordem pela % de match.
 */
import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { AppHeader } from "@/components/app-header";
import { Button, Select, useToast } from "@/components/ui";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { FichaPainel } from "@/components/ficha-painel";
import { tituloDaFicha, useTraducaoFicha } from "@/components/traducao-ficha";
import { DetailModal } from "@/components/detail-modal";
import { MatchCandidatoCell, MatchDaVaga } from "@/components/candidato-match";
import { AgendaEntrevista } from "@/components/agenda-entrevista";
import { contaRecusada, linkEntrar, useConta } from "@/lib/conta-client";
import { selectionStore } from "@/lib/selection-store";
import { ETAPAS, type Etapa } from "@/lib/painel-rh";
import type { CandidaturaRh, VagaDaPagina } from "@/lib/rh-candidaturas";
import type { OrdemInfo } from "@/lib/ranking";
import { OrdemRanking } from "@/components/ordem-ranking";
import { BotaoPdf, CvDocumento } from "@/components/cv-documento";

type Estado =
  | { t: "carregando" }
  | { t: "erro" }
  | { t: "nao_encontrada" }
  | { t: "ok"; vaga: VagaDaPagina; itens: CandidaturaRh[]; total: number; ordem?: OrdemInfo };

const nomeDe = (it: CandidaturaRh) => String(it.candidato.nome ?? "");

export default function CandidaturasDaVagaPage() {
  const t = useTranslations("rh");
  const tr = useTranslations();
  const fmt = useFormatter();
  const locale = useLocale();
  const { show } = useToast();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const conta = useConta();
  const liberado = conta.estado === "ok" && conta.conta?.perfil === "recrutador";
  const [estado, setEstado] = React.useState<Estado>({ t: "carregando" });
  const [filtro, setFiltro] = React.useState<Etapa | null>(null);
  const [salvando, setSalvando] = React.useState<string | null>(null);
  const [aberto, setAberto] = React.useState<string | null>(null);
  const [painelLado, setPainelLado] = React.useState(false);
  const [selecionados, setSelecionados] = React.useState<string[]>([]);
  const gatilho = React.useRef<HTMLElement | null>(null);
  const pedido = React.useRef(0);
  // 3.1b: fica na URL, como os filtros de Candidatos (o link mandado a um colega abre na mesma ordem).
  const [ordemPadrao, setOrdemPadrao] = React.useState(() => {
    try { return typeof window !== "undefined" && new URLSearchParams(window.location.search).get("ordem") === "padrao"; } catch { return false; }
  });

  React.useEffect(() => {
    const mql = window.matchMedia?.("(min-width: 1024px)");
    const update = () => setPainelLado(!!mql?.matches);
    update();
    mql?.addEventListener?.("change", update);
    return () => mql?.removeEventListener?.("change", update);
  }, []);

  React.useEffect(() => {
    const sync = () => { try { setSelecionados([...selectionStore.getState().selectedIds]); } catch {} };
    sync();
    const unsub = selectionStore.subscribe?.(sync);
    return () => { unsub?.(); };
  }, []);

  const carregar = React.useCallback(async () => {
    const meu = ++pedido.current;
    try {
      const qs = new URLSearchParams([["lang", locale], ...(ordemPadrao ? [["ordem", "padrao"] as [string, string]] : [])]);
      const r = await fetch(`/api/rh/vagas/${encodeURIComponent(id)}?${qs.toString()}`, { cache: "no-store" });
      if (meu !== pedido.current) return;
      if (r.status === 401 || r.status === 403) {
        contaRecusada();
        return;
      }
      if (r.status === 404) return setEstado({ t: "nao_encontrada" });
      if (!r.ok) throw new Error(String(r.status));
      const j = (await r.json()) as { vaga: VagaDaPagina; itens: CandidaturaRh[]; total: number; ordem?: OrdemInfo };
      if (meu === pedido.current) setEstado({ t: "ok", ...j });
    } catch {
      if (meu === pedido.current) setEstado({ t: "erro" });
    }
  }, [id, locale, ordemPadrao]);

  const trocarOrdem = (padrao: boolean) => {
    setOrdemPadrao(padrao);
    try {
      const url = new URL(window.location.href);
      if (padrao) url.searchParams.set("ordem", "padrao");
      else url.searchParams.delete("ordem");
      window.history.replaceState(null, "", url.toString());
    } catch {}
  };

  React.useEffect(() => {
    if (liberado && id) void carregar();
  }, [liberado, id, carregar]);

  const nomeEtapa = (e: Etapa) => t(`etapa_${e}`);

  const mudar = async (it: CandidaturaRh, para: Etapa) => {
    if (para === it.etapa) return;
    setSalvando(it.applicationId);
    try {
      const r = await fetch(`/api/rh/candidaturas/${encodeURIComponent(it.applicationId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ de: it.etapa, para }),
      });
      if (r.status === 401 || r.status === 403) return contaRecusada();
      if (r.status === 409 || r.status === 404) {
        show(t("etapaMudou"), "error");
        // a lista é recarregada: o que estiver na tela pode estar velho
        void carregar();
        return;
      }
      if (!r.ok) throw new Error(String(r.status));
      const j = (await r.json()) as { etapa: Etapa; etapaEm: string; contato: CandidaturaRh["contato"] };
      setEstado((e) =>
        e.t === "ok"
          ? { ...e, itens: e.itens.map((x) => (x.applicationId === it.applicationId ? { ...x, etapa: j.etapa, etapaEm: j.etapaEm, contato: j.contato ?? x.contato } : x)) }
          : e,
      );
      show(t("etapaSalva", { nome: nomeDe(it), etapa: nomeEtapa(j.etapa) }), "success");
    } catch {
      show(t("etapaErro"), "error");
    } finally {
      setSalvando(null);
    }
  };

  const abrir = (it: CandidaturaRh, el: HTMLElement) => {
    gatilho.current = el;
    setAberto(it.applicationId);
    // D3: abrir a ficha conta como "Vista" para o candidato. Em segundo plano; a ficha não depende disso.
    fetch(`/api/rh/candidaturas/${encodeURIComponent(it.applicationId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ visto: true }),
      keepalive: true,
    }).catch(() => {});
  };
  const fechar = React.useCallback(() => setAberto(null), []);

  const alternar = (it: CandidaturaRh) => {
    const cid = String(it.candidato.id);
    try {
      selectionStore.rememberLabel?.(cid, [nomeDe(it), it.candidato.titulo].filter(Boolean).join(" · "));
      const r = selectionStore.toggle(cid);
      setSelecionados([...selectionStore.getState().selectedIds]);
      // A seleção é a mesma de Candidatos: cheia, avisa em vez de falhar calada.
      if (r && r.ok === false) show(t("selecaoCheia", { max: 10 }), "error");
    } catch {}
  };

  // 2.7b: a ficha aberta no idioma da tela quando há tradução, com "Ver original".
  const candidatoAberto = estado.t === "ok" && aberto ? estado.itens.find((x) => x.applicationId === aberto)?.candidato ?? null : null;
  const traducao = useTraducaoFicha(candidatoAberto);

  if (!liberado) {
    return (
      <div>
        <AppHeader area="recrutador" active="/rh" />
        <main className="mx-auto max-w-page px-4 py-6 md:px-6">
          <h1 className="text-xl font-semibold">{t("title")}</h1>
          {conta.estado === "carregando" ? (
            <p aria-busy="true" className="mt-4 text-sm text-muted">{tr("common.loading")}</p>
          ) : (
            <div role="status" className="mt-4 rounded-card border border-line bg-surface px-6 py-10 text-center" data-testid="so-recrutador">
              <p className="font-semibold">{t("gateTitle")}</p>
              <p className="mt-1 text-sm text-muted">{conta.estado === "ok" ? t("gateCandidate") : t("gateBody")}</p>
              {conta.estado !== "ok" ? (
                <a href={linkEntrar(`/rh/vagas/${id}`)} className={buttonClasses("primary", "md", "mt-4 hover:no-underline hover:text-white")}>{tr("conta.signIn")}</a>
              ) : null}
            </div>
          )}
        </main>
      </div>
    );
  }

  const itens = estado.t === "ok" ? estado.itens : [];
  const contagem = Object.fromEntries(ETAPAS.map((e) => [e, itens.filter((x) => x.etapa === e).length])) as Record<Etapa, number>;
  const visiveis = filtro ? itens.filter((x) => x.etapa === filtro) : itens;
  const itemAberto = aberto ? itens.find((x) => x.applicationId === aberto) ?? null : null;
  const vagaAtiva = estado.t === "ok" && estado.vaga.status === "ativa" && new Date(estado.vaga.expiresAt).getTime() > Date.now();
  const marcados = new Set(selecionados);
  const compararHref = `/candidatos/comparar${vagaAtiva ? `?vaga=${encodeURIComponent(id)}` : ""}`;
  const antes = itemAberto && estado.t === "ok" ? <><MatchDaVaga vaga={estado.vaga.titulo} match={itemAberto.match} gaps={itemAberto.gaps} />{traducao.aviso}</> : null;
  const painelAberto = painelLado && !!itemAberto;

  return (
    <div className="min-h-screen">
      <AppHeader area="recrutador" active="/rh" />
      <main className={cn("mx-auto px-4 py-6 pb-24 md:px-6", painelAberto ? "max-w-[1480px]" : "max-w-page")}>
        <Link href="/rh" className="text-[13px] font-medium text-brand underline underline-offset-2">{t("voltar")}</Link>
        {estado.t === "nao_encontrada" ? (
          <div role="status" className="mt-4 rounded-card border border-line bg-surface px-6 py-10 text-center" data-testid="rh-vaga-404">
            <h1 className="font-semibold">{t("vagaNaoEncontrada")}</h1>
            <p className="mt-1 text-sm text-muted">{t("vagaNaoEncontradaBody")}</p>
          </div>
        ) : (
          <>
            <h1 className="mt-2 text-xl font-semibold">{estado.t === "ok" ? estado.vaga.titulo : t("title")}</h1>
            <p className="mt-1 text-sm text-muted" aria-live="polite">
              {estado.t === "ok" ? t("vagaLead", { total: estado.total }) : estado.t === "carregando" ? tr("common.loading") : ""}
              {estado.t === "ok" && estado.total > estado.itens.length ? ` ${t("maisDe", { n: estado.itens.length })}` : ""}
            </p>
            {estado.t === "ok" && estado.itens.length > 1 ? <OrdemRanking className="mt-1" ordem={estado.ordem} onTrocar={trocarOrdem} /> : null}
          </>
        )}

        {estado.t === "erro" ? (
          <div role="alert" className="mt-4 rounded-card border border-line bg-surface px-6 py-8 text-center">
            <p className="text-sm">{t("erro")}</p>
            <Button variant="secondary" size="md" className="mt-3" onClick={() => void carregar()}>{t("tentar")}</Button>
          </div>
        ) : null}

        {estado.t === "ok" && itens.length > 0 ? (
          <div role="group" aria-label={t("filtroEtapa")} className="mt-4 flex flex-wrap gap-2" data-testid="rh-filtro-etapa">
            {[null, ...ETAPAS].map((e) => {
              const ativo = filtro === e;
              const n = e ? contagem[e] : itens.length;
              return (
                <button
                  key={e ?? "todas"}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => setFiltro(e)}
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium",
                    ativo ? "border-ink bg-ink text-surface" : "border-line bg-surface text-ink hover:bg-line-soft",
                  )}
                >
                  {e ? nomeEtapa(e) : t("todas")}
                  <span className="tabular-nums">{n}</span>
                </button>
              );
            })}
          </div>
        ) : null}

        {estado.t === "ok" ? (
          <div className={painelAberto ? "mt-4 grid grid-cols-[minmax(0,1fr)_360px] items-start gap-5" : "mt-4"}>
            <section className="min-w-0 rounded-card border border-line bg-surface" aria-label={t("vagasTitle")}>
              {itens.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-muted" data-testid="rh-vaga-vazia">{t("vazioVaga")}</p>
              ) : visiveis.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-muted">{t("nenhumaNaEtapa")}</p>
              ) : (
                <ul className="flex flex-col" data-testid="rh-candidaturas">
                  {visiveis.map((it) => {
                    const nome = nomeDe(it);
                    const cid = String(it.candidato.id);
                    return (
                      <li key={it.applicationId} data-candidatura={it.applicationId} className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-line-soft px-4 py-3.5 first:border-t-0 md:px-5">
                        <input
                          type="checkbox"
                          className="h-5 w-5 shrink-0 cursor-pointer accent-brand"
                          checked={marcados.has(cid)}
                          onChange={() => alternar(it)}
                          aria-label={t("compararDe", { nome })}
                        />
                        <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
                          <span className="font-medium">{nome}</span>
                          <span className="text-[13px] text-muted">{tituloDaFicha(it.candidato)}</span>
                          <span className="text-[12px] text-muted">
                            {t("enviadaEm", { data: fmt.dateTime(new Date(it.enviadaEm), { day: "numeric", month: "short" }) })}
                            {!it.fichaAtiva ? <span className="ml-2 inline-flex whitespace-nowrap h-5 items-center rounded-control bg-neutral-soft px-1.5 text-[11px] text-ink-soft">{t("fichaFora")}</span> : null}
                          </span>
                          {it.contato ? (
                            <span className="flex flex-wrap gap-x-3 text-[13px]" data-testid="rh-contato">
                              <a href={`mailto:${it.contato.email}`} className="text-brand underline underline-offset-2" aria-label={t("contatoEmail", { nome })}>{it.contato.email}</a>
                              {it.contato.celular ? (
                                <a href={`tel:${it.contato.celular.replace(/[^\d+]/g, "")}`} className="text-brand underline underline-offset-2" aria-label={t("contatoTel", { nome })}>{it.contato.celular}</a>
                              ) : null}
                            </span>
                          ) : null}
                        </div>
                        <div className="min-w-[140px] flex-[0_1_200px]"><MatchCandidatoCell match={it.match} gaps={it.gaps} /></div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="w-[170px]">
                          <Select
                            aria-label={t("etapaDe", { nome })}
                            value={it.etapa}
                            disabled={salvando === it.applicationId}
                            onChange={(e) => void mudar(it, e.target.value as Etapa)}
                            className="font-medium"
                            data-testid="rh-etapa"
                          >
                            {ETAPAS.map((e) => <option key={e} value={e}>{nomeEtapa(e)}</option>)}
                          </Select>
                          </div>
                          <button
                            type="button"
                            data-detail-id={it.applicationId}
                            aria-label={t("verFichaDe", { nome })}
                            onClick={(ev) => abrir(it, ev.currentTarget)}
                            className={buttonClasses("secondary", "md")}
                          >
                            {t("verFicha")}
                          </button>
                        </div>
                        {it.contato ? (
                          <AgendaEntrevista
                            applicationId={it.applicationId}
                            nome={nome}
                            entrevista={it.entrevista}
                            onAtualizar={(ent) =>
                              setEstado((e) =>
                                e.t === "ok" ? { ...e, itens: e.itens.map((x) => (x.applicationId === it.applicationId ? { ...x, entrevista: ent } : x)) } : e,
                              )
                            }
                          />
                        ) : null}
                        {it.adaptacao ? (
                          <details className="basis-full rounded-card border border-line-soft bg-canvas px-3.5 py-2.5 text-sm" data-testid="rh-adaptacao">
                            <summary className="cursor-pointer text-[13px] font-medium">
                              {it.adaptacao.cv ? t("adaptacaoComCv") : it.adaptacao.carta ? t("adaptacaoComCarta") : t("adaptacaoTitulo")}
                              <span className="ml-2 font-normal text-muted">{it.adaptacao.ia ? t("adaptacaoIa") : t("adaptacaoCandidato")}</span>
                            </summary>
                            {it.adaptacao.porQue ? (
                              <div className="mt-2">
                                <p className="text-[13px] font-medium text-muted">{t("adaptacaoPorQue")}</p>
                                <p className="mt-1">{it.adaptacao.porQue}</p>
                              </div>
                            ) : null}
                            {it.adaptacao.carta ? (
                              <div className="mt-2">
                                <p className="text-[13px] font-medium text-muted">{t("adaptacaoCarta")}</p>
                                <p className="mt-1 whitespace-pre-line">{it.adaptacao.carta}</p>
                              </div>
                            ) : null}
                            {it.adaptacao.resumo ? (
                              <div className="mt-2">
                                <p className="text-[13px] font-medium text-muted">{t("adaptacaoResumo")}</p>
                                <p className="mt-1">{it.adaptacao.resumo}</p>
                                {it.adaptacao.destaques.length ? (
                                  <ul className="mt-1 list-disc pl-5">
                                    {it.adaptacao.destaques.map((d, k) => <li key={k}>{d}</li>)}
                                  </ul>
                                ) : null}
                              </div>
                            ) : null}
                            {it.adaptacao.cv ? (
                              <div className="mt-3 border-t border-line-soft pt-3" data-testid="rh-adaptacao-cv">
                                <p className="text-[13px] font-medium text-muted">{t("adaptacaoCv")}</p>
                                <div className="mt-2 rounded-card border border-line bg-white p-4">
                                  <CvDocumento cv={it.adaptacao.cv} nome={nomeDe(it)} resumo={it.adaptacao.resumo} porQue={it.adaptacao.porQue} />
                                </div>
                                <div className="mt-2">
                                  <BotaoPdf
                                    label={t("adaptacaoImprimir")}
                                    arquivo={[nomeDe(it), estado.t === "ok" ? estado.vaga.titulo : ""].filter(Boolean).join(" - ")}
                                    documento={<CvDocumento cv={it.adaptacao.cv} nome={nomeDe(it)} resumo={it.adaptacao.resumo} porQue={it.adaptacao.porQue} />}
                                  />
                                </div>
                              </div>
                            ) : null}
                          </details>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
            {painelAberto && itemAberto ? (
              <FichaPainel
                item={traducao.item}
                titulo={nomeDe(itemAberto)}
                antes={antes}
                onClose={fechar}
                triggerRef={gatilho}
                focoVolta={() => document.querySelector<HTMLElement>(`[data-detail-id="${CSS.escape(itemAberto.applicationId)}"]`)}
                vagaSkills={estado.t === "ok" ? estado.vaga.skills : undefined}
              />
            ) : null}
          </div>
        ) : null}

        {!painelLado ? (
          <DetailModal open={!!itemAberto} onClose={fechar} item={traducao.item} triggerRef={gatilho} title={itemAberto ? nomeDe(itemAberto) : ""} antes={antes} vagaSkills={estado.t === "ok" ? estado.vaga.skills : undefined} />
        ) : null}

        {selecionados.length > 0 ? (
          <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur md:px-6">
            <div className="mx-auto flex max-w-page flex-wrap items-center justify-between gap-2">
              <span className="text-[13px] text-muted" aria-live="polite">{t("selecionadosDica", { n: selecionados.length, max: 10 })}</span>
              <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-action="limpar-selecao"
                onClick={() => { try { selectionStore.clear(); } catch {} setSelecionados([]); }}
                className={buttonClasses("secondary", "md")}
              >
                {t("limparSelecao")}
              </button>
              <a href={compararHref} data-action="comparar" className={buttonClasses("primary", "md", "hover:no-underline hover:text-white")}>
                {t("comparar", { n: selecionados.length })}
              </a>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
