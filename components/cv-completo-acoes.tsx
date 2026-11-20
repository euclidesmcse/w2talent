"use client";
/**
 * Linha do tempo, PR c (plano 2026-11-20, D3 e D4): botões do cartão do cargo para o recrutador.
 * - "CV completo": painel à direita com o texto do CV (guardado sem contatos), rolado e marcado no cargo.
 * - "Resumo por IA": resumo deste cargo e da carreira, gerado uma vez e guardado; avisa que é feito por IA.
 * Texto e resumo ficam em memória por candidato, então trocar de cargo não busca de novo.
 */
import * as React from "react";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "next-intl";
import { buttonClasses, cn } from "@/components/ui";
import { IaLink } from "@/components/ia-link";
import type { Experiencia } from "@/lib/ficha";
import type { ResumoCv } from "@/lib/cv-resumo";

const textos = new Map<string, Promise<string | null>>();
const resumos = new Map<string, ResumoCv>();

function buscarTexto(profileId: string): Promise<string | null> {
  let p = textos.get(profileId);
  if (!p) {
    p = fetch(`/api/candidates/${encodeURIComponent(profileId)}/cv`, { cache: "no-store" })
      .then(async (r) => (r.ok ? ((await r.json()) as { texto?: string }).texto ?? null : null))
      .catch(() => null);
    // Falhou: tenta de novo na próxima vez.
    p.then((t) => t == null && textos.delete(profileId));
    textos.set(profileId, p);
  }
  return p;
}

/** Linha do CV onde o cargo aparece: a primeira com a empresa; sem ela, a primeira com o nome do cargo. */
export function linhaDoCargo(linhas: string[], cargo: Pick<Experiencia, "cargo" | "empresa">): number {
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  for (const alvo of [cargo.empresa, cargo.cargo].map(norm)) {
    if (alvo.length < 2) continue;
    const i = linhas.findIndex((l) => norm(l).includes(alvo));
    if (i >= 0) return i;
  }
  return -1;
}

export function AcoesCv({ profileId, cargo, indice }: { profileId: string; cargo: Experiencia; indice: number }) {
  const t = useTranslations("linhaTempo");
  const locale = useLocale();
  const chave = `${profileId}:${locale}`;
  const [painel, setPainel] = React.useState(false);
  const [resumo, setResumo] = React.useState<ResumoCv | null>(() => resumos.get(chave) ?? null);
  const [estado, setEstado] = React.useState<"nada" | "carregando" | "erro" | "limite">("nada");
  const botaoCv = React.useRef<HTMLButtonElement>(null);
  const idResumo = React.useId();

  async function pedirResumo() {
    setEstado("carregando");
    try {
      const r = await fetch(`/api/candidates/${encodeURIComponent(profileId)}/cv`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idioma: locale }),
      });
      const j = (await r.json().catch(() => ({}))) as { resumo?: ResumoCv; error?: string };
      if (!r.ok || !j.resumo) return setEstado(j.error === "limite_dia" ? "limite" : "erro");
      resumos.set(chave, j.resumo);
      setResumo(j.resumo);
      setEstado("nada");
    } catch {
      setEstado("erro");
    }
  }

  const doCargo = resumo?.cargos[indice] ?? "";
  return (
    <>
      <button ref={botaoCv} type="button" data-action="cv-completo" className={buttonClasses("secondary", "sm")} onClick={() => setPainel(true)}>
        {t("cvCompleto")}
      </button>
      {!resumo ? (
        <button type="button" data-action="resumo-ia" className={buttonClasses("ghost", "sm")} onClick={pedirResumo} disabled={estado === "carregando"} aria-describedby={idResumo}>
          {estado === "carregando" ? t("resumoCarregando") : t("resumoIa")}
        </button>
      ) : null}
      <div id={idResumo} className="basis-full" aria-live="polite">
        {estado === "erro" || estado === "limite" ? <p className="text-[13px] text-danger">{t(estado === "limite" ? "resumoLimite" : "resumoErro")}</p> : null}
        {resumo ? (
          <div data-resumo-cv className="mt-1 rounded-control border border-line bg-canvas p-3">
            <p className="text-[13px] font-semibold text-ink-soft">{t("resumoCargo")}</p>
            <p className="mt-1 text-ink">{doCargo || <span className="text-muted">{t("resumoSemCargo")}</span>}</p>
            <details className="mt-2">
              <summary className="cursor-pointer text-[13px] font-medium text-ink-soft hover:text-ink">{t("resumoCarreira")}</summary>
              <p className="mt-1 text-ink">{resumo.geral}</p>
            </details>
            <p className="mt-2 text-[12px] text-muted">
              {t("resumoAviso")} · <IaLink ancora="resumo-cv" />
            </p>
          </div>
        ) : null}
      </div>
      {painel ? (
        <PainelCv
          profileId={profileId}
          cargo={cargo}
          onClose={() => {
            setPainel(false);
            requestAnimationFrame(() => botaoCv.current?.focus({ preventScroll: true }));
          }}
        />
      ) : null}
    </>
  );
}

