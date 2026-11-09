import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "@/components/ui/cn";
import { BrandMark, BrandWordmark } from "@/components/brand-logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { AREA_NAME, AREA_SWITCH, NAV, type Area } from "@/lib/nav";

/** Barra do topo: logo, o menu fixo da área (lib/nav.ts), idioma e o link para a outra área.
 *  No celular fica numa linha só: só o símbolo da marca e os rótulos curtos.
 *  `suffix` é só para telas fora das áreas (ex.: /design). */
export function AppHeader({ area, active, right, suffix }: { area?: Area; active?: string; right?: React.ReactNode; suffix?: string }) {
  const t = useTranslations("nav");
  const links = area ? NAV[area] : [];
  const nameKey = area ? AREA_NAME[area] : undefined;
  const troca = area ? AREA_SWITCH[area] : undefined;
  return (
    <header className="border-b border-line bg-surface" data-area={area}>
      <div className="mx-auto flex min-h-14 max-w-page items-center gap-x-3 px-4 py-2.5 md:gap-x-6 md:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 text-ink hover:text-ink hover:no-underline">
          <BrandMark size={28} />
          <BrandWordmark suffix={nameKey ? t(nameKey) : suffix} className="sr-only text-[18px] md:not-sr-only" />
        </Link>
        {links.length ? (
          <nav aria-label={t("main")} className="-my-2 flex min-w-0 flex-1 gap-x-3 overflow-x-auto whitespace-nowrap py-2 text-sm [scrollbar-width:none] md:gap-x-5">
            {links.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                data-nav={n.href}
                aria-current={n.href === active ? "page" : undefined}
                className={cn("hover:no-underline", n.href === active ? "font-semibold text-ink" : "text-muted hover:text-ink")}
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
        ) : (
          <span className="flex-1" />
        )}
        <div className="flex shrink-0 items-center gap-2 md:gap-3">
          <LanguageSwitcher />
          {troca ? (
            <Link href={troca.href} data-area-switch={troca.href} className="hidden text-sm text-brand md:inline">
              {t(troca.key)}
            </Link>
          ) : null}
          {right}
        </div>
      </div>
    </header>
  );
}
