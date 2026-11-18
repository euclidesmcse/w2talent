"use client";
/**
 * Minha empresa (2.1a, D1/D2): o recrutador cadastra a empresa uma vez e passa a publicar em nome dela.
 * Até o admin validar, as vagas aparecem com a etiqueta "Empresa não verificada".
 */
import * as React from "react";
import { useTranslations } from "next-intl";
import { AppHeader } from "@/components/app-header";
import { Button, Card, CardBody, Field, Input, useToast } from "@/components/ui";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { contaRecusada, linkEntrar, useConta } from "@/lib/conta-client";

type Status = "pendente" | "validado" | "rejeitado";
type Empresa = { id: string; nome: string; site: string | null; cnpj: string | null; emailContato: string | null; validacaoStatus: Status };
type Campo = "nome" | "site" | "cnpj" | "emailContato";
type Form = Record<Campo, string>;

const VAZIO: Form = { nome: "", site: "", cnpj: "", emailContato: "" };
const TOM: Record<Status, string> = {
  pendente: "bg-warning-soft text-warning-ink",
  validado: "bg-success-soft text-success-ink",
  rejeitado: "bg-danger-soft text-danger-ink",
};

function formDe(e: Empresa | null): Form {
  return e ? { nome: e.nome, site: e.site ?? "", cnpj: e.cnpj ?? "", emailContato: e.emailContato ?? "" } : VAZIO;
}

