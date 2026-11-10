"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Button, cn } from "@/components/ui";
import { TelaConta, useVolta } from "@/components/tela-conta";
import { destinoDoEstado, linkEntrar, recarregarConta, useConta, type PerfilConta } from "@/lib/conta-client";
import { CONSENTIMENTOS, CONSENTIMENTOS_OBRIGATORIOS, textoConsentimento, type TipoConsentimento } from "@/lib/consentimento";

/**
 * Primeira entrada (1.5.5, decisão 3): candidato ou recrutador, uma vez só.
 * Candidato aceita os dois consentimentos obrigatórios; o de e-mails é opcional.
 */
export default function EscolherPerfilPage() {
  const t = useTranslations("conta");
  const locale = useLocale();
  const router = useRouter();
  const info = useConta();
  const volta = useVolta();
  const [perfil, setPerfil] = React.useState<PerfilConta | null>(null);
  const [aceites, setAceites] = React.useState<Record<TipoConsentimento, boolean>>({ tratamentoBusca: false, contatoProxy: false, nudges: false });
  const [ocupado, setOcupado] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);

  // Quem não está nesta etapa (sem login, já escolheu, falta o código) vai para a certa.
  React.useEffect(() => {
    if (!volta || info.estado === "carregando" || info.estado === "sem_perfil" || info.estado === "erro") return;
    router.replace(info.estado === "anonimo" ? linkEntrar(volta) : destinoDoEstado(info.estado, volta) ?? volta);
  }, [info.estado, volta, router]);

  const faltaAceite = perfil === "candidato" && CONSENTIMENTOS_OBRIGATORIOS.some((c) => !aceites[c]);

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (!perfil || faltaAceite) return;
    setOcupado(true);
    setErro(null);
    try {
      const r = await fetch("/api/conta/perfil", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ perfil, consentimentos: perfil === "candidato" ? aceites : {}, idioma: locale }),
      });
      if (!r.ok && r.status !== 409) throw new Error(String(r.status));
      const novo = await recarregarConta();
      router.replace(destinoDoEstado(novo.estado, volta ?? "/vagas") ?? "/");
    } catch {
      setErro(t("errorGeneric"));
      setOcupado(false);
    }
  }

  const opcao = (valor: PerfilConta, titulo: string, texto: string) => (
    <label
      className={cn(
        "flex cursor-pointer gap-3 rounded-card border p-3.5",
        perfil === valor ? "border-brand bg-brand-soft" : "border-line hover:border-ink/30",
      )}
    >
      <input type="radio" name="perfil" value={valor} checked={perfil === valor} onChange={() => setPerfil(valor)} className="mt-1 h-4 w-4 shrink-0" />
      <span>
        <span className="block font-semibold">{titulo}</span>
        <span className="block text-[13px] text-muted">{texto}</span>
      </span>
    </label>
  );

  return (
    <TelaConta titulo={t("profileTitle")}>
      <form onSubmit={confirmar} className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-sm text-muted">{t("profileBody")}</legend>
          {opcao("candidato", t("perfilCandidato"), t("profileCandidateHint"))}
          {opcao("recrutador", t("perfilRecrutador"), t("profileRecruiterHint"))}
        </fieldset>
        {perfil === "candidato" ? (
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 text-sm font-semibold">{t("consentTitle")}</legend>
            {CONSENTIMENTOS.map((c) => (
              <label key={c} className="flex gap-3 text-[13px]">
                <input
                  type="checkbox"
                  data-consent={c}
                  checked={aceites[c]}
                  onChange={(e) => setAceites((a) => ({ ...a, [c]: e.target.checked }))}
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-describedby={CONSENTIMENTOS_OBRIGATORIOS.includes(c) ? "consent-obrigatorio" : undefined}
                />
                <span>{textoConsentimento(c, locale)}</span>
              </label>
            ))}
            <p id="consent-obrigatorio" className="text-[12px] text-muted">{t("consentRequired")}</p>
          </fieldset>
        ) : null}
        <p className="text-[13px] text-muted">{t("profileFinal")}</p>
        {erro ? <p role="alert" className="text-sm text-danger">{erro}</p> : null}
        <Button type="submit" size="lg" data-action="confirmar-perfil" disabled={!perfil || faltaAceite || ocupado}>
          {ocupado ? t("saving") : t("profileConfirm")}
        </Button>
      </form>
    </TelaConta>
  );
}
