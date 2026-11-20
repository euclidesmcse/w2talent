"use client";
/**
 * CV por vaga (D6, D7), por regra e sem IA: "por que você se destaca" (competências que a ficha
 * cobre e o cargo mais próximo da vaga) e o aviso de idioma (a vaga pede um nível que a ficha não mostra).
 * Só informa: nada aqui bloqueia a candidatura.
 */
import * as React from "react";
import { useTranslations } from "next-intl";
import type { AvisoIdioma, PorQueRegra } from "@/lib/coach-vaga";

export function AvisosVaga({ porQue, idiomas, className = "" }: { porQue: PorQueRegra | null; idiomas: AvisoIdioma[]; className?: string }) {
  const t = useTranslations("vagaAvisos");
  const tf = useTranslations("ficha");
  const nivel = (n: string) => tf(`niv_${n}` as "niv_basico").toLowerCase();
  const linhas: string[] = [];
  if (porQue && porQue.total > 0) linhas.push(t("bate", { bate: porQue.bate, total: porQue.total }));
  if (porQue?.cargo) {
    const onde = porQue.empresa ? t("cargoEmpresa", { cargo: porQue.cargo, empresa: porQue.empresa }) : porQue.cargo;
    linhas.push(porQue.anos != null ? t("cargoAnos", { onde, anos: porQue.anos }) : t("cargo", { onde }));
  }
  if (!linhas.length && !idiomas.length) return null;
  return (
    <div className={`flex flex-col gap-2 text-[13px] ${className}`} data-testid="avisos-vaga">
      {linhas.length ? (
        <div>
          <p className="font-medium text-muted">{t("titulo")}</p>
          <ul className="mt-1 list-disc pl-5 text-ink-soft">
            {linhas.map((l, k) => (
              <li key={k}>{l}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {idiomas.map((a, k) => (
        <div key={k} role="note" data-testid="aviso-idioma" className="rounded-card border border-warning bg-warning-soft px-3 py-2 text-warning-ink">
          <p className="font-medium">
            {a.tem === null
              ? t("idiomaSem", { idioma: a.idioma, nivel: nivel(a.pede) })
              : a.tem === ""
                ? t("idiomaSemNivel", { idioma: a.idioma, nivel: nivel(a.pede) })
                : t("idioma", { idioma: a.idioma, nivel: nivel(a.pede), tem: nivel(a.tem) })}
          </p>
          <p className="mt-0.5">{t("idiomaTrecho", { trecho: a.trecho })}</p>
          <p className="mt-0.5">{t("idiomaDica")}</p>
        </div>
      ))}
    </div>
  );
}

/**
 * No detalhe da vaga (D7): só para candidato logado com ficha. Usa o mesmo estado da tela Aprovar
 * (regra no servidor, sem IA). Sem login ou sem ficha, não mostra nada.
 */
export function AvisosDoDetalhe({ vacancyId, ligado }: { vacancyId: string; ligado: boolean }) {
  const [dados, setDados] = React.useState<{ porQue: PorQueRegra | null; idiomas: AvisoIdioma[] } | null>(null);
  React.useEffect(() => {
    setDados(null);
    if (!ligado || !vacancyId) return;
    let vivo = true;
    fetch("/api/envio/estado", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ vacancyIds: [vacancyId] }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const it = j?.itens?.[0];
        if (vivo && it) setDados({ porQue: it.porQue ?? null, idiomas: it.idiomas ?? [] });
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [vacancyId, ligado]);
  if (!dados) return null;
  return <AvisosVaga porQue={dados.porQue} idiomas={dados.idiomas} className="border-t border-line pt-3" />;
}
