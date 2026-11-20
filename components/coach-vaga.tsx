"use client";
/**
 * Coach IA por vaga (plano 2026-11-20, D1–D5) e CV por vaga (plano 2026-11-20 "CV por vaga", D1–D8):
 * dentro de "O que a empresa recebe" na tela Aprovar. Mostra o que a vaga pede e a ficha não mostra
 * (por regra), o aviso de idioma e o "por que você se destaca", e prepara uma versão do CV, do resumo,
 * dos destaques e uma mensagem para esta vaga, em abas. A IA só usa o que está na ficha e no CV
 * completo; a pessoa confere, edita e escolhe o que vai. Nada sai daqui sem aprovar a vaga.
 */
import * as React from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Button, Field, Input, Textarea } from "@/components/ui";
import { IaLink } from "@/components/ia-link";
import { AvisosVaga } from "@/components/avisos-vaga";
import { BotaoPdf, CvDocumento, type ContatoCv } from "@/components/cv-documento";
import { postEnvio } from "@/lib/envio-client";
import type { Adaptacao, AvisoIdioma, CvVaga, Lacuna, PorQueRegra } from "@/lib/coach-vaga";
import {
  MAX_CARTA_TELA,
  MAX_DESTAQUE_TELA,
  MAX_POR_QUE_TELA,
  MAX_RESUMO_TELA,
  MAX_TITULO_TELA,
  cvDoRascunho,
  periodoCargo,
  rascunhoDaProposta,
  rascunhoManual,
  type RascunhoCargo,
  type RascunhoCoach,
} from "@/lib/coach-rascunho";

type Props = {
  vacancyId: string;
  hash: string | null;
  estado: string;
  lacunas: Lacuna[];
  adaptacao: Adaptacao | null;
  w2: { resumo: string; destaques: string[] };
  rascunho: RascunhoCoach | null;
  onRascunho: (r: RascunhoCoach | null) => void;
  /** Aprovada (desfaça para mudar), enviada ou fora do ar. */
  travado: boolean;
  online: boolean;
  /** A vaga mudou entre mostrar e preparar: a tela recarrega. */
  onMudou: () => void;
  /** Avisa a tela enquanto a IA prepara (Aprovar fica desligado nesse meio-tempo). */
  onPreparando?: (sim: boolean) => void;
  /** CV por vaga: base da ficha, aviso de idioma, "por que" por regra e os dados do PDF. */
  cvBase?: CvVaga | null;
  idiomas?: AvisoIdioma[];
  porQueRegra?: PorQueRegra | null;
  nome?: string;
  vagaTitulo?: string;
};

type Aba = "empresa" | "cv" | "mensagem";
const ABAS: Aba[] = ["empresa", "cv", "mensagem"];

