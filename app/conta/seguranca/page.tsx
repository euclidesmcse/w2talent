"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Field, Input } from "@/components/ui";
import { QrCode } from "@/components/qr-code";
import { TelaConta, useVolta } from "@/components/tela-conta";
import { linkEntrar, recarregarConta, useConta } from "@/lib/conta-client";

type Config = { uri: string; segredo: string; codigos: string[] };

function segredoDaUri(uri: string): string {
  try { return new URL(uri).searchParams.get("secret") ?? ""; } catch { return ""; }
}

async function post(caminho: string, corpo: Record<string, unknown> = {}): Promise<{ ok: boolean; status: number; j: Record<string, unknown> }> {
  const r = await fetch(`/api/auth${caminho}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) });
  return { ok: r.ok, status: r.status, j: ((await r.json().catch(() => ({}))) ?? {}) as Record<string, unknown> };
}

/**
 * Segurança da conta (1.5.5): ligar o autenticador (QR + 10 códigos de recuperação),
 * gerar novos códigos e, só para candidato, desligar (para recrutador é obrigatório).
 */
export default function SegurancaPage() {
  const t = useTranslations("conta");
  const router = useRouter();
  const info = useConta();
  const volta = useVolta("/");
  const [config, setConfig] = React.useState<Config | null>(null);
  const [codigo, setCodigo] = React.useState("");
  const [novosCodigos, setNovosCodigos] = React.useState<string[] | null>(null);
  const [ocupado, setOcupado] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [aviso, setAviso] = React.useState<string | null>(null);
  const titulo = React.useRef<HTMLHeadingElement>(null);

  React.useEffect(() => {
    if (!volta) return;
    if (info.estado === "anonimo") router.replace(linkEntrar("/conta/seguranca"));
    else if (info.estado === "mfa") router.replace(`/entrar/codigo?volta=${encodeURIComponent("/conta/seguranca")}`);
    else if (info.estado === "sem_perfil") router.replace(`/entrar/perfil?volta=${encodeURIComponent("/conta/seguranca")}`);
  }, [info.estado, volta, router]);

  const ligado = !!info.conta?.mfaLigado;
  const recrutador = info.conta?.perfil === "recrutador";

  async function comecar() {
    setOcupado(true);
    setErro(null);
    const r = await post("/two-factor/enable").catch(() => null);
    setOcupado(false);
    const uri = typeof r?.j.totpURI === "string" ? r.j.totpURI : "";
    if (!r?.ok || !uri) return setErro(t("errorGeneric"));
    setConfig({ uri, segredo: segredoDaUri(uri), codigos: Array.isArray(r.j.backupCodes) ? (r.j.backupCodes as string[]) : [] });
  }

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    setOcupado(true);
    setErro(null);
    const r = await post("/two-factor/verify-totp", { code: codigo.trim() }).catch(() => null);
    if (!r?.ok) {
      setOcupado(false);
      return setErro(t("errorCode"));
    }
    const novo = await recarregarConta();
    setOcupado(false);
    setCodigo("");
    setAviso(t("mfaOn"));
    titulo.current?.focus();
    // Recrutador que veio obrigado: segue para onde ia (os códigos já foram mostrados na etapa anterior).
    if (novo.estado === "ok" && volta && volta !== "/" && recrutador) router.replace(volta);
    else setConfig(null);
  }

  async function desligar() {
    if (!window.confirm(t("mfaOffConfirm"))) return;
    setOcupado(true);
    setErro(null);
    const r = await post("/two-factor/disable").catch(() => null);
    setOcupado(false);
    if (!r?.ok) return setErro(r?.status === 403 && recrutador ? t("mfaRequired") : t("errorGeneric"));
    await recarregarConta();
    setAviso(t("mfaOff"));
  }

  async function gerarCodigos() {
    setOcupado(true);
    setErro(null);
    const r = await post("/two-factor/generate-backup-codes").catch(() => null);
    setOcupado(false);
    if (!r?.ok || !Array.isArray(r.j.backupCodes)) return setErro(t("errorGeneric"));
    setNovosCodigos(r.j.backupCodes as string[]);
  }

  const listaCodigos = (codigos: string[]) => (
    <div className="flex flex-col gap-2">
      <p className="text-[13px] text-muted">{t("recoveryHint")}</p>
      <ul data-testid="codigos-recuperacao" className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-control border border-line bg-canvas p-3 font-mono text-[14px]">
        {codigos.map((c) => <li key={c}>{c}</li>)}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" type="button" onClick={() => { void navigator.clipboard?.writeText(codigos.join("\n")).then(() => setAviso(t("copied"))).catch(() => {}); }}>
          {t("copy")}
        </Button>
        <a
          className="inline-flex h-8 items-center rounded-control border border-line px-3 text-[13px] font-medium text-ink hover:no-underline"
          download="w2talent-codigos-de-recuperacao.txt"
          href={`data:text/plain;charset=utf-8,${encodeURIComponent(codigos.join("\n") + "\n")}`}
        >
          {t("download")}
        </a>
      </div>
    </div>
  );

  if (info.estado === "carregando" || info.estado === "anonimo" || info.estado === "mfa" || info.estado === "sem_perfil") {
    return <TelaConta titulo={t("securityTitle")}><p aria-busy="true" className="text-sm text-muted">{t("continuingBody")}</p></TelaConta>;
  }

  return (
    <TelaConta titulo={t("securityTitle")} tituloRef={titulo}>
      {info.estado === "mfa_obrigatorio" ? (
        <p role="status" className="rounded-card border border-warning bg-warning-soft px-3.5 py-2.5 text-[13px] text-warning-ink">{t("mfaRequiredBody")}</p>
      ) : null}
      {aviso ? <p role="status" className="text-sm text-success">{aviso}</p> : null}
      <section className="flex flex-col gap-3">
        <h2 className="text-[15px] font-semibold">{t("authenticator")}</h2>
        <p className="text-sm">
          {ligado ? t("mfaStatusOn") : t("mfaStatusOff")}
        </p>
        {!ligado && !config ? (
          <>
            <p className="text-[13px] text-muted">{t("mfaWhy")}</p>
            <Button size="lg" data-action="ligar-autenticador" disabled={ocupado} onClick={comecar}>{t("mfaStart")}</Button>
          </>
        ) : null}
        {!ligado && config ? (
          <form onSubmit={confirmar} className="flex flex-col gap-4">
            <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm">
              <li>
                {t("step1")}
                <div className="mt-2 flex flex-col items-start gap-2">
                  <QrCode texto={config.uri} rotulo={t("qrLabel")} />
                  <a href={config.uri} className="text-[13px]">{t("openInApp")}</a>
                  <p className="text-[13px] text-muted">
                    {t("manualKey")} <code data-testid="segredo" className="break-all font-mono text-ink">{config.segredo}</code>
                  </p>
                </div>
              </li>
              <li>
                {t("step2")}
                <div className="mt-2">{listaCodigos(config.codigos)}</div>
              </li>
              <li>{t("step3")}</li>
            </ol>
            <Field label={t("codeLabel")} error={erro ?? undefined}>
              <Input name="codigo" autoComplete="one-time-code" inputMode="numeric" maxLength={6} pattern="[0-9]{6}" required value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))} />
            </Field>
            <Button type="submit" size="lg" data-action="confirmar-autenticador" disabled={ocupado || codigo.length !== 6}>
              {ocupado ? t("checking") : t("mfaConfirm")}
            </Button>
          </form>
        ) : null}
        {ligado ? (
          <div className="flex flex-col gap-3">
            {novosCodigos ? listaCodigos(novosCodigos) : null}
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" disabled={ocupado} onClick={gerarCodigos}>{t("newRecoveryCodes")}</Button>
              {!recrutador ? <Button variant="ghost" disabled={ocupado} onClick={desligar}>{t("mfaTurnOff")}</Button> : null}
            </div>
            {recrutador ? <p className="text-[13px] text-muted">{t("mfaRequired")}</p> : null}
          </div>
        ) : null}
        {erro && !config ? <p role="alert" className="text-sm text-danger">{erro}</p> : null}
      </section>
    </TelaConta>
  );
}
