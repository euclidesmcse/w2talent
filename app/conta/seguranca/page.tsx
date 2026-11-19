"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { TreinoConsentimento } from "@/components/treino-consentimento";
import { Button, Field, Input } from "@/components/ui";
import { CampoSenha } from "@/components/campo-senha";
import { QrCode } from "@/components/qr-code";
import { TelaConta, useVolta } from "@/components/tela-conta";
import { useTurnstile } from "@/components/turnstile";
import { WhatsappConta } from "@/components/whatsapp-conta";
import { SENHA_MAX, SENHA_MIN, linkEntrar, postAuth, recarregarConta, useConta, type RespostaAuth } from "@/lib/conta-client";

type Config = { uri: string; segredo: string; codigos: string[] };

function segredoDaUri(uri: string): string {
  try { return new URL(uri).searchParams.get("secret") ?? ""; } catch { return ""; }
}

function post(caminho: string, corpo: Record<string, unknown> = {}): Promise<RespostaAuth> {
  return postAuth(caminho, corpo);
}

/**
 * Segurança da conta (1.5.5): ligar o autenticador (QR + 10 códigos de recuperação),
 * gerar novos códigos e, só para candidato, desligar (para recrutador é obrigatório).
 * 3.5a: candidato também liga ou desliga aqui os avisos pelo WhatsApp (components/whatsapp-conta.tsx).
 * Senha: quem tem senha troca aqui (e confirma com ela o autenticador); quem não tem pede o
 * link para criar uma (só com o envio de e-mail ligado, config.senha).
 */