export function CoachVaga({
  vacancyId,
  hash,
  estado,
  lacunas,
  adaptacao,
  w2,
  rascunho,
  onRascunho,
  travado,
  online,
  onMudou,
  onPreparando,
  cvBase = null,
  idiomas = [],
  porQueRegra = null,
  nome = "",
  vagaTitulo = "",
}: Props) {
  const t = useTranslations("aprovar");
  const locale = useLocale();
  const [aceite, setAceite] = React.useState(false);
  const [ocupado, setOcupado] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [aba, setAba] = React.useState<Aba>("empresa");
  const abasRef = React.useRef<Record<Aba, HTMLButtonElement | null>>({ empresa: null, cv: null, mensagem: null });
  const id = (s: string) => `coach-${s}-${vacancyId}`;

  React.useEffect(() => {
    setErro(null);
    setAba("empresa");
  }, [vacancyId]);
  // Resposta que chega depois de a vaga ser aprovada (ou de trocar de vaga) é descartada:
  // o que a tela mostra tem de ser o que foi gravado.
  const atual = React.useRef({ vacancyId, travado });
  atual.current = { vacancyId, travado };

  const preparar = async () => {
    setOcupado(true);
    onPreparando?.(true);
    setErro(null);
    const pedida = vacancyId;
    const valeAinda = () => atual.current.vacancyId === pedida && !atual.current.travado;
    try {
      const r = await fetch("/api/envio/preparar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ vacancyId, hash, aceiteIa: true }),
      });
      const j = await r.json().catch(() => ({}));
      if (!valeAinda()) return;
      if (r.ok && j.proposta) {
        setAba("empresa");
        return onRascunho(rascunhoDaProposta(j.proposta));
      }
      if (r.status === 429) return setErro(t("coachLimite"));
      if (j.error === "sem_ficha_w2") return setErro(t("coachSemW2"));
      if (j.error === "mudou") return onMudou();
      setErro(r.status === 502 ? t("coachIaFalhou") : t("error"));
    } catch {
      if (valeAinda()) setErro(t("error"));
    } finally {
      setOcupado(false);
      onPreparando?.(false);
    }
  };

  const mudar = (p: Partial<RascunhoCoach>) => rascunho && onRascunho({ ...rascunho, ...p });
  const mudarCargo = (i: number, p: Partial<RascunhoCargo>) =>
    rascunho?.cv && mudar({ cv: { ...rascunho.cv, cargos: rascunho.cv.cargos.map((c) => (c.i === i ? { ...c, ...p } : c)) } });
  const contar = (n: number, max: number) => t("coachContador", { n, max });

  const teclaAba = (e: React.KeyboardEvent) => {
    const k = ABAS.indexOf(aba);
    const prox = e.key === "ArrowRight" ? ABAS[(k + 1) % ABAS.length] : e.key === "ArrowLeft" ? ABAS[(k + ABAS.length - 1) % ABAS.length] : null;
    if (!prox) return;
    e.preventDefault();
    setAba(prox);
    abasRef.current[prox]?.focus();
  };

  const cvFinal = cvDoRascunho(rascunho, rascunho?.base ?? cvBase);
  const resumoPdf = rascunho?.usarVersao && rascunho.resumo.trim() ? rascunho.resumo.trim() : w2.resumo;

  return (
    <section aria-labelledby={id("titulo")} data-coach={vacancyId} className="rounded-card border border-line bg-surface p-5 text-sm">
      <h3 id={id("titulo")} className="font-semibold">{t("coachTitulo")}</h3>

      <AvisosVaga porQue={porQueRegra} idiomas={idiomas} className="mt-3" />

      <div className="mt-3">
        <p className="text-[13px] font-medium text-muted">{t("coachLacunasTitulo")}</p>
        {lacunas.length ? (
          <>
            <ul className="mt-1 space-y-1" data-testid="coach-lacunas">
              {lacunas.map((l) => (
                <li key={l.skillId} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-ink">{l.proxima ? t("coachLacunaProxima", { skill: l.nome, proxima: l.proxima }) : l.nome}</span>
                  <Link href={`/mercado?skill=${encodeURIComponent(l.skillId)}`} className="text-[13px]">
                    {t("coachVerMercado")}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-muted">{t("coachLacunasDica")}</p>
          </>
        ) : (
          <p className="mt-1 text-ink-soft">{t("coachSemLacunas")}</p>
        )}
      </div>

      {estado === "mudou" && adaptacao ? (
        <p role="status" className="mt-3 rounded-card border border-warning bg-warning-soft px-3 py-2 text-[13px] text-warning-ink">
          {t("coachVersaoAnterior")}
        </p>
      ) : null}

      {!rascunho ? (
        travado ? null : (
          <div className="mt-4 border-t border-line pt-4">
            <p className="text-ink-soft">{t("coachExplica")}</p>
            <label className="mt-3 flex items-start gap-2 text-[13px]">
              <input type="checkbox" className="mt-0.5 h-4 w-4" checked={aceite} onChange={(e) => setAceite(e.target.checked)} data-testid="coach-aceite" />
              <span>
                {t("coachAceite")} <IaLink ancora="coach-vaga" />
              </span>
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="primary" size="md" data-action="coach-preparar" disabled={!aceite || ocupado || !online} onClick={preparar}>
                {ocupado ? t("coachPreparando") : t("coachPreparar")}
              </Button>
              <Button variant="ghost" size="md" data-action="coach-manual" disabled={ocupado} onClick={() => onRascunho(rascunhoManual(w2, cvBase))}>
                {t("coachManual")}
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted">{t("coachLimiteDica")}</p>
          </div>
        )
      ) : (
        <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4" data-testid="coach-editor">
          {rascunho.ia ? <p className="text-[13px] font-medium text-brand">{t("coachFeitoIa")}</p> : null}
          {rascunho.removidos.length ? (
            <details className="text-[13px] text-ink-soft">
              <summary className="cursor-pointer">{t("coachRemovidos", { count: rascunho.removidos.length })}</summary>
              <ul className="mt-1 list-disc pl-5">
                {rascunho.removidos.map((f, k) => (
                  <li key={k}>{f}</li>
                ))}
              </ul>
            </details>
          ) : null}

          <div role="tablist" aria-label={t("coachAbas")} className="flex flex-wrap gap-1 border-b border-line" onKeyDown={teclaAba}>
            {ABAS.map((a) => (
              <button
                key={a}
                ref={(el) => {
                  abasRef.current[a] = el;
                }}
                type="button"
                role="tab"
                id={id(`aba-${a}`)}
                aria-selected={aba === a}
                aria-controls={id(`painel-${a}`)}
                tabIndex={aba === a ? 0 : -1}
                data-aba={a}
                onClick={() => setAba(a)}
                className={`-mb-px rounded-t-control border-b-2 px-3 py-2 text-[13px] font-medium ${aba === a ? "border-brand text-ink" : "border-transparent text-muted hover:text-ink"}`}
              >
                {t(a === "empresa" ? "coachAbaEmpresa" : a === "cv" ? "coachAbaCv" : "coachAbaMensagem")}
              </button>
            ))}
          </div>

          <div role="tabpanel" id={id("painel-empresa")} aria-labelledby={id("aba-empresa")} hidden={aba !== "empresa"} className={aba === "empresa" ? "flex flex-col gap-3" : "hidden"}>
            <Field label={t("coachPorQue")} hint={contar(rascunho.porQue.length, MAX_POR_QUE_TELA)}>
              <Textarea rows={2} maxLength={MAX_POR_QUE_TELA} value={rascunho.porQue} disabled={travado} onChange={(e) => mudar({ porQue: e.target.value })} data-testid="coach-porque" />
            </Field>
            <label className="flex items-start gap-2 text-[13px] font-medium">
              <input type="checkbox" className="mt-0.5 h-4 w-4" checked={rascunho.usarVersao} disabled={travado} onChange={(e) => mudar({ usarVersao: e.target.checked })} data-testid="coach-usar" />
              <span>{t("coachUsarVersao")}</span>
            </label>
            <Field label={t("coachResumo")} hint={contar(rascunho.resumo.length, MAX_RESUMO_TELA)}>
              <Textarea rows={4} maxLength={MAX_RESUMO_TELA} value={rascunho.resumo} disabled={travado || !rascunho.usarVersao} onChange={(e) => mudar({ resumo: e.target.value })} />
            </Field>
            {rascunho.destaques.map((d, k) => (
              <Field key={k} label={t("coachDestaque", { n: k + 1 })}>
                <Input
                  maxLength={MAX_DESTAQUE_TELA}
                  value={d}
                  disabled={travado || !rascunho.usarVersao}
                  onChange={(e) => mudar({ destaques: rascunho.destaques.map((x, i) => (i === k ? e.target.value : x)) })}
                />
              </Field>
            ))}
          </div>

          <div role="tabpanel" id={id("painel-cv")} aria-labelledby={id("aba-cv")} hidden={aba !== "cv"} className={aba === "cv" ? "flex flex-col gap-3" : "hidden"} data-testid="coach-cv">
            {rascunho.cv ? (
              <>
                <label className="flex items-start gap-2 text-[13px] font-medium">
                  <input type="checkbox" className="mt-0.5 h-4 w-4" checked={rascunho.usarCv} disabled={travado} onChange={(e) => mudar({ usarCv: e.target.checked })} data-testid="coach-usar-cv" />
                  <span>{t("coachUsarCv")}</span>
                </label>
                <Field label={t("coachTituloCv")}>
                  <Input maxLength={MAX_TITULO_TELA} value={rascunho.cv.titulo} disabled={travado || !rascunho.usarCv} onChange={(e) => mudar({ cv: { ...rascunho.cv!, titulo: e.target.value } })} />
                </Field>
                {rascunho.cv.cargos.map((c) => (
                  <fieldset key={c.i} className="rounded-card border border-line-soft p-3" data-cargo={c.i}>
                    <legend className="px-1 text-[13px] font-medium">
                      {[c.cargo, c.empresa].filter(Boolean).join(" · ")}
                      <span className="ml-2 font-normal text-muted">{periodoCargo(c, locale)}</span>
                    </legend>
                    <label className="flex items-start gap-2 text-[13px]">
                      <input type="checkbox" className="mt-0.5 h-4 w-4" checked={c.incluir} disabled={travado || !rascunho.usarCv} onChange={(e) => mudarCargo(c.i, { incluir: e.target.checked })} />
                      <span>{t("coachCargoIncluir")}</span>
                    </label>
                    <Field label={t("coachPontos")} className="mt-2">
                      <Textarea rows={5} value={c.texto} disabled={travado || !rascunho.usarCv || !c.incluir} onChange={(e) => mudarCargo(c.i, { texto: e.target.value })} />
                    </Field>
                  </fieldset>
                ))}
                {cvBase?.competencias.length ? (
                  <div className="text-[13px]">
                    <p className="font-medium text-muted">{t("coachCompetenciasCv")}</p>
                    <p className="mt-1 text-ink-soft">{cvBase.competencias.map((s) => s.nome).join(" · ")}</p>
                  </div>
                ) : null}
                {cvFinal ? (
                  <div className="flex flex-col gap-1">
                    <div>
                      <BotaoPdf
                        label={t("coachBaixarPdf")}
                        arquivo={[t("coachArquivo"), nome, vagaTitulo].filter(Boolean).join(" - ")}
                        documento={async () => {
                          // Contatos da própria pessoa: buscados só agora, para o PDF dela (a empresa recebe sem).
                          const c = await postEnvio("contato", {})
                            .then((r) => (r.ok ? (r.json() as Promise<ContatoCv & { nome?: string }>) : null))
                            .catch(() => null);
                          return <CvDocumento cv={cvFinal} nome={c?.nome || nome} contato={c} resumo={resumoPdf} />;
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted">{t("coachPdfDica")}</p>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-ink-soft">{t("coachSemCargos")}</p>
            )}
          </div>

          <div role="tabpanel" id={id("painel-mensagem")} aria-labelledby={id("aba-mensagem")} hidden={aba !== "mensagem"} className={aba === "mensagem" ? "flex flex-col gap-3" : "hidden"}>
            <label className="flex items-start gap-2 text-[13px] font-medium">
              <input type="checkbox" className="mt-0.5 h-4 w-4" checked={rascunho.enviarCarta} disabled={travado} onChange={(e) => mudar({ enviarCarta: e.target.checked })} data-testid="coach-carta" />
              <span>{t("coachEnviarCarta")}</span>
            </label>
            <Field label={t("coachCarta")} hint={`${contar(rascunho.carta.length, MAX_CARTA_TELA)} · ${t("coachCartaDica")}`}>
              <Textarea rows={6} maxLength={MAX_CARTA_TELA} value={rascunho.carta} disabled={travado || !rascunho.enviarCarta} onChange={(e) => mudar({ carta: e.target.value })} />
            </Field>
          </div>

          {travado ? (
            <p className="text-xs text-muted">{t("coachTravado")}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" size="md" data-action="coach-descartar" onClick={() => onRascunho(null)}>
                {t("coachDescartar")}
              </Button>
            </div>
          )}
        </div>
      )}

      {erro ? (
        <p role="alert" className="mt-3 text-[13px] text-danger">
          {erro}
        </p>
      ) : null}
    </section>
  );
}
