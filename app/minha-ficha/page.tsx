"use client";
/**
 * "Minha ficha" (1.5.10 + 1.5.11): enviar o CV → conferir a ficha → ver a Ficha W2.
 * Nada é salvo no servidor até publicar; o rascunho fica neste navegador (localStorage).
 * Publicar, até o login novo (1.5.5), só para o admin (decisão D1).
 */
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { AppHeader } from "@/components/app-header";
import { useOnline } from "@/lib/pwa-client";
import Link from "next/link";
import { linkEntrar } from "@/lib/conta-client";
import { FichaW2Card } from "@/components/ficha-w2-card";
import { LinhaDoTempo } from "@/components/linha-do-tempo";
import { TreinoConsentimento } from "@/components/treino-consentimento";
import { FichaViesAviso } from "@/components/ficha-vies-aviso";
import { revisarViesFicha, trocarViesFicha, type AvisoFichaVies } from "@/lib/ficha-vies";
import { textoCvCompleto } from "@/lib/consentimento";
import { Button, Card, Field, Input, Select, Textarea, cn } from "@/components/ui";
import {
  camposFaltando,
  DISPONIBILIDADES,
  experienciaVazia,
  fichaVazia,
  MAX_EXPERIENCIAS,
  MAX_FUNCOES,
  MAX_SKILLS,
  MODOS,
  MOEDAS,
  NIVEIS_IDIOMA,
  novaPretensao,
  REGIMES,
  REGIMES_COM_UNIDADE,
  sanitizeFicha,
  SENIORIDADES,
  TIPOS_TRABALHO,
  type CampoMinimo,
  type Ficha,
  type FichaW2,
  type Pretensao,
  UNIDADES,
} from "@/lib/ficha";

/** Chave das mensagens por regime (sem acento): pret_CLT, pret_Estagio… */
const chaveRegime = (g: string) => g.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
import { getSkill, listSkills, normalizeSkill } from "@/lib/taxonomy";
import { dicasFicha, ETAPAS_LEITURA, lerRespostaEmEtapas, PASSOS_CONFERIR, passoDoCampo, type Dica, type EtapaLeitura, type PassoConferir } from "@/lib/importar-cv";

type Passo = "enviar" | PassoConferir | "w2";
const PASSOS_VALIDOS: readonly string[] = ["enviar", ...PASSOS_CONFERIR, "w2"];
type SkillRow = { texto: string; anos: number };
/** recibo (3.6a): o que a IA escreveu, assinado pelo servidor; volta ao publicar e só vira exemplo de treino com o consentimento. */
/** cvTexto (linha do tempo, D3): o CV lido, já sem contatos; só vai ao servidor se a pessoa marcar mostrarCv. */
type Rascunho = { passo: Passo; ficha: Ficha; skills: SkillRow[]; w2: FichaW2 | null; aceite: boolean; recibo?: string | null; cvTexto?: string | null; mostrarCv?: boolean | null; w2De?: string | null };

const CHAVE = "w2talent:ficha";

function skillRows(f: Ficha): SkillRow[] {
  return f.stack.map((s) => ({ texto: getSkill(s.skillId)?.label ?? s.skillId, anos: s.anos }));
}
function resolveSkill(texto: string): string | null {
  return normalizeSkill(texto);
}
/** Formulário → Ficha válida (competências fora da lista ficam de fora). */
function montarFicha(f: Ficha, rows: SkillRow[]): Ficha {
  return sanitizeFicha({ ...f, stack: rows.map((r) => ({ skillId: resolveSkill(r.texto), anos: r.anos })).filter((r) => r.skillId) });
}

