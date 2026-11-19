"use client";
/**
 * 3.6a (D2): caixa opcional, desligada por padrão, para a pessoa deixar as próprias correções ajudarem a
 * treinar um modelo de IA aberto do W2Talent. O texto é o mesmo que vai para o ConsentLog (versão no
 * servidor, no idioma da tela). Desligar apaga os exemplos guardados. Sem login, não aparece.
 * Usado em /minha-ficha (passo da Ficha W2), /publicar e /conta/seguranca.
 */
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "./ui/cn";

type Estado = { ligado: boolean; texto: string } | null;

export function TreinoConsentimento({ className }: { className?: string }) {
  const t = useTranslations("treino");
  const locale = useLocale();
  const [estado, setEstado] = React.useState<Estado>(null);
  const [ocupado, setOcupado] = React.useState(false);
  const [aviso, setAviso] = React.useState<{ texto: string; erro?: boolean } | null>(null);

  React.useEffect(() => {
    let vivo = true;
    fetch(`/api/conta/treino?idioma=${encodeURIComponent(locale)}`, { cache: "no-store" })
      .then(async (r) => (r.ok ? ((await r.json()) as { ligado?: boolean; texto?: string }) : null))
      .then((j) => {
        if (vivo && j && typeof j.texto === "string") setEstado({ ligado: j.ligado === true, texto: j.texto });
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [locale]);

  if (!estado) return null;

  const mudar = async (ligar: boolean) => {
    setOcupado(true);
    setAviso(null);
    try {
      const r = await fetch("/api/conta/treino", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ligar, idioma: locale }),
      });
      const j = (await r.json().catch(() => ({}))) as { ligado?: boolean; apagados?: number };
      if (!r.ok) throw new Error();
      setEstado((e) => (e ? { ...e, ligado: j.ligado === true } : e));
      setAviso({ texto: ligar ? t("ligou") : t("desligou", { count: j.apagados ?? 0 }) });
    } catch {
      setAviso({ texto: t("erro"), erro: true });
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-1.5 text-[13px]", className)} data-testid="treino-consentimento">
      <label className="flex items-start gap-2 text-ink">
        <input
          type="checkbox"
          data-aceite="treino"
          className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
          checked={estado.ligado}
          disabled={ocupado}
          onChange={(e) => mudar(e.target.checked)}
        />
        <span>
          {estado.texto}{" "}
          <a href="/ajuda/privacidade" className="font-semibold underline">
            {t("saibaMais")}
          </a>
        </span>
      </label>
      {aviso ? (
        <p role={aviso.erro ? "alert" : "status"} className={aviso.erro ? "text-danger" : "text-muted"}>
          {aviso.texto}
        </p>
      ) : null}
    </div>
  );
}