function PainelCv({ profileId, cargo, onClose }: { profileId: string; cargo: Experiencia; onClose: () => void }) {
  const t = useTranslations("linhaTempo");
  const [texto, setTexto] = React.useState<string | null | undefined>(undefined);
  const ref = React.useRef<HTMLDivElement>(null);
  const titulo = React.useRef<HTMLHeadingElement>(null);
  const idTitulo = React.useId();
  const fechar = React.useRef(onClose);
  fechar.current = onClose;

  React.useEffect(() => {
    let vivo = true;
    buscarTexto(profileId).then((x) => vivo && setTexto(x));
    return () => {
      vivo = false;
    };
  }, [profileId]);

  React.useEffect(() => {
    titulo.current?.focus({ preventScroll: true });
    // Esc fecha só o painel; Tab fica dentro dele (a janela do detalhe tem a própria trava de foco).
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        e.preventDefault();
        fechar.current();
        return;
      }
      if (e.key !== "Tab" || !ref.current) return;
      e.stopImmediatePropagation();
      const foco = [...ref.current.querySelectorAll<HTMLElement>("button, [href], [tabindex]:not([tabindex='-1'])")];
      if (!foco.length) return;
      const [primeiro, ultimo] = [foco[0], foco[foco.length - 1]];
      const dentro = ref.current.contains(document.activeElement);
      if (e.shiftKey && (!dentro || document.activeElement === primeiro || document.activeElement === titulo.current)) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && (!dentro || document.activeElement === ultimo)) {
        e.preventDefault();
        primeiro.focus();
      }
    };
    window.addEventListener("keydown", tecla, true);
    return () => window.removeEventListener("keydown", tecla, true);
  }, []);

  const linhas = React.useMemo(() => (texto ?? "").split("\n"), [texto]);
  const marcada = React.useMemo(() => (texto ? linhaDoCargo(linhas, cargo) : -1), [texto, linhas, cargo]);
  // O bloco do cargo: da linha achada até a próxima linha em branco (no máximo 15 linhas).
  const fimMarca = React.useMemo(() => {
    if (marcada < 0) return -1;
    let f = marcada + 1;
    while (f < linhas.length && f - marcada < 15 && linhas[f].trim()) f++;
    return f;
  }, [marcada, linhas]);
  React.useEffect(() => {
    if (marcada < 0) return;
    ref.current?.querySelector("[data-marcada]")?.scrollIntoView({ block: "center" });
  }, [marcada]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <>
      <div aria-hidden className="fixed inset-0 z-[60] bg-[rgba(17,24,39,0.35)]" onClick={onClose} />
      <div
        ref={ref}
        data-cv-painel
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        className="fixed inset-y-0 right-0 z-[61] flex w-full max-w-[560px] flex-col border-l border-line bg-surface shadow-[-18px_0_40px_-12px_rgba(17,24,39,0.35)]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 ref={titulo} id={idTitulo} tabIndex={-1} className="font-display text-lg font-semibold text-ink outline-none">
              {t("cvTitulo")}
            </h2>
            <p className="mt-0.5 text-[13px] text-muted">{t("cvAviso")}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t("fechar")} className="-mr-2 rounded-control px-2 py-1 text-lg text-muted hover:bg-canvas hover:text-ink">
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 text-sm leading-relaxed text-ink" tabIndex={0} aria-label={t("cvTitulo")}>
          {texto === undefined ? (
            <p className="text-muted">{t("cvCarregando")}</p>
          ) : texto === null ? (
            <p className="text-muted">{t("cvIndisponivel")}</p>
          ) : (
            linhas.map((l, i) =>
              l.trim() ? (
                <p
                  key={i}
                  {...(i === marcada ? { "data-marcada": "" } : {})}
                  className={cn(
                    "whitespace-pre-wrap",
                    i >= marcada && i < fimMarca && "-mx-2 bg-brand-soft px-2 text-brand-ink",
                    i === marcada && "rounded-t-control pt-1 font-semibold",
                    i === fimMarca - 1 && "rounded-b-control pb-1",
                  )}
                >
                  {l}
                </p>
              ) : (
                <div key={i} className="h-3" />
              ),
            )
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}
