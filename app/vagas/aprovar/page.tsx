"use client";
/**
 * Revisar e aprovar (1.5.13): uma vaga por vez, com o match e o que a empresa vai receber.
 * Só vão as vagas aprovadas; não há "aprovar todas". Até o login (1.5.5), só o admin envia,
 * como o perfil publicado em "Minha ficha" (modo de teste).
 */
import * as React from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { AppHeader } from "@/components/app-header";
import { Button, Chip, MatchBar, buttonClasses } from "@/components/ui";
import { FichaW2Card } from "@/components/ficha-w2-card";
import { skillName } from "@/components/skill-chips";
import { useGapText } from "@/components/vacancy-match";
import { formatFaixa } from "@/lib/format";
import { selectionStore } from "@/lib/selection-store";
import { diaMes, emailDaFichaLocal, podeEnviar, postEnvio } from "@/lib/envio-client";
import type { Ficha, FichaW2 } from "@/lib/ficha";
import type { MatchResult } from "@/lib/match";
import type { CampoVaga } from "@/lib/envio";

type Vaga = {
  id: string;
  titulo: string;
  empresa: string;
  temContato: boolean;
  stack: unknown;
  nivel: string | null;
  regime: string | null;
  localidade: string | null;
  faixaDe: number | null;
  faixaAte: number | null;
  faixaMoeda: string | null;
  descricaoBullets: unknown;
  beneficios: unknown;
};
type Item = {
  vacancyId: string;
  estado: "nova" | "aprovada" | "mudou" | "enviada" | "indisponivel" | "nao_encontrada";
  campos?: CampoVaga[];
  enviadaEm?: string;
  vaga: Vaga | null;
  match: MatchResult | null;
  paraEmpresa: Ficha | null;
};
type Resultado = { vacancyId: string; status: string; email?: boolean };
type Fase = "carregando" | "sem_admin" | "sem_perfil" | "sem_selecao" | "erro" | "revisar" | "feito";

const textos = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : []);
const skillIds = (v: unknown): string[] =>
  (Array.isArray(v) ? v : []).map((s: any) => (typeof s === "string" ? s : s?.skillId ?? "")).filter(Boolean);

