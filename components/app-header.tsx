import Link from "next/link";
import { useTranslations } from "next-intl";
import { BrandMark, BrandWordmark } from "@/components/brand-logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { InstallApp } from "@/components/install-app";
import { ContaMenu, ConviteAutenticador, TrocaDeArea } from "@/components/conta-menu";
import { NavArea } from "@/components/nav-area";
import { AREA_NAME, AREA_SWITCH, type Area } from "@/lib/nav";

/** Barra do topo: logo, o menu da área (lib/nav.ts; com login, a do perfil da conta), idioma e o link para a outra área.
 *  No celular fica numa linha só: só o símbolo da marca e os rótulos curtos.
 *  `suffix` é só para telas fora das áreas (ex.: /design). */
export function AppHeader({ area, active, right, suffix }: { area?: Area; active?: string; right?: React.ReactNode; suffix?: string }) {
  const t = useTranslations("nav");
  const nameKey = area ? AREA_NAME[area] : undefined;
  const troca = area ? AREA_SWITCH[area] : undefined;
  return (
    <header className="border-b border-line bg-surface pt-[env(safe-area-inset-top)]" data-area={area}>
      <div className="mx-auto flex min-h-14 max-w-page items-center gap-x-3 px-4 py-2.5 md:gap-x-6 md:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 text-ink hover:text-ink hover:no-underline">
          <BrandMark size={28} />
          <BrandWordmark suffix={nameKey ? t(nameKey) : suffix} className="sr-only text-[18px] md:not-sr-only" />
        </Link>
        <NavArea area={area} active={active} />
        <div className="flex shrink-0 items-center gap-1 md:gap-3">
          <InstallApp />
          <LanguageSwitcher />
          {troca ? <TrocaDeArea href={troca.href}>{t(troca.key)}</TrocaDeArea> : null}
          {area !== "admin" ? <ContaMenu /> : null}
          {right}
        </div>
      </div>
      <ConviteAutenticador />
    </header>
  );
}