export default function MinhaFichaPage() {
  const t = useTranslations("ficha");
  const tp = useTranslations("pwa");
  const locale = useLocale();
  // Sem internet (1.5.14): editar continua (fica neste navegador); ler o CV, gerar e publicar esperam a rede.
  const online = useOnline();
  const semRede = online ? undefined : tp("needsInternet");
  const [r, setR] = React.useState<Rascunho>({ passo: "enviar", ficha: fichaVazia(), skills: [], w2: null, aceite: false });
  const [carregado, setCarregado] = React.useState(false);
  const [ocupado, setOcupado] = React.useState<null | "ler" | "gerar" | "publicar">(null);
  const [erro, setErro] = React.useState<string | null>(null);
  const [aviso, setAviso] = React.useState<string | null>(null);
  const [mostrarFaltas, setMostrarFaltas] = React.useState(false);
  const [podePublicar, setPodePublicar] = React.useState(false);
  const [cvGuardado, setCvGuardado] = React.useState(false);
  const [publicado, setPublicado] = React.useState(false);
  const [editandoW2, setEditandoW2] = React.useState(false);
  const arquivoRef = React.useRef<HTMLInputElement>(null);
  const [texto, setTexto] = React.useState("");
  // Importar CV (D1, D2): escolher a entrada, etapas reais da leitura, card de experiência aberto (-1 = todos fechados).
  const [entrada, setEntrada] = React.useState<"escolher" | "cv">("escolher");
  const [etapas, setEtapas] = React.useState<EtapaLeitura[]>([]);
  const [temArquivo, setTemArquivo] = React.useState(false);
  const [aberto, setAberto] = React.useState<number | null>(0);
  const tituloRef = React.useRef<HTMLHeadingElement>(null);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CHAVE);
      if (raw) {
        const d = JSON.parse(raw) as Partial<Rascunho>;
        const ficha = sanitizeFicha(d.ficha);
        setR({
          // "conferir" era o passo único antes dos 4 passos curtos (D3): volta para o primeiro deles.
          passo: d.passo === ("conferir" as string) ? "pessoais" : PASSOS_VALIDOS.includes(d.passo as string) ? (d.passo as Passo) : "enviar",
          ficha,
          skills: Array.isArray(d.skills) ? d.skills.filter((x) => x && typeof x.texto === "string").slice(0, MAX_SKILLS) : skillRows(ficha),
          w2: d.w2 ?? null,
          aceite: d.aceite === true,
          recibo: typeof d.recibo === "string" ? d.recibo : null,
          cvTexto: typeof d.cvTexto === "string" ? d.cvTexto : null,
          mostrarCv: typeof d.mostrarCv === "boolean" ? d.mostrarCv : null,
          w2De: typeof d.w2De === "string" ? d.w2De : null,
        });
      }
    } catch {
      /* sem rascunho */
    }
    setCarregado(true);
    fetch("/api/ficha/publicar")
      .then((x) => x.json())
      .then((j: { podePublicar?: boolean; publicado?: boolean; cvCompleto?: boolean }) => {
        setPodePublicar(j.podePublicar === true);
        setCvGuardado(j.cvCompleto === true);
      })
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    if (!carregado) return;
    try {
      window.localStorage.setItem(CHAVE, JSON.stringify(r));
    } catch {
      /* navegador sem armazenamento */
    }
  }, [r, carregado]);

  function irPara(passo: Passo) {
    setR((x) => ({ ...x, passo }));
    setErro(null);
    requestAnimationFrame(() => tituloRef.current?.focus());
  }
  // Publicado vale para o rascunho daquele momento: qualquer mudança na ficha ou na Ficha W2 pede publicar de novo.
  React.useEffect(() => setPublicado(false), [r.ficha, r.skills, r.w2]);
  const set = <K extends keyof Ficha>(k: K, v: Ficha[K]) => setR((x) => ({ ...x, ficha: { ...x.ficha, [k]: v } }));
  // Revisor de viés (mesmas regras das vagas): só avisa, nunca bloqueia gerar, salvar ou publicar.
  const trocarVies = (a: AvisoFichaVies) =>
    setR((x) => {
      const novo = trocarViesFicha({ titulo: x.ficha.titulo, objetivo: x.ficha.objetivo, resumo: x.w2?.resumo, destaques: x.w2?.destaques }, a);
      const w2 = x.w2 && (novo.resumo !== x.w2.resumo || novo.destaques !== x.w2.destaques) ? { ...x.w2, resumo: novo.resumo ?? "", destaques: novo.destaques ?? [], editada: true } : x.w2;
      return { ...x, ficha: { ...x.ficha, titulo: novo.titulo ?? "", objetivo: novo.objetivo ?? "" }, w2 };
    });
  // Marcar um regime abre a linha da pretensão dele; desmarcar tira as duas coisas.
  const marcarRegime = (g: string, on: boolean) =>
    setR((x) => {
      const f = x.ficha;
      // sempre na ordem da tela (CLT, PJ, Estágio…), não na ordem em que foram marcados
      const regimes = REGIMES.filter((y) => (y === g ? on : f.regimes.includes(y)));
      const pretensoes = regimes.map((y) => f.pretensoes.find((p) => p.regime === y) ?? novaPretensao(y, f.pretensoes));
      return { ...x, ficha: { ...f, regimes, pretensoes } };
    });
  const setPretensao = (i: number, patch: Partial<Pretensao>) =>
    setR((x) => ({ ...x, ficha: { ...x.ficha, pretensoes: x.ficha.pretensoes.map((p, j) => (j === i ? { ...p, ...patch } : p)) } }));
  const msgErro = (codigo: string) => {
    const k = `erro_${codigo}`;
    return t.has(k) ? t(k) : t("erro_geral");
  };

  async function ler() {
    setErro(null);
    setAviso(null);
    if (!r.aceite) return setErro(t("erro_aceite_ia_obrigatorio"));
    const file = arquivoRef.current?.files?.[0];
    if (!file && texto.trim().length < 30) return setErro(t("erro_texto_curto"));
    if (file && file.size > 5 * 1024 * 1024) return setErro(t("erro_arquivo_grande"));
    setOcupado("ler");
    setEtapas([]);
    requestAnimationFrame(() => tituloRef.current?.focus());
    const alvo = fichaAtualRef.current;
    try {
      const fd = new FormData();
      fd.set("aceiteIa", "true");
      if (file) fd.set("arquivo", file);
      else fd.set("texto", texto);
      const res = await fetch("/api/ficha/ler", { method: "POST", body: fd, headers: { accept: "application/x-ndjson" } });
      // As etapas chegam uma por linha (D2); o resultado (ou o erro) é a última linha.
      const j = (await lerRespostaEmEtapas(res, (e) => setEtapas((x) => (x.includes(e) ? x : [...x, e])))) as { ficha?: Ficha; origem?: string; error?: string; cvTexto?: string };
      // Se a pessoa começou a preencher à mão enquanto a IA lia, não sobrescreve o que ela digitou.
      if (fichaAtualRef.current !== alvo) return;
      if (!res.ok || !j.ficha) return setErro(msgErro(j.error ?? "geral"));
      const ficha = sanitizeFicha(j.ficha);
      setAberto(0);
      setR((x) => ({ ...x, ficha, skills: skillRows(ficha), w2: null, cvTexto: typeof j.cvTexto === "string" && j.cvTexto ? j.cvTexto : null }));
      setAviso(j.origem === "ia" ? t("lidoIa") : t("lidoRegras"));
      setMostrarFaltas(false);
      irPara("pessoais");
    } catch {
      setErro(t("erro_geral"));
    } finally {
      setOcupado(null);
    }
  }

  const fichaAtual = montarFicha(r.ficha, r.skills);
  const faltas = camposFaltando(fichaAtual);
  // A ficha atual, para descartar uma Ficha W2 que chegue depois de o rascunho mudar.
  const fichaAtualRef = React.useRef("");
  fichaAtualRef.current = JSON.stringify(fichaAtual);
  const marcar = (c: CampoMinimo) => mostrarFaltas && faltas.includes(c);

  async function gerar(forcar = false) {
    setErro(null);
    setMostrarFaltas(true);
    if (faltas.length) {
      setErro(t("erro_ficha_incompleta"));
      // Abre o passo do primeiro campo que falta (D3).
      irPara(passoDoCampo(faltas[0]));
      requestAnimationFrame(() => document.getElementById("faltas")?.focus());
      return;
    }
    if (r.w2?.editada && !forcar) return irPara("w2");
    if (!r.aceite) return setErro(t("erro_aceite_ia_obrigatorio"));
    setOcupado("gerar");
    const alvo = JSON.stringify(fichaAtual);
    try {
      const res = await fetch("/api/ficha/w2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ficha: fichaAtual, idioma: locale, aceiteIa: r.aceite }),
      });
      const j = (await res.json().catch(() => ({}))) as { fichaW2?: FichaW2; recibo?: string | null; error?: string };
      // O rascunho mudou (campos editados ou começou de novo) enquanto a IA escrevia: resposta velha, descarta.
      if (fichaAtualRef.current !== alvo) return;
      if (!res.ok || !j.fichaW2) return setErro(msgErro(j.error ?? "geral"));
      setR((x) => ({ ...x, w2: j.fichaW2!, recibo: j.recibo ?? null, w2De: alvo, passo: "w2" }));
      setEditandoW2(false);
      requestAnimationFrame(() => tituloRef.current?.focus());
    } catch {
      setErro(t("erro_geral"));
    } finally {
      setOcupado(null);
    }
  }

  // CV completo (D3): só oferece com um CV lido neste rascunho ou um já guardado. Sem escolha, vale o que está no servidor.
  const ofereceCv = podePublicar && (!!r.cvTexto || cvGuardado);
  const mostrarCv = r.mostrarCv ?? cvGuardado;

  async function publicar() {
    if (!r.w2) return;
    setErro(null);
    setOcupado("publicar");
    try {
      const res = await fetch("/api/ficha/publicar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ficha: fichaAtual,
          fichaW2: r.w2,
          recibo: r.recibo ?? undefined,
          cv: ofereceCv ? { mostrar: mostrarCv, texto: mostrarCv ? r.cvTexto ?? undefined : undefined } : undefined,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; cvCompleto?: boolean; cvErro?: boolean };
      if (!res.ok) return setErro(msgErro(j.error ?? "geral"));
      // A ficha saiu, mas o CV completo (ligar ou apagar) não: avisa e deixa publicar de novo.
      if (j.cvErro) return setErro(t("erro_cv_completo"));
      if (typeof j.cvCompleto === "boolean") setCvGuardado(j.cvCompleto);
      setPublicado(true);
    } catch {
      setErro(t("erro_geral"));
    } finally {
      setOcupado(null);
    }
  }

  function recomecar() {
    setR({ passo: "enviar", ficha: fichaVazia(), skills: [], w2: null, aceite: r.aceite, recibo: null, cvTexto: null, mostrarCv: null });
    setTexto("");
    setAviso(null);
    setPublicado(false);
    setMostrarFaltas(false);
    setEntrada("escolher");
    setEtapas([]);
    if (arquivoRef.current) arquivoRef.current.value = "";
    irPara("enviar");
  }

  const passos: [Passo, string][] = [
    ["enviar", t("passoEnviar")],
    ["pessoais", t("passo_pessoais")],
    ["experiencia", t("passo_experiencia")],
    ["formacao", t("passo_formacao")],
    ["competencias", t("passo_competencias")],
    ["w2", t("passoW2")],
  ];
  const w2EmDia = !!r.w2 && (r.w2.editada || r.w2De === JSON.stringify(fichaAtual));
  const nPasso = passos.findIndex(([p]) => p === r.passo) + 1;
  const passoConferir = (PASSOS_CONFERIR as readonly string[]).includes(r.passo) ? (r.passo as PassoConferir) : null;
  const tituloPasso = r.passo === "enviar" ? t("enviarTitulo") : r.passo === "w2" ? t("w2Titulo") : t(`titulo_${r.passo}`);
  const opt = (prefix: string, list: readonly string[]) => [
    <option key="" value="">
      {t("escolha")}
    </option>,
    ...list.map((v) => (
      <option key={v} value={v}>
        {t(`${prefix}_${v}`)}
      </option>
    )),
  ];
  // Faltas e dicas do passo aberto (D3, D4).
  const faltasPasso = passoConferir ? faltas.filter((c) => passoDoCampo(c) === passoConferir) : [];
  const dicas = passoConferir ? dicasFicha(fichaAtual, r.cvTexto).filter((d) => d.passo === passoConferir) : [];
  const iPasso = passoConferir ? PASSOS_CONFERIR.indexOf(passoConferir) : -1;
  const experiencias = r.ficha.experiencias.length ? r.ficha.experiencias : [experienciaVazia()];
  const moverExp = (i: number, d: -1 | 1) =>
    setR((x) => {
      const lista = [...x.ficha.experiencias];
      const j = i + d;
      if (j < 0 || j >= lista.length) return x;
      [lista[i], lista[j]] = [lista[j], lista[i]];
      return { ...x, ficha: { ...x.ficha, experiencias: lista } };
    });

  return (
    <>
      <AppHeader area="candidato" active="/minha-ficha" />
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-6 md:px-6">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("subtitle")}</p>

        <ol className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-[13px]" aria-label={t("passo", { n: nPasso })}>
          {passos.map(([p, rot], i) => {
            const atual = p === r.passo;
            // A Ficha W2 só abre direto se foi gerada destes campos (ou editada à mão); senão, "Gerar" faz uma nova.
            const podeIr = !atual && ocupado !== "ler" && (p !== "w2" || w2EmDia);
            return (
              <li key={p} aria-current={atual ? "step" : undefined}>
                <button
                  type="button"
                  data-passo={p}
                  disabled={!podeIr}
                  onClick={() => irPara(p)}
                  className={cn("flex items-center gap-1.5 rounded-control py-0.5", atual ? "font-semibold text-ink" : podeIr ? "text-ink-soft hover:text-ink" : "text-muted")}
                >
                  <span className={cn("grid h-5 w-5 place-items-center rounded-full text-[11px] tabular-nums", atual ? "bg-brand-solid text-white" : "bg-neutral-soft text-muted")}>{i + 1}</span>
                  {rot}
                </button>
              </li>
            );
          })}
        </ol>

        <Card className="mt-4 p-5 md:p-6">
          <h2 ref={tituloRef} tabIndex={-1} className="text-lg font-semibold focus:outline-none">
            {ocupado === "ler" ? t("etapasTitulo") : tituloPasso}
          </h2>

          {aviso && r.passo === "pessoais" ? (
            <p role="status" className="mt-2 text-sm text-muted">
              {aviso}
            </p>
          ) : null}

          {r.passo === "enviar" && ocupado === "ler" ? (
            <div className="mt-2 flex flex-col gap-3">
              <p className="text-sm text-muted">{t("etapasLead")}</p>
              <ol data-etapas className="flex flex-col gap-2" aria-live="polite">
                {ETAPAS_LEITURA.map((e) => {
                  const feita = etapas.includes(e);
                  const agora = !feita && ETAPAS_LEITURA.find((x) => !etapas.includes(x)) === e;
                  return (
                    <li
                      key={e}
                      data-etapa={e}
                      data-estado={feita ? "feita" : agora ? "agora" : "espera"}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-control border px-4 py-3 text-sm",
                        feita ? "border-brand-soft bg-brand-soft text-brand-ink" : agora ? "border-line bg-surface text-ink" : "border-line-soft bg-canvas text-muted",
                      )}
                    >
                      <span>{t(entrada === "cv" && e === "arquivo" && !temArquivo ? "etapa_texto" : `etapa_${e}`)}</span>
                      <span className="sr-only">{feita ? t("etapaFeita") : agora ? t("etapaAgora") : ""}</span>
                      {feita ? (
                        <span aria-hidden className="grid h-6 w-6 place-items-center rounded-full bg-brand-solid text-[13px] text-white">
                          ✓
                        </span>
                      ) : agora ? (
                        <span aria-hidden className="h-5 w-5 rounded-full border-2 border-line border-t-brand motion-safe:animate-spin" />
                      ) : (
                        <span aria-hidden className="h-5 w-5" />
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          ) : null}

          {r.passo === "enviar" && ocupado !== "ler" && entrada === "escolher" ? (
            <div className="mt-3 flex flex-col gap-3">
              <p className="text-sm text-muted">{t("entradaLead")}</p>
              <button
                type="button"
                data-action="tenho-cv"
                onClick={() => setEntrada("cv")}
                className="group flex items-start justify-between gap-4 rounded-card border border-line bg-surface p-4 text-left shadow-[0_1px_0_rgba(17,24,39,0.04)] hover:border-brand"
              >
                <span>
                  <span className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                    {t("entradaCv")}
                    <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[12px] font-medium text-brand-ink">{t("recomendado")}</span>
                  </span>
                  <span className="mt-1 block text-sm text-muted">{t("entradaCvAjuda")}</span>
                </span>
                <span aria-hidden className="mt-1 text-lg text-muted group-hover:text-ink">
                  ›
                </span>
              </button>
              <button
                type="button"
                data-action="manual"
                onClick={() => irPara("pessoais")}
                className="group flex items-start justify-between gap-4 rounded-card border border-line bg-surface p-4 text-left shadow-[0_1px_0_rgba(17,24,39,0.04)] hover:border-brand"
              >
                <span>
                  <span className="font-semibold text-ink">{t("entradaZero")}</span>
                  <span className="mt-1 block text-sm text-muted">{t("entradaZeroAjuda")}</span>
                </span>
                <span aria-hidden className="mt-1 text-lg text-muted group-hover:text-ink">
                  ›
                </span>
              </button>
            </div>
          ) : null}

          {/* Fica montado (só escondido) durante a leitura: o arquivo escolhido mora no input e precisa sobreviver a uma falha. */}
          {r.passo === "enviar" && entrada === "cv" ? (
            <div className={cn("mt-2 flex-col gap-4", ocupado === "ler" ? "hidden" : "flex")}>
              <p className="text-sm text-muted">{t("enviarLead")}</p>
              <Field label={t("arquivo")} hint={t("arquivoAjuda")}>
                <input
                  ref={arquivoRef}
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => setTemArquivo(!!e.target.files?.length)}
                  className="text-sm font-normal file:mr-3 file:h-9 file:rounded-control file:border file:border-line-strong file:bg-surface file:px-3 file:text-sm file:font-medium file:text-ink"
                />
              </Field>
              <p className="-mt-2 text-[13px] text-muted">{t("linkedinComo")}</p>
              <Field label={t("colar")}>
                <Textarea rows={5} value={texto} onChange={(e) => setTexto(e.target.value)} />
              </Field>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand" checked={r.aceite} onChange={(e) => setR((x) => ({ ...x, aceite: e.target.checked }))} />
                <span>{t("aceite")}</span>
              </label>
              <div className="flex flex-wrap gap-3">
                <Button data-action="ler-cv" onClick={ler} disabled={!online} title={semRede}>
                  {t("ler")}
                </Button>
                <Button variant="secondary" onClick={() => setEntrada("escolher")}>
                  {t("voltar")}
                </Button>
              </div>
            </div>
          ) : null}

          {passoConferir ? (
            <div className="mt-3 flex flex-col gap-6">
              <p
                id="faltas"
                tabIndex={-1}
                aria-live="polite"
                className={cn("text-sm focus:outline-none", faltasPasso.length ? (mostrarFaltas ? "text-danger" : "text-muted") : "text-success")}
              >
                {faltasPasso.length ? t("faltamPasso", { lista: faltasPasso.map((c) => t(`campo_${c}`)).join(", ") }) : t("completaPasso")}
              </p>

              <Dicas passo={passoConferir} dicas={dicas} />

              {passoConferir === "pessoais" ? (
                <>
                  <fieldset className="grid gap-4 md:grid-cols-2">
                    <legend className="mb-2 text-[15px] font-semibold">{t("secSobre")}</legend>
                    <Field label={t("nome")}>
                      <Input value={r.ficha.nome} aria-invalid={marcar("nome")} autoComplete="name" onChange={(e) => set("nome", e.target.value)} />
                    </Field>
                    <Field label={t("email")}>
                      <Input type="email" value={r.ficha.email} aria-invalid={marcar("email")} autoComplete="email" onChange={(e) => set("email", e.target.value)} />
                    </Field>
                    <Field label={t("celular")}>
                      <Input type="tel" value={r.ficha.celular} autoComplete="tel" onChange={(e) => set("celular", e.target.value)} />
                    </Field>
                  </fieldset>

                  <fieldset className="grid gap-4 md:grid-cols-2">
                    <legend className="mb-2 text-[15px] font-semibold">{t("secCargo")}</legend>
                    <Field label={t("titulo")}>
                      <Input value={r.ficha.titulo} aria-invalid={marcar("titulo")} onChange={(e) => set("titulo", e.target.value)} />
                    </Field>
                    <Field label={t("senioridade")}>
                      <Select value={r.ficha.senioridade} aria-invalid={marcar("senioridade")} onChange={(e) => set("senioridade", e.target.value as Ficha["senioridade"])}>
                        {opt("sen", SENIORIDADES)}
                      </Select>
                    </Field>
                  </fieldset>

                  <fieldset className="grid gap-4 md:grid-cols-2">
                    <legend className="mb-2 text-[15px] font-semibold">{t("secOnde")}</legend>
                    <Field label={t("localidade")}>
                      <Input value={r.ficha.localidade} aria-invalid={marcar("localidade")} onChange={(e) => set("localidade", e.target.value)} />
                    </Field>
                    <Field label={t("modo")}>
                      <Select value={r.ficha.modo} aria-invalid={marcar("modo")} onChange={(e) => set("modo", e.target.value as Ficha["modo"])}>
                        {opt("modo", MODOS)}
                      </Select>
                    </Field>
                    <label className="flex items-center gap-2 text-sm md:col-span-2">
                      <input type="checkbox" className="h-4 w-4 accent-brand" checked={r.ficha.mudanca} onChange={(e) => set("mudanca", e.target.checked)} />
                      {t("mudanca")}
                    </label>
                  </fieldset>

                  <fieldset className="flex flex-col gap-4">
                    <legend className="mb-2 text-[15px] font-semibold">{t("secRegime")}</legend>
                    <div role="group" aria-label={t("regimes")} className="flex flex-wrap gap-x-5 gap-y-2">
                      <span className={cn("w-full text-[13px] font-medium", marcar("regimes") ? "text-danger" : "text-ink")}>{t("regimes")}</span>
                      {REGIMES.map((g) => (
                        <label key={g} className="flex items-center gap-2 text-sm">
                          <input type="checkbox" className="h-4 w-4 accent-brand" checked={r.ficha.regimes.includes(g)} onChange={(e) => marcarRegime(g, e.target.checked)} />
                          {g}
                        </label>
                      ))}
                    </div>
                    {r.ficha.pretensoes.length ? <p className="-mb-1 text-[13px] text-muted">{t("pretMinimo")}</p> : null}
                    {r.ficha.pretensoes.map((p, i) => (
                      <div key={p.regime} data-pretensao={p.regime} className="grid grid-cols-2 gap-3 md:grid-cols-[1fr_120px_110px]">
                        <Field className="col-span-2 md:col-span-1" label={t(`pret_${chaveRegime(p.regime)}`)}>
                          <Input
                            type="number"
                            min={0}
                            inputMode="numeric"
                            value={p.valor ?? ""}
                            aria-invalid={marcar("pretensao") && p.valor == null}
                            onChange={(e) => setPretensao(i, { valor: e.target.value ? Number(e.target.value) : null })}
                          />
                        </Field>
                        <Field label={t("unidade")}>
                          {(REGIMES_COM_UNIDADE as readonly string[]).includes(p.regime) ? (
                            <Select value={p.unidade} onChange={(e) => setPretensao(i, { unidade: e.target.value as Pretensao["unidade"] })}>
                              {UNIDADES.map((u) => (
                                <option key={u} value={u}>
                                  {t(`unidade_${u}`)}
                                </option>
                              ))}
                            </Select>
                          ) : (
                            <Input value={t("unidade_mes")} readOnly tabIndex={-1} className="bg-canvas text-muted" />
                          )}
                        </Field>
                        <Field label={t("moeda")}>
                          <Select value={p.moeda} onChange={(e) => setPretensao(i, { moeda: e.target.value })}>
                            {MOEDAS.map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </Select>
                        </Field>
                      </div>
                    ))}
                  </fieldset>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label={t("disponibilidade")}>
                      <Select value={r.ficha.disponibilidade} aria-invalid={marcar("disponibilidade")} onChange={(e) => set("disponibilidade", e.target.value as Ficha["disponibilidade"])}>
                        {opt("disp", DISPONIBILIDADES)}
                      </Select>
                    </Field>
                    <Field label={t("objetivo")} className="md:col-span-2">
                      <Textarea rows={2} value={r.ficha.objetivo} onChange={(e) => set("objetivo", e.target.value)} />
                    </Field>
                  </div>

                  <FichaViesAviso avisos={revisarViesFicha({ titulo: r.ficha.titulo, objetivo: r.ficha.objetivo })} onTrocar={trocarVies} />
                </>
              ) : null}

              {passoConferir === "experiencia" ? (
                <fieldset className="flex flex-col gap-3">
                  <legend className="mb-1 text-[15px] font-semibold">{t("secExp")}</legend>
                  <p className="text-[13px] text-muted">{t("expAjuda")}</p>
                  {experiencias.map((e, i) => {
                    const upd = (patch: Partial<typeof e>) =>
                      setR((x) => {
                        const lista = x.ficha.experiencias.length ? [...x.ficha.experiencias] : [experienciaVazia()];
                        lista[i] = { ...lista[i], ...patch };
                        return { ...x, ficha: { ...x.ficha, experiencias: lista } };
                      });
                    const inv = marcar("experiencia") && i === 0;
                    const aberta = aberto === i || (inv && aberto == null);
                    const rotulo = e.cargo || `${t("cargo")} (${i + 1})`;
                    const idCorpo = `exp-${i}`;
                    return (
                      <div key={i} data-exp={i} className={cn("rounded-control border", aberta ? "border-line" : "border-line-soft")}>
                        <div className="flex items-center gap-2 px-3 py-2">
                          <button
                            type="button"
                            aria-expanded={aberta}
                            aria-controls={idCorpo}
                            onClick={() => setAberto(aberta ? -1 : i)}
                            className="flex min-w-0 flex-1 flex-col items-start text-left"
                          >
                            <span className={cn("w-full truncate text-sm font-semibold", inv ? "text-danger" : "text-ink")}>{e.cargo || t("cargoNovo")}</span>
                            <span className="w-full truncate text-[13px] text-muted">
                              {[e.empresa, e.inicio ? `${e.inicio} – ${e.atual ? t("atualCurto") : e.fim || "?"}` : ""].filter(Boolean).join(" · ")}
                            </span>
                          </button>
                          <Button variant="ghost" size="sm" aria-label={`${t("subir")}: ${rotulo}`} disabled={i === 0 || r.ficha.experiencias.length < 2} onClick={() => moverExp(i, -1)}>
                            ↑
                          </Button>
                          <Button variant="ghost" size="sm" aria-label={`${t("descer")}: ${rotulo}`} disabled={i >= r.ficha.experiencias.length - 1} onClick={() => moverExp(i, 1)}>
                            ↓
                          </Button>
                          {r.ficha.experiencias.length > 1 ? (
                            <Button variant="ghost" size="sm" aria-label={`${t("remover")} ${rotulo}`} onClick={() => set("experiencias", r.ficha.experiencias.filter((_, j) => j !== i))}>
                              {t("remover")}
                            </Button>
                          ) : null}
                        </div>
                        {aberta ? (
                          <div id={idCorpo} className="grid gap-3 border-t border-line-soft p-3 md:grid-cols-2">
                            <Field label={`${t("cargo")} (${i + 1})`}>
                              <Input value={e.cargo} aria-invalid={inv && !e.cargo} onChange={(ev) => upd({ cargo: ev.target.value })} />
                            </Field>
                            <Field label={`${t("empresa")} (${i + 1})`}>
                              <Input value={e.empresa} aria-invalid={inv && !e.empresa} onChange={(ev) => upd({ empresa: ev.target.value })} />
                            </Field>
                            <Field label={`${t("inicio")} (${i + 1})`}>
                              <Input type="month" value={e.inicio} aria-invalid={inv && !e.inicio} onChange={(ev) => upd({ inicio: ev.target.value })} />
                            </Field>
                            <Field label={`${t("fim")} (${i + 1})`}>
                              <Input type="month" value={e.fim} disabled={e.atual} onChange={(ev) => upd({ fim: ev.target.value })} />
                            </Field>
                            <Field label={`${t("tipoTrabalho")} (${i + 1})`}>
                              <Select value={e.tipo} onChange={(ev) => upd({ tipo: ev.target.value as typeof e.tipo })}>
                                <option value="">{t("tipo_vazio")}</option>
                                {TIPOS_TRABALHO.map((k) => (
                                  <option key={k} value={k}>
                                    {t(`tipo_${k}`)}
                                  </option>
                                ))}
                              </Select>
                            </Field>
                            <Field label={`${t("skillsCargo")} (${i + 1})`} hint={t("skillsCargoAjuda")}>
                              <Input
                                key={e.skills.join(",")}
                                defaultValue={e.skills.map((id) => getSkill(id)?.label ?? id).join(", ")}
                                onBlur={(ev) => {
                                  const ids: string[] = [];
                                  for (const nome of ev.target.value.split(",")) {
                                    const id = normalizeSkill(nome.trim());
                                    if (id && !ids.includes(id)) ids.push(id);
                                  }
                                  upd({ skills: ids.slice(0, 8) });
                                }}
                              />
                            </Field>
                            <Field label={`${t("funcoes")} (${i + 1})`} hint={t("funcoesAjuda")} className="md:col-span-2">
                              <Textarea rows={3} value={e.funcoes.join("\n")} onChange={(ev) => upd({ funcoes: ev.target.value.split("\n").slice(0, MAX_FUNCOES) })} />
                            </Field>
                            <label className="flex items-center gap-2 text-sm md:col-span-2">
                              <input type="checkbox" className="h-4 w-4 accent-brand" checked={e.atual} onChange={(ev) => upd({ atual: ev.target.checked, fim: ev.target.checked ? "" : e.fim })} />
                              {t("atual")}
                            </label>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                  {r.ficha.experiencias.length < MAX_EXPERIENCIAS ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="self-start"
                      onClick={() => {
                        const n = Math.max(1, r.ficha.experiencias.length);
                        set("experiencias", [...experiencias, experienciaVazia()]);
                        setAberto(n);
                      }}
                    >
                      {t("addExp")}
                    </Button>
                  ) : null}
                </fieldset>
              ) : null}

              {passoConferir === "formacao" ? (
                <>
                  <fieldset className="flex flex-col gap-3">
                    <legend className="mb-1 text-[15px] font-semibold">{t("secFormacao")}</legend>
                    {r.ficha.formacao.map((f, i) => {
                      const upd = (patch: Partial<typeof f>) => set("formacao", r.ficha.formacao.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                      return (
                        <div key={i} data-formacao={i} className="grid gap-2 rounded-control border border-line-soft p-3 md:grid-cols-[1fr_1fr_88px_auto] md:items-end">
                          <Field label={`${t("curso")} ${i + 1}`}>
                            <Input value={f.curso} maxLength={100} onChange={(e) => upd({ curso: e.target.value })} />
                          </Field>
                          <Field label={`${t("instituicao")} ${i + 1}`}>
                            <Input value={f.instituicao} maxLength={100} onChange={(e) => upd({ instituicao: e.target.value })} />
                          </Field>
                          <Field label={`${t("anoConclusao")} ${i + 1}`}>
                            <Input inputMode="numeric" maxLength={4} value={f.ano} onChange={(e) => upd({ ano: e.target.value.replace(/\D/g, "").slice(0, 4) })} />
                          </Field>
                          <Button variant="ghost" size="sm" aria-label={`${t("remover")} ${f.curso || `${t("curso")} ${i + 1}`}`} onClick={() => set("formacao", r.ficha.formacao.filter((_, j) => j !== i))}>
                            {t("remover")}
                          </Button>
                        </div>
                      );
                    })}
                    {r.ficha.formacao.length < 5 ? (
                      <Button variant="secondary" size="sm" className="self-start" onClick={() => set("formacao", [...r.ficha.formacao, { curso: "", instituicao: "", ano: "" }])}>
                        {t("addFormacao")}
                      </Button>
                    ) : null}
                  </fieldset>

                  <fieldset className="flex flex-col gap-3">
                    <legend className="mb-1 text-[15px] font-semibold">{t("secIdiomas")}</legend>
                    {(r.ficha.idiomas.length ? r.ficha.idiomas : [{ idioma: "", nivel: "" as const }]).map((l, i) => {
                      const upd = (patch: Partial<typeof l>) =>
                        setR((x) => {
                          const lista = x.ficha.idiomas.length ? [...x.ficha.idiomas] : [{ idioma: "", nivel: "" as const }];
                          lista[i] = { ...lista[i], ...patch } as (typeof lista)[number];
                          return { ...x, ficha: { ...x.ficha, idiomas: lista } };
                        });
                      return (
                        <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                          <Field label={`${t("idioma")} ${i + 1}`}>
                            <Input value={l.idioma} aria-invalid={marcar("idiomas") && i === 0} onChange={(e) => upd({ idioma: e.target.value })} />
                          </Field>
                          <Field label={`${t("nivel")} ${i + 1}`}>
                            <Select value={l.nivel} aria-invalid={marcar("idiomas") && i === 0} onChange={(e) => upd({ nivel: e.target.value as (typeof l)["nivel"] })}>
                              {opt("niv", NIVEIS_IDIOMA)}
                            </Select>
                          </Field>
                          {r.ficha.idiomas.length > 1 ? (
                            <Button variant="ghost" size="sm" aria-label={`${t("remover")} ${l.idioma || `${t("idioma")} ${i + 1}`}`} onClick={() => set("idiomas", r.ficha.idiomas.filter((_, j) => j !== i))}>
                              {t("remover")}
                            </Button>
                          ) : (
                            <span />
                          )}
                        </div>
                      );
                    })}
                    {r.ficha.idiomas.length < 6 ? (
                      <Button variant="secondary" size="sm" className="self-start" onClick={() => set("idiomas", [...(r.ficha.idiomas.length ? r.ficha.idiomas : [{ idioma: "", nivel: "" as const }]), { idioma: "", nivel: "" }])}>
                        {t("addIdioma")}
                      </Button>
                    ) : null}
                  </fieldset>
                </>
              ) : null}

              {passoConferir === "competencias" ? (
                <>
                  <fieldset className="flex flex-col gap-3">
                    <legend className="mb-1 text-[15px] font-semibold">{t("secSkills")}</legend>
                    <p className="text-[13px] text-muted">{t("skillsAjuda")}</p>
                    <datalist id="lista-skills">
                      {listSkills().map((s) => (
                        <option key={s.id} value={s.label} />
                      ))}
                    </datalist>
                    {r.skills.map((row, i) => {
                      const desconhecida = row.texto.trim() !== "" && !resolveSkill(row.texto);
                      return (
                        <div key={i} className="grid grid-cols-[1fr_88px_auto] items-start gap-2">
                          <Field label={`${t("skill")} ${i + 1}`} error={desconhecida ? t("skillDesconhecida") : undefined}>
                            <Input
                              list="lista-skills"
                              value={row.texto}
                              aria-invalid={desconhecida || (marcar("stack") && i === 0)}
                              onChange={(e) => setR((x) => ({ ...x, skills: x.skills.map((s, j) => (j === i ? { ...s, texto: e.target.value } : s)) }))}
                            />
                          </Field>
                          <Field label={t("anos")}>
                            <Input
                              type="number"
                              min={0}
                              max={50}
                              inputMode="numeric"
                              value={row.anos || ""}
                              onChange={(e) => setR((x) => ({ ...x, skills: x.skills.map((s, j) => (j === i ? { ...s, anos: Math.max(0, Math.min(50, Number(e.target.value) || 0)) } : s)) }))}
                            />
                          </Field>
                          <Button variant="ghost" size="sm" className="mt-6" aria-label={`${t("remover")} ${row.texto || `${t("skill")} ${i + 1}`}`} onClick={() => setR((x) => ({ ...x, skills: x.skills.filter((_, j) => j !== i) }))}>
                            {t("remover")}
                          </Button>
                        </div>
                      );
                    })}
                    {r.skills.length < MAX_SKILLS ? (
                      <Button variant="secondary" size="sm" className="self-start" onClick={() => setR((x) => ({ ...x, skills: [...x.skills, { texto: "", anos: 0 }] }))}>
                        {t("addSkill")}
                      </Button>
                    ) : null}
                  </fieldset>

                  <label className="flex items-start gap-2 text-sm text-ink">
                    <input type="checkbox" data-aceite="w2" className="mt-0.5 h-4 w-4 accent-brand" checked={r.aceite} onChange={(e) => setR((x) => ({ ...x, aceite: e.target.checked }))} />
                    <span>{t("aceiteW2")}</span>
                  </label>
                </>
              ) : null}

              <div className="flex flex-wrap gap-3">
                {passoConferir === "competencias" ? (
                  <Button data-action="gerar-w2" onClick={() => gerar(false)} disabled={ocupado === "gerar" || !online} title={semRede}>
                    {ocupado === "gerar" ? t("gerando") : t("gerar")}
                  </Button>
                ) : (
                  <Button data-action="continuar" onClick={() => irPara(PASSOS_CONFERIR[iPasso + 1])}>
                    {t("continuar")}
                  </Button>
                )}
                <Button variant="secondary" onClick={() => irPara(iPasso > 0 ? PASSOS_CONFERIR[iPasso - 1] : "enviar")}>
                  {t("voltar")}
                </Button>
              </div>
            </div>
          ) : null}

          {r.passo === "w2" && r.w2 ? (
            <div className="mt-2 flex flex-col gap-4">
              <p className="text-sm text-muted">{t("w2Lead")}</p>
              {editandoW2 ? (
                <EditarW2
                  w2={r.w2}
                  onSalvar={(w2) => {
                    setR((x) => ({ ...x, w2 }));
                    setEditandoW2(false);
                  }}
                />
              ) : (
                <>
                  <FichaW2Card ficha={fichaAtual} w2={r.w2} />
                  <LinhaDoTempo ficha={fichaAtual} />
                  <FichaViesAviso
                    avisos={revisarViesFicha({ titulo: r.ficha.titulo, objetivo: r.ficha.objetivo, resumo: r.w2.resumo, destaques: r.w2.destaques })}
                    onTrocar={trocarVies}
                  />
                </>
              )}
              {publicado ? (
                <p role="status" className="text-sm text-success">
                  {t("publicado")}
                </p>
              ) : !podePublicar ? (
                <p className="text-sm text-muted">
                  {t("publicarDepois")}{" "}
                  <Link href={linkEntrar("/minha-ficha")} className="font-semibold">
                    {t("publicarEntrar")}
                  </Link>
                </p>
              ) : null}
              {ofereceCv ? (
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    data-action="mostrar-cv"
                    className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
                    checked={mostrarCv}
                    onChange={(e) => {
                      setR((x) => ({ ...x, mostrarCv: e.target.checked }));
                      setPublicado(false);
                    }}
                  />
                  <span>{textoCvCompleto(locale)}</span>
                </label>
              ) : null}
              {podePublicar ? <TreinoConsentimento /> : null}
              <div className="flex flex-wrap gap-3">
                {podePublicar && !publicado ? (
                  <Button data-action="publicar" onClick={publicar} disabled={ocupado === "publicar" || editandoW2 || !online} title={semRede}>
                    {ocupado === "publicar" ? t("publicando") : t("publicar")}
                  </Button>
                ) : null}
                {!editandoW2 ? (
                  <Button variant="secondary" data-action="editar-w2" onClick={() => setEditandoW2(true)}>
                    {t("editar")}
                  </Button>
                ) : null}
                <Button variant="secondary" onClick={() => gerar(true)} disabled={ocupado === "gerar" || !online} title={semRede}>
                  {ocupado === "gerar" ? t("gerando") : t("refazer")}
                </Button>
                <Button variant="secondary" onClick={() => irPara("pessoais")}>
                  {t("editarCampos")}
                </Button>
                <Button variant="ghost" onClick={recomecar}>
                  {t("recomecar")}
                </Button>
              </div>
            </div>
          ) : null}

          {erro ? (
            <p role="alert" className="mt-4 text-sm text-danger">
              {erro}
            </p>
          ) : null}
        </Card>
      </main>
    </>
  );
}

function EditarW2({ w2, onSalvar }: { w2: FichaW2; onSalvar: (w2: FichaW2) => void }) {
  const t = useTranslations("ficha");
  const [resumo, setResumo] = React.useState(w2.resumo);
  const [destaques, setDestaques] = React.useState<string[]>([...w2.destaques, "", "", ""].slice(0, 3));
  return (
    <div className="flex flex-col gap-3 rounded-card border border-line p-4">
      <Field label={t("w2Resumo")}>
        <Textarea rows={4} maxLength={420} value={resumo} onChange={(e) => setResumo(e.target.value)} />
      </Field>
      {destaques.map((d, i) => (
        <Field key={i} label={`${t("w2Destaques")} ${i + 1}`}>
          <Input maxLength={160} value={d} onChange={(e) => setDestaques((x) => x.map((v, j) => (j === i ? e.target.value : v)))} />
        </Field>
      ))}
      <FichaViesAviso
        avisos={revisarViesFicha({ resumo, destaques })}
        onTrocar={(a) => {
          const novo = trocarViesFicha({ resumo, destaques }, a);
          setResumo(novo.resumo);
          setDestaques(novo.destaques);
        }}
      />
      <Button
        className="self-start"
        disabled={!resumo.trim()}
        onClick={() => onSalvar({ ...w2, resumo: resumo.trim(), destaques: destaques.map((d) => d.trim()).filter(Boolean), editada: true })}
      >
        {t("salvar")}
      </Button>
    </div>
  );
}

/** Dicas profissionais do passo (D4): uma fixa e as das regras. Só avisam, nunca bloqueiam. */
function Dicas({ passo, dicas }: { passo: PassoConferir; dicas: Dica[] }) {
  const t = useTranslations("ficha");
  return (
    <aside data-dicas={passo} className="rounded-card border border-line bg-canvas p-4 text-sm">
      <h3 className="text-[15px] font-semibold text-ink">{t("dicasTitulo")}</h3>
      <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-ink-soft">
        <li>{t(`dicaFixa_${passo}`)}</li>
        {dicas.map((d, i) => (
          <li key={`${d.codigo}-${i}`} data-dica={d.codigo}>
            {t(`dica_${d.codigo}`, { ...("n" in d ? { n: d.n } : {}), ...("a" in d ? { a: d.a, b: d.b } : {}) })}
          </li>
        ))}
      </ul>
    </aside>
  );
}
