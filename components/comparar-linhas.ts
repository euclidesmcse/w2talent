"use client";
/**
 * 2.3 Linhas da comparação: cada campo da Ficha W2 vira uma linha com um texto por candidato.
 * A tela (2.3a) mostra os candidatos em colunas; os arquivos (2.3b) saem com uma linha por candidato.
 */
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatPretensaoCandidato, formatTempo } from "@/lib/format";
import { skillName } from "@/components/skill-chips";
import { useGapCandidatoText } from "@/components/candidato-match";
import type { ItemComparacao } from "@/lib/comparar";

export type LinhaComparacao = { chave: string; rotulo: string; valores: string[] };

export function useLinhasComparacao(itens: ItemComparacao[], comVaga: boolean): LinhaComparacao[] {
  const t = useTranslations("comparar");
  const tf = useTranslations("ficha");
  const locale = useLocale();
  const gapText = useGapCandidatoText();
  return React.useMemo(() => {
    const linha = (chave: string, f: (it: ItemComparacao) => string): LinhaComparacao => ({
      chave,
      rotulo: t(`campo_${chave}`),
      valores: itens.map((it) => f(it) || "—"),
    });
    const linhas: LinhaComparacao[] = [];
    if (comVaga) {
      linhas.push(linha("match", (it) => (it.match == null ? "" : `${Math.round(it.match)}%`)));
      linhas.push(linha("falta", (it) => (it.match == null ? "" : it.gaps.length ? it.gaps.map(gapText).join("\n") : t("nadaFalta"))));
    }
    linhas.push(
      linha("cargo", (it) => [it.titulo, it.senioridade ? tf(`sen_${it.senioridade}`) : ""].filter(Boolean).join(" · ")),
      linha("experiencia", (it) => (it.anos > 0 ? tf("w2Anos", { n: it.anos }) : "")),
      linha("competencias", (it) => it.stack.map((s) => (s.anos > 0 ? `${skillName(s.skillId)} (${tf("w2Anos", { n: s.anos })})` : skillName(s.skillId))).join("\n")),
      linha("local", (it) =>
        [it.localidade, it.modo ? tf(`modo_${it.modo}`) : "", it.mudanca ? tf("w2Mudanca") : ""].filter(Boolean).join(" · "),
      ),
      linha("regime", (it) => it.regimes.join(", ")),
      linha("pretensao", (it) => {
        const p = formatPretensaoCandidato(it, locale);
        return p === "—" ? "" : p;
      }),
      linha("idiomas", (it) => it.idiomas.map((i) => (i.nivel ? `${i.idioma} ${tf(`niv_${i.nivel}`).toLowerCase()}` : i.idioma)).join("\n")),
      linha("disponibilidade", (it) => (it.disponibilidade ? tf(`disp_${it.disponibilidade}`) : "")),
      linha("resumo", (it) => it.resumo),
      linha("destaques", (it) => it.destaques.join("\n")),
      linha("contato", (it) => [it.emailMasked, it.celularMasked].filter(Boolean).join(" · ")),
      linha("atualizado", (it) => {
        const s = formatTempo(it.updatedAt, locale);
        return s === "—" ? "" : s;
      }),
    );
    return linhas;
  }, [itens, comVaga, t, tf, locale, gapText]);
}
