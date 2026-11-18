"use client";
/**
 * 2.6a-2 caixa "Pergunte" da Ajuda: responde só com os artigos (POST /api/ajuda/perguntar) e,
 * quando não sabe, oferece mandar a pergunta para a equipe (POST /api/ajuda/equipe).
 */
import * as React from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { IaLink } from "@/components/ia-link";
import { Button, Input, Textarea } from "@/components/ui";

type Fonte = { slug: string; titulo: string; secao: string };
type Estado =
  | { t: "vazio" }
  | { t: "pensando" }
  | { t: "resposta"; resposta: string; fontes: Fonte[] }
  | { t: "sem_resposta"; id: string | null; pergunta: string }
  | { t: "enviado" }
  | { t: "erro"; chave: "erroTamanho" | "erroLimite" | "erroGeral" };

const MIN = 5;
const MAX = 500;

export function AjudaPergunta({ de }: { de?: string | null }) {
  const t = useTranslations("ajuda");
  const locale = useLocale();
  const [pergunta, setPergunta] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [erroEmail, setErroEmail] = React.useState(false);
  const [enviando, setEnviando] = React.useState(false);
  const [estado, setEstado] = React.useState<Estado>({ t: "vazio" });
  const seq = React.useRef(0);

  async function perguntar(e: React.FormEvent) {
    e.preventDefault();
    const p = pergunta.trim();
    if (p.length < MIN || p.length > MAX) return setEstado({ t: "erro", chave: "erroTamanho" });
    const meu = ++seq.current;
    setEstado({ t: "pensando" });
    try {
      const r = await fetch("/api/ajuda/perguntar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pergunta: p, locale, de }),
      });
      if (meu !== seq.current) return;
      if (r.status === 429) return setEstado({ t: "erro", chave: "erroLimite" });
      if (r.status === 422) return setEstado({ t: "erro", chave: "erroTamanho" });
      if (!r.ok) return setEstado({ t: "sem_resposta", id: null, pergunta: p });
      const j = (await r.json()) as { tipo: "resposta"; resposta: string; fontes: Fonte[] } | { tipo: "sem_resposta"; id: string };
      if (meu !== seq.current) return;
      setEstado(j.tipo === "resposta" ? { t: "resposta", resposta: j.resposta, fontes: j.fontes } : { t: "sem_resposta", id: j.id, pergunta: p });
    } catch {
      if (meu === seq.current) setEstado({ t: "sem_resposta", id: null, pergunta: p });
    }
  }

  async function mandarEquipe(e: React.FormEvent) {
    e.preventDefault();
    if (estado.t !== "sem_resposta") return;
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
    setErroEmail(!ok);
    if (!ok) return;
    setEnviando(true);
    try {
      const r = await fetch("/api/ajuda/equipe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: estado.id, pergunta: estado.pergunta, email: email.trim(), locale, de }),
      });
      if (r.ok) setEstado({ t: "enviado" });
      else if (r.status === 422) setErroEmail(true);
      else setEstado({ t: "erro", chave: r.status === 429 ? "erroLimite" : "erroGeral" });
    } catch {
      setEstado({ t: "erro", chave: "erroGeral" });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section aria-labelledby="ajuda-pergunte" className="relevo-cartao flex max-w-[68ch] flex-col gap-4 rounded-card border border-line bg-surface p-5" data-ajuda-pergunta>
      <h2 id="ajuda-pergunte" className="text-xl font-semibold">{t("perguntaTitulo")}</h2>
      <form onSubmit={perguntar} className="flex flex-col gap-3">
        <label htmlFor="ajuda-pergunta-texto" className="text-[13px] font-medium text-ink">{t("perguntaRotulo")}</label>
        <Textarea
          id="ajuda-pergunta-texto"
          rows={3}
          maxLength={MAX}
          value={pergunta}
          aria-describedby="ajuda-pergunta-dica"
          onChange={(e) => setPergunta(e.target.value)}
        />
        <p id="ajuda-pergunta-dica" className="text-[13px] text-muted">{t("perguntaDica")}</p>
        <div>
          <Button type="submit" data-action="perguntar-ajuda" disabled={estado.t === "pensando"}>
            {estado.t === "pensando" ? t("pensando") : t("perguntar")}
          </Button>
        </div>
      </form>

      <div aria-live="polite" className="flex flex-col gap-3" data-ajuda-resultado={estado.t}>
        {estado.t === "resposta" && (
          <div className="flex flex-col gap-2 border-t border-line-soft pt-4">
            <h3 className="text-[15px] font-semibold">{t("respostaTitulo")}</h3>
            <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink">{estado.resposta}</p>
            <p className="text-[13px] text-ink">
              {t("fontes")}{" "}
              {estado.fontes.map((f, i) => (
                <React.Fragment key={`${f.slug}-${f.secao}`}>
                  {i > 0 && " · "}
                  <Link href={`/ajuda/${f.slug}`} className="font-medium text-brand underline underline-offset-2" data-ajuda-fonte={f.slug}>
                    {f.secao && f.secao !== f.titulo ? `${f.titulo}: ${f.secao}` : f.titulo}
                  </Link>
                </React.Fragment>
              ))}
            </p>
            <p className="text-xs text-muted">
              {t("respostaIa")} <IaLink ancora="ajuda" className="text-xs" />
            </p>
          </div>
        )}
        {estado.t === "erro" && <p role="alert" className="text-[14px] text-danger">{t(estado.chave)}</p>}
        {estado.t === "enviado" && <p className="text-[14px] font-medium text-success-ink">{t("equipeEnviado")}</p>}
        {estado.t === "sem_resposta" && (
          <form onSubmit={mandarEquipe} noValidate className="flex flex-col gap-3 border-t border-line-soft pt-4" data-ajuda-equipe>
            <p className="text-[15px] text-ink">
              <strong className="font-semibold">{t("semResposta")}</strong> {t("equipeLead")}
            </p>
            <label htmlFor="ajuda-equipe-email" className="text-[13px] font-medium text-ink">{t("equipeEmail")}</label>
            <Input
              id="ajuda-equipe-email"
              type="email"
              autoComplete="email"
              value={email}
              aria-invalid={erroEmail}
              aria-describedby={erroEmail ? "ajuda-equipe-erro" : undefined}
              onChange={(e) => setEmail(e.target.value)}
              className="md:max-w-[360px]"
            />
            {erroEmail && <p id="ajuda-equipe-erro" className="text-[13px] text-danger">{t("erroEmail")}</p>}
            <div>
              <Button type="submit" variant="secondary" data-action="mandar-equipe" disabled={enviando}>{t("equipeEnviar")}</Button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
