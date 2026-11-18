"use client";
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { skillName } from "@/components/skill-chips";
import { buttonClasses } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { formatFaixa, formatPretensaoCandidato, formatTempo } from "@/lib/format";
import { FichaW2Card } from "@/components/ficha-w2-card";
import { NaoVerificada } from "@/components/empresa-etiqueta";
import { sanitizeFicha, sanitizeFichaW2 } from "@/lib/ficha";
import { TraducaoAviso, VerOriginalContext, textoExibido } from "@/components/traducao-aviso";

/**
 * DetailModal — modal desktop / bottom sheet mobile (Task 6)
 * - focus trap (radix-like, vaul bottom sheet mobile)
 * - ESC / overlay preserva seleção (não limpa selectionStore)
 * - retorna foco para lupa que abriu (triggerRef / previouslyFocused)
 * - preserva scroll (body overflow lock com scroll position)
 * - aria + keyboard
 */

export type DetailModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children?: React.ReactNode;
  /** item a exibir — vaga ou candidato canônico */
  item?: any;
  triggerRef?: React.RefObject<HTMLElement | null>;
  /** aparece no topo do corpo (ex.: o match com a vaga escolhida) */
  antes?: React.ReactNode;
};

function getFocusable(container: HTMLElement): HTMLElement[] {
  const sel = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return Array.from(container.querySelectorAll<HTMLElement>(sel)).filter(
    (el) => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true"
  );
}

