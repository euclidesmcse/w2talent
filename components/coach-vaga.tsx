"use client";
/**
 * Coach IA por vaga (plano 2026-11-20, D1–D5): dentro de "O que a empresa recebe" na tela Aprovar.
 * Mostra o que a vaga pede e a ficha não mostra (por regra), e prepara uma versão do resumo,
 * dos destaques e uma mensagem para esta vaga. A IA só usa o que está na ficha; a pessoa confere,
 * edita e escolhe o que vai. Nada sai daqui sem aprovar a vaga.
 */
import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button, Field, Input, Textarea } from "@/components/ui";
import { IaLink } from "@/components/ia-link";
import type { Adaptacao, Lacuna } from "@/lib/coach-vaga";
import {
  MAX_CARTA_TELA,
  MAX_DESTAQUE_TELA,
  MAX_RESUMO_TELA,
  rascunhoDaProposta,
  rascunhoManual,
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
};

export function CoachVaga({ vacancyId, hash, estado, lacunas, adaptacao, w2, rascunho, onRascunho, travado, online, onMudou }: Props) {
  const t = useTranslations("aprovar");
  const [aceite, setAceite] = React.useState(false);
  const [ocupado, setOcupado] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const id = (s: string) => `coach-${s}-${vacancyId}`;

  React.useEffect(() => setErro(null), [vacancyId]);

  const preparar = async () => {
    setOcupado(true);
    setErro(null);
    try {
      const r = await fetch("/api/envio/preparar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ vacancyId, hash, aceiteIa: true }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.proposta) return onRascunho(rascunhoDaProposta(j.proposta));
      if (r.status === 429) return setErro(t("coachLimite"));
      if (j.error === "sem_ficha_w2") return setErro(t("coachSemW2"));
      if (j.error === "mudou") return onMudou();
      setErro(r.status === 502 ? t("coachIaFalhou") : t("error"));
    } catch {
      setErro(t("error"));
    } finally {
      setOcupado(false);
    }
  };

  const mudar = (p: Partial<RascunhoCoach>) => rascunho && onRascunho({ ...rascunho, ...p });
  const contar = (n: number, max: number) => t("coachContador", { n, max });

  return (
    <section aria-labelledby={id("titulo")} data-coach={vacancyId} className="rounded-card border border-line bg-surface p-5 text-sm">
      <h3 id={id("titulo")} className="font-semibold">{t("coachTitulo")}</h3>

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
              <Button variant="ghost" size="md" data-action="coach-manual" disabled={ocupado} onClick={() => onRascunho(rascunhoManual(w2))}>
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

          <label className="mt-1 flex items-start gap-2 text-[13px] font-medium">
            <input type="checkbox" className="mt-0.5 h-4 w-4" checked={rascunho.enviarCarta} disabled={travado} onChange={(e) => mudar({ enviarCarta: e.target.checked })} data-testid="coach-carta" />
            <span>{t("coachEnviarCarta")}</span>
          </label>
          <Field label={t("coachCarta")} hint={`${contar(rascunho.carta.length, MAX_CARTA_TELA)} · ${t("coachCartaDica")}`}>
            <Textarea rows={6} maxLength={MAX_CARTA_TELA} value={rascunho.carta} disabled={travado || !rascunho.enviarCarta} onChange={(e) => mudar({ carta: e.target.value })} />
          </Field>

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
