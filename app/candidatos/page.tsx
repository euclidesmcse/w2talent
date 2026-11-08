"use client";
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { AppHeader } from "@/components/app-header";
import { Button, Input } from "@/components/ui";
import { CandidateTable } from "@/components/candidate-table";
import { CandidateCards } from "@/components/candidate-cards";
import { DetailModal } from "@/components/detail-modal";
import { BatchBar } from "@/components/batch-bar";
import { EmptyState } from "@/components/empty-state";
import { selectionStore } from "@/lib/selection-store";

type Item = any;

export default function CandidatosPage() {
  const tr = useTranslations();
  const locale = useLocale();
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

  const fetchPage = React.useCallback(async (query: string, p: number) => {
    const lang = locale;
    const params = new URLSearchParams({ q: query, page: String(p), pageSize: "20", lang });
    const res = await fetch(`/api/search/candidates?${params.toString()}`);
    const data = await res.json();
    setItems(data.items ?? []);
    setTotal(data.total ?? 0);
    setTotalPages(data.totalPages ?? 1);
    setSuggestion(data.suggestion ?? null);
    setEmptyCTA(data.emptyCTA ?? null);
    setLoaded(true);
  }, [locale]);

  React.useEffect(() => { setSearching(true); fetchPage(q, page).catch(() => {}).finally(() => { setLoaded(true); setSearching(false); }); }, [q, page, fetchPage]);

  const handleClearFilters = () => { setDraft(""); setQ(""); setPage(1); };
  const handleUseSuggestion = (s: string) => { setDraft(s); setQ(s); setPage(1); };
  const toggle = (id: string) => { const it = items.find((x) => String(x.id ?? x.userId) === id); if (it) selectionStore.rememberLabel(id, [it.nome, it.titulo].filter(Boolean).join(" · ")); const res = selectionStore.toggle(id); setSelected([...selectionStore.getState().selectedIds]); void res; };
  const openDetail = (id: string) => {
    const item = items.find((x) => x.id === id || x.userId === id) ?? null;
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
      <AppHeader navLabel={tr("nav.main")} nav={[{ href: "/vagas", label: tr("nav.vagas"), active: false }, { href: "/candidatos", label: tr("nav.candidatos"), active: true }, { href: "/minhas-candidaturas", label: tr("nav.minhasCandidaturas"), short: tr("nav.minhasCandidaturasCurto") }]} />
      <main>
      <div className="mx-auto max-w-page px-6 pt-6">
        <h1 className="text-xl font-bold">{tr("candidatos.title")}</h1>
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
          <span aria-live="polite" className="text-[13px] text-muted">{searching && loaded ? tr("common.searching") : tr("candidatos.count", { count: total })}</span>
        </form>
      </div>

      <div className="mx-auto max-w-page px-6 pt-4 pb-24">
        {suggestion ? <div role="status" data-testid="sugestao" className="mb-3 rounded-card border border-line bg-brand-soft px-3.5 py-2.5 text-[13px] text-brand-ink">{tr("empty.didYouMean", { suggestion })} <Button variant="ghost" size="sm" onClick={() => handleUseSuggestion(suggestion)}>{tr("empty.viewSuggestion")}</Button></div> : null}
        {isEmpty ? <EmptyState query={q} suggestion={suggestion} emptyCTA={emptyCTA} variant="candidatos" onClearFilters={handleClearFilters} onUseSuggestion={handleUseSuggestion} /> : null}
        {!loaded ? (
          <div aria-busy="true" aria-label={tr("common.loading")} className="flex min-h-[640px] flex-col gap-px overflow-hidden rounded-card border border-line bg-line-soft">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex h-[70px] items-center gap-4 bg-surface px-4">
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
              <CandidateTable items={items} selectedIds={selectedSet} onToggle={toggle} onOpenDetail={openDetail} />
            </div>
          </div>
          <div className="md:hidden"><CandidateCards items={items} selectedIds={selectedSet} onToggle={toggle} onOpenDetail={openDetail} /></div>
          </div>
        )}
        <nav aria-label={tr("common.pageOf", { page, total: totalPages })} className="mt-3.5 flex items-center justify-between gap-2 text-[13px] text-muted">
          <span>{tr("candidatos.pageSummary", { page, totalPages, count: total })}</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>{tr("common.previous")}</Button>
            <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>{tr("common.next")}</Button>
          </div>
        </nav>
        <DetailModal open={modalOpen} onClose={closeModal} item={modalItem} triggerRef={activeTrigger} title={modalItem?.nome ?? modalItem?.titulo ?? tr("detail.title")} />
        <BatchBar variant="candidatos" onAction={(ids) => { void ids; }} />
      </div>
      </main>
    </div>
  );
}