export default function SegurancaPage() {
  const t = useTranslations("conta");
  const tt = useTranslations("treino");
  const router = useRouter();
  const info = useConta({ fresco: true });
  const volta = useVolta("/");
  const [config, setConfig] = React.useState<Config | null>(null);
  const [codigo, setCodigo] = React.useState("");
  const [novosCodigos, setNovosCodigos] = React.useState<string[] | null>(null);
  const [ocupado, setOcupado] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [aviso, setAviso] = React.useState<string | null>(null);
  const titulo = React.useRef<HTMLHeadingElement>(null);
  // Senha da conta: confirma o autenticador (Better Auth pede quando a conta tem senha).
  const [senhaMfa, setSenhaMfa] = React.useState("");
  // Seção Senha
  const [senhaAtual, setSenhaAtual] = React.useState("");
  const [senhaNova, setSenhaNova] = React.useState("");
  const [ocupadoSenha, setOcupadoSenha] = React.useState(false);
  const [erroAtual, setErroAtual] = React.useState<string | null>(null);
  const [erroNova, setErroNova] = React.useState<string | null>(null);
  const [erroSenha, setErroSenha] = React.useState<string | null>(null);
  const [avisoSenha, setAvisoSenha] = React.useState<string | null>(null);
  const campoAtual = React.useRef<HTMLInputElement>(null);
  const campoNova = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!volta) return;
    if (info.estado === "anonimo") router.replace(linkEntrar("/conta/seguranca"));
    else if (info.estado === "mfa") router.replace(`/entrar/codigo?volta=${encodeURIComponent("/conta/seguranca")}`);
    else if (info.estado === "sem_perfil") router.replace(`/entrar/perfil?volta=${encodeURIComponent("/conta/seguranca")}`);
  }, [info.estado, volta, router]);

  const ligado = !!info.conta?.mfaLigado;
  const recrutador = info.conta?.perfil === "recrutador";
  const temSenha = !!info.conta?.temSenha;
  const senhaLigada = !!info.config?.senha;
  // "Criar senha" usa o mesmo pedido do Esqueci a senha, que passa pelo desafio da Cloudflare.
  const podeCriarSenha = !temSenha && senhaLigada && !!info.conta?.email;
  const captcha = useTurnstile(podeCriarSenha ? info.config?.turnstileSiteKey : null);
  const comSenha = (): Record<string, unknown> => (temSenha ? { password: senhaMfa } : {});
  const erroMfa = (r: RespostaAuth | null) => (r?.code === "INVALID_PASSWORD" ? t("errorCurrentPassword") : r?.status === 429 ? t("errorTooMany") : t("errorGeneric"));

  async function comecar() {
    setOcupado(true);
    setErro(null);
    const r = await post("/two-factor/enable", comSenha()).catch(() => null);
    setOcupado(false);
    const uri = typeof r?.j.totpURI === "string" ? r.j.totpURI : "";
    if (!r?.ok || !uri) return setErro(erroMfa(r));
    setSenhaMfa("");
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
    const r = await post("/two-factor/disable", comSenha()).catch(() => null);
    setOcupado(false);
    if (!r?.ok) return setErro(r?.status === 403 && recrutador ? t("mfaRequired") : erroMfa(r));
    setSenhaMfa("");
    await recarregarConta();
    setAviso(t("mfaOff"));
  }

  async function gerarCodigos() {
    setOcupado(true);
    setErro(null);
    const r = await post("/two-factor/generate-backup-codes", comSenha()).catch(() => null);
    setOcupado(false);
    if (!r?.ok || !Array.isArray(r.j.backupCodes)) return setErro(erroMfa(r));
    setSenhaMfa("");
    setNovosCodigos(r.j.backupCodes as string[]);
  }

  async function trocarSenha(e: React.FormEvent) {
    e.preventDefault();
    setErroAtual(null);
    setErroNova(null);
    setErroSenha(null);
    setAvisoSenha(null);
    if (senhaNova.length < SENHA_MIN) {
      setErroNova(t("errorPasswordShort"));
      campoNova.current?.focus();
      return;
    }
    setOcupadoSenha(true);
    const r = await post("/change-password", { currentPassword: senhaAtual, newPassword: senhaNova, revokeOtherSessions: true }).catch(() => null);
    setOcupadoSenha(false);
    if (r?.ok) {
      setSenhaAtual("");
      setSenhaNova("");
      setAvisoSenha(t("passwordChanged"));
      return;
    }
    if (r?.code === "INVALID_PASSWORD") {
      setErroAtual(t("errorCurrentPassword"));
      campoAtual.current?.focus();
    } else if (r?.code === "PASSWORD_COMPROMISED") {
      setErroNova(t("errorPasswordCompromised"));
      campoNova.current?.focus();
    } else if (r?.code === "PASSWORD_TOO_SHORT") {
      setErroNova(t("errorPasswordShort"));
      campoNova.current?.focus();
    } else setErroSenha(r?.status === 429 ? t("errorTooMany") : r?.status === 401 ? t("errorSession") : t("errorGeneric"));
  }

  async function criarSenha() {
    if (!info.conta?.email) return;
    setErroSenha(null);
    setAvisoSenha(null);
    setOcupadoSenha(true);
    const r = await postAuth("/request-password-reset", { email: info.conta.email, redirectTo: "/entrar/nova-senha" }, captcha.headers()).catch(() => null);
    captcha.reset();
    setOcupadoSenha(false);
    if (r?.ok) setAvisoSenha(t("createPasswordSent"));
    else setErroSenha(r?.status === 429 ? t("errorTooMany") : t("errorGeneric"));
  }

  const campoSenhaMfa = temSenha ? (
    <CampoSenha
      label={t("passwordLabel")}
      hint={t("mfaPasswordHint")}
      mostrar={t("showPassword")}
      esconder={t("hidePassword")}
      name="senha-autenticador"
      autoComplete="current-password"
      maxLength={SENHA_MAX}
      value={senhaMfa}
      onChange={(e) => setSenhaMfa(e.target.value)}
    />
  ) : null;
  const faltaSenhaMfa = temSenha && !senhaMfa;

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
            {campoSenhaMfa}
            <Button size="lg" data-action="ligar-autenticador" disabled={ocupado || faltaSenhaMfa} onClick={comecar}>{t("mfaStart")}</Button>
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
            {campoSenhaMfa}
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" disabled={ocupado || faltaSenhaMfa} onClick={gerarCodigos}>{t("newRecoveryCodes")}</Button>
              {!recrutador ? <Button variant="ghost" disabled={ocupado || faltaSenhaMfa} onClick={desligar}>{t("mfaTurnOff")}</Button> : null}
            </div>
            {recrutador ? <p className="text-[13px] text-muted">{t("mfaRequired")}</p> : null}
          </div>
        ) : null}
        {erro && !config ? <p role="alert" className="text-sm text-danger">{erro}</p> : null}
      </section>
      {senhaLigada && (temSenha || podeCriarSenha) ? (
        <section className="flex flex-col gap-3 border-t border-line pt-5" aria-labelledby="secao-senha">
          <h2 id="secao-senha" className="text-[15px] font-semibold">{t("passwordSection")}</h2>
          <p className="text-sm">{temSenha ? t("passwordStatusOn") : t("passwordStatusOff")}</p>
          {temSenha ? (
            <form onSubmit={trocarSenha} className="flex flex-col gap-4">
              <CampoSenha
                ref={campoAtual}
                label={t("currentPasswordLabel")}
                error={erroAtual ?? undefined}
                mostrar={t("showPassword")}
                esconder={t("hidePassword")}
                name="current-password"
                autoComplete="current-password"
                maxLength={SENHA_MAX}
                required
                value={senhaAtual}
                onChange={(e) => setSenhaAtual(e.target.value)}
              />
              <CampoSenha
                ref={campoNova}
                label={t("newPasswordLabel")}
                hint={t("passwordRule")}
                error={erroNova ?? undefined}
                mostrar={t("showPassword")}
                esconder={t("hidePassword")}
                name="new-password"
                autoComplete="new-password"
                maxLength={SENHA_MAX}
                required
                value={senhaNova}
                onChange={(e) => setSenhaNova(e.target.value)}
              />
              <Button type="submit" variant="secondary" data-action="trocar-senha" disabled={ocupadoSenha || !senhaAtual || !senhaNova}>
                {ocupadoSenha ? t("saving") : t("changePassword")}
              </Button>
            </form>
          ) : (
            <>
              {captcha.caixa}
              <Button variant="secondary" data-action="criar-senha" disabled={ocupadoSenha || !captcha.pronto} onClick={criarSenha}>
                {ocupadoSenha ? t("sending") : t("createPassword")}
              </Button>
            </>
          )}
          {avisoSenha ? <p role="status" className="text-sm text-success">{avisoSenha}</p> : null}
          {erroSenha ? <p role="alert" className="text-sm text-danger">{erroSenha}</p> : null}
        </section>
      ) : null}
      {info.estado === "ok" && info.conta?.perfil === "candidato" ? <WhatsappConta /> : null}
      {info.estado === "ok" ? (
        <section className="flex flex-col gap-3 border-t border-line pt-5">
          <h2 className="text-[15px] font-semibold">{tt("titulo")}</h2>
          <TreinoConsentimento />
        </section>
      ) : null}
    </TelaConta>
  );
}
