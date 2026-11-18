"use client";
/**
 * 3.1b Ranking adaptativo (D5): uma linha acima da lista quando a ordem dos candidatos usa (ou pode usar)
 * os pesos aprendidos. Só muda a ordem; a % de match continua a mesma conta. O recrutador pode ver a ordem padrão.
 */
import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "@/components/ui/cn";
import { hrefIa } from "@/lib/ia-transparencia";
import type { OrdemInfo } from "@/lib/ranking";

export function OrdemRanking({ ordem, onTrocar, className }: { ordem: OrdemInfo | null | undefined; onTrocar: (padrao: boolean) => void; className?: string }) {
  const t = useTranslations("ordemRanking");
  if (!ordem || ordem.escopo === "padrao") return null;
  const ajustada = ordem.usada === "ajustada";
  return (
    <p className={cn("text-[13px] text-muted", className)} data-testid="ordem-ranking" data-ordem={ordem.usada}>
      {ajustada ? (ordem.escopo === "global" ? t("ajustadaGlobal") : t("ajustadaEmpresa")) : t("padrao")}{" "}
      <button
        type="button"
        onClick={() => onTrocar(ajustada)}
        className="font-medium text-brand underline underline-offset-2"
        data-action="trocar-ordem"
      >
        {ajustada ? t("verPadrao") : t("verAjustada")}
      </button>
      {" · "}
      <Link href={hrefIa("ranking")} className="text-brand underline underline-offset-2" aria-label={t("comoFuncionaLabel")}>
        {t("comoFunciona")}
      </Link>
    </p>
  );
}

export default OrdemRanking;
