"use client";
/** Etiqueta "Empresa não verificada" (2.1a, D2): a vaga já aparece, mas a empresa ainda não foi conferida. */
import { useTranslations } from "next-intl";

export function NaoVerificada({ company }: { company?: { verificada?: boolean } | null }) {
  const t = useTranslations("vagas");
  if (!company || company.verificada !== false) return null;
  return (
    <span data-nao-verificada className="inline-flex items-center rounded-pill bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning-ink">
      {t("naoVerificada")}
    </span>
  );
}
