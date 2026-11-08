import Link from "next/link";
import { cn } from "@/components/ui/cn";
import { BrandMark, BrandWordmark } from "@/components/brand-logo";
import { LanguageSwitcher } from "@/components/language-switcher";

export type NavItem = { href: string; label: string; active?: boolean; /** rótulo curto usado no celular */ short?: string };

/** Barra do topo do protótipo: logo à esquerda, navegação curta, fundo branco com borda.
 *  No celular fica numa linha só: só o símbolo da marca, e a navegação rola para o lado se não couber. */
export function AppHeader({ area, nav = [], right, navLabel = "Principal" }: { area?: string; nav?: NavItem[]; right?: React.ReactNode; navLabel?: string }) {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex min-h-14 max-w-page items-center gap-x-3 px-4 py-2.5 md:gap-x-6 md:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 text-ink hover:text-ink hover:no-underline">
          <BrandMark size={28} />
          <BrandWordmark suffix={area} className="sr-only text-[18px] md:not-sr-only" />
        </Link>
        {nav.length ? (
          <nav aria-label={navLabel} className="-my-2 flex min-w-0 flex-1 gap-x-3 overflow-x-auto whitespace-nowrap py-2 text-sm [scrollbar-width:none] md:gap-x-5">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={n.active ? "page" : undefined}
                className={cn("hover:no-underline", n.active ? "font-semibold text-ink" : "text-muted hover:text-ink")}
              >
                {n.short ? (
                  <>
                    <span className="md:hidden">{n.short}</span>
                    <span className="hidden md:inline">{n.label}</span>
                  </>
                ) : (
                  n.label
                )}
              </Link>
            ))}
          </nav>
        ) : null}
        {nav.length ? null : <span className="flex-1" />}
        <div className="flex shrink-0 items-center gap-2 md:gap-3">
          <LanguageSwitcher />
          {right}
        </div>
      </div>
    </header>
  );
}
