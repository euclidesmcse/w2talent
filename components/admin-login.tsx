"use client";
/** Entrar com a senha do admin (ADMIN_SECRET). Usado pelo Admin de IA e pela validação de empresas. */
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button, Card, CardBody, CardHeader, Field, Input } from "@/components/ui";
import { intlTag } from "@/lib/locale";

export function AdminLoginCard({ onDone, titulo }: { onDone: () => Promise<void>; titulo?: string }) {
  const t = useTranslations("admin");
  const locale = useLocale();
  const [senha, setSenha] = React.useState("");
  const [error, setError] = React.useState<string | undefined>();
  const [busy, setBusy] = React.useState(false);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const res = await fetch("/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ senha }) });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSenha("");
        await onDone();
        return;
      }
      if (data.error === "bloqueado" && data.ate) {
        setError(t("login.locked", { time: new Date(data.ate).toLocaleTimeString(intlTag(locale), { hour: "2-digit", minute: "2-digit" }) }));
      } else if (data.error === "admin_desligado") setError(t("login.disabled"));
      else if (data.error === "senha_errada") setError(t("login.wrong"));
      else setError(t("errors.generic"));
    } catch {
      setError(t("errors.generic"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="max-w-md">
      <CardHeader title={titulo ?? t("login.title")} />
      <CardBody>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <p className="text-sm text-muted">{t("login.hint")}</p>
          <Field label={t("login.password")} error={error}>
            <Input type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} aria-invalid={!!error} required />
          </Field>
          <div>
            <Button type="submit" disabled={busy || !senha}>{t("login.submit")}</Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
