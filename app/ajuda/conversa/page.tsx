"use client";
/**
 * 2.6b-1 Conversa com a equipe (/ajuda/conversa). Sem ?c=: formulário para abrir. Com ?c=<código>:
 * a conversa. A tela pergunta por respostas a cada 10 s só enquanto a conversa está aberta e a página
 * visível (D1). Sem login; o código do link é a chave (D2). Sem IA (D7).
 */
import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { AppHeader } from "@/components/app-header";
import { ConversaNova, TEXTO_MAX } from "@/components/conversa-nova";
import { Button, Card, CardBody, Textarea, buttonClasses } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import type { VisaoConversa } from "@/lib/atendimento";

const INTERVALO_MS = 10_000;
type Estado = { t: "carregando" } | { t: "nao_encontrada" } | { t: "erro" } | { t: "ok"; v: VisaoConversa };
type ErroEnvio = "erroTamanho" | "erroLimite" | "erroGeral";

function Conversa({ codigo }: { codigo: string }) {
  const t = useTranslations("conversa");
  const fmt = useFormatter();
  const [estado, setEstado] = React.useState<Estado>({ t: "carregando" });
  const [texto, setTexto] = React.useState("");
  const [enviando, setEnviando] = React.useState(false);
  const [erro, setErro] = React.useState<ErroEnvio | null>(null);
  const [fuso, setFuso] = React.useState<string | undefined>(undefined);
  // Só a leitura mais nova vale (a pergunta periódica pode cruzar com um envio).
  const seq = React.useRef(0);

  const pedir = React.useCallback(async (corpo: Record<string, unknown>) => {
    const r = await fetch("/api/ajuda/conversa", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ c: codigo, ...corpo }) });
    const j = (await r.json().catch(() => ({}))) as { visao?: VisaoConversa | null; error?: string };
    return { status: r.status, visao: j.visao ?? null, erro: j.error ?? null };
  }, [codigo]);

  const carregar = React.useCallback(async () => {
    const meu = ++seq.current;
    try {
      const r = await pedir({ acao: "ver" });
      if (meu !== seq.current) return;
      if (r.visao) setEstado({ t: "ok", v: r.visao });
      else if (r.status === 404) setEstado({ t: "nao_encontrada" });
      else setEstado((e) => (e.t === "ok" ? e : { t: "erro" }));
    } catch {
      if (meu === seq.current) setEstado((e) => (e.t === "ok" ? e : { t: "erro" }));
    }
  }, [pedir]);

  React.useEffect(() => {
    setFuso(Intl.DateTimeFormat().resolvedOptions().timeZone);
    setEstado({ t: "carregando" });
    void carregar();
  }, [carregar]);

  const aberta = estado.t === "ok" && estado.v.status === "aberta";
  React.useEffect(() => {
    if (!aberta) return;
    const visivel = () => document.visibilityState === "visible";
    const id = window.setInterval(() => {
      if (visivel()) void carregar();
    }, INTERVALO_MS);
    const aoVoltar = () => {
      if (visivel()) void carregar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [aberta, carregar]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const tx = texto.trim();
    setErro(null);
    if (!tx || tx.length > TEXTO_MAX) return setErro("erroTamanho");
    setEnviando(true);
    const meu = ++seq.current;
    try {
      const r = await pedir({ acao: "enviar", texto: tx });
      if (r.visao && meu === seq.current) setEstado({ t: "ok", v: r.visao });
      if (r.status === 200) setTexto("");
      else if (r.status === 404) setEstado({ t: "nao_encontrada" });
      else if (r.erro !== "encerrada") setErro(r.status === 429 ? "erroLimite" : r.status === 422 ? "erroTamanho" : "erroGeral");
    } catch {
      setErro("erroGeral");
    } finally {
      setEnviando(false);
    }
  }

  const quando = (iso: string) => fmt.dateTime(new Date(iso), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: fuso });

  if (estado.t === "carregando") return <p aria-busy="true" className="text-muted">{t("carregando")}</p>;
  if (estado.t === "nao_encontrada") return <p className="text-ink" data-conversa-404>{t("naoEncontrada")}</p>;
  if (estado.t === "erro") return <p role="alert" className="text-ink">{t("erroGeral")}</p>;
  const v = estado.v;
  const ultima = v.mensagens[v.mensagens.length - 1];
  return (
    <div className="flex flex-col gap-4" data-conversa={v.status}>
      <p className="text-[13px] text-muted">{t("guardeLink")}</p>
      <h2 className="sr-only">{t("mensagens")}</h2>
      <div role="log" aria-label={t("mensagens")}>
        <ol className="flex flex-col gap-3">
          {v.mensagens.map((m) => (
            <li
              key={m.id}
              data-autor={m.autor}
              className={cn(
                "flex max-w-[90%] flex-col gap-1 rounded-card border px-4 py-3",
                m.autor === "pessoa" ? "self-end border-brand-soft bg-brand-soft text-brand-ink" : "self-start border-line bg-surface text-ink",
              )}
            >
              <span className="text-[12px] font-semibold">
                {m.autor === "pessoa" ? t("voce") : t("equipe")} · <time dateTime={m.em} className="font-normal">{quando(m.em)}</time>
              </span>
              <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{m.texto}</p>
            </li>
          ))}
        </ol>
      </div>
      {v.status === "aberta" && ultima?.autor === "pessoa" ? <p className="text-[13px] text-muted">{t("aguardando")}</p> : null}

      {v.status === "encerrada" ? (
        <div className="flex flex-col gap-3 rounded-control bg-neutral-soft px-4 py-3 text-ink" data-conversa-encerrada>
          <p>
            <strong className="font-semibold">{t("encerrada")}.</strong> {t("encerradaLead")}
          </p>
          <div>
            <Link href="/ajuda/conversa" className={buttonClasses("secondary", "sm")} data-action="abrir-outra">{t("abrirOutra")}</Link>
          </div>
        </div>
      ) : (
        <form onSubmit={enviar} noValidate className="flex flex-col gap-3 border-t border-line-soft pt-4">
          <label htmlFor="conversa-nova-msg" className="text-[13px] font-medium text-ink">{t("novaRotulo")}</label>
          <Textarea id="conversa-nova-msg" rows={3} maxLength={TEXTO_MAX} value={texto} onChange={(e) => setTexto(e.target.value)} />
          {erro && <p role="alert" className="text-[13px] text-danger">{t(erro)}</p>}
          <div>
            <Button type="submit" data-action="enviar-mensagem" disabled={enviando}>{enviando ? t("enviando") : t("enviar")}</Button>
          </div>
        </form>
      )}
    </div>
  );
}

function ConversaTela() {
  const t = useTranslations("conversa");
  const sp = useSearchParams();
  const codigo = sp.get("c");
  const de = sp.get("de");
  return (
    <Card>
      <CardBody className="flex flex-col gap-4 p-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-[24px] font-semibold leading-tight">{t("titulo")}</h1>
          {!codigo ? <p className="text-ink">{t("lead")}</p> : null}
          <p className="text-[13px] text-muted">{t("semIa")}</p>
        </div>
        {codigo ? <Conversa key={codigo} codigo={codigo} /> : <ConversaNova de={de} />}
      </CardBody>
    </Card>
  );
}

export default function ConversaPage() {
  const t = useTranslations("conversa");
  return (
    <>
      <AppHeader area="publico" />
      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-8 md:py-12">
        <Link href="/ajuda" className="w-fit text-[14px] font-medium text-brand underline underline-offset-2">{t("voltarAjuda")}</Link>
        <React.Suspense fallback={<p aria-busy="true" className="text-muted">{t("carregando")}</p>}>
          <ConversaTela />
        </React.Suspense>
      </main>
    </>
  );
}
