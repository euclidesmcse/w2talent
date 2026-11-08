import Link from "next/link";
import { cn } from "@/components/ui/cn";
import { BrandMark, BrandWordmark } from "@/components/brand-logo";

export type NavItem = { href: string; label: string; active?: boolean };

/** Barra do topo do protótipo: logo à esquerda, navegação curta, fundo branco com borda.
 *  No celular fica numa linha só: só o símbolo da marca, e a navegação rola para o lado se não couber. */
export function AppHeader({ area, nav = [], right }: { area?: string; nav?: NavItem[]; right?: React.ReactNode }) {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex min-h-14 max-w-page items-center gap-x-4 px-4 py-2.5 md:gap-x-6 md:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 text-ink hover:text-ink hover:no-underline">
          <BrandMark size={28} />
          <BrandWordmark suffix={area} className="sr-only text-[18px] md:not-sr-only" />
        </Link>
        {nav.length ? (
          <nav aria-label="Principal" className="-my-2 flex min-w-0 flex-1 gap-x-4 overflow-x-auto whitespace-nowrap py-2 text-sm [scrollbar-width:none] md:gap-x-5">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={n.active ? "page" : undefined}
                className={cn("hover:no-underline", n.active ? "font-semibold text-ink" : "text-muted hover:text-ink")}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        ) : null}
        {nav.length ? null : <span className="flex-1" />}
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
    </header>
  );
}
