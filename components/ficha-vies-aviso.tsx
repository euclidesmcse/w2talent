"use client";
/**
 * Aviso do revisor de viés na Ficha W2 (mesmas regras das vagas, `lib/ficha-vies.ts`).
 * Mesmo visual do aviso de `/publicar`. Só avisa: não bloqueia salvar, gerar nem publicar.
 * Sem avisos, não mostra nada.
 */
import * as React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import type { AvisoFichaVies } from "@/lib/ficha-vies";

export function FichaViesAviso({ avisos, onTrocar }: { avisos: AvisoFichaVies[]; onTrocar?: (a: AvisoFichaVies) => void }) {
  const t = useTranslations("ficha");
  const id = React.useId();
  if (!avisos.length) return null;
  const campo = (a: AvisoFichaVies) => (a.campo === "destaque" ? t("vies.campos.destaque", { n: a.indice + 1 }) : t(`vies.campos.${a.campo}`));
  return (
    <section aria-labelledby={id} data-testid="ficha-vies" className="rounded-card bg-warning-soft px-3.5 py-3 text-[13px] text-warning-ink">
      <h2 id={id} className="font-semibold">
        {t("vies.titulo", { count: avisos.length })}
      </h2>
      <p className="mt-1">
        {t("vies.intro")} <a href="/ia#revisor-vies" className="underline">{t("vies.comoFunciona")}</a>
      </p>
      <ul className="mt-2 flex flex-col gap-2">
        {avisos.map((a) => (
          <li key={`${a.campo}-${a.indice}-${a.inicio}-${a.regra}`} data-vies={a.regra} className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>
              <strong>&ldquo;{a.trecho}&rdquo;</strong> ({campo(a)}): {t(`vies.cat.${a.categoria}`)}
            </span>
            {a.troca === null || !onTrocar ? (
              <span>{t("vies.reescrever")}</span>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => onTrocar(a)}>
                {a.troca ? t("vies.trocarPor", { troca: a.troca }) : t("vies.tirar", { trecho: a.trecho })}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