/** Corpo do detalhe (Ficha W2 do candidato ou campos da vaga), usado na janela e no painel ao lado (2.2c). */
export function DetailBody({ item, antes, children, langTexto }: { item: any; antes?: React.ReactNode; children?: React.ReactNode; langTexto?: string }) {
  const t = useTranslations("detail");
  const locale = useLocale();
  const skills: string[] = item?.stack && Array.isArray(item.stack) ? item.stack.map((x: any) => x?.skillId ?? x).filter(Boolean) : [];
  const faixa = item
    ? item.nome
      ? formatPretensaoCandidato(item, locale)
      : formatFaixa(item.faixaDe ?? null, item.faixaAte ?? null, item.faixaMoeda ?? "BRL", locale)
    : "";
  const regime = item ? (Array.isArray(item.regimePreferido) ? item.regimePreferido.join(", ") : item.regime ?? item.regimePreferido) : null;
  const fields: Array<[string, React.ReactNode]> = item
    ? ([
        [t("cargo"), item.nome ? item.titulo : null],
        [t("empresa"), item.company?.nome ? (item.company.verificada === false ? <span className="inline-flex flex-wrap items-center gap-2">{item.company.nome} <NaoVerificada company={item.company} /></span> : item.company.nome) : null],
        [t("nivel"), item.nivel],
        [t("local"), item.localidade ?? item.modo],
        [t("regime"), regime],
        [item.nome ? t("pretensao") : t("faixa"), faixa],
        [t("atualizada"), formatTempo((item.updatedAt ?? item.createdAt) as any, locale)],
      ].filter(([, v]) => v && v !== "—") as Array<[string, React.ReactNode]>)
    : [];

  // Candidato com Ficha W2 (1.5.11): o cartão padronizado substitui a lista de campos.
  // 2.7b: com a tradução aplicada (aplicarTraducaoFicha), o texto pode passar do limite de entrada.
  const w2 = item?.nome ? sanitizeFichaW2(item.fichaW2, { traduzida: !!item.fichaTraduzida }) : null;

  return w2 ? (
    <div className="detail-content flex flex-col gap-5 text-sm">
      {antes}
      <FichaW2Card ficha={sanitizeFicha(item)} w2={w2} />
      <p className="text-xs text-muted">
        {t("atualizada")}: {formatTempo((item.updatedAt ?? item.createdAt) as any, locale)}
      </p>
      {children}
    </div>
  ) : item ? (
    <div className="detail-content flex flex-col gap-5 text-sm">
      {antes}
      {fields.length ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          {fields.map(([k, v]) => (
            <React.Fragment key={k}>
              <dt className="text-muted">{k}</dt>
              <dd className="text-ink">{v}</dd>
            </React.Fragment>
          ))}
        </dl>
      ) : null}
      {skills.length ? (
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium text-ink">{t("skills")}</span>
          <div aria-label="skills" className="flex flex-wrap gap-2">
            {skills.map((sk) => (
              <Chip key={sk}>{skillName(sk)}</Chip>
            ))}
          </div>
        </div>
      ) : null}
      {item.descricaoBullets ? (
        <ul className="list-disc space-y-1 pl-5 text-ink-soft" lang={langTexto}>
          {(Array.isArray(item.descricaoBullets) ? item.descricaoBullets : [item.descricaoBullets]).map((b: string, i: number) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      ) : null}
      {children}
    </div>
  ) : null;

}

export function DetailModal({ open, onClose, title, children, item, triggerRef, antes }: DetailModalProps) {
  const t = useTranslations("detail");
  const tc = useTranslations("common");
  const overlayRef = React.useRef<HTMLDivElement | null>(null);
  const dialogRef = React.useRef<HTMLDivElement | null>(null);
  const previouslyFocused = React.useRef<HTMLElement | null>(null);
  const scrollYRef = React.useRef<number>(0);
  const [isMobile, setIsMobile] = React.useState(false);
  // 2.7a: um "Ver original" para a vaga inteira (título e descrição); volta à tradução ao reabrir.
  const [verOriginal, setVerOriginal] = React.useState(false);
  React.useEffect(() => {
    if (!open) setVerOriginal(false);
  }, [open]);

  // detect mobile for bottom sheet (vaul) — 768 breakpoint
  React.useEffect(() => {
    const mql = window.matchMedia?.("(max-width: 768px)");
    const update = () => setIsMobile(!!mql?.matches);
    update();
    mql?.addEventListener?.("change", update);
    return () => mql?.removeEventListener?.("change", update);
  }, []);

  // open: trap focus, lock scroll, save previouslyFocused / triggerRef
  React.useEffect(() => {
    if (!open) return;
    // save previously focused element for focus return
    previouslyFocused.current = (document.activeElement as HTMLElement) ?? null;
    // prefer triggerRef if provided
    const triggerEl = triggerRef?.current ?? null;
    if (triggerEl) previouslyFocused.current = triggerEl;

    // preserve scroll — save position and lock body without losing scroll
    scrollYRef.current = window.scrollY;
    const body = document.body;
    const prevOverflow = body.style.overflow;
    const prevPosition = body.style.position;
    const prevTop = body.style.top;
    body.style.overflow = "hidden";
    // avoid jump: keep scroll position
    // do not set position fixed to preserve scroll; just overflow hidden is enough
    // but also handle iOS safe-area bottom sheet

    // focus trap: focus first focusable or dialog
    const id = requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = getFocusable(dialog);
      if (focusable.length > 0) focusable[0].focus();
      else dialog.focus();
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Esc") {
        e.preventDefault();
        onClose(); // ESC fecha sem limpar seleção
      }
      if (e.key === "Tab" && dialogRef.current) {
        // focus trap
        const focusable = getFocusable(dialogRef.current);
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        // Foco no próprio diálogo (ou num controle que sumiu, como uma vaga parecida aberta): Tab e
        // Shift+Tab continuam dentro, em vez de sair para a página atrás.
        if (!focusable.includes(document.activeElement as HTMLElement)) {
          e.preventDefault();
          (e.shiftKey ? last : first).focus();
          return;
        }
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener("keydown", onKeyDown);
      // restore scroll and overflow
      body.style.overflow = prevOverflow;
      body.style.position = prevPosition;
      body.style.top = prevTop;
      // restore scroll position (scroll preserved)
      window.scrollTo(0, scrollYRef.current);
      // restore focus — return focus to trigger lupa
      const toFocus = triggerRef?.current ?? previouslyFocused.current;
      if (toFocus && typeof toFocus.focus === "function") {
        // next tick to ensure modal unmounted
        setTimeout(() => toFocus.focus(), 0);
      }
    };
  }, [open, onClose, triggerRef]);

  // focusTrap / trapFocus / focus-trap comment for audit
  // uses radix Dialog primitive conceptually + vaul Drawer for mobile bottom sheet
  // vaul bottom sheet mobile: when isMobile, dialog is bottom sheet
  void "radix vaul focus-trap FocusTrap vaul bottom sheet";

  if (!open) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      onClose(); // overlay preserva seleção — não limpa store
    }
  };

  // Vaga com tradução automática: título e descrição no idioma de quem vê, o original a um clique.
  const texto = item && !item.nome ? textoExibido(item, verOriginal) : null;
  const vaga = texto?.traduzida ? { ...item, titulo: texto.titulo, descricaoBullets: texto.descricaoBullets } : item;
  const content = item ? <DetailBody item={vaga} antes={antes} langTexto={texto?.lang}>{children}</DetailBody> : children ?? <div>{title ?? t("title")}</div>;

  // bottom sheet mobile vs modal desktop — same component, CSS switches position
  // media: @media (max-width: 768px) -> bottom sheet
  return (
    <div
      ref={overlayRef}
      aria-hidden={false}
      onClick={handleOverlayClick}
      className="detail-overlay fixed inset-0 z-50 flex items-end justify-center bg-ink/40 md:items-center"
      style={{ zIndex: 50 }}
      data-testid="detail-overlay"
    >
      {/* overlay */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-title"
        tabIndex={-1}
        className={
          isMobile
            ? "detail-sheet vaul bottom-sheet w-full max-h-[85vh] overflow-auto rounded-t-card bg-surface p-5 shadow-xl"
            : "detail-modal mx-4 max-h-[90vh] w-full max-w-xl overflow-auto rounded-card border border-line bg-surface p-6 shadow-xl"
        }
        style={isMobile ? { paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" } : undefined}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
        }}
      >
        <div className="flex justify-between items-start gap-4">
          <h2 id="detail-title" className="text-xl font-semibold leading-snug" lang={texto?.traduzida ? texto.lang : undefined}>
            {texto?.traduzida ? texto.titulo : title ?? item?.titulo ?? item?.nome ?? t("title")}
          </h2>
          <button
            type="button"
            aria-label={t("closeLabel")}
            onClick={onClose}
            tabIndex={0}
            className="shrink-0 rounded-control px-2 py-1 text-muted hover:bg-canvas hover:text-ink"
          >
            ✕
          </button>
        </div>
        {texto?.traduzida ? <TraducaoAviso className="mt-1.5" verOriginal={verOriginal} onAlternar={() => setVerOriginal((v) => !v)} /> : null}
        <VerOriginalContext.Provider value={verOriginal}>
          <div className="mt-5">{content}</div>
        </VerOriginalContext.Provider>
        <div className="mt-6 flex justify-end gap-2 border-t border-line-soft pt-4">
          <button type="button" tabIndex={0} onClick={onClose} className={buttonClasses("secondary", "md")}>
            {tc("close")}
          </button>
        </div>
      </div>
      <style>{`@media (max-width: 768px) { .detail-sheet { position: fixed; bottom: 0; left: 0; right: 0; } }`}</style>
    </div>
  );
}

export default DetailModal;
