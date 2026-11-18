import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppHeader } from "@/components/app-header";
import { CAMPOS_LINHA, EMAIL_REVISAO, LINHAS_IA } from "@/lib/ia-transparencia";

/**
 * 2.0 Transparência: "Como usamos IA" (plano "IA para RH (SAP)", aprovado em 2026-11-18).
 * Página pública, nos três idiomas. Os selos "Como usamos IA" das outras telas apontam para as âncoras daqui.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ia");
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function IaPage() {
  const t = await getTranslations("ia");
  const principios = [1, 2, 3, 4, 5].map((n) => t(`p${n}`));
  return (
    <div className="min-h-screen">
      <AppHeader area="publico" />
      <main className="mx-auto flex max-w-page flex-col gap-10 px-6 py-10 md:py-14">
        <header className="flex max-w-[68ch] flex-col gap-3">
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em] md:text-[36px]">{t("title")}</h1>
          <p className="text-[17px] text-ink">{t("lead")}</p>
          <p className="text-[13px] text-muted">{t("atualizado")}</p>
        </header>

        <section aria-labelledby="ia-principios" className="flex max-w-[68ch] flex-col gap-3">
          <h2 id="ia-principios" className="text-xl font-semibold">{t("principiosTitulo")}</h2>
          <ul className="list-disc space-y-2 pl-5 text-ink">
            {principios.map((p) => <li key={p}>{p}</li>)}
          </ul>
        </section>

        <section aria-labelledby="ia-onde" className="flex flex-col gap-3">
          <h2 id="ia-onde" className="text-xl font-semibold">{t("ondeTitulo")}</h2>
          {/* Lista de definições em vez de tabela: lê bem no celular sem rolagem lateral */}
          <ul className="grid gap-4 md:grid-cols-2">
            {LINHAS_IA.map((l) => (
              <li key={l.id} id={l.ancora} className="scroll-mt-24 rounded-card border border-line bg-surface p-5 text-sm" data-ia-linha={l.id}>
                <h3 className="text-base font-semibold text-ink">{t(`${l.id}Tarefa`)}</h3>
                <dl className="mt-3 grid gap-3">
                  {CAMPOS_LINHA.filter((c) => c !== "Tarefa").map((c) => (
                    <div key={c}>
                      <dt className="text-[13px] font-medium text-muted">{t(`col${c}`)}</dt>
                      <dd className="mt-1 text-ink">{t(`${l.id}${c}`)}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="ia-fornecedores" className="flex max-w-[68ch] flex-col gap-3">
          <h2 id="ia-fornecedores" className="text-xl font-semibold">{t("fornecedoresTitulo")}</h2>
          <p className="text-ink">{t("fornecedores1")}</p>
          <p className="text-ink">{t("fornecedores2")}</p>
        </section>

        <section id="revisao" aria-labelledby="ia-revisao" className="flex max-w-[68ch] scroll-mt-24 flex-col gap-3">
          <h2 id="ia-revisao" className="text-xl font-semibold">{t("revisaoTitulo")}</h2>
          <p className="text-ink">
            {t.rich("revisao1", {
              email: () => <a href={`mailto:${EMAIL_REVISAO}`} className="font-medium underline underline-offset-2">{EMAIL_REVISAO}</a>,
            })}
          </p>
        </section>

        <p>
          <Link href="/vagas" className="font-medium">{t("voltar")}</Link>
        </p>
      </main>
    </div>
  );
}
