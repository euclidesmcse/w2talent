"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Field, Input } from "@/components/ui";
import { TelaConta, useVolta } from "@/components/tela-conta";
import { destinoDoEstado, linkContinuar, linkEntrar, postAuth, recarregarConta, sair, useConta } from "@/lib/conta-client";

/**
 * Código do autenticador (1.5.5). Aceita também um código de recuperação. "Lembrar este
 * aparelho" evita pedir o código por 30 dias neste navegador.
 * - Depois do Google/Microsoft: a sessão já existe com o código pendente (/api/conta/mfa).
 * - `?via=senha` (e-mail e senha): ainda não há sessão; o Better Auth guardou um cookie do
 *   segundo passo e a sessão nasce quando o código é aceito (/api/auth/two-factor/*).
 */
export default function CodigoPage() {
  const t = useTranslations("conta");
  const router = useRouter();
  const info = useConta({ fresco: true });
  const volta = useVolta();
  // undefined até ler o endereço (antes disso não redireciona).
  const [via, setVia] = React.useState<"senha" | "social" | undefined>(undefined);
  const [codigo, setCodigo] = React.useState("");
  const [recuperacao, setRecuperacao] = React.useState(false);
  const [confiar, setConfiar] = React.useState(false);
  const [ocupado, setOcupado] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [sessaoAcabou, setSessaoAcabou] = React.useState(false);
  const campo = React.useRef<HTMLInputElement>(null);
  const porSenha = via === "senha";

  React.useEffect(() => {
    try { setVia(new URLSearchParams(window.location.search).get("via") === "senha" ? "senha" : "social"); } catch { setVia("social"); }
  }, []);

  React.useEffect(() => {
    if (!volta || !via || info.estado === "carregando" || info.estado === "mfa" || info.estado === "erro") return;
    // Pela senha ainda não há sessão: "anonimo" é o esperado aqui.
    if (info.estado === "anonimo") {
      if (!porSenha) router.replace(linkEntrar(volta));
      return;
    }
    router.replace(destinoDoEstado(info.estado, volta) ?? volta);
  }, [info.estado, volta, via, porSenha, router]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!codigo.trim()) return;
    setOcupado(true);
    setErro(null);
    setSessaoAcabou(false);
    try {
      if (porSenha) {
        const r = await postAuth(recuperacao ? "/two-factor/verify-backup-code" : "/two-factor/verify-totp", { code: codigo.trim(), trustDevice: confiar });
        if (!r.ok) {
          if (r.code === "INVALID_TWO_FACTOR_COOKIE") {
            setSessaoAcabou(true);
            setErro(t("errorSession"));
          } else setErro(r.status === 429 ? t("errorTooMany") : t("errorCode"));
          setOcupado(false);
          campo.current?.focus();
          return;
        }
        const novo = await recarregarConta();
        const v = volta ?? "/vagas";
        router.replace(destinoDoEstado(novo.estado, v) ?? linkContinuar(v));
        return;
      }
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
        {sessaoAcabou ? (
          <a href={linkEntrar(volta ?? "/vagas")} className="text-sm font-semibold">{t("signInAgain")}</a>
        ) : null}
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
          {porSenha ? (
            <a href={linkEntrar(volta ?? "/vagas")} className="text-sm text-muted">{t("cancel")}</a>
          ) : (
            <button type="button" className="text-sm text-muted" onClick={async () => { if (!(await sair())) setErro(t("signOutError")); }}>
              {t("signOut")}
            </button>
          )}
        </div>
      </form>
    </TelaConta>
  );
}
