"use client";
import * as React from "react";
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
  const [q, setQ] = React.useState("");
  const [items, setItems] = React.useState<Item[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [suggestion, setSuggestion] = React.useState<string | null>(null);
  const [emptyCTA, setEmptyCTA] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<string[]>(() => {
    try { return selectionStore.getState().selectedIds ?? []; } catch { return []; }
  });
  const [modalItem, setModalItem] = React.useState<Item | null>(null);
  const [modalOpen, setModalOpen] = React.useState(false);
  const triggerRefs = React.useRef<Map<string, HTMLButtonElement>>(new Map());
  const [activeTrigger, setActiveTrigger] = React.useState<React.RefObject<HTMLElement | null> | undefined>(undefined);

  React.useEffect(() => {
    const sync = () => { try { setSelected([...selectionStore.getState().selectedIds]); } catch {} };
    sync();
    const unsub = selectionStore.subscribe?.(sync);
    return () => { try { (unsub as any)?.(); } catch {} };
  }, []);

  const getLang = () => {
    try {
      const seg = window.location.pathname.split("/").filter(Boolean)[0];
      if (seg === "en") return "en";
      return new URLSearchParams(window.location.search).get("lang") ?? "pt-BR";
    } catch { return "pt-BR"; }
  };

  const fetchPage = React.useCallback(async (query: string, p: number) => {
    const lang = getLang();
    const params = new URLSearchParams({ q: query, page: String(p), pageSize: "20", lang });
    const res = await fetch(`/api/search/candidates?${params.toString()}`);
    const data = await res.json();
    setItems(data.items ?? []);
    setTotal(data.total ?? 0);
    setTotalPages(data.totalPages ?? 1);
    setSuggestion(data.suggestion ?? null);
    setEmptyCTA(data.emptyCTA ?? null);
  }, []);

  React.useEffect(() => { fetchPage(q, page); }, [q, page, fetchPage]);

  const handleClearFilters = () => { setQ(""); setPage(1); fetchPage("", 1); };
  const handleUseSuggestion = (s: string) => { setQ(s); setPage(1); fetchPage(s, 1); };
  const toggle = (id: string) => { const res = selectionStore.toggle(id); setSelected([...selectionStore.getState().selectedIds]); void res; };
  const openDetail = (id: string) => {
    const item = items.find((x) => x.id === id || x.userId === id) ?? null;
    setModalItem(item); setModalOpen(true);
    const btn = triggerRefs.current.get(id);
    if (btn) setActiveTrigger({ current: btn } as any);
  };
  const closeModal = () => setModalOpen(false);
  const selectedSet = React.useMemo(() => new Set(selected), [selected]);
  const isEmpty = items.length === 0;

  return (
    <div>
      <AppHeader nav={[{ href: "/vagas", label: "Vagas", active: false }, { href: "/candidatos", label: "Candidatos", active: true }, { href: "/minhas-candidaturas", label: "Minhas candidaturas" }]} />
      <div className="mx-auto max-w-page px-6 pt-6">
        <h1 className="text-xl font-bold">Candidatos</h1>
        <p className="mt-1 text-sm text-muted">A busca entende sinônimos: AWS e Cloud aparecem juntos.</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Input
            type="search"
            aria-label="busca-candidatos"
            placeholder="Analista Cloud"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            className="max-w-[560px] flex-[1_1_340px]"
          />
          <span className="text-[13px] text-muted">{total} candidatos</span>
        </div>
      </div>

      <div className="mx-auto max-w-page px-6 pt-4 pb-24">
        {suggestion ? <div role="status" aria-label="sugestao" className="mb-3 rounded-card border border-line bg-brand-soft px-3.5 py-2.5 text-[13px] text-brand-ink">Você quis dizer &quot;{suggestion}&quot;? <Button variant="ghost" size="sm" onClick={() => handleUseSuggestion(suggestion)}>Ver sugestão</Button></div> : null}
        {emptyCTA ? <div role="status" aria-label="empty-cta" className="mb-2 text-xs text-muted">{emptyCTA}</div> : null}
        {isEmpty ? <EmptyState query={q} suggestion={suggestion} emptyCTA={emptyCTA} variant="candidatos" onClearFilters={handleClearFilters} onUseSuggestion={handleUseSuggestion} /> : null}
        <div className="hidden md:block">
          <div className="overflow-hidden rounded-card border border-line bg-surface">
            <CandidateTable items={items} selectedIds={selectedSet} onToggle={toggle} onOpenDetail={openDetail} />
          </div>
        </div>
        <div className="md:hidden"><CandidateCards items={items} selectedIds={selectedSet} onToggle={toggle} onOpenDetail={openDetail} /></div>
        <div aria-label="paginacao" className="mt-3.5 flex items-center justify-between gap-2 text-[13px] text-muted">
          <span>Página {page} de {totalPages} — {total} candidatos</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Anterior</Button>
            <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
          </div>
        </div>
        <DetailModal open={modalOpen} onClose={closeModal} item={modalItem} triggerRef={activeTrigger} title={modalItem?.nome ?? modalItem?.titulo ?? "Detalhes do candidato"} />
        <BatchBar variant="candidatos" onAction={(ids) => { void ids; }} />
        <span aria-hidden className="hidden">{items.map((it) => <button key={it.id ?? it.userId} ref={(el) => { if (el) triggerRefs.current.set(it.id ?? it.userId, el); }} aria-label={`lupa-${it.id ?? it.userId}`} onClick={() => openDetail(it.id ?? it.userId)} />)}</span>
      </div>
    </div>
  );
}
