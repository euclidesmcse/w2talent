"use client";
/**
 * 2.5a Agenda na lista de candidaturas da vaga: oferecer de 3 a 8 horários, ver o que foi marcado,
 * remarcar ou cancelar. Formulário na própria linha (sem janela), abre e fecha pelo botão.
 */
import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Button, Input, Select, useToast } from "@/components/ui";
import type { ResumoEntrevista } from "@/lib/entrevista";

const DURACOES = [30, 45, 60];
const MIN = 3;
const MAX = 8;

type Props = {
  applicationId: string;
  nome: string;
  entrevista: ResumoEntrevista | null;
  onAtualizar: (e: ResumoEntrevista) => void;
};

/** "2026-11-25T14:00" no fuso do navegador, para o campo datetime-local. */
function localInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Primeiro horário aceito: agora + 65 min, arredondado para cima no múltiplo de 5 min. */
export function minimoAgendavel(agora: number): Date {
  const passo = 5 * 60_000;
  return new Date(Math.ceil((agora + 65 * 60_000) / passo) * passo);
}

export function AgendaEntrevista({ applicationId, nome, entrevista, onAtualizar }: Props) {
  const t = useTranslations("agenda");
  const fmt = useFormatter();
  const { show } = useToast();
  const formId = React.useId();
  const [aberto, setAberto] = React.useState(false);
  const [confirmarCancelar, setConfirmarCancelar] = React.useState(false);
  const [duracao, setDuracao] = React.useState(45);
  const [horarios, setHorarios] = React.useState<string[]>(["", "", ""]);
  const [link, setLink] = React.useState("");
  const [erro, setErro] = React.useState<string | null>(null);
  const [enviando, setEnviando] = React.useState(false);
  const [minimo, setMinimo] = React.useState("");
  const [fuso, setFuso] = React.useState<string | undefined>(undefined);

  React.useEffect(() => {
    setFuso(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  React.useEffect(() => {
    // Arredondado para cima no múltiplo de 5 min: com step=300 o navegador conta os passos a partir do min.
    if (aberto) setMinimo(localInput(minimoAgendavel(Date.now())));
  }, [aberto]);

  // No fuso do navegador (o next-intl usaria o do servidor).
  const quando = (iso: string) =>
    fmt.dateTime(new Date(iso), { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: fuso });

  const agora = Date.now();
  const e = entrevista;
  const marcadaFutura = e?.status === "marcada" && !!e.inicio && new Date(e.inicio).getTime() + e.duracaoMin * 60_000 > agora;
  const aberta = e?.status === "aberta";
  const ativa = marcadaFutura || aberta;

  const abrirForm = () => {
    setErro(null);
    setConfirmarCancelar(false);
    if (e && ativa) {
      setDuracao(e.duracaoMin);
      setLink(e.linkReuniao ?? "");
    }
    setHorarios(["", "", ""]);
    setAberto(true);
  };

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault();
    const preenchidos = horarios.filter(Boolean);
    if (preenchidos.length < MIN) return setErro(t("erro_horarios_qtd", { min: MIN, max: MAX }));
    setEnviando(true);
    setErro(null);
    try {
      const fuso = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const r = await fetch(`/api/rh/candidaturas/${encodeURIComponent(applicationId)}/entrevista`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duracaoMin: duracao, horarios: preenchidos.map((h) => new Date(h).toISOString()), linkReuniao: link.trim() || null, fuso }),
      });
      const j = (await r.json().catch(() => ({}))) as { entrevista?: ResumoEntrevista; error?: string };
      if (!r.ok || !j.entrevista) {
        const codigo = j.error ?? "erro";
        const conhecidos = ["horarios_qtd", "horario_invalido", "horario_passado", "horario_longe", "horarios_sobrepostos", "link_invalido", "sem_contato", "duracao"];
        setErro(conhecidos.includes(codigo) ? t(`erro_${codigo}`, { min: MIN, max: MAX }) : t("erro_geral"));
        return;
      }
      onAtualizar(j.entrevista);
      setAberto(false);
      show(t("oferecida", { nome }), "success");
    } catch {
      setErro(t("erro_geral"));
    } finally {
      setEnviando(false);
    }
  }

  async function cancelar() {
    setEnviando(true);
    try {
      const r = await fetch(`/api/rh/candidaturas/${encodeURIComponent(applicationId)}/entrevista`, { method: "DELETE" });
      const j = (await r.json().catch(() => ({}))) as { entrevista?: ResumoEntrevista };
      if (!r.ok || !j.entrevista) throw new Error(String(r.status));
      onAtualizar(j.entrevista);
      setConfirmarCancelar(false);
      show(t("cancelada", { nome }), "success");
    } catch {
      show(t("erro_geral"), "error");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="basis-full rounded-control bg-canvas px-3 py-2.5 text-[13px]" data-testid="rh-agenda">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="min-w-0 flex-[1_1_220px]" data-agenda-status={marcadaFutura ? "marcada" : aberta ? "aberta" : "sem"}>
          {marcadaFutura && e?.inicio ? (
            <>
              <span className="font-medium">{t("marcadaPara", { quando: quando(e.inicio), min: e.duracaoMin })}</span>
              {e.linkReuniao ? (
                <>
                  {" · "}
                  <a href={e.linkReuniao} target="_blank" rel="noopener noreferrer" className="text-brand underline underline-offset-2">{t("linkReuniao")}</a>
                </>
              ) : null}
            </>
          ) : aberta && e ? (
            t("aguardando", { n: e.horarios.length })
          ) : e?.status === "cancelada" ? (
            t(e.canceladaPor === "candidato" ? "canceladaPeloCandidato" : "canceladaPelaEmpresa")
          ) : e?.status === "expirada" ? (
            t("expirada")
          ) : (
            <span className="text-muted">{t("semEntrevista")}</span>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            aria-expanded={aberto}
            aria-controls={formId}
            onClick={() => (aberto ? setAberto(false) : abrirForm())}
            aria-label={t(ativa ? "remarcarDe" : "agendarDe", { nome })}
            data-action="agendar"
          >
            {t(ativa ? "remarcar" : "agendar")}
          </Button>
          {ativa ? (
            confirmarCancelar ? (
              <Button variant="secondary" size="sm" disabled={enviando} onClick={() => void cancelar()} data-action="confirmar-cancelar" className="text-danger">
                {t("confirmarCancelar")}
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setConfirmarCancelar(true)} aria-label={t("cancelarDe", { nome })} data-action="cancelar-entrevista">
                {t("cancelar")}
              </Button>
            )
          ) : null}
        </div>
      </div>
      {aberto ? (
        <form id={formId} onSubmit={enviar} className="mt-3 flex flex-col gap-3 border-t border-line-soft pt-3" aria-label={t("formLabel", { nome })}>
          <p className="text-muted">{t("formDica", { min: MIN, max: MAX })}</p>
          <label className="flex max-w-[220px] flex-col gap-1">
            <span className="font-medium">{t("duracao")}</span>
            <Select value={duracao} onChange={(ev) => setDuracao(Number(ev.target.value))}>
              {DURACOES.map((d) => <option key={d} value={d}>{t("minutos", { n: d })}</option>)}
            </Select>
          </label>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 font-medium">{t("horarios")}</legend>
            {horarios.map((h, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  type="datetime-local"
                  step={300}
                  min={minimo}
                  value={h}
                  onChange={(ev) => setHorarios((hs) => hs.map((x, j) => (j === i ? ev.target.value : x)))}
                  aria-label={t("horarioN", { n: i + 1 })}
                  className="max-w-[240px]"
                  data-testid="agenda-horario"
                />
                {horarios.length > MIN ? (
                  <Button variant="ghost" size="sm" type="button" onClick={() => setHorarios((hs) => hs.filter((_, j) => j !== i))} aria-label={t("tirarHorario", { n: i + 1 })}>
                    {t("tirar")}
                  </Button>
                ) : null}
              </div>
            ))}
            {horarios.length < MAX ? (
              <Button variant="ghost" size="sm" type="button" className="w-fit" onClick={() => setHorarios((hs) => [...hs, ""])}>
                {t("maisHorario")}
              </Button>
            ) : null}
          </fieldset>
          <label className="flex max-w-[420px] flex-col gap-1">
            <span className="font-medium">{t("linkCampo")}</span>
            <Input type="url" inputMode="url" placeholder="https://" value={link} onChange={(ev) => setLink(ev.target.value)} />
            <span className="text-muted">{t("linkDica")}</span>
          </label>
          {erro ? <p role="alert" className="text-danger">{erro}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" size="sm" disabled={enviando} data-action="enviar-horarios">{t("enviar")}</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setAberto(false)}>{t("fechar")}</Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
