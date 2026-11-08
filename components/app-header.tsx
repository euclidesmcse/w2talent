import Link from "next/link";
import { cn } from "@/components/ui/cn";

export type NavItem = { href: string; label: string; active?: boolean };

/** Barra do topo do protótipo: marca W2 à esquerda, navegação curta, fundo branco com borda. */
export function AppHeader({ area, nav = [], right }: { area?: string; nav?: NavItem[]; right?: React.ReactNode }) {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex min-h-14 max-w-page flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5 md:px-6">
        <Link href="/" className="flex items-center gap-2 text-ink hover:text-ink hover:no-underline">
          <span className="flex h-[26px] w-[26px] items-center justify-center rounded-control bg-brand text-xs font-bold text-white">W2</span>
          <span className="text-[15px] font-semibold">W2Talent{area ? ` · ${area}` : ""}</span>
        </Link>
        {nav.length ? (
          <nav aria-label="Principal" className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
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
        <span className="flex-1" />
        {right}
      </div>
    </header>
  );
}
