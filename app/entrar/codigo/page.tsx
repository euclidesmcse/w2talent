"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Field, Input } from "@/components/ui";
import { TelaConta, useVolta } from "@/components/tela-conta";
import { destinoDoEstado, linkEntrar, recarregarConta, sair, useConta } from "@/lib/conta-client";

/**
 * Código do autenticador depois do Google/Microsoft (1.5.5). Aceita também um código de
 * recuperação. "Lembrar este aparelho" evita pedir o código por 30 dias neste navegador.
 */
export default function CodigoPage() {
  const t = useTranslations("conta");
  const router = useRouter();
  const info = useConta({ fresco: true });
  const volta = useVolta();
  const [codigo, setCodigo] = React.useState("");
  const [recuperacao, setRecuperacao] = React.useState(false);
  const [confiar, setConfiar] = React.useState(false);
  const [ocupado, setOcupado] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const campo = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!volta || info.estado === "carregando" || info.estado === "mfa" || info.estado === "erro") return;
    router.replace(info.estado === "anonimo" ? linkEntrar(volta) : destinoDoEstado(info.estado, volta) ?? volta);
  }, [info.estado, volta, router]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!codigo.trim()) return;
    setOcupado(true);
    setErro(null);
    try {
      const r = await fetch("/api/conta/mfa", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ codigo: codigo.trim(), recuperacao, confiar }),
      });
      if (!r.ok) {
        setErro(r.status === 401 ? t("errorSession") : r.status === 429 ? t("errorTooMany") : t("errorCode"));
        setOcupado(false);
        campo.current?.focus();
        return;
      }
      const novo = await recarregarConta();
      router.replace(destinoDoEstado(novo.estado, volta ?? "/vagas") ?? "/");
    } catch {
      setErro(t("errorGeneric"));
      setOcupado(false);
    }
  }

  return (
    <TelaConta titulo={t("codeTitle")}>
      <form onSubmit={enviar} className="flex flex-col gap-4">
        <p className="text-sm text-muted">{recuperacao ? t("codeRecoveryBody") : t("codeBody")}</p>
        <Field label={recuperacao ? t("recoveryLabel") : t("codeLabel")} error={erro ?? undefined}>
          <Input
            ref={campo}
            name="codigo"
            autoComplete="one-time-code"
            inputMode={recuperacao ? "text" : "numeric"}
            maxLength={recuperacao ? 32 : 6}
            pattern={recuperacao ? undefined : "[0-9]{6}"}
            value={codigo}
            onChange={(e) => setCodigo(recuperacao ? e.target.value : e.target.value.replace(/\D/g, ""))}
            autoFocus
            required
          />
        </Field>
        <label className="flex gap-3 text-[13px]">
          <input type="checkbox" checked={confiar} onChange={(e) => setConfiar(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t("rememberDevice")}</span>
        </label>
        <Button type="submit" size="lg" data-action="confirmar-codigo" disabled={ocupado || !codigo.trim()}>
          {ocupado ? t("checking") : t("codeConfirm")}
        </Button>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <button type="button" className="text-sm text-brand" onClick={() => { setRecuperacao((v) => !v); setCodigo(""); setErro(null); }}>
            {recuperacao ? t("useAppCode") : t("useRecoveryCode")}
          </button>
          <button type="button" className="text-sm text-muted" onClick={async () => { if (!(await sair())) setErro(t("signOutError")); }}>
            {t("signOut")}
          </button>
        </div>
      </form>
    </TelaConta>
  );
}
