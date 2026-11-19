"use client";
import * as React from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Button, Field, Input } from "@/components/ui";
import { textoConsentimento } from "@/lib/consentimento";

type Estado = {
  temFicha: boolean;
  ligado: boolean;
  numero: string | null;
  sugestao: string | null;
  pendente: { numero: string; expiraEm: string } | null;
  modoTeste: boolean;
};

const ERROS: Record<string, string> = {
  vazio: "errorNumber",
  invalido: "errorNumber",
  fixo: "errorLandline",
  limite: "errorLimit",
  envio: "errorSend",
  sem_pedido: "errorExpired",
  expirado: "errorExpired",
  tentativas: "errorAttempts",
  codigo: "errorCode",
  consentimento: "errorConsent",
  sem_ficha: "noProfile",
};

async function chamar(metodo: "GET" | "POST", corpo?: Record<string, unknown>): Promise<{ ok: boolean; j: Record<string, unknown> }> {
  const r = await fetch("/api/conta/whatsapp", {
    method: metodo,
    headers: corpo ? { "content-type": "application/json" } : undefined,
    body: corpo ? JSON.stringify(corpo) : undefined,
    cache: "no-store",
  });
  return { ok: r.ok, j: ((await r.json().catch(() => ({}))) ?? {}) as Record<string, unknown> };
}

/**
 * 3.5a Avisos pelo WhatsApp em Minha conta (só candidato): celular → código de 6 dígitos → aceite → ligado.
 * Desligar vale na hora. Desligado por padrão.
 */
export function WhatsappConta() {
  const t = useTranslations("whatsapp");
  const locale = useLocale();
  const [estado, setEstado] = React.useState<Estado | null>(null);
  const [falhaLeitura, setFalhaLeitura] = React.useState(false);
  const [numero, setNumero] = React.useState("");
  const [codigo, setCodigo] = React.useState("");
  const [aceite, setAceite] = React.useState(false);
  const [trocar, setTrocar] = React.useState(false);
  const [ocupado, setOcupado] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [aviso, setAviso] = React.useState<string | null>(null);
  const idErro = React.useId();

  const carregar = React.useCallback(async () => {
    const r = await chamar("GET").catch(() => null);
    if (!r?.ok) return setFalhaLeitura(true);
    const e = r.j as unknown as Estado;
    setEstado(e);
    setNumero((n) => n || e.sugestao || "");
  }, []);

  React.useEffect(() => {
    void carregar();
  }, [carregar]);

  const falha = (j: Record<string, unknown>) => setErro(t(ERROS[String(j.error)] ?? "errorGeneric"));

  async function pedir(e: React.FormEvent) {
    e.preventDefault();
    setOcupado(true);
    setErro(null);
    setAviso(null);
    const r = await chamar("POST", { acao: "codigo", numero }).catch(() => null);
    setOcupado(false);
    if (!r?.ok) return r ? falha(r.j) : setErro(t("errorGeneric"));
    setCodigo("");
    setAceite(false);
    setTrocar(false);
    setEstado((s) => (s ? { ...s, pendente: { numero: String(r.j.numero), expiraEm: String(r.j.expiraEm) }, modoTeste: !!r.j.modoTeste } : s));
  }

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    setOcupado(true);
    setErro(null);
    const r = await chamar("POST", { acao: "confirmar", codigo, aceite }).catch(() => null);
    setOcupado(false);
    if (!r?.ok) return r ? falha(r.j) : setErro(t("errorGeneric"));
    setEstado(r.j.estado as Estado);
    setAviso(t("turnedOn"));
  }

  async function desligar() {
    setOcupado(true);
    setErro(null);
    const r = await chamar("POST", { acao: "desligar" }).catch(() => null);
    setOcupado(false);
    if (!r?.ok) return setErro(t("errorGeneric"));
    setEstado(r.j.estado as Estado);
    setNumero("");
    setAviso(t("turnedOff"));
  }

  return (
    <section className="flex flex-col gap-3 border-t border-line pt-4" aria-labelledby="whatsapp-titulo" data-testid="whatsapp-conta">
      <h2 id="whatsapp-titulo" className="text-[15px] font-semibold">{t("title")}</h2>
      {aviso ? <p role="status" className="text-sm text-success">{aviso}</p> : null}
      {!estado ? (
        falhaLeitura ? <p role="alert" className="text-sm text-danger">{t("errorGeneric")}</p> : <p aria-busy="true" className="text-sm text-muted">{t("loading")}</p>
      ) : !estado.temFicha ? (
        <p className="text-sm text-muted">
          {t("noProfile")} <Link href="/minha-ficha">{t("noProfileCta")}</Link>
        </p>
      ) : estado.ligado ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm">{t("statusOn", { numero: estado.numero ?? "" })}</p>
          <p className="text-[13px] text-muted">{t("statusOnHint")}</p>
          <div>
            <Button variant="secondary" data-action="desligar-whatsapp" disabled={ocupado} onClick={desligar}>{t("turnOff")}</Button>
          </div>
        </div>
      ) : estado.pendente && !trocar ? (
        <form onSubmit={confirmar} className="flex flex-col gap-3">
          <p className="text-sm">{t("codeSent", { numero: estado.pendente.numero })}</p>
          {estado.modoTeste ? <p className="rounded-card border border-warning bg-warning-soft px-3.5 py-2.5 text-[13px] text-warning-ink">{t("testMode")}</p> : null}
          <Field label={t("codeLabel")}>
            <Input
              name="codigo-whatsapp"
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={6}
              pattern="[0-9]{6}"
              required
              value={codigo}
              aria-describedby={erro ? idErro : undefined}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
            />
          </Field>
          <label className="flex gap-3 text-[13px]">
            <input type="checkbox" data-consent="whatsapp" checked={aceite} onChange={(e) => setAceite(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{textoConsentimento("whatsapp", locale)}</span>
          </label>
          {erro ? <p id={idErro} role="alert" className="text-sm text-danger">{erro}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" data-action="confirmar-whatsapp" disabled={ocupado || codigo.length !== 6 || !aceite}>
              {ocupado ? t("checking") : t("confirm")}
            </Button>
            <Button variant="ghost" disabled={ocupado} onClick={() => { setTrocar(true); setErro(null); }}>{t("changeNumber")}</Button>
          </div>
        </form>
      ) : (
        <form onSubmit={pedir} className="flex flex-col gap-3">
          <p className="text-sm">{t("statusOff")}</p>
          <p className="text-[13px] text-muted">{t("why")}</p>
          <Field label={t("numberLabel")} hint={t("numberHint")}>
            <Input
              name="celular-whatsapp"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              maxLength={30}
              required
              value={numero}
              aria-describedby={erro ? idErro : undefined}
              onChange={(e) => setNumero(e.target.value)}
            />
          </Field>
          {erro ? <p id={idErro} role="alert" className="text-sm text-danger">{erro}</p> : null}
          <div>
            <Button type="submit" data-action="pedir-codigo-whatsapp" disabled={ocupado || !numero.trim()}>
              {ocupado ? t("sending") : t("sendCode")}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
