"use client";
/**
 * 2.6b-1 "Falar com uma pessoa": formulário que abre a conversa (POST /api/ajuda/conversa, acao "abrir").
 * Sem login pede o e-mail (D2); com login usa o da conta. Depois de abrir, vai para o link da conversa.
 * Usado em /ajuda/conversa e, pré-preenchido com a pergunta, quando o assistente da Ajuda não sabe (D6).
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Button, Input, Textarea } from "@/components/ui";
import { useConta } from "@/lib/conta-client";

export const TEXTO_MAX = 2000;
type Erro = "erroTamanho" | "erroLimite" | "erroGeral";

export function ConversaNova({ inicial = "", perguntaId = null, de = null, prefixo = "conversa" }: { inicial?: string; perguntaId?: string | null; de?: string | null; prefixo?: string }) {
  const t = useTranslations("conversa");
  const locale = useLocale();
  const router = useRouter();
  const info = useConta();
  const [texto, setTexto] = React.useState(inicial);
  const [email, setEmail] = React.useState("");
  const [erroEmail, setErroEmail] = React.useState(false);
  const [erro, setErro] = React.useState<Erro | null>(null);
  const [enviando, setEnviando] = React.useState(false);
  // O servidor manda: se ele não reconhecer o login, pede o e-mail.
  const [pedirEmail, setPedirEmail] = React.useState(false);
  const emailDaConta = info.estado !== "mfa" ? info.conta?.email : undefined;
  const semEmail = pedirEmail || !emailDaConta;

  async function abrir(e: React.FormEvent) {
    e.preventDefault();
    const tx = texto.trim();
    setErro(null);
    if (!tx || tx.length > TEXTO_MAX) return setErro("erroTamanho");
    const emailOk = !semEmail || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
    setErroEmail(!emailOk);
    if (!emailOk) return;
    setEnviando(true);
    try {
      const r = await fetch("/api/ajuda/conversa", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ acao: "abrir", texto: tx, email: semEmail ? email.trim() : undefined, locale, de, perguntaId }),
      });
      const j = (await r.json().catch(() => ({}))) as { codigo?: string; error?: string };
      if (r.ok && j.codigo) {
        router.push(`/ajuda/conversa?c=${encodeURIComponent(j.codigo)}`);
        return;
      }
      if (j.error === "email_invalido") {
        setPedirEmail(true);
        setErroEmail(true);
      } else if (j.error === "texto_invalido") setErro("erroTamanho");
      else setErro(r.status === 429 ? "erroLimite" : "erroGeral");
      setEnviando(false);
    } catch {
      setErro("erroGeral");
      setEnviando(false);
    }
  }

  const id = (s: string) => `${prefixo}-${s}`;
  return (
    <form onSubmit={abrir} noValidate className="flex flex-col gap-3" data-conversa-nova>
      <label htmlFor={id("texto")} className="text-[13px] font-medium text-ink">{t("mensagemRotulo")}</label>
      <Textarea id={id("texto")} rows={5} maxLength={TEXTO_MAX} value={texto} aria-describedby={id("dica")} onChange={(e) => setTexto(e.target.value)} />
      <p id={id("dica")} className="text-[13px] text-muted">{t("mensagemDica")}</p>
      {semEmail ? (
        <>
          <label htmlFor={id("email")} className="text-[13px] font-medium text-ink">{t("emailRotulo")}</label>
          <Input
            id={id("email")}
            type="email"
            autoComplete="email"
            value={email}
            aria-invalid={erroEmail}
            aria-describedby={erroEmail ? `${id("email-dica")} ${id("email-erro")}` : id("email-dica")}
            onChange={(e) => setEmail(e.target.value)}
            className="md:max-w-[360px]"
          />
          <p id={id("email-dica")} className="text-[13px] text-muted">{t("emailDica")}</p>
          {erroEmail && <p id={id("email-erro")} className="text-[13px] text-danger">{t("erroEmail")}</p>}
        </>
      ) : (
        <p className="text-[13px] text-muted">{t("emailConta", { email: emailDaConta })}</p>
      )}
      {erro && <p role="alert" className="text-[13px] text-danger">{t(erro)}</p>}
      <div>
        <Button type="submit" data-action="abrir-conversa" disabled={enviando}>{enviando ? t("abrindo") : t("abrir")}</Button>
      </div>
    </form>
  );
}
