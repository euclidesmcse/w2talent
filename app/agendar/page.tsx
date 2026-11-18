"use client";
/**
 * 2.5a Página do link do e-mail (/agendar?c=<código>): o candidato escolhe, troca ou cancela o
 * horário da entrevista, sem login. Horários no fuso do navegador.
 */
import * as React from "react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { AppHeader } from "@/components/app-header";
import { Button, Card, CardBody, buttonClasses } from "@/components/ui";
import type { VisaoAgendar } from "@/lib/entrevista";

type Estado = { t: "carregando" } | { t: "sem_link" } | { t: "nao_encontrada" } | { t: "erro" } | { t: "ok"; v: VisaoAgendar };

export default function AgendarPage() {
  const t = useTranslations("agendar");
  const fmt = useFormatter();
  const [codigo, setCodigo] = React.useState<string | null>(null);
  const [estado, setEstado] = React.useState<Estado>({ t: "carregando" });
  const [escolha, setEscolha] = React.useState<string>("");
  const [trocando, setTrocando] = React.useState(false);
  const [confirmarCancelar, setConfirmarCancelar] = React.useState(false);
  const [enviando, setEnviando] = React.useState(false);
  const [aviso, setAviso] = React.useState<{ tom: "ok" | "erro"; texto: string } | null>(null);
  const [fuso, setFuso] = React.useState("");

  const pedir = React.useCallback(async (c: string, corpo: Record<string, unknown>) => {
    const r = await fetch("/api/agendar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ c, ...corpo }) });
    const j = (await r.json().catch(() => ({}))) as { visao?: VisaoAgendar | null; error?: string };
    return { status: r.status, visao: j.visao ?? null, erro: j.error ?? null };
  }, []);

  React.useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("c");
    setFuso(Intl.DateTimeFormat().resolvedOptions().timeZone);
    setCodigo(c);
    if (!c) return setEstado({ t: "sem_link" });
    pedir(c, { acao: "ver" })
      .then((r) => setEstado(r.visao ? { t: "ok", v: r.visao } : r.status === 404 ? { t: "nao_encontrada" } : { t: "erro" }))
      .catch(() => setEstado({ t: "erro" }));
  }, [pedir]);

  // Sempre no fuso do navegador (o next-intl usaria o fuso do servidor, UTC no Worker).
  const timeZone = fuso || undefined;
  const quando = (iso: string) => fmt.dateTime(new Date(iso), { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone });
  const dia = (iso: string) => {
    const d = fmt.dateTime(new Date(iso), { weekday: "long", day: "numeric", month: "long", timeZone });
    return d.charAt(0).toUpperCase() + d.slice(1);
  };
  const hora = (iso: string) => fmt.dateTime(new Date(iso), { hour: "2-digit", minute: "2-digit", timeZone });

  async function agir(acao: "escolher" | "cancelar") {
    if (!codigo) return;
    setEnviando(true);
    setAviso(null);
    try {
      const r = await pedir(codigo, acao === "escolher" ? { acao, inicio: escolha, fuso } : { acao });
      if (r.visao) setEstado({ t: "ok", v: r.visao });
      if (r.status === 200) {
        setTrocando(false);
        setConfirmarCancelar(false);
        setEscolha("");
        setAviso({ tom: "ok", texto: acao === "escolher" ? t("okMarcada") : t("okCancelada") });
      } else {
        setAviso({ tom: "erro", texto: r.erro === "horario_indisponivel" ? t("erroIndisponivel") : r.erro === "nao_pode" ? t("erroPrazo") : t("erroGeral") });
      }
    } catch {
      setAviso({ tom: "erro", texto: t("erroGeral") });
    } finally {
      setEnviando(false);
    }
  }

  const v = estado.t === "ok" ? estado.v : null;
  const mostrarEscolha = !!v && v.podeAlterar && (v.status === "aberta" || trocando) && v.disponiveis.length > 0;
  const porDia = React.useMemo(() => {
    const m = new Map<string, string[]>();
    for (const h of v?.disponiveis ?? []) {
      const k = dia(h);
      m.set(k, [...(m.get(k) ?? []), h]);
    }
    return [...m.entries()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v]);

  return (
    <>
      <AppHeader area="publico" />
      <main className="mx-auto max-w-lg px-4 py-10">
        <Card>
          <CardBody className="flex flex-col gap-4 p-6">
            <h1 className="text-xl font-semibold text-ink">{v ? t("title", { empresa: v.empresa }) : t("titleSem")}</h1>
            {estado.t === "carregando" ? (
              <p aria-busy="true" className="text-muted">{t("carregando")}</p>
            ) : estado.t === "sem_link" ? (
              <p className="text-muted">{t("semLink")}</p>
            ) : estado.t === "nao_encontrada" ? (
              <p className="text-muted" data-testid="agendar-404">{t("naoEncontrada")}</p>
            ) : estado.t === "erro" ? (
              <p role="alert" className="text-muted">{t("erroGeral")}</p>
            ) : v ? (
              <>
                <p className="text-muted">{t("lead", { vaga: v.vaga, min: v.duracaoMin })}</p>

                {v.status === "marcada" && v.inicio ? (
                  <div className="rounded-control bg-success-soft px-4 py-3 text-success-ink" data-testid="agendar-marcada">
                    <p className="font-semibold">{t("marcadaPara", { quando: quando(v.inicio) })}</p>
                    {v.linkReuniao ? (
                      <a href={v.linkReuniao} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block font-medium underline underline-offset-2">{t("linkReuniao")}</a>
                    ) : (
                      <p className="mt-1 text-[13px]">{t("semLinkReuniao")}</p>
                    )}
                  </div>
                ) : v.status === "cancelada" ? (
                  <p className="rounded-control bg-neutral-soft px-4 py-3 text-ink-soft" data-testid="agendar-cancelada">{t("cancelada")}</p>
                ) : v.status === "expirada" ? (
                  <p className="rounded-control bg-neutral-soft px-4 py-3 text-ink-soft">{t("expirada")}</p>
                ) : v.disponiveis.length === 0 ? (
                  <p className="rounded-control bg-warning-soft px-4 py-3 text-warning-ink">{t("semHorarios")}</p>
                ) : null}

                {aviso ? (
                  <p role={aviso.tom === "erro" ? "alert" : "status"} className={aviso.tom === "erro" ? "text-danger" : "text-success-ink"}>{aviso.texto}</p>
                ) : null}

                {mostrarEscolha ? (
                  <form
                    onSubmit={(ev) => {
                      ev.preventDefault();
                      if (escolha) void agir("escolher");
                    }}
                    className="flex flex-col gap-4"
                  >
                    <fieldset className="flex flex-col gap-3">
                      <legend className="mb-1 font-medium">{t(trocando ? "escolhaOutro" : "escolha")}</legend>
                      {porDia.map(([d, hs]) => (
                        <div key={d} className="flex flex-col gap-1.5">
                          <p className="text-[13px] font-medium text-muted">{d}</p>
                          <div className="flex flex-wrap gap-2">
                            {hs.map((h) => (
                              <label
                                key={h}
                                className={`inline-flex h-11 cursor-pointer items-center gap-2 rounded-control border px-3 text-sm ${escolha === h ? "border-brand bg-brand-soft text-brand-ink" : "border-line bg-surface"}`}
                              >
                                <input type="radio" name="horario" value={h} checked={escolha === h} onChange={() => setEscolha(h)} className="accent-brand" />
                                {hora(h)}
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </fieldset>
                    <p className="text-[13px] text-muted">{t("fuso", { fuso })}</p>
                    <div className="flex flex-wrap gap-2">
                      <Button type="submit" disabled={!escolha || enviando} data-action="confirmar-horario">{t("confirmar")}</Button>
                      {trocando ? <Button type="button" variant="ghost" onClick={() => setTrocando(false)}>{t("voltar")}</Button> : null}
                    </div>
                  </form>
                ) : null}

                {v.podeAlterar && (v.status === "marcada" || v.status === "aberta") ? (
                  <div className="flex flex-wrap gap-2 border-t border-line-soft pt-4">
                    {v.status === "marcada" && !trocando && v.disponiveis.length > 0 ? (
                      <Button variant="secondary" onClick={() => setTrocando(true)} data-action="trocar">{t("trocar")}</Button>
                    ) : null}
                    {confirmarCancelar ? (
                      <Button variant="secondary" className="text-danger" disabled={enviando} onClick={() => void agir("cancelar")} data-action="confirmar-cancelar">{t("confirmarCancelar")}</Button>
                    ) : (
                      <Button variant="ghost" onClick={() => setConfirmarCancelar(true)} data-action="cancelar">{t("cancelar")}</Button>
                    )}
                  </div>
                ) : v.status === "marcada" ? (
                  <p className="text-[13px] text-muted">{t("prazo")}</p>
                ) : null}

                <Link href="/minhas-candidaturas" className={buttonClasses("ghost", "md", "w-fit px-0 hover:bg-transparent")}>{t("minhas")}</Link>
              </>
            ) : null}
          </CardBody>
        </Card>
      </main>
    </>
  );
}
