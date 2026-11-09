"use client";
/**
 * "Minha ficha" (1.5.10 + 1.5.11): enviar o CV → conferir a ficha → ver a Ficha W2.
 * Nada é salvo no servidor até publicar; o rascunho fica neste navegador (localStorage).
 * Publicar, até o login novo (1.5.5), só para o admin (decisão D1).
 */
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { AppHeader } from "@/components/app-header";
import { FichaW2Card } from "@/components/ficha-w2-card";
import { Button, Card, Field, Input, Select, Textarea, cn } from "@/components/ui";
import {
  camposFaltando,
  DISPONIBILIDADES,
  fichaVazia,
  MAX_SKILLS,
  MODOS,
  MOEDAS,
  NIVEIS_IDIOMA,
  REGIMES,
  sanitizeFicha,
  SENIORIDADES,
  type CampoMinimo,
  type Ficha,
  type FichaW2,
} from "@/lib/ficha";
import { getSkill, listSkills, normalizeSkill } from "@/lib/taxonomy";

type Passo = "enviar" | "conferir" | "w2";
type SkillRow = { texto: string; anos: number };
type Rascunho = { passo: Passo; ficha: Ficha; skills: SkillRow[]; w2: FichaW2 | null; aceite: boolean };

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
  const tr = useTranslations();
  const locale = useLocale();
  const [r, setR] = React.useState<Rascunho>({ passo: "enviar", ficha: fichaVazia(), skills: [], w2: null, aceite: false });
  const [carregado, setCarregado] = React.useState(false);
  const [ocupado, setOcupado] = React.useState<null | "ler" | "gerar" | "publicar">(null);
  const [erro, setErro] = React.useState<string | null>(null);
  const [aviso, setAviso] = React.useState<string | null>(null);
  const [mostrarFaltas, setMostrarFaltas] = React.useState(false);
  const [podePublicar, setPodePublicar] = React.useState(false);
  const [publicado, setPublicado] = React.useState(false);
  const [editandoW2, setEditandoW2] = React.useState(false);
  const arquivoRef = React.useRef<HTMLInputElement>(null);
  const [texto, setTexto] = React.useState("");
  const tituloRef = React.useRef<HTMLHeadingElement>(null);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CHAVE);
      if (raw) {
        const d = JSON.parse(raw) as Partial<Rascunho>;
        const ficha = sanitizeFicha(d.ficha);
        setR({
          passo: d.passo === "conferir" || d.passo === "w2" ? d.passo : "enviar",
          ficha,
          skills: Array.isArray(d.skills) ? d.skills.filter((x) => x && typeof x.texto === "string").slice(0, MAX_SKILLS) : skillRows(ficha),
          w2: d.w2 ?? null,
          aceite: d.aceite === true,
        });
      }
    } catch {
      /* sem rascunho */
    }
    setCarregado(true);
    fetch("/api/ficha/publicar")
      .then((x) => x.json())
      .then((j: { podePublicar?: boolean }) => setPodePublicar(j.podePublicar === true))
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
  const set = <K extends keyof Ficha>(k: K, v: Ficha[K]) => setR((x) => ({ ...x, ficha: { ...x.ficha, [k]: v } }));
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
    try {
      const fd = new FormData();
      fd.set("aceiteIa", "true");
      if (file) fd.set("arquivo", file);
      else fd.set("texto", texto);
      const res = await fetch("/api/ficha/ler", { method: "POST", body: fd });
      const j = (await res.json().catch(() => ({}))) as { ficha?: Ficha; origem?: string; error?: string };
      if (!res.ok || !j.ficha) return setErro(msgErro(j.error ?? "geral"));
      const ficha = sanitizeFicha(j.ficha);
      setR((x) => ({ ...x, ficha, skills: skillRows(ficha), w2: null }));
      setAviso(j.origem === "ia" ? t("lidoIa") : t("lidoRegras"));
      setMostrarFaltas(false);
      irPara("conferir");
    } catch {
      setErro(t("erro_geral"));
    } finally {
      setOcupado(null);
    }
  }

  const fichaAtual = montarFicha(r.ficha, r.skills);
  const faltas = camposFaltando(fichaAtual);
  const marcar = (c: CampoMinimo) => mostrarFaltas && faltas.includes(c);

  async function gerar(forcar = false) {
    setErro(null);
    setMostrarFaltas(true);
    if (faltas.length) {
      setErro(t("erro_ficha_incompleta"));
      requestAnimationFrame(() => document.getElementById("faltas")?.focus());
      return;
    }
    if (r.w2?.editada && !forcar) return irPara("w2");
    setOcupado("gerar");
    try {
      const res = await fetch("/api/ficha/w2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ficha: fichaAtual, idioma: locale, aceiteIa: true }),
      });
      const j = (await res.json().catch(() => ({}))) as { fichaW2?: FichaW2; error?: string };
      if (!res.ok || !j.fichaW2) return setErro(msgErro(j.error ?? "geral"));
      setR((x) => ({ ...x, w2: j.fichaW2!, passo: "w2" }));
      setEditandoW2(false);
      requestAnimationFrame(() => tituloRef.current?.focus());
    } catch {
      setErro(t("erro_geral"));
    } finally {
      setOcupado(null);
    }
  }

  async function publicar() {
    if (!r.w2) return;
    setErro(null);
    setOcupado("publicar");
    try {
      const res = await fetch("/api/ficha/publicar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ficha: fichaAtual, fichaW2: r.w2 }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) return setErro(msgErro(j.error ?? "geral"));
      setPublicado(true);
    } catch {
      setErro(t("erro_geral"));
    } finally {
      setOcupado(null);
    }
  }

  function recomecar() {
    setR({ passo: "enviar", ficha: fichaVazia(), skills: [], w2: null, aceite: r.aceite });
    setTexto("");
    setAviso(null);
    setPublicado(false);
    setMostrarFaltas(false);
    if (arquivoRef.current) arquivoRef.current.value = "";
    irPara("enviar");
  }

  const nav = [
    { href: "/vagas", label: tr("nav.vagas") },
    { href: "/minha-ficha", label: tr("nav.minhaFicha"), short: tr("nav.minhaFichaCurto"), active: true },
    { href: "/minhas-candidaturas", label: tr("nav.minhasCandidaturas"), short: tr("nav.minhasCandidaturasCurto") },
  ];
  const passos: [Passo, string][] = [
    ["enviar", t("passoEnviar")],
    ["conferir", t("passoConferir")],
    ["w2", t("passoW2")],
  ];
  const nPasso = passos.findIndex(([p]) => p === r.passo) + 1;
  const tituloPasso = r.passo === "enviar" ? t("enviarTitulo") : r.passo === "conferir" ? t("conferirTitulo") : t("w2Titulo");
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

  return (
    <>
      <AppHeader navLabel={tr("nav.main")} nav={nav} />
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-6 md:px-6">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("subtitle")}</p>

        <ol className="mt-5 flex flex-wrap gap-x-4 gap-y-1 text-[13px]" aria-label={t("passo", { n: nPasso })}>
          {passos.map(([p, rot], i) => (
            <li key={p} aria-current={p === r.passo ? "step" : undefined} className={cn("flex items-center gap-1.5", p === r.passo ? "font-semibold text-ink" : "text-muted")}>
              <span className={cn("grid h-5 w-5 place-items-center rounded-full text-[11px] tabular-nums", p === r.passo ? "bg-brand text-white" : "bg-neutral-soft text-muted")}>{i + 1}</span>
              {rot}
            </li>
          ))}
        </ol>

        <Card className="mt-4 p-5 md:p-6">
          <h2 ref={tituloRef} tabIndex={-1} className="text-lg font-semibold focus:outline-none">
            {tituloPasso}
          </h2>

          {aviso && r.passo === "conferir" ? (
            <p role="status" className="mt-2 text-sm text-muted">
              {aviso}
            </p>
          ) : null}

          {r.passo === "enviar" ? (
            <div className="mt-2 flex flex-col gap-4">
              <p className="text-sm text-muted">{t("enviarLead")}</p>
              <Field label={t("arquivo")} hint={t("arquivoAjuda")}>
                <input ref={arquivoRef} type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="text-sm font-normal file:mr-3 file:h-9 file:rounded-control file:border file:border-line-strong file:bg-surface file:px-3 file:text-sm file:font-medium file:text-ink" />
              </Field>
              <Field label={t("colar")}>
                <Textarea rows={5} value={texto} onChange={(e) => setTexto(e.target.value)} />
              </Field>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand" checked={r.aceite} onChange={(e) => setR((x) => ({ ...x, aceite: e.target.checked }))} />
                <span>{t("aceite")}</span>
              </label>
              <div className="flex flex-wrap gap-3">
                <Button data-action="ler-cv" onClick={ler} disabled={ocupado === "ler"}>
                  {ocupado === "ler" ? t("lendo") : t("ler")}
                </Button>
                <Button variant="secondary" data-action="manual" onClick={() => irPara("conferir")}>
                  {t("manual")}
                </Button>
              </div>
            </div>
          ) : null}

          {r.passo === "conferir" ? (
            <div className="mt-3 flex flex-col gap-6">
              <p id="faltas" tabIndex={-1} aria-live="polite" className={cn("text-sm focus:outline-none", faltas.length ? (mostrarFaltas ? "text-danger" : "text-muted") : "text-success")}>
                {faltas.length ? t("faltam", { n: faltas.length, lista: faltas.map((c) => t(`campo_${c}`)).join(", ") }) : t("completa")}
              </p>

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

              <fieldset className="flex flex-col gap-4">
                <legend className="mb-1 text-[15px] font-semibold">{t("secExp")}</legend>
                <p className="text-[13px] text-muted">{t("expAjuda")}</p>
                {(r.ficha.experiencias.length ? r.ficha.experiencias : [{ cargo: "", empresa: "", inicio: "", fim: "", atual: false }]).map((e, i) => {
                  const upd = (patch: Partial<typeof e>) =>
                    setR((x) => {
                      const lista = x.ficha.experiencias.length ? [...x.ficha.experiencias] : [{ cargo: "", empresa: "", inicio: "", fim: "", atual: false }];
                      lista[i] = { ...lista[i], ...patch };
                      return { ...x, ficha: { ...x.ficha, experiencias: lista } };
                    });
                  const inv = marcar("experiencia") && i === 0;
                  return (
                    <div key={i} className="grid gap-3 rounded-control border border-line-soft p-3 md:grid-cols-2">
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
                      <div className="flex flex-wrap items-center justify-between gap-2 md:col-span-2">
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" className="h-4 w-4 accent-brand" checked={e.atual} onChange={(ev) => upd({ atual: ev.target.checked, fim: ev.target.checked ? "" : e.fim })} />
                          {t("atual")}
                        </label>
                        {r.ficha.experiencias.length > 1 ? (
                          <Button variant="ghost" size="sm" aria-label={`${t("remover")} ${e.cargo || `${t("cargo")} (${i + 1})`}`} onClick={() => set("experiencias", r.ficha.experiencias.filter((_, j) => j !== i))}>
                            {t("remover")}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
                {r.ficha.experiencias.length < 8 ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="self-start"
                    onClick={() => set("experiencias", [...(r.ficha.experiencias.length ? r.ficha.experiencias : [{ cargo: "", empresa: "", inicio: "", fim: "", atual: false }]), { cargo: "", empresa: "", inicio: "", fim: "", atual: false }])}
                  >
                    {t("addExp")}
                  </Button>
                ) : null}
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
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-brand"
                        checked={r.ficha.regimes.includes(g)}
                        onChange={(e) => set("regimes", e.target.checked ? [...r.ficha.regimes, g] : r.ficha.regimes.filter((x) => x !== g))}
                      />
                      {g}
                    </label>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-[1fr_1fr_120px]">
                  <Field label={t("pretensaoDe")} hint={t("porMes")}>
                    <Input type="number" min={0} inputMode="numeric" value={r.ficha.pretensaoDe ?? ""} aria-invalid={marcar("pretensao")} onChange={(e) => set("pretensaoDe", e.target.value ? Number(e.target.value) : null)} />
                  </Field>
                  <Field label={t("pretensaoAte")}>
                    <Input type="number" min={0} inputMode="numeric" value={r.ficha.pretensaoAte ?? ""} onChange={(e) => set("pretensaoAte", e.target.value ? Number(e.target.value) : null)} />
                  </Field>
                  <Field label={t("moeda")}>
                    <Select value={r.ficha.pretensaoMoeda} onChange={(e) => set("pretensaoMoeda", e.target.value)}>
                      {MOEDAS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
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

              <div className="flex flex-wrap gap-3">
                <Button data-action="gerar-w2" onClick={() => gerar(false)} disabled={ocupado === "gerar"}>
                  {ocupado === "gerar" ? t("gerando") : t("gerar")}
                </Button>
                <Button variant="secondary" onClick={() => irPara("enviar")}>
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
                <FichaW2Card ficha={fichaAtual} w2={r.w2} />
              )}
              {publicado ? (
                <p role="status" className="text-sm text-success">
                  {t("publicado")}
                </p>
              ) : !podePublicar ? (
                <p className="text-sm text-muted">{t("publicarDepois")}</p>
              ) : null}
              <div className="flex flex-wrap gap-3">
                {podePublicar && !publicado ? (
                  <Button data-action="publicar" onClick={publicar} disabled={ocupado === "publicar" || editandoW2}>
                    {ocupado === "publicar" ? t("publicando") : t("publicar")}
                  </Button>
                ) : null}
                {!editandoW2 ? (
                  <Button variant="secondary" data-action="editar-w2" onClick={() => setEditandoW2(true)}>
                    {t("editar")}
                  </Button>
                ) : null}
                <Button variant="secondary" onClick={() => gerar(true)} disabled={ocupado === "gerar"}>
                  {ocupado === "gerar" ? t("gerando") : t("refazer")}
                </Button>
                <Button variant="secondary" onClick={() => irPara("conferir")}>
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
