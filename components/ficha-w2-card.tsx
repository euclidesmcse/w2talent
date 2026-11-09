"use client";
/**
 * Ficha W2 (1.5.11): o cartão padronizado que o recrutador lê em 10 segundos (spec v2 §6.3).
 * Cabeçalho, competências e idiomas saem da ficha; resumo e destaques foram escritos pela IA.
 */
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Chip } from "@/components/ui/chip";
import { skillName } from "@/components/skill-chips";
import { formatFaixa } from "@/lib/format";
import { anosExperiencia, nomeCurto, topSkills, type Ficha, type FichaW2 } from "@/lib/ficha";

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function FichaW2Card({ ficha, w2, children }: { ficha: Ficha; w2: FichaW2; children?: React.ReactNode }) {
  const t = useTranslations("ficha");
  const locale = useLocale();
  const anos = anosExperiencia(ficha);
  const faixa = ficha.pretensaoDe != null || ficha.pretensaoAte != null ? formatFaixa(ficha.pretensaoDe, ficha.pretensaoAte, ficha.pretensaoMoeda, locale) : "";
  // "Analista Cloud Pleno" já diz a senioridade: não repete.
  const sen = ficha.senioridade ? t(`sen_${ficha.senioridade}`) : "";
  const cargo = sen && !semAcento(ficha.titulo).includes(semAcento(sen)) ? `${ficha.titulo} ${sen}`.trim() : ficha.titulo;
  const local = ficha.localidade ? `${ficha.localidade}${ficha.modo ? ` (${t(`modo_${ficha.modo}`).toLowerCase()})` : ""}` : ficha.modo ? t(`modo_${ficha.modo}`) : "";
  const cabecalho = [
    nomeCurto(ficha.nome),
    cargo,
    anos > 0 ? t("w2Anos", { n: anos }) : "",
    local,
    ficha.mudanca ? t("w2Mudanca") : "",
    ficha.regimes.join("/"),
    faixa && faixa !== "—" ? faixa : "",
    ficha.disponibilidade === "imediata" ? t("w2InicioImediato") : ficha.disponibilidade ? t("w2Inicio", { d: t(`disp_${ficha.disponibilidade}`).toLowerCase() }) : "",
  ].filter(Boolean);
  const skills = topSkills(ficha);
  const idiomas = ficha.idiomas.filter((i) => i.idioma);

  return (
    <article data-ficha-w2 className="rounded-card border border-line bg-surface p-5 text-sm">
      <p className="font-medium text-ink">{cabecalho.join(" · ")}</p>
      <dl className="mt-4 grid gap-4">
        <div>
          <dt className="text-[13px] font-medium text-muted">{t("w2Resumo")}</dt>
          <dd className="mt-1 text-ink">{w2.resumo}</dd>
        </div>
        {skills.length ? (
          <div>
            <dt className="text-[13px] font-medium text-muted">{t("w2Skills")}</dt>
            <dd className="mt-2 flex flex-wrap gap-2">
              {skills.map((s) => (
                <Chip key={s.skillId}>
                  {skillName(s.skillId)}
                  {s.anos > 0 ? <span className="ml-1 tabular-nums text-muted">{s.anos}a</span> : null}
                </Chip>
              ))}
            </dd>
          </div>
        ) : null}
        {w2.destaques.length ? (
          <div>
            <dt className="text-[13px] font-medium text-muted">{t("w2Destaques")}</dt>
            <dd className="mt-1">
              <ul className="list-disc space-y-1 pl-5 text-ink">
                {w2.destaques.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </dd>
          </div>
        ) : null}
        {idiomas.length ? (
          <div>
            <dt className="text-[13px] font-medium text-muted">{t("w2Idiomas")}</dt>
            <dd className="mt-1 text-ink">{idiomas.map((i) => (i.nivel ? `${i.idioma} ${t(`niv_${i.nivel}`).toLowerCase()}` : i.idioma)).join(" · ")}</dd>
          </div>
        ) : null}
      </dl>
      {children}
      <p className="mt-4 border-t border-line pt-3 text-xs text-muted">{w2.editada ? t("w2Rodape") : t("w2RodapeIa")}</p>
    </article>
  );
}

export default FichaW2Card;