export default function AprovarPage() {
  const t = useTranslations("aprovar");
  const locale = useLocale();
  const gapText = useGapText();
  const [fase, setFase] = React.useState<Fase>("carregando");
  const [email, setEmail] = React.useState("");
  const [itens, setItens] = React.useState<Item[]>([]);
  const [w2, setW2] = React.useState<FichaW2 | null>(null);
  const [limites, setLimites] = React.useState({ lote: 10, dia: 30, usadas24h: 0 });
  const [idx, setIdx] = React.useState(0);
  const [ocupado, setOcupado] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [resultado, setResultado] = React.useState<Resultado[]>([]);
  const tituloRef = React.useRef<HTMLHeadingElement>(null);

  const carregar = React.useCallback(async (mail: string, ids: string[]) => {
    const r = await postEnvio("estado", { email: mail, vacancyIds: ids });
    if (r.status === 404) return setFase("sem_perfil");
    if (r.status === 401 || r.status === 503) return setFase("sem_admin");
    if (!r.ok) return setFase("erro");
    const j = await r.json();
    setItens(j.itens);
    setW2(j.perfil?.w2 ?? null);
    setLimites(j.limites);
    setFase("revisar");
  }, []);

  React.useEffect(() => {
    (async () => {
      if (!(await podeEnviar())) return setFase("sem_admin");
      const mail = emailDaFichaLocal();
      if (!mail) return setFase("sem_perfil");
      setEmail(mail);
      const ids = [...(selectionStore.getState().selectedIds ?? [])];
      if (!ids.length) return setFase("sem_selecao");
      await carregar(mail, ids);
    })().catch(() => setFase("erro"));
  }, [carregar]);

  // Ao trocar de vaga, o foco volta ao título (leitor de tela anuncia a nova vaga).
  React.useEffect(() => {
    if (fase === "revisar") tituloRef.current?.focus();
  }, [idx, fase]);

  const atual = itens[idx];
  const aprovadas = itens.filter((i) => i.estado === "aprovada");
  const restantesHoje = Math.max(0, limites.dia - limites.usadas24h);
  const podeMandar = aprovadas.length > 0 && aprovadas.length <= limites.lote && aprovadas.length <= restantesHoje && !ocupado;

  const proxima = () => setIdx((i) => Math.min(itens.length - 1, i + 1));
  const anterior = () => setIdx((i) => Math.max(0, i - 1));

  const marcar = async (aprovar: boolean) => {
    if (!atual) return;
    setOcupado(true);
    setErro(null);
    try {
      const r = await postEnvio("aprovar", { email, vacancyId: atual.vacancyId, aprovar });
      if (r.ok) {
        setItens((xs) => xs.map((x) => (x.vacancyId === atual.vacancyId ? { ...x, estado: aprovar ? "aprovada" : "nova", campos: undefined } : x)));
        if (aprovar && idx < itens.length - 1) proxima();
      } else {
        // A vaga venceu ou já foi enviada enquanto a tela estava aberta: recarrega o estado.
        await carregar(email, itens.map((i) => i.vacancyId));
      }
    } catch {
      setErro(t("error"));
    } finally {
      setOcupado(false);
    }
  };

  const tirar = () => {
    if (!atual) return;
    selectionStore.remove(atual.vacancyId);
    if (atual.estado === "aprovada") void postEnvio("aprovar", { email, vacancyId: atual.vacancyId, aprovar: false });
    const resto = itens.filter((x) => x.vacancyId !== atual.vacancyId);
    setItens(resto);
    setIdx((i) => Math.max(0, Math.min(i, resto.length - 1)));
    if (!resto.length) setFase("sem_selecao");
  };

  const enviar = async () => {
    setOcupado(true);
    setErro(null);
    try {
      const r = await postEnvio("enviar", { email, vacancyIds: aprovadas.map((a) => a.vacancyId), loteId: selectionStore.getState().loteId || undefined });
      const j = await r.json().catch(() => ({}));
      if (r.status === 429) {
        setErro(t("limitDay", { max: j.max ?? limites.dia, left: j.restantes ?? 0 }));
        setLimites((l) => ({ ...l, usadas24h: j.usadas24h ?? l.usadas24h }));
        return;
      }
      if (!r.ok) {
        setErro(t("error"));
        return;
      }
      const res = (j.itens ?? []) as Resultado[];
      // Sai da seleção o que foi enviado (ou já tinha ido); o resto continua para revisar.
      for (const x of res) if (x.status === "enviada" || x.status === "ja_enviada") selectionStore.remove(x.vacancyId);
      setResultado(res);
      setFase("feito");
    } catch {
      setErro(t("error"));
    } finally {
      setOcupado(false);
    }
  };

  const tituloDe = (id: string) => itens.find((i) => i.vacancyId === id)?.vaga?.titulo ?? selectionStore.getLabel(id) ?? id;

  const aviso = (texto: string, tom: "warning" | "neutral" | "danger" = "warning") => (
    <p
      role="status"
      className={`rounded-card border px-3.5 py-2.5 text-[13px] ${
        tom === "warning" ? "border-warning bg-warning-soft text-warning-ink" : tom === "danger" ? "border-danger bg-danger-soft text-danger-ink" : "border-line bg-neutral-soft text-ink-soft"
      }`}
    >
      {texto}
    </p>
  );

  const vazio = (titulo: string, corpo: string, cta?: { href: string; label: string }) => (
    <div role="status" className="rounded-card border border-line bg-surface px-6 py-10 text-center">
      <p className="font-semibold">{titulo}</p>
      <p className="mx-auto mt-1 max-w-prose text-sm text-muted">{corpo}</p>
      <Link href={cta?.href ?? "/vagas"} className={buttonClasses("primary", "md", "mt-4 hover:no-underline hover:text-white")}>
        {cta?.label ?? t("backToList")}
      </Link>
    </div>
  );

  let corpo: React.ReactNode = null;
  if (fase === "carregando") corpo = <p className="text-muted" aria-busy="true">{t("loading")}</p>;
  else if (fase === "sem_admin") corpo = vazio(t("adminOnlyTitle"), t("adminOnlyBody"));
  else if (fase === "sem_perfil") corpo = vazio(t("noProfileTitle"), t("noProfileBody"), { href: "/minha-ficha", label: t("noProfileCta") });
  else if (fase === "sem_selecao") corpo = vazio(t("emptyTitle"), t("emptyBody"));
  else if (fase === "erro") corpo = vazio(t("error"), "");
  else if (fase === "feito") {
    const enviadas = resultado.filter((r) => r.status === "enviada").length;
    corpo = (
      <div className="flex flex-col gap-4">
        <div role="status" className="rounded-card border border-line bg-surface p-6">
          <p className="text-lg font-semibold">{t("doneTitle", { count: enviadas })}</p>
          <p className="mt-1 text-sm text-muted">{t("doneBody")}</p>
          <ul className="mt-4 divide-y divide-line-soft text-sm">
            {resultado.map((r) => (
              <li key={r.vacancyId} data-resultado={r.status} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="font-medium">{tituloDe(r.vacancyId)}</span>
                <span className={r.status === "enviada" ? "text-success-ink" : "text-muted"}>
                  {r.status === "enviada" ? (r.email === false ? t("res_enviadaSemEmail") : t("res_enviada")) : t(`res_${r.status}` as "res_mudou")}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/minhas-candidaturas" className={buttonClasses("primary", "md", "hover:no-underline hover:text-white")}>
              {t("doneCta")}
            </Link>
            <Link href="/vagas" className={buttonClasses("secondary", "md", "hover:no-underline")}>
              {t("backToList")}
            </Link>
          </div>
        </div>
      </div>
    );
  } else if (atual) {
    const v = atual.vaga;
    const bloqueada = atual.estado === "enviada" || atual.estado === "indisponivel" || atual.estado === "nao_encontrada";
    const meta = v
      ? [v.empresa, v.regime, v.localidade, v.nivel, formatFaixa(v.faixaDe, v.faixaAte, v.faixaMoeda ?? "BRL", locale)].filter((x) => x && x !== "—")
      : [];
    const desc = textos(v?.descricaoBullets);
    const bens = textos(v?.beneficios);
    const skills = skillIds(v?.stack);
    corpo = (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-muted">
          <span data-testid="posicao">{t("position", { n: idx + 1, total: itens.length })}</span>
          <ol aria-hidden className="flex gap-1">
            {itens.map((i, k) => (
              <li
                key={i.vacancyId}
                className={`h-1.5 w-5 rounded-[3px] ${k === idx ? "bg-ink" : i.estado === "aprovada" ? "bg-brand" : i.estado === "enviada" ? "bg-success" : "bg-line"}`}
              />
            ))}
          </ol>
        </div>

        {atual.estado === "mudou" ? aviso(t("changed", { fields: (atual.campos ?? []).map((c) => t(`field_${c}`)).join(", ") })) : null}
        {atual.estado === "enviada" && atual.enviadaEm ? aviso(t("sentOn", { date: diaMes(atual.enviadaEm, locale) }), "neutral") : null}
        {atual.estado === "indisponivel" ? aviso(t("unavailable"), "danger") : null}
        {atual.estado === "nao_encontrada" ? aviso(t("notFound"), "danger") : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <section aria-labelledby="vaga-titulo" data-vaga={atual.vacancyId} className="rounded-card border border-line bg-surface p-5 text-sm">
            <p className="text-[13px] font-medium text-muted">{t("jobTitle")}</p>
            <h2 id="vaga-titulo" ref={tituloRef} tabIndex={-1} className="mt-1 text-lg font-semibold outline-none">
              {v?.titulo ?? tituloDe(atual.vacancyId)}
            </h2>
            {meta.length ? <p className="mt-1 text-ink-soft">{meta.join(" · ")}</p> : null}
            {atual.match ? (
              <div className="mt-4">
                <p className="text-[13px] font-medium text-muted">{t("matchTitle")}</p>
                <div className="mt-1">
                  <MatchBar value={atual.match.pct} />
                </div>
                {atual.match.gaps.length ? (
                  <ul className="mt-1 list-disc pl-5 text-[13px] text-ink-soft">
                    {atual.match.gaps.map((g, k) => (
                      <li key={k}>{gapText(g)}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-[13px] text-ink-soft">{t("noGaps")}</p>
                )}
              </div>
            ) : null}
            {skills.length ? (
              <div className="mt-4">
                <p className="text-[13px] font-medium text-muted">{t("skills")}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {skills.map((s) => (
                    <Chip key={s}>{skillName(s)}</Chip>
                  ))}
                </div>
              </div>
            ) : null}
            {desc.length ? (
              <div className="mt-4">
                <p className="text-[13px] font-medium text-muted">{t("description")}</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-ink">
                  {desc.map((d, k) => (
                    <li key={k}>{d}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {bens.length ? (
              <div className="mt-4">
                <p className="text-[13px] font-medium text-muted">{t("benefits")}</p>
                <p className="mt-1 text-ink">{bens.join(" · ")}</p>
              </div>
            ) : null}
            {v && !v.temContato && !bloqueada ? <p className="mt-4 border-t border-line pt-3 text-xs text-muted">{t("noContact")}</p> : null}
          </section>

          {atual.paraEmpresa && w2 ? (
            <section aria-labelledby="empresa-recebe" className="flex flex-col gap-2">
              <h2 id="empresa-recebe" className="text-[13px] font-medium text-muted">
                {t("companyGets")}
              </h2>
              <FichaW2Card ficha={atual.paraEmpresa} w2={w2} />
              <p className="text-xs text-muted">{t("companyGetsHint")}</p>
            </section>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {atual.estado === "aprovada" ? (
            <>
              <span data-testid="aprovada" className="inline-flex h-9 items-center rounded-control bg-success-soft px-3 text-sm font-medium text-success-ink">
                ✓ {t("approved")}
              </span>
              <Button variant="ghost" size="md" disabled={ocupado} onClick={() => marcar(false)}>
                {t("undo")}
              </Button>
            </>
          ) : (
            <Button variant="primary" size="md" disabled={ocupado || bloqueada} onClick={() => marcar(true)}>
              {atual.estado === "mudou" ? t("approveAgain") : t("approve")}
            </Button>
          )}
          <Button variant="secondary" size="md" disabled={idx >= itens.length - 1} onClick={proxima}>
            {t("skip")}
          </Button>
          <Button variant="ghost" size="md" disabled={idx === 0} onClick={anterior}>
            {t("previous")}
          </Button>
          <Button variant="ghost" size="md" className="ml-auto" onClick={tirar}>
            {t("remove")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <AppHeader area="candidato" active="/vagas" />
      <main className="mx-auto max-w-page px-6 pb-32 pt-6">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("subtitle")}</p>
        <div className="mt-5">{corpo}</div>
      </main>

      {fase === "revisar" ? (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-surface shadow-[0_-4px_16px_rgba(17,24,39,0.06)]" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div className="mx-auto flex max-w-page flex-wrap items-center justify-between gap-2 px-4 py-3 md:px-6">
            <div className="flex flex-col text-sm">
              <span className="font-medium" data-testid="aprovadas">{t("approvedCount", { count: aprovadas.length })}</span>
              <span className="text-xs text-muted">
                {t("usage", { used: limites.usadas24h, max: limites.dia })} · {t("batchLimit", { max: limites.lote })}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {erro ? (
                <span role="alert" className="text-sm text-danger">
                  {erro}
                </span>
              ) : aprovadas.length > restantesHoje ? (
                <span role="alert" className="text-sm text-danger">
                  {t("overLimit", { left: restantesHoje })}
                </span>
              ) : null}
              <Button variant="primary" size="md" data-action="enviar-aprovadas" disabled={!podeMandar} onClick={enviar}>
                {ocupado ? t("sending") : t("send", { count: aprovadas.length })}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
