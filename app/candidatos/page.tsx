"use client";
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { AppHeader } from "@/components/app-header";
import { Button, Input } from "@/components/ui";
import { CandidateTable } from "@/components/candidate-table";
import { CandidateCards } from "@/components/candidate-cards";
import { DetailModal } from "@/components/detail-modal";
import { FichaPainel } from "@/components/ficha-painel";
import { useTraducaoFicha } from "@/components/traducao-ficha";
import { MatchDaVaga } from "@/components/candidato-match";
import { BatchBar } from "@/components/batch-bar";
import { EmptyState } from "@/components/empty-state";
import { selectionStore } from "@/lib/selection-store";
import { buttonClasses } from "@/components/ui/button";
import { linkEntrar, useConta } from "@/lib/conta-client";
import { CandidatosFiltros, type VagaOpcao } from "@/components/candidatos-filtros";
import { filtrosParaUrl, lerFiltros, type FiltrosCandidatos } from "@/lib/candidatos-filtros";
import { OrdemRanking } from "@/components/ordem-ranking";
import type { OrdemInfo } from "@/lib/ranking";

type Item = any;

export default function CandidatosPage() {
  const tr = useTranslations();
  const locale = useLocale();
  // 1.5.5 (decisão 4): candidatos só para recrutador logado, com o autenticador ligado.
  const conta = useConta();
  const liberado = conta.estado === "ok" && conta.conta?.perfil === "recrutador";
  const [q, setQ] = React.useState("");
  const [draft, setDraft] = React.useState("");
  const [searching, setSearching] = React.useState(false);
  const [items, setItems] = React.useState<Item[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [suggestion, setSuggestion] = React.useState<string | null>(null);
  const [emptyCTA, setEmptyCTA] = React.useState<string | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  const [selected, setSelected] = React.useState<string[]>(() => {
    try { return selectionStore.getState().selectedIds ?? []; } catch { return []; }
  });
  const [modalItem, setModalItem] = React.useState<Item | null>(null);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [activeTrigger, setActiveTrigger] = React.useState<React.RefObject<HTMLElement | null> | undefined>(undefined);
  // 2.2b: filtros e vaga de referência ficam na URL (dá para mandar o link a um colega da empresa).
  const [filtros, setFiltros] = React.useState<FiltrosCandidatos>({ skills: [] });
  const [pronto, setPronto] = React.useState(false);
  const [vagas, setVagas] = React.useState<VagaOpcao[] | null>(null);
  const [vagaSumiu, setVagaSumiu] = React.useState(false);
  // vaga usada na busca que trouxe `items` (o match de cada linha vale só para ela)
  const [itensDaVaga, setItensDaVaga] = React.useState<string | null>(null);
  // 3.1b: ordem da busca com vaga de referência (ajustada pelos pesos da empresa ou padrão).
  const [ordem, setOrdem] = React.useState<OrdemInfo | null>(null);
  // 2.2c: no computador (lg, 1024px+) a Ficha W2 abre num painel ao lado; abaixo disso, na janela.
  const [painelLado, setPainelLado] = React.useState(false);
  React.useEffect(() => {
    const mql = window.matchMedia?.("(min-width: 1024px)");
    const update = () => setPainelLado(!!mql?.matches);
    update();
    mql?.addEventListener?.("change", update);
    return () => mql?.removeEventListener?.("change", update);
  }, []);

  React.useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const q0 = sp.get("q") ?? "";
      setQ(q0);
      setDraft(q0);
      setFiltros(lerFiltros(sp));
    } catch {}
    setPronto(true);
  }, []);

  React.useEffect(() => {
    if (!liberado) return;
    fetch("/api/conta/empresa/vagas", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { vagas: [] }))
      .then((d) => setVagas(Array.isArray(d.vagas) ? d.vagas : []))
      .catch(() => setVagas([]));
  }, [liberado]);

  React.useEffect(() => {
    if (!pronto) return;
    try {
      const url = new URL(window.location.href);
      url.search = new URLSearchParams([...(q ? [["q", q] as [string, string]] : []), ...filtrosParaUrl(filtros)]).toString();
      window.history.replaceState(null, "", url.toString());
    } catch {}
  }, [q, filtros, pronto]);

  const mudarFiltros = (f: FiltrosCandidatos) => { setVagaSumiu(false); setFiltros(f); setPage(1); };

  React.useEffect(() => {
    const sync = () => { try { setSelected([...selectionStore.getState().selectedIds]); } catch {} };
    sync();
    const unsub = selectionStore.subscribe?.(sync);
    return () => { try { (unsub as any)?.(); } catch {} };
  }, []);


  // digitar busca sozinho após uma pausa curta; Enter ou "Buscar" buscam na hora
  React.useEffect(() => {
    if (draft === q) return;
    const t = setTimeout(() => { setQ(draft); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [draft, q]);
  const submitSearch = (e: React.FormEvent) => { e.preventDefault(); setQ(draft); setPage(1); };

  // Só a busca mais recente pode mexer na tela: respostas atrasadas são ignoradas.
  const ultimaBusca = React.useRef(0);
  const fetchPage = React.useCallback(async (query: string, p: number, f: FiltrosCandidatos) => {
    const minha = ++ultimaBusca.current;
    const lang = locale;
    const params = new URLSearchParams([["q", query], ["page", String(p)], ["pageSize", "20"], ["lang", lang], ...filtrosParaUrl(f)]);
    const res = await fetch(`/api/search/candidates?${params.toString()}`);
    if (minha !== ultimaBusca.current) return false;
    if (res.status === 404 && f.vaga) {
      // Vaga vencida, arquivada ou de outra empresa: tira a vaga (se ainda for a escolhida) e busca de novo.
      setVagaSumiu(true);
      setFiltros((atual) => (atual.vaga === f.vaga ? { ...atual, vaga: undefined } : atual));
      return false;
    }
    const data = await res.json();
    if (minha !== ultimaBusca.current) return false;
    setItems(data.items ?? []);
    setItensDaVaga(f.vaga ?? null);
    setOrdem(data.ordem ?? null);
    setTotal(data.total ?? 0);
    setTotalPages(data.totalPages ?? 1);
    setSuggestion(data.suggestion ?? null);
    setEmptyCTA(data.emptyCTA ?? null);
    setLoaded(true);
    return true;
  }, [locale]);

  React.useEffect(() => {
    if (!liberado || !pronto) return;
    setSearching(true);
    const minha = ultimaBusca.current + 1;
    fetchPage(q, page, filtros).catch(() => {}).finally(() => {
      if (minha !== ultimaBusca.current) return;
      setLoaded(true); setSearching(false);
    });
  }, [q, page, filtros, fetchPage, liberado, pronto]);

  const handleClearFilters = () => { setDraft(""); setQ(""); setFiltros((f) => ({ vaga: f.vaga, ordem: f.ordem, skills: [] })); setPage(1); };
  const handleUseSuggestion = (s: string) => { setDraft(s); setQ(s); setPage(1); };
  const toggle = (id: string) => { const it = items.find((x) => String(x.id ?? x.userId) === id); if (it) selectionStore.rememberLabel(id, [it.nome, it.titulo].filter(Boolean).join(" · ")); const res = selectionStore.toggle(id); setSelected([...selectionStore.getState().selectedIds]); void res; };
  const openDetail = (id: string) => {
    const item = items.find((x) => x.id === id || x.userId === id) ?? null;
    setModalItem(item); setModalOpen(true);
    // devolve o foco ao botão "Ver" visível (tabela no computador, cartão no celular)
    const btn = Array.from(document.querySelectorAll<HTMLElement>(`[data-detail-id="${CSS.escape(id)}"]`)).find((el) => el.offsetParent !== null);
    if (btn) setActiveTrigger({ current: btn });
  };
  const closeModal = React.useCallback(() => setModalOpen(false), []);
  const vagaTitulo = filtros.vaga ? vagas?.find((v) => v.id === filtros.vaga)?.titulo ?? null : null;
  // O detalhe aberto acompanha a lista atual: trocar a vaga atualiza o match do mesmo candidato,
  // e enquanto a nova busca não chega (ou se ele saiu da lista) a linha do match some.
  const idDetalhe = modalItem ? String(modalItem.id ?? modalItem.userId) : null;
  const itemDaLista = idDetalhe ? items.find((x) => String(x.id ?? x.userId) === idDetalhe) : undefined;
  const itemDetalhe = itemDaLista ?? modalItem;
  const matchDoDetalhe = filtros.vaga && itensDaVaga === filtros.vaga && itemDaLista && typeof itemDaLista.match === "number"
    ? <MatchDaVaga vaga={vagaTitulo} match={itemDaLista.match} gaps={itemDaLista.gaps} />
    : null;
  const focoVolta = React.useCallback((): HTMLElement | null => {
    if (!idDetalhe) return null;
    const ver = Array.from(document.querySelectorAll<HTMLElement>(`[data-detail-id="${CSS.escape(idDetalhe)}"]`)).find((el) => el.offsetParent !== null);
    return ver ?? document.querySelector<HTMLElement>('form[role="search"] input');
  }, [idDetalhe]);
  // 2.7b: a ficha no idioma da tela quando há tradução, com "Ver original".
  const traducao = useTraducaoFicha(itemDetalhe);
  const antesDetalhe = traducao.aviso || matchDoDetalhe ? <>{matchDoDetalhe}{traducao.aviso}</> : null;
  const tituloDetalhe = itemDetalhe?.nome ?? itemDetalhe?.titulo ?? tr("detail.title");
  const painelAberto = painelLado && modalOpen && !!itemDetalhe;
  // Com o painel aberto a página usa mais da tela, para a tabela não apertar.
  const largura = painelAberto ? "max-w-[1480px]" : "max-w-page";
  const selectedSet = React.useMemo(() => new Set(selected), [selected]);
  const isEmpty = loaded && items.length === 0;

  if (!liberado) {
    // Volta para a mesma busca (vaga e filtros da URL) depois de entrar.
    const aqui = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/candidatos";
    const volta = encodeURIComponent(aqui.startsWith("/candidatos") ? aqui : "/candidatos");
    const proximo =
      conta.estado === "mfa" ? `/entrar/codigo?volta=${volta}`
      : conta.estado === "sem_perfil" ? `/entrar/perfil?volta=${volta}`
      : conta.estado === "mfa_obrigatorio" ? `/conta/seguranca?volta=${volta}`
      : conta.estado === "ok" ? null
      : linkEntrar(aqui.startsWith("/candidatos") ? aqui : "/candidatos");
    const corpo = conta.estado === "ok" ? tr("candidatos.gateCandidate") : conta.estado === "mfa_obrigatorio" ? tr("conta.mfaRequiredBody") : tr("candidatos.gateBody");
    return (
      <div>
        <AppHeader area="recrutador" active="/candidatos" />
        <main className="mx-auto max-w-page px-4 py-6 md:px-6">
          <h1 className="text-xl font-semibold">{tr("candidatos.title")}</h1>
          {conta.estado === "carregando" ? (
            <p aria-busy="true" className="mt-4 text-sm text-muted">{tr("common.loading")}</p>
          ) : (
            <div role="status" data-testid="so-recrutador" className="mt-4 rounded-card border border-line bg-surface px-6 py-10 text-center">
              <p className="font-semibold">{tr("candidatos.gateTitle")}</p>
              <p className="mt-1 text-sm text-muted">{corpo}</p>
              {proximo ? (
                <a href={proximo} className={buttonClasses("primary", "md", "mt-4 hover:no-underline hover:text-white")}>
                  {conta.estado === "mfa_obrigatorio" ? tr("conta.mfaStart") : tr("conta.signIn")}
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
      <AppHeader area="recrutador" active="/candidatos" />
      <main>
      <div className={`mx-auto ${largura} px-6 pt-6`}>
        <h1 className="text-xl font-semibold">{tr("candidatos.title")}</h1>
        <p className="mt-1 text-sm text-muted">{tr("candidatos.subtitle")}</p>
        <form role="search" onSubmit={submitSearch} className="mt-4 flex flex-wrap items-center gap-3">
          <Input
            type="search"
            aria-label={tr("candidatos.searchLabel")}
            placeholder={tr("candidatos.searchPlaceholder")}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="min-w-0 max-w-[560px] flex-[1_1_220px]"
          />
          <Button type="submit" variant="primary" size="md">{tr("common.search")}</Button>
          <span aria-live="polite" className="basis-full text-[13px] text-muted md:basis-auto">{searching && loaded ? tr("common.searching") : tr("candidatos.count", { count: total })}</span>
        </form>
        <CandidatosFiltros filtros={filtros} onChange={mudarFiltros} vagas={vagas} />
        {vagaSumiu ? <p role="status" className="mt-2 text-[13px] text-danger">{tr("candidatos.filtros.vagaSumiu")}</p> : null}
        {filtros.vaga ? (
          <p className="mt-2 text-[13px] text-muted">
            {tr("candidatos.match.explica")} <a href="/ia#match" className="text-brand underline">{tr("candidatos.match.comoFunciona")}</a>
          </p>
        ) : null}
        {filtros.vaga && itensDaVaga === filtros.vaga ? (
          <OrdemRanking className="mt-1" ordem={ordem} onTrocar={(padrao) => mudarFiltros({ ...filtros, ordem: padrao ? "padrao" : undefined })} />
        ) : null}
      </div>

      <div className={`mx-auto ${largura} px-6 pt-4 pb-24`}>
        <div className={painelAberto ? "grid grid-cols-[minmax(0,1fr)_360px] items-start gap-5" : ""}>
        <div className="min-w-0">
        {suggestion ? <div role="status" data-testid="sugestao" className="mb-3 rounded-card border border-line bg-brand-soft px-3.5 py-2.5 text-[13px] text-brand-ink">{tr("empty.didYouMean", { suggestion })} <Button variant="ghost" size="sm" onClick={() => handleUseSuggestion(suggestion)}>{tr("empty.viewSuggestion")}</Button></div> : null}
        {isEmpty ? <EmptyState query={q} suggestion={suggestion} emptyCTA={emptyCTA} variant="candidatos" onClearFilters={handleClearFilters} onUseSuggestion={handleUseSuggestion} /> : null}
        {!loaded ? (
          <div aria-busy="true" aria-label={tr("common.loading")} className="flex min-h-[640px] flex-col gap-px overflow-hidden rounded-card border border-line bg-line-soft">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex h-[72px] items-center gap-4 bg-surface px-4">
                <span className="h-4 w-4 rounded bg-line" />
                <span className="h-3 w-1/3 animate-pulse rounded bg-line" />
                <span className="h-3 w-1/6 animate-pulse rounded bg-line-soft" />
              </div>
            ))}
          </div>
        ) : (
          <div aria-busy={searching} className={`transition-opacity ${searching ? "opacity-60" : ""}`}>
          <div className="hidden md:block">
            <div className="overflow-x-auto rounded-card border border-line bg-surface">
              <CandidateTable items={items} selectedIds={selectedSet} onToggle={toggle} onOpenDetail={openDetail} />
            </div>
          </div>
          <div className="md:hidden"><CandidateCards items={items} selectedIds={selectedSet} onToggle={toggle} onOpenDetail={openDetail} /></div>
          </div>
        )}
        {/* Com uma página só, a paginação some: a contagem já aparece ao lado da busca */}
        {totalPages > 1 ? (
          <nav aria-label={tr("common.pageOf", { page, total: totalPages })} className="mt-3.5 flex items-center justify-between gap-2 text-[13px] text-muted">
            <span>{tr("candidatos.pageSummary", { page, totalPages, count: total })}</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>{tr("common.previous")}</Button>
              <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>{tr("common.next")}</Button>
            </div>
          </nav>
        ) : null}
        </div>
        {painelAberto ? <FichaPainel item={traducao.item} titulo={tituloDetalhe} antes={antesDetalhe} onClose={closeModal} triggerRef={activeTrigger} focoVolta={focoVolta} /> : null}
        </div>
        {!painelLado ? <DetailModal open={modalOpen} onClose={closeModal} item={traducao.item} triggerRef={activeTrigger} title={tituloDetalhe} antes={antesDetalhe} /> : null}
        <BatchBar variant="candidatos" onAction={(ids) => { void ids; }} compararHref={`/candidatos/comparar${filtros.vaga ? `?vaga=${encodeURIComponent(filtros.vaga)}` : ""}`} />
      </div>
      </main>
    </div>
  );
}
