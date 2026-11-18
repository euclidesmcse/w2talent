"use client";
/**
 * 3.4a Integração com ATS, na tela Minha empresa: endereço, ligar/desligar, novo segredo (aparece uma
 * vez), enviar teste e as últimas 20 entregas. Só o dono da empresa configura (a API confere).
 * 3.4b: depois de 50 falhas seguidas a integração fica "Pausada"; Ativar liga de novo e zera a contagem.
 */
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button, Card, CardBody, Field, Input, useToast } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import { contaRecusada } from "@/lib/conta-client";

type Entrega = { id: string; createdAt: string; evento: string; status: number | null; erro: string | null; tentativa: number; ok: boolean };
type Config = { url: string; ativo: boolean; falhasSeguidas: number; pausada: boolean; pausadaEm: string | null; createdAt: string; entregas: Entrega[] } | null;
type Resposta = { webhook?: Config; segredo?: string | null; teste?: { ok: boolean; status: number | null; erro: string | null }; error?: string; motivo?: string };

const API = "/api/conta/empresa/webhook";
const MOTIVOS = ["vazia", "invalida", "https", "credenciais", "porta", "host_privado", "longa"];

export function EmpresaWebhook() {
  const t = useTranslations("empresa.ats");
  const locale = useLocale();
  const { show } = useToast();
  const [config, setConfig] = React.useState<Config | undefined>(undefined);
  const [bloqueio, setBloqueio] = React.useState<string | null>(null);
  const [url, setUrl] = React.useState("");
  const [erroUrl, setErroUrl] = React.useState<string | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);
  const [segredo, setSegredo] = React.useState<string | null>(null);
  const [ocupado, setOcupado] = React.useState(false);

  const aplicar = (j: Resposta) => {
    if (j.webhook !== undefined) {
      setConfig(j.webhook);
      if (j.webhook) setUrl(j.webhook.url);
    }
    if (j.segredo) setSegredo(j.segredo);
  };

  React.useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await fetch(API, { cache: "no-store" });
        const j = (await r.json().catch(() => ({}))) as Resposta;
        if (!vivo) return;
        if (r.ok) aplicar(j);
        else if (j.error === "so_dono" || j.error === "rejeitada") setBloqueio(j.error);
        else {
          if (r.status === 401 || (r.status === 403 && j.error !== "origem_invalida")) contaRecusada();
          setConfig(null);
          setErro(t("erros.generic"));
        }
      } catch {
        if (vivo) {
          setConfig(null);
          setErro(t("erros.generic"));
        }
      }
    })();
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pedir = async (method: "PATCH" | "POST", body: unknown): Promise<Resposta | null> => {
    setOcupado(true);
    setErro(null);
    setErroUrl(null);
    try {
      const r = await fetch(API, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const j = (await r.json().catch(() => ({}))) as Resposta;
      if (r.ok) {
        aplicar(j);
        return j;
      }
      if (j.error === "url") setErroUrl(t(`erros.url_${MOTIVOS.includes(j.motivo ?? "") ? j.motivo : "invalida"}`));
      else if (j.error === "sem_chave") setErro(t("erros.sem_chave"));
      else if (j.error === "limite_dia") setErro(t("erros.limite_dia"));
      else if (j.error === "so_dono" || j.error === "rejeitada") setBloqueio(j.error);
      else {
        if (r.status === 401 || (r.status === 403 && j.error !== "origem_invalida")) contaRecusada();
        setErro(t("erros.generic"));
      }
      return null;
    } catch {
      setErro(t("erros.generic"));
      return null;
    } finally {
      setOcupado(false);
    }
  };

  const salvar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const criar = !config;
    const j = await pedir("PATCH", { url });
    if (j) show(criar ? t("criada") : t("salva"), "success");
  };

  const ligar = async (ativo: boolean) => {
    const j = await pedir("PATCH", { ativo });
    if (j) show(ativo ? t("ativada") : t("desativada"), "success");
  };

  const trocarSegredo = async () => {
    if (!window.confirm(t("segredoConfirma"))) return;
    await pedir("POST", { acao: "segredo" });
  };

  const testar = async () => {
    const j = await pedir("POST", { acao: "teste" });
    if (j?.teste) show(j.teste.ok ? t("testeOk") : t("testeFalhou", { resultado: resultado(j.teste.status, j.teste.erro) }), j.teste.ok ? "success" : "error");
  };

  const copiar = async () => {
    if (!segredo) return;
    try {
      await navigator.clipboard.writeText(segredo);
      show(t("copiado"), "success");
    } catch {
      show(t("copiarFalhou"), "error");
    }
  };

  const resultado = (status: number | null, erroEntrega: string | null) =>
    erroEntrega === "pausado"
      ? t("resultadoErro.pausado")
      : status != null ? (status >= 200 && status < 300 ? t("resultadoOk", { status }) : t("resultadoHttp", { status })) : t(`resultadoErro.${erroEntrega && ["tempo", "rede", "url", "segredo", "candidatura_apagada"].includes(erroEntrega) ? erroEntrega : "outro"}`);

  const data = (iso: string) => new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
  const evento = (e: string) => t(`eventos.${e === "candidatura.recebida" ? "recebida" : e === "candidatura.etapa" ? "etapa" : "teste"}`);

  return (
    <Card className="mt-6 max-w-[640px]" data-testid="integracao-ats">
      <CardBody>
        <h2 className="text-base font-semibold">{t("title")}</h2>
        <p className="mt-1 text-[13px] text-muted">
          {t("intro")}{" "}
          <a href="/ajuda/minha-empresa" className="font-medium">{t("ajuda")}</a>
        </p>

        {config === undefined && !bloqueio ? (
          <p aria-busy="true" className="mt-4 text-[13px] text-muted">{t("carregando")}</p>
        ) : bloqueio ? (
          <p role="status" className="mt-4 text-[13px] text-muted">{t(bloqueio === "so_dono" ? "soDono" : "rejeitada")}</p>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            {config ? (
              <p className="text-[13px] font-medium" data-webhook-ativo={config.ativo ? "sim" : config.pausada ? "pausada" : "nao"}>
                {t("statusLabel")}:{" "}
                <span
                  className={cn(
                    "ml-1 inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-semibold",
                    config.ativo ? "bg-success-soft text-success-ink" : config.pausada ? "bg-danger-soft text-danger-ink" : "bg-warning-soft text-warning-ink",
                  )}
                >
                  {config.ativo ? t("ativa") : config.pausada ? t("pausada") : t("desligada")}
                </span>
              </p>
            ) : null}

            {config?.pausada ? (
              <div role="status" className="rounded-card border border-line bg-danger-soft p-4 text-danger-ink" data-testid="webhook-pausado">
                <p className="text-[13px] font-semibold">{config.pausadaEm ? t("pausadaTitulo", { data: data(config.pausadaEm) }) : t("pausadaTituloSemData")}</p>
                <p className="mt-1 text-[13px]">{t("pausadaTexto", { n: config.falhasSeguidas })}</p>
              </div>
            ) : null}

            <form onSubmit={salvar} className="flex flex-col gap-3" noValidate>
              <Field label={t("url")} hint={t("urlHint")} error={erroUrl ?? undefined}>
                <Input type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" maxLength={500} aria-invalid={!!erroUrl} autoComplete="off" spellCheck={false} />
              </Field>
              <div>
                <Button type="submit" disabled={ocupado || !url.trim() || (!!config && url.trim() === config.url)}>{config ? t("salvar") : t("criar")}</Button>
              </div>
            </form>

            {segredo ? (
              <div role="status" className="rounded-card border border-line bg-brand-soft p-4" data-testid="segredo-webhook">
                <p className="text-[13px] font-semibold">{t("segredoTitulo")}</p>
                <p className="mt-1 text-[13px]">{t("segredoUmaVez")}</p>
                <code className="mt-2 block break-all rounded-card bg-surface px-3 py-2 text-[13px]">{segredo}</code>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={copiar}>{t("copiar")}</Button>
                  <Button size="sm" variant="ghost" onClick={() => setSegredo(null)}>{t("segredoGuardei")}</Button>
                </div>
              </div>
            ) : null}

            {config ? (
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" disabled={ocupado} onClick={() => ligar(!config.ativo)}>{config.ativo ? t("desativar") : t("ativar")}</Button>
                <Button variant="secondary" disabled={ocupado} onClick={testar}>{t("teste")}</Button>
                <Button variant="ghost" disabled={ocupado} onClick={trocarSegredo}>{t("novoSegredo")}</Button>
              </div>
            ) : null}

            {erro ? <p role="alert" className="text-[13px] text-danger">{erro}</p> : null}

            {config ? (
              <div>
                <h3 className="text-[13px] font-semibold">{t("entregas")}</h3>
                {config.entregas.length === 0 ? (
                  <p className="mt-1 text-[13px] text-muted">{t("semEntregas")}</p>
                ) : (
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full text-left text-[13px]">
                      <thead>
                        <tr className="border-b border-line text-muted">
                          <th scope="col" className="py-1.5 pr-3 font-medium">{t("colData")}</th>
                          <th scope="col" className="py-1.5 pr-3 font-medium">{t("colEvento")}</th>
                          <th scope="col" className="py-1.5 font-medium">{t("colResultado")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {config.entregas.map((e) => (
                          <tr key={e.id} className="border-b border-line last:border-0">
                            <td className="whitespace-nowrap py-1.5 pr-3">{data(e.createdAt)}</td>
                            <td className="py-1.5 pr-3">{evento(e.evento)}</td>
                            <td className={cn("py-1.5", e.ok ? "text-success-ink" : "text-danger")}>
                              {resultado(e.status, e.erro)}
                              {e.tentativa > 1 ? <span className="text-muted"> · {t("tentativa", { n: e.tentativa })}</span> : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