export default function EmpresaPage() {
  const t = useTranslations("empresa");
  const tc = useTranslations("conta");
  const tg = useTranslations("common");
  const { show } = useToast();
  const conta = useConta();
  const liberado = conta.estado === "ok" && conta.conta?.perfil === "recrutador";
  const [empresa, setEmpresa] = React.useState<Empresa | null | undefined>(undefined);
  const [form, setForm] = React.useState<Form>(VAZIO);
  const [erro, setErro] = React.useState<{ campo?: Campo; texto: string } | null>(null);
  const [salvando, setSalvando] = React.useState(false);

  React.useEffect(() => {
    if (!liberado) return;
    let vivo = true;
    fetch("/api/conta/empresa", { cache: "no-store" })
      .then((r) => {
        if (r.status === 401 || r.status === 403) contaRecusada();
        return r.ok ? (r.json() as Promise<{ empresa: Empresa | null }>) : { empresa: null };
      })
      .then((j) => {
        if (!vivo) return;
        setEmpresa(j.empresa);
        setForm(formDe(j.empresa));
      })
      .catch(() => { if (vivo) setEmpresa(null); });
    return () => { vivo = false; };
  }, [liberado]);

  const muda = (c: Campo) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [c]: e.target.value }));

  const salvar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch("/api/conta/empresa", {
        method: empresa ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = (await res.json().catch(() => ({}))) as { empresa?: Empresa; error?: string; campo?: Campo };
      if (res.ok && j.empresa) {
        show(empresa ? t("salva") : t("criada"), "success");
        setEmpresa(j.empresa);
        setForm(formDe(j.empresa));
        return;
      }
      if (res.status === 401 || res.status === 403) contaRecusada();
      if (j.error === "campo_invalido" && j.campo) setErro({ campo: j.campo, texto: t(`erros.${j.campo}`) });
      else if (j.error === "cnpj_em_uso") setErro({ campo: "cnpj", texto: t("erros.cnpj_em_uso") });
      else if (j.error === "ja_tem_empresa") setErro({ texto: t("erros.ja_tem_empresa") });
      else setErro({ texto: t("erros.generic") });
    } catch {
      setErro({ texto: t("erros.generic") });
    } finally {
      setSalvando(false);
    }
  };

  if (!liberado) {
    const proximo =
      conta.estado === "mfa" ? `/entrar/codigo?volta=%2Fempresa`
      : conta.estado === "sem_perfil" ? `/entrar/perfil?volta=%2Fempresa`
      : conta.estado === "mfa_obrigatorio" ? `/conta/seguranca?volta=%2Fempresa`
      : conta.estado === "ok" ? null
      : linkEntrar("/empresa");
    const corpo = conta.estado === "ok" ? t("gateCandidate") : conta.estado === "mfa_obrigatorio" ? t("mfaBody") : t("gateBody");
    return (
      <div>
        <AppHeader area="recrutador" active="/empresa" />
        <main className="mx-auto max-w-page px-4 py-6 md:px-6">
          <h1 className="text-xl font-semibold">{t("title")}</h1>
          {conta.estado === "carregando" ? (
            <p aria-busy="true" className="mt-4 text-sm text-muted">{tg("loading")}</p>
          ) : (
            <div role="status" data-testid="so-recrutador" className="mt-4 rounded-card border border-line bg-surface px-6 py-10 text-center">
              <p className="font-semibold">{t("gateTitle")}</p>
              <p className="mt-1 text-sm text-muted">{corpo}</p>
              {proximo ? (
                <a href={proximo} className={buttonClasses("primary", "md", "mt-4 hover:no-underline hover:text-white")}>
                  {conta.estado === "mfa_obrigatorio" ? tc("mfaStart") : tc("signIn")}
                </a>
              ) : null}
            </div>
          )}
        </main>
      </div>
    );
  }

  const status = empresa?.validacaoStatus;
  return (
    <div>
      <AppHeader area="recrutador" active="/empresa" />
      <main className="mx-auto max-w-page px-4 py-6 md:px-6">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="mt-1 max-w-[640px] text-sm text-muted">{t("intro")}</p>
        {empresa === undefined ? (
          <p aria-busy="true" className="mt-4 text-sm text-muted">{tg("loading")}</p>
        ) : (
          <Card className="mt-4 max-w-[640px]">
            <CardBody>
              {status ? (
                <div data-status-empresa={status} className="mb-4 flex flex-col gap-1">
                  <p className="text-[13px] font-medium">
                    {t("statusLabel")}:{" "}
                    <span className={cn("ml-1 inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-semibold", TOM[status])}>{t(`status.${status}`)}</span>
                  </p>
                  <p className="text-[13px] text-muted">{t(`statusHint.${status}`)}</p>
                </div>
              ) : null}
              <form onSubmit={salvar} className="flex flex-col gap-4" noValidate>
                <Field label={t("nome")} error={erro?.campo === "nome" ? erro.texto : undefined}>
                  <Input value={form.nome} onChange={muda("nome")} required maxLength={120} autoComplete="organization" aria-invalid={erro?.campo === "nome"} disabled={status === "rejeitado"} />
                </Field>
                <Field label={t("site")} hint={t("siteHint")} error={erro?.campo === "site" ? erro.texto : undefined}>
                  <Input value={form.site} onChange={muda("site")} inputMode="url" autoComplete="url" aria-invalid={erro?.campo === "site"} disabled={status === "rejeitado"} />
                </Field>
                <Field label={t("cnpj")} hint={t("cnpjHint")} error={erro?.campo === "cnpj" ? erro.texto : undefined}>
                  <Input value={form.cnpj} onChange={muda("cnpj")} inputMode="numeric" maxLength={18} aria-invalid={erro?.campo === "cnpj"} disabled={status === "rejeitado"} />
                </Field>
                <Field label={t("emailContato")} hint={t("emailContatoHint")} error={erro?.campo === "emailContato" ? erro.texto : undefined}>
                  <Input type="email" value={form.emailContato} onChange={muda("emailContato")} autoComplete="email" aria-invalid={erro?.campo === "emailContato"} disabled={status === "rejeitado"} />
                </Field>
                {erro && !erro.campo ? <p role="alert" className="text-[13px] text-danger">{erro.texto}</p> : null}
                {empresa && status === "validado" ? <p className="text-[13px] text-muted">{t("reverificar")}</p> : null}
                {status !== "rejeitado" ? (
                  <div>
                    <Button type="submit" disabled={salvando || !form.nome.trim()}>{empresa ? t("salvar") : t("criar")}</Button>
                  </div>
                ) : null}
              </form>
            </CardBody>
          </Card>
        )}
      </main>
    </div>
  );
}
