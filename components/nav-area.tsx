"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "@/components/ui/cn";
import { NAV, type Area } from "@/lib/nav";
import { useConta } from "@/lib/conta-client";

/** Área do menu: com login (1.5.5) vem do perfil da conta; sem login, do endereço da tela. O admin fica no dele. */
export function areaDoMenu(area: Area | undefined, estado: string, perfil: string | null | undefined): Area | undefined {
  if (area === "admin") return area;
  if ((estado === "ok" || estado === "mfa_obrigatorio") && (perfil === "candidato" || perfil === "recrutador")) return perfil;
  return area;
}

export function NavArea({ area, active }: { area?: Area; active?: string }) {
  const t = useTranslations("nav");
  const info = useConta();
  const efetiva = areaDoMenu(area, info.estado, info.conta?.perfil);
  const links = efetiva ? NAV[efetiva] : [];
  if (!links.length) return <span className="flex-1" />;
  return (
    <nav aria-label={t("main")} data-nav-area={efetiva} className="-my-2 flex min-w-0 flex-1 gap-x-2 overflow-x-auto whitespace-nowrap px-1 py-2 text-sm [scrollbar-width:none] md:gap-x-3">
      {links.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          data-nav={n.href}
          aria-current={n.href === active ? "page" : undefined}
          className={cn("relevo-pilula hover:no-underline", n.href === active ? "font-semibold text-ink" : "text-muted hover:text-ink")}
        >
          {n.shortKey ? (
            <>
              <span className="md:hidden">{t(n.shortKey)}</span>
              <span className="hidden md:inline">{t(n.key)}</span>
            </>
          ) : (
            t(n.key)
          )}
        </Link>
      ))}
    </nav>
  );
}
