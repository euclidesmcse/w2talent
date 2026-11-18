"use client";
/**
 * Selo "Como usamos IA" (2.0 Transparência): link discreto ao lado do que a IA escreveu ou escolheu,
 * apontando para a linha certa da página /ia.
 */
import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "@/components/ui/cn";
import { hrefIa } from "@/lib/ia-transparencia";

export function IaLink({ ancora, texto = "selo", className }: { ancora?: string; texto?: "selo" | "seloParecidas" | "traducaoTarefa"; className?: string }) {
  const t = useTranslations("ia");
  return (
    <Link href={hrefIa(ancora)} className={cn("font-medium text-muted underline underline-offset-2 hover:text-ink", className)} data-ia-link={ancora ?? ""}>
      {t(texto)}
    </Link>
  );
}

export default IaLink;
