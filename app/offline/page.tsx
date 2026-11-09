import { getTranslations } from "next-intl/server";
import { BrandMark } from "@/components/brand-logo";
import { buttonClasses } from "@/components/ui/button";

/**
 * Página offline (1.5.14, D2). O service worker guarda esta página e o CSS dela na instalação
 * e a mostra quando não há internet e a tela pedida não tem cópia no aparelho.
 * Sem JavaScript próprio: links comuns, para funcionar mesmo sem os scripts guardados.
 */
export const metadata = { robots: { index: false } };

export default async function OfflinePage() {
  const t = await getTranslations("pwa");
  const telas: Array<[string, string]> = [
    ["/vagas", t("screenVagas")],
    ["/minha-ficha", t("screenFicha")],
    ["/minhas-candidaturas", t("screenMinhas")],
  ];
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-4 py-10">
      <BrandMark size={36} />
      <h1 className="text-xl font-semibold">{t("offlinePageTitle")}</h1>
      <p className="text-sm text-muted">{t("offlinePageBody")}</p>
      <ul className="flex flex-col gap-2 text-sm">
        {telas.map(([href, nome]) => (
          <li key={href}><a href={href} className="font-medium">{nome}</a></li>
        ))}
      </ul>
      <a href="/vagas" className={buttonClasses("primary", "lg", "self-start hover:no-underline hover:text-white")}>{t("retry")}</a>
    </main>
  );
}
