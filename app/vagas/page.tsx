"use client";
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { AppHeader } from "@/components/app-header";
import { Button, Input } from "@/components/ui";
import { VacancyTable } from "@/components/vacancy-table";
import { VacancyCards } from "@/components/vacancy-cards";
import { DetailModal } from "@/components/detail-modal";
import { BatchBar } from "@/components/batch-bar";
import { EmptyState } from "@/components/empty-state";
import { selectionStore } from "@/lib/selection-store";
import { IntentChips } from "@/components/intent-chips";
import { removeChipFromQuery, type IntentChip } from "@/lib/query-intent";
import { emailDaFichaLocal, enviadasDoPerfil, podeEnviar } from "@/lib/envio-client";
import { useRouter } from "next/navigation";
import { dataHoraCurta, lerCopia, salvarCopia, useOnline } from "@/lib/pwa-client";

/** Últimos resultados de busca, para abrir a tela sem internet (1.5.14). Só vagas públicas, nada pessoal. */
const COPIA_BUSCA = "w2talent:ultima-busca";
type CopiaBusca = { q: string; page: number; items: any[]; total: number; totalPages: number; entendeu: IntentChip[] };

type Item = any;

export default function VagasPage() {
  const tr = useTranslations();
  const locale = useLocale();
  const online = useOnline();
  const [copiaDe, setCopiaDe] = React.useState<string | null>(null);
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
  const [ready, setReady] = React.useState(false);
  const [entendeu, setEntendeu] = React.useState<IntentChip[]>([]);
  const [selected, setSelected] = React.useState<string[]>(() => {
    try { return selectionStore.getState().selectedIds ?? []; } catch { return []; }
  });
  const [modalItem, setModalItem] = React.useState<Item | null>(null);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [activeTrigger, setActiveTrigger] = React.useState<React.RefObject<HTMLElement | null> | undefined>(undefined);
  const router = useRouter();
  // 1.5.13: envio ligado só no modo de teste do admin; vagas já enviadas não podem ser marcadas.
  const [envioLigado, setEnvioLigado] = React.useState(false);
  const [enviadas, setEnviadas] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    let vivo = true;
    (async () => {
      if (!(await podeEnviar())) return;
      if (vivo) setEnvioLigado(true);
      const env = await enviadasDoPerfil(emailDaFichaLocal());
      if (!vivo) return;
      setEnviadas(env);
      for (const id of Object.keys(env)) if (selectionStore.getState().selectedIds.includes(id)) selectionStore.remove(id);
    })().catch(() => {});
    return () => { vivo = false; };
  }, []);

  React.useEffect(() => {
    const sync = () => { try { setSelected([...selectionStore.getState().selectedIds]); } catch {} };
    sync();
    const unsub = selectionStore.subscribe?.(sync);
    return () => { try { (unsub as any)?.(); } catch {} };
  }, []);

  // A busca guardada no endereço (/vagas?q=...) volta ao abrir a página e pode ser compartilhada.
  React.useEffect(() => {
    try {
      const initial = (new URLSearchParams(window.location.search).get("q") ?? "").trim().replace(/\s+/g, " ");
      if (initial) { setDraft(initial); setQ(initial); }
    } catch {}
    setReady(true);
  }, []);

  // Busca ao apertar Enter ou "Buscar" (decisão de 09/11: os chips não piscam enquanto digita).
  const runSearch = (next: string) => {
    const clean = next.trim().replace(/\s+/g, " ");
    setDraft(clean); setQ(clean); setPage(1);
    try {
      const url = new URL(window.location.href);
      if (clean) url.searchParams.set("q", clean); else url.searchParams.delete("q");
      window.history.replaceState(null, "", url.toString());
    } catch {}
  };
  const submitSearch = (e: React.FormEvent) => { e.preventDefault(); runSearch(draft); };
  const removeChip = (chip: IntentChip) => runSearch(removeChipFromQuery(q, chip));

  const fetchPage = React.useCallback(async (query: string, p: number) => {
    const lang = locale;
    const params = new URLSearchParams({ q: query, page: String(p), pageSize: "20", lang });
    let data: any;
    try {
      const res = await fetch(`/api/search/vacancies?${params.toString()}`);
      if (!res.ok) throw new Error(String(res.status));
      data = await res.json();
      setCopiaDe(null);
      salvarCopia<CopiaBusca>(COPIA_BUSCA, { q: query, page: p, items: data.items ?? [], total: data.total ?? 0, totalPages: data.totalPages ?? 1, entendeu: Array.isArray(data.entendeu) ? data.entendeu : [] });
    } catch (e) {
      // Sem internet: mostra os últimos resultados salvos neste aparelho, com a data.
      const copia = navigator.onLine ? null : lerCopia<CopiaBusca>(COPIA_BUSCA);
      if (!copia) throw e;
      data = copia.dados;
      setCopiaDe(copia.salvoEm);
      if (copia.dados.q !== query) { setDraft(copia.dados.q); }
    }
    setItems(data.items ?? []);
    setTotal(data.total ?? 0);
    setTotalPages(data.totalPages ?? 1);
    setSuggestion(data.suggestion ?? null);
    setEmptyCTA(data.emptyCTA ?? null);
    setEntendeu(Array.isArray(data.entendeu) ? data.entendeu : []);
    setLoaded(true);
  }, [locale]);

  React.useEffect(() => {
    if (!ready) return;
    setSearching(true);
    fetchPage(q, page).catch(() => {}).finally(() => { setLoaded(true); setSearching(false); });
  }, [ready, q, page, fetchPage]);

  // A internet voltou: troca a cópia salva pelos resultados atuais.
  React.useEffect(() => {
    if (online && copiaDe) fetchPage(q, page).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  const handleClearFilters = () => runSearch("");
  const handleUseSuggestion = (s: string) => runSearch(s);
  const toggle = (id: string) => { if (enviadas[id]) return; const it = items.find((x) => String(x.id ?? x.userId) === id); if (it) selectionStore.rememberLabel(id, it.titulo); const res = selectionStore.toggle(id); setSelected([...selectionStore.getState().selectedIds]); void res; };
  const openDetail = (id: string) => {
    const item = items.find((x) => x.id === id) ?? null;
    setModalItem(item); setModalOpen(true);
    // devolve o foco ao botão "Ver" visível (tabela no computador, cartão no celular)
    const btn = Array.from(document.querySelectorAll<HTMLElement>(`[data-detail-id="${CSS.escape(id)}"]`)).find((el) => el.offsetParent !== null);
    if (btn) setActiveTrigger({ current: btn });
  };
  const closeModal = () => setModalOpen(false);
  const selectedSet = React.useMemo(() => new Set(selected), [selected]);
  const isEmpty = loaded && items.length === 0;

  return (
    <div>
      <AppHeader area="candidato" active="/vagas" />
      <main>
      <div className="mx-auto max-w-page px-4 pt-6 md:px-6">
        <h1 className="text-xl font-semibold">{tr("vagas.title")}</h1>
        <p className="mt-1 text-sm text-muted">{tr("vagas.subtitle")}</p>
        <form role="search" onSubmit={submitSearch} className="mt-4 flex flex-wrap items-center gap-3">
          <Input
            type="search"
            aria-label={tr("vagas.searchLabel")}
            placeholder={tr("vagas.searchPlaceholder")}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="min-w-0 max-w-[560px] flex-[1_1_220px]"
          />
          <Button type="submit" variant="primary" size="md" disabled={!online} title={online ? undefined : tr("pwa.needsInternet")}>{tr("common.search")}</Button>
          <span aria-live="polite" className="basis-full text-[13px] text-muted md:basis-auto">{searching && loaded ? tr("common.searching") : entendeu.length ? "" : tr("vagas.count", { count: total })}</span>
        </form>
        <IntentChips chips={entendeu} total={total} byMatch={items.some((it) => it.match != null)} onRemove={removeChip} />
      </div>

      <div className="mx-auto max-w-page px-4 pt-4 pb-24 md:px-6">
        {copiaDe ? <div role="status" data-testid="copia-busca" className="mb-3 rounded-card border border-warning bg-warning-soft px-3.5 py-2.5 text-[13px] text-warning-ink">{tr("pwa.savedSearch", { date: dataHoraCurta(copiaDe, locale) })}</div> : null}
        {suggestion ? <div role="status" data-testid="sugestao" className="mb-3 rounded-card border border-line bg-brand-soft px-3.5 py-2.5 text-[13px] text-brand-ink">{tr("empty.didYouMean", { suggestion })} <Button variant="ghost" size="sm" onClick={() => handleUseSuggestion(suggestion)}>{tr("empty.viewSuggestion")}</Button></div> : null}
        {isEmpty && !online && !copiaDe ? <div role="status" className="rounded-card border border-line bg-surface px-6 py-10 text-center text-sm"><p className="font-semibold">{tr("pwa.needsInternet")}</p><p className="mt-1 text-muted">{tr("pwa.offlineBody")}</p></div> : null}
        {isEmpty && (online || copiaDe) ? <EmptyState query={q} suggestion={suggestion} emptyCTA={emptyCTA} variant="vagas" onClearFilters={handleClearFilters} onUseSuggestion={handleUseSuggestion} /> : null}
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
            <div className="overflow-hidden rounded-card border border-line bg-surface">
              <VacancyTable items={items} selectedIds={selectedSet} sentAt={enviadas} onToggle={toggle} onOpenDetail={openDetail} />
            </div>
          </div>
          <div className="md:hidden"><VacancyCards items={items} selectedIds={selectedSet} sentAt={enviadas} onToggle={toggle} onOpenDetail={openDetail} /></div>
          </div>
        )}
        {/* Com uma página só, a paginação some: a contagem já aparece ao lado da busca */}
        {totalPages > 1 ? (
          <nav aria-label={tr("common.pageOf", { page, total: totalPages })} className="mt-3.5 flex items-center justify-between gap-2 text-[13px] text-muted">
            <span>{tr("vagas.pageSummary", { page, totalPages, count: total })}</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>{tr("common.previous")}</Button>
              <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>{tr("common.next")}</Button>
            </div>
          </nav>
        ) : null}
        <DetailModal open={modalOpen} onClose={closeModal} item={modalItem} triggerRef={activeTrigger} title={modalItem?.titulo ?? tr("vagas.detailFallback")} />
        <BatchBar variant="vagas" actionEnabled={envioLigado} onAction={() => router.push("/vagas/aprovar")} />
      </div>
      </main>
    </div>
  );
}
