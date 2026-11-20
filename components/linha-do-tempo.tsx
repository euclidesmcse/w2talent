"use client";
/**
 * Linha do tempo da carreira (plano 2026-11-20; protótipo https://claude.ai/artifact/GFmWCAANqQX3XaZ7z97mLx).
 * Horizontal quando cabe (≥ 440 px de largura); lista quando o espaço é estreito (celular).
 * Clicar num cargo abre um cartão ligado a ele, com período, tipo, competências e funções;
 * `acoes` põe botões no cartão (CV completo e resumo por IA, PR c).
 * Cálculos em lib/linha-do-tempo.ts. Períodos sem trabalho ficam só como espaço vazio (D6).
 */
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { skillName } from "@/components/skill-chips";
import { cn } from "@/components/ui";
import type { Experiencia, Ficha } from "@/lib/ficha";
import { duracaoMeses, janela, mesAtual, montarCargos, numerosCarreira, type CargoNaLinha } from "@/lib/linha-do-tempo";
import { pesoCompetencia } from "@/lib/taxonomia-proximas";

const LARGURA_MIN = 440;

export type AcoesDoCargo = (cargo: Experiencia, indice: number) => React.ReactNode;

export function LinhaDoTempo({ ficha, vagaSkills = [], acoes, now }: { ficha: Pick<Ficha, "experiencias" | "formacao">; vagaSkills?: string[]; acoes?: AcoesDoCargo; now?: Date }) {
  const t = useTranslations("linhaTempo");
  const tf = useTranslations("ficha");
  const locale = useLocale();
  const hoje = React.useMemo(() => now ?? new Date(), [now]);
  const { cargos, raias } = React.useMemo(() => montarCargos(ficha.experiencias, vagaSkills, hoje), [ficha.experiencias, vagaSkills, hoje]);
  const numeros = React.useMemo(() => numerosCarreira(cargos, vagaSkills.length > 0), [cargos, vagaSkills.length]);
  const formacao = ficha.formacao.filter((f) => Number(f.ano) > 1950);
  const [modo, setModo] = React.useState<"tudo" | "10">("tudo");
  const [aberto, setAberto] = React.useState<number | null>(null);
  const [largura, setLargura] = React.useState(0);
  const caixa = React.useRef<HTMLDivElement>(null);
  const cartaoRef = React.useRef<HTMLDivElement>(null);
  const idBase = React.useId();

  React.useEffect(() => {
    const el = caixa.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setLargura(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  React.useEffect(() => setAberto(null), [modo, ficha.experiencias]);
  React.useEffect(() => {
    if (aberto == null) return;
    cartaoRef.current?.focus({ preventScroll: true });
    // Esc fecha só o cartão (na janela do detalhe, não fecha a janela junto).
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      e.preventDefault();
      fechar();
    };
    window.addEventListener("keydown", esc, true);
    return () => window.removeEventListener("keydown", esc, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  if (!cargos.length) return null;

  const horizontal = largura >= LARGURA_MIN;
  const j = janela(cargos, formacao, modo, hoje);
  const total = j.fim - j.ini;
  const pct = (m: number) => Math.min(100, Math.max(0, ((m - j.ini) / total) * 100));
  const anoIni = Math.ceil(j.ini / 12);
  const anoFim = Math.floor(j.fim / 12);
  const passo = anoFim - anoIni > 14 ? 4 : anoFim - anoIni > 7 ? 2 : 1;
  const anos: number[] = [];
  for (let a = anoIni; a <= anoFim; a++) if (a % passo === 0) anos.push(a);
  const longa = (numeros.mesesCarreira > 0 ? mesAtual(hoje) - Math.min(...cargos.map((c) => c.ini)) : 0) > 11 * 12;
  const visiveis = cargos.filter((c) => c.fim >= j.ini);
  const usadas = Math.max(1, ...visiveis.map((c) => c.raia + 1));
  const temParalelo = cargos.some((c) => c.paralelo);

  const fmtMes = (m: number) => new Intl.DateTimeFormat(locale, { month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(Math.floor(m / 12), m % 12, 1)));
  const duracao = (meses: number) => {
    const a = Math.floor(meses / 12);
    const m = meses % 12;
    return [a ? t("anos", { n: a }) : "", m ? t("meses", { n: m }) : ""].filter(Boolean).join(t("e"));
  };
  const anosDecimal = (meses: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(meses / 12);
  const periodo = (c: CargoNaLinha) => `${fmtMes(c.ini)} – ${c.atual ? t("hoje") : fmtMes(c.fim)} · ${duracao(duracaoMeses(c))}`;
  const rotulo = (c: CargoNaLinha) => [c.cargo || t("semCargo"), c.empresa, c.tipo && c.tipo !== "integral" ? tf(`tipo_${c.tipo}`) : "", periodo(c)].filter(Boolean).join(", ");

  function fechar() {
    const i = aberto;
    setAberto(null);
    if (i != null) requestAnimationFrame(() => document.getElementById(`${idBase}-c${i}`)?.focus({ preventScroll: true }));
  }

  const atual = aberto != null ? cargos.find((c) => c.indice === aberto) ?? null : null;
  // Posição do cartão no modo horizontal: abaixo da barra, preso à largura da caixa.
  let posCartao: { left: number; top: number; seta: number } | null = null;
  if (atual && horizontal && caixa.current) {
    const barra = document.getElementById(`${idBase}-c${atual.indice}`);
    if (barra) {
      const q = caixa.current.getBoundingClientRect();
      const b = barra.getBoundingClientRect();
      const w = Math.min(400, q.width - 8);
      const meio = b.left + b.width / 2 - q.left;
      const left = Math.max(4, Math.min(meio - w / 2, q.width - w - 4));
      posCartao = { left, top: b.bottom - q.top + 12, seta: meio - left };
    }
  }

  const cartao = atual ? (
    <div
      ref={cartaoRef}
      id={`${idBase}-cartao`}
      role="dialog"
      aria-modal="false"
      aria-labelledby={`${idBase}-cartao-titulo`}
      tabIndex={-1}
      data-cartao-cargo={atual.indice}
      className={cn(
        "z-20 rounded-card border border-line bg-surface p-5 text-sm shadow-[0_18px_40px_-12px_rgba(17,24,39,0.35)] outline-none motion-safe:animate-[abre-cartao_220ms_cubic-bezier(.2,.8,.2,1)]",
        posCartao ? "absolute w-[min(400px,calc(100%-8px))]" : "mt-3",
      )}
      style={posCartao ? { left: posCartao.left, top: posCartao.top, transformOrigin: `${posCartao.seta}px 0` } : undefined}
    >
      {posCartao ? (
        <span aria-hidden className="absolute -top-[7px] h-3 w-3 rotate-45 border-l border-t border-line bg-surface" style={{ left: posCartao.seta - 6 }} />
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <h4 id={`${idBase}-cartao-titulo`} className="text-[15px] font-semibold leading-snug text-ink">
          {atual.cargo || t("semCargo")}
        </h4>
        <button type="button" onClick={fechar} aria-label={t("fechar")} className="-mr-2 -mt-1 shrink-0 rounded-control px-2 py-1 text-muted hover:bg-canvas hover:text-ink">
          ×
        </button>
      </div>
      <p className="mt-1 text-[13px] text-muted">
        {[atual.tipo && atual.tipo !== "integral" ? tf(`tipo_${atual.tipo}`) : "", atual.empresa].filter(Boolean).join(" · ")}
        <br />
        <span className="tabular-nums">{periodo(atual)}</span>
      </p>
      {atual.skills.length ? (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={t("competencias")}>
          {atual.skills.map((s) => {
            const bate = vagaSkills.some((v) => pesoCompetencia(s, v) > 0);
            return (
              <li key={s} className={cn("rounded-pill px-2.5 py-0.5 text-[12px] font-medium", bate ? "bg-brand-soft text-brand-ink" : "bg-neutral-soft text-ink-soft")}>
                {skillName(s)}
              </li>
            );
          })}
        </ul>
      ) : null}
      {atual.funcoes.length ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-ink">
          {atual.funcoes.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[13px] text-muted">{t("semFuncoes")}</p>
      )}
      {acoes ? <div className="mt-4 flex flex-wrap gap-2">{acoes(ficha.experiencias[atual.indice], atual.indice)}</div> : null}
    </div>
  ) : null;

  const numerosLista: [string, string][] = [
    [t("anos", { n: Math.floor(numeros.mesesCarreira / 12) }), t("deCarreira")],
    ...(numeros.mesesNaVaga != null ? ([[t("anos", { n: Math.floor(numeros.mesesNaVaga / 12) }), t("ligadosVaga")]] as [string, string][]) : []),
    [String(numeros.empresas), t("empresas", { n: numeros.empresas }).trim()],
    ...(numeros.empresas > 1 ? ([[t("anosCurto", { n: anosDecimal(numeros.mediaPorEmpresa) }), t("mediaEmpresa")]] as [string, string][]) : []),
    ...(numeros.simultaneos.n > 1 ? ([[String(numeros.simultaneos.n), t("simultaneos", { ano: String(numeros.simultaneos.ano) })]] as [string, string][]) : []),
  ];

  return (
    <section data-linha-tempo aria-labelledby={`${idBase}-titulo`} className="rounded-card border border-line bg-surface p-5 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id={`${idBase}-titulo`} className="text-[15px] font-semibold text-ink">
          {t("titulo")}
        </h3>
        {longa && horizontal ? (
          <div role="group" aria-label={t("periodo")} className="inline-flex rounded-pill border border-line p-0.5">
            {(["tudo", "10"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={modo === m}
                data-action={`linha-${m}`}
                onClick={() => setModo(m)}
                className={cn("rounded-pill px-3 py-1 text-[13px] font-medium", modo === m ? "bg-brand-soft text-ink" : "text-muted hover:text-ink")}
              >
                {m === "tudo" ? t("carreiraInteira") : t("ultimos10")}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
        {numerosLista.map(([v, l]) => (
          <div key={l}>
            <dt className="sr-only">{l}</dt>
            <dd className="font-display text-xl font-medium tabular-nums leading-tight text-ink">{v}</dd>
            <dd className="text-[12px] text-muted">{l}</dd>
          </div>
        ))}
      </dl>

      {vagaSkills.length || temParalelo ? (
        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted" aria-label={t("legenda")}>
          {vagaSkills.length ? (
            <li className="flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-2.5 w-4 rounded-[2px] bg-brand-solid" />
              {t("legendaVaga")}
            </li>
          ) : null}
          {vagaSkills.length ? (
            <li className="flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-2.5 w-4 rounded-[2px] border border-line-strong bg-neutral-soft" />
              {t("legendaOutros")}
            </li>
          ) : null}
          {temParalelo ? (
            <li className="flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-2.5 w-4 rounded-[2px] border-2 border-dashed border-line-dashed bg-surface" />
              {t("legendaParalelo")}
            </li>
          ) : null}
        </ul>
      ) : null}

      <div ref={caixa} className="relative mt-4">
        {horizontal ? (
          <div className="pb-2">
            <div className="relative ml-24 h-6 border-b border-line" aria-hidden>
              {anos.map((a) => (
                <span key={a} className="absolute -translate-x-1/2 text-[11px] tabular-nums text-muted" style={{ left: `${pct(a * 12)}%` }}>
                  {a}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-[96px_1fr]">
              <p className="pt-3 text-[12px] font-medium text-muted">{t("experiencia")}</p>
              <ol className="relative py-2" aria-label={t("experiencia")}>
                <span aria-hidden className="absolute inset-y-0 w-0.5 bg-brand" style={{ left: `${pct(mesAtual(hoje) + 1)}%` }} />
                {Array.from({ length: usadas }, (_, r) => (
                  <li key={r} className="relative my-1 h-11 list-none">
                    <ol>
                      {visiveis
                        .filter((c) => c.raia === r)
                        .map((c) => {
                          const left = pct(c.ini);
                          const w = Math.max(pct(c.fim + 1) - left, 1.2);
                          const estreita = (w / 100) * Math.max(0, largura - 96) < 56;
                          return (
                            <li key={c.indice} className="list-none">
                              <button
                                type="button"
                                id={`${idBase}-c${c.indice}`}
                                data-cargo={c.indice}
                                aria-expanded={aberto === c.indice}
                                aria-controls={aberto === c.indice ? `${idBase}-cartao` : undefined}
                                aria-label={rotulo(c)}
                                title={rotulo(c)}
                                onClick={() => (aberto === c.indice ? fechar() : setAberto(c.indice))}
                                className={cn(
                                  "absolute top-0 flex h-11 flex-col justify-center overflow-hidden rounded-[4px] text-left transition-[transform,box-shadow] duration-150 ease-[cubic-bezier(.2,.8,.2,1)] hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                                  estreita ? "px-0" : "px-2",
                                  c.paralelo
                                    ? c.casa
                                      ? "border-2 border-dashed border-brand bg-brand-soft text-ink"
                                      : "border-2 border-dashed border-line-dashed bg-surface text-ink"
                                    : c.casa
                                      ? "bg-brand-solid text-white"
                                      : "border border-line-strong bg-neutral-soft text-ink",
                                  aberto === c.indice && "-translate-y-0.5 shadow-md outline outline-2 outline-offset-2 outline-brand",
                                )}
                                style={{ left: `${left}%`, width: `${w}%` }}
                              >
                                {estreita ? null : (
                                  <>
                                    <span className="truncate text-[12px] font-semibold leading-tight">{c.cargo || t("semCargo")}</span>
                                    <span className="truncate text-[11px] leading-tight opacity-90">
                                      {c.paralelo && c.tipo ? `${tf(`tipo_${c.tipo}`)} · ` : ""}
                                      {c.empresa}
                                    </span>
                                  </>
                                )}
                              </button>
                            </li>
                          );
                        })}
                    </ol>
                  </li>
                ))}
              </ol>
              {formacao.length ? (
                <>
                  <p className="border-t border-dashed border-line pt-3 text-[12px] font-medium text-muted">{t("formacao")}</p>
                  <ul className="relative h-12 border-t border-dashed border-line" aria-label={t("formacao")}>
                    {formacao
                      .filter((f) => Number(f.ano) * 12 >= j.ini)
                      .sort((a, b) => Number(a.ano) - Number(b.ano))
                      .map((f, i) => (
                        <li key={i} className="absolute top-3 -translate-x-1/2 list-none text-center" style={{ left: `${pct(Number(f.ano) * 12 + 6)}%` }}>
                          <span aria-hidden className="mx-auto block h-3 w-3 rotate-45 rounded-[2px] bg-brand" />
                          <span className={cn("block max-w-[120px] truncate text-[11px] text-muted", i % 2 ? "mt-4" : "mt-1")} title={`${f.curso}${f.instituicao ? `, ${f.instituicao}` : ""} (${f.ano})`}>
                            {f.curso || f.instituicao} · {f.ano}
                          </span>
                        </li>
                      ))}
                  </ul>
                </>
              ) : null}
            </div>
            {posCartao ? cartao : null}
          </div>
        ) : (
          <ol className="flex flex-col gap-2" aria-label={t("experiencia")}>
            {[...cargos]
              .sort((a, b) => b.ini - a.ini)
              .map((c) => (
                <li key={c.indice} className="list-none">
                  <button
                    type="button"
                    id={`${idBase}-c${c.indice}`}
                    data-cargo={c.indice}
                    aria-expanded={aberto === c.indice}
                    aria-controls={aberto === c.indice ? `${idBase}-cartao` : undefined}
                    onClick={() => (aberto === c.indice ? fechar() : setAberto(c.indice))}
                    className={cn(
                      "w-full rounded-control border border-line border-l-4 bg-surface px-3 py-2 text-left hover:bg-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                      c.casa ? "border-l-brand-solid" : "border-l-line-strong",
                      c.paralelo && "border-dashed",
                    )}
                  >
                    <span className="block font-semibold text-ink">{c.cargo || t("semCargo")}</span>
                    <span className="block text-[12px] text-muted">
                      {[c.paralelo && c.tipo ? tf(`tipo_${c.tipo}`) : "", c.empresa, periodo(c)].filter(Boolean).join(" · ")}
                    </span>
                  </button>
                  {aberto === c.indice ? cartao : null}
                </li>
              ))}
          </ol>
        )}
      </div>
    </section>
  );
}

export default LinhaDoTempo;
