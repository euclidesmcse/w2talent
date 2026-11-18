"use client";
/**
 * Publicar vaga (2.1b, plano 2.1, D4 e D6). O recrutador cola o texto, a IA preenche os campos,
 * ele confere e publica. Antes de publicar, a tela avisa vaga parecida já ativa na empresa
 * ("Atualizar a existente") e sugere a faixa salarial quando há 5 ou mais vagas parecidas de base.
 */
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { AppHeader } from "@/components/app-header";
import { Button, Card, CardBody, Field, Input, Select, Textarea, useToast } from "@/components/ui";
import { buttonClasses } from "@/components/ui/button";
import { contaRecusada, linkEntrar, useConta } from "@/lib/conta-client";
import { formatFaixa } from "@/lib/format";
import { diaMes } from "@/lib/envio-client";
import { getSkill, normalizeSkill } from "@/lib/taxonomy";
import { localidadeDaVaga, MODOS, MOEDAS, NIVEIS, rascunhoVazio, REGIMES, type RascunhoVaga } from "@/lib/vaga-campos";

type Duplicada = { id: string; titulo: string; updatedAt: string };
type Faixa = { de: number; ate: number; base: number; moeda: string };
type Empresa = { nome: string; validacaoStatus: "pendente" | "validado" | "rejeitado" } | null;

/** Campos de texto da tela (a faixa e as listas ficam como o recrutador digita). */
type Form = Omit<RascunhoVaga, "stack" | "faixaDe" | "faixaAte" | "descricaoBullets" | "beneficios"> & {
  skills: string;
  faixaDe: string;
  faixaAte: string;
  descricao: string;
  beneficios: string;
};

function formDe(v: RascunhoVaga): Form {
  return {
    titulo: v.titulo,
    nivel: v.nivel,
    regime: v.regime,
    cidade: v.cidade,
    modo: v.modo,
    faixaMoeda: v.faixaMoeda,
    skills: v.stack.map((id) => getSkill(id)?.label ?? id).join(", "),
    faixaDe: v.faixaDe ? String(v.faixaDe) : "",
    faixaAte: v.faixaAte ? String(v.faixaAte) : "",
    descricao: v.descricaoBullets.join("\n"),
    beneficios: v.beneficios.join("\n"),
  };
}

/** Chave das mensagens sem acento ("Júnior" → "junior"). */
function ascii(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function lerSkills(s: string): { ids: string[]; desconhecidas: string[] } {
  const ids: string[] = [];
  const desconhecidas: string[] = [];
  for (const parte of s.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean)) {
    const id = normalizeSkill(parte);
    if (!id) desconhecidas.push(parte);
    else if (!ids.includes(id)) ids.push(id);
  }
  return { ids, desconhecidas };
}

function valor(s: string): number | null {
  const n = Number(s.replace(/[^\d]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function linhas(s: string): string[] {
  return s.split(/\r?\n/).map((l) => l.replace(/^[-•*·]\s*/, "").trim()).filter(Boolean);
}

/** O que a API recebe: o mesmo formato do rascunho da IA. */
function rascunhoDe(f: Form): RascunhoVaga {
  return {
    titulo: f.titulo.trim(),
    nivel: f.nivel,
    regime: f.regime,
    cidade: f.cidade.trim(),
    modo: f.modo,
    stack: lerSkills(f.skills).ids,
    faixaDe: valor(f.faixaDe),
    faixaAte: valor(f.faixaAte),
    faixaMoeda: f.faixaMoeda,
    descricaoBullets: linhas(f.descricao),
    beneficios: linhas(f.beneficios),
  };
}

export default function PublicarPage() {
  const t = useTranslations("publicar");
  const tc = useTranslations("conta");
  const tg = useTranslations("common");
  const locale = useLocale();
  const { show } = useToast();
  const conta = useConta();
  const liberado = conta.estado === "ok" && conta.conta?.perfil === "recrutador";

  const [empresa, setEmpresa] = React.useState<Empresa | undefined>(undefined);
  const [colado, setColado] = React.useState("");
  const [lendo, setLendo] = React.useState(false);
  const [passo, setPasso] = React.useState<"colar" | "conferir" | "publicada">("colar");
  const [origem, setOrigem] = React.useState<"ia" | "regras" | "manual">("manual");
  const [form, setForm] = React.useState<Form>(() => formDe(rascunhoVazio()));
  const [erro, setErro] = React.useState<string | null>(null);
  const [duplicadas, setDuplicadas] = React.useState<Duplicada[]>([]);
  const [faixa, setFaixa] = React.useState<Faixa | null>(null);
  const [editando, setEditando] = React.useState<Duplicada | null>(null);
  const [enviando, setEnviando] = React.useState(false);
  const [publicada, setPublicada] = React.useState<{ titulo: string; atualizada: boolean } | null>(null);
  const conferencia = React.useRef(0);
  const tituloRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!liberado) return;
    fetch("/api/conta/empresa", { cache: "no-store" })
      .then(async (r) => {
        if (r.status === 401 || r.status === 403) contaRecusada();
        const j = r.ok ? ((await r.json()) as { empresa: Empresa }) : { empresa: null };
        setEmpresa(j.empresa);
      })
      .catch(() => setEmpresa(null));
  }, [liberado]);

  // Conferência (duplicada e faixa) quando muda o que pesa nela, depois de uma pausa curta.
  const rascunho = React.useMemo(() => rascunhoDe(form), [form]);
  const chaveConferir = JSON.stringify([rascunho.titulo, rascunho.stack, rascunho.nivel, rascunho.regime, rascunho.faixaMoeda]);
  React.useEffect(() => {
    if (passo !== "conferir") return;
    if (!rascunho.titulo && !rascunho.stack.length) {
      setDuplicadas([]);
      setFaixa(null);
      return;
    }
    const n = ++conferencia.current;
    const timer = setTimeout(async () => {
      try {
        const r = await fetch("/api/vacancies/conferir", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ rascunho, ignorarId: editando?.id ?? null }),
        });
        if (n !== conferencia.current || !r.ok) return;
        const j = (await r.json()) as { duplicadas: Duplicada[]; faixa: Faixa | null };
        setDuplicadas(j.duplicadas ?? []);
        setFaixa(j.faixa ?? null);
      } catch {
        /* a conferência só ajuda; sem ela, publica igual */
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [chaveConferir, passo, editando?.id]);

  const set = <K extends keyof Form>(k: K) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const irParaConferir = (v: RascunhoVaga, o: "ia" | "regras" | "manual") => {
    setForm(formDe(v));
    setOrigem(o);
    setErro(null);
    setEditando(null);
    setDuplicadas([]);
    setFaixa(null);
    setPasso("conferir");
    setTimeout(() => tituloRef.current?.focus(), 0);
  };

  const ler = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setErro(null);
    setLendo(true);
    try {
      const r = await fetch("/api/vacancies/ler", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ texto: colado }),
      });
      const j = (await r.json().catch(() => ({}))) as { vaga?: RascunhoVaga; origem?: "ia" | "regras"; error?: string };
      if (r.ok && j.vaga) return irParaConferir(j.vaga, j.origem ?? "regras");
      if (r.status === 401 || (r.status === 403 && j.error !== "empresa_rejeitada")) contaRecusada();
      setErro(t(`erros.${j.error === "texto_curto" || j.error === "limite_dia" || j.error === "sem_empresa" ? j.error : "leitura"}`));
    } catch {
      setErro(t("erros.leitura"));
    } finally {
      setLendo(false);
    }
  };

  const desconhecidas = lerSkills(form.skills).desconhecidas;
  const faixaInvertida = rascunho.faixaDe !== null && rascunho.faixaAte !== null && rascunho.faixaDe > rascunho.faixaAte;

  const publicar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setErro(null);
    if (!rascunho.titulo) return setErro(t("erros.titulo"));
    if (faixaInvertida) return setErro(t("erros.faixa"));
    setEnviando(true);
    const corpo = {
      titulo: rascunho.titulo,
      nivel: rascunho.nivel || null,
      regime: rascunho.regime || null,
      localidade: localidadeDaVaga(rascunho.cidade, rascunho.modo),
      stack: rascunho.stack,
      faixaDe: rascunho.faixaDe,
      faixaAte: rascunho.faixaAte,
      faixaMoeda: rascunho.faixaMoeda,
      descricaoBullets: rascunho.descricaoBullets,
      beneficios: rascunho.beneficios,
    };
    try {
      const r = await fetch(editando ? `/api/vacancies/${encodeURIComponent(editando.id)}` : "/api/vacancies", {
        method: editando ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(corpo),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (r.ok) {
        setPublicada({ titulo: rascunho.titulo, atualizada: !!editando });
        setPasso("publicada");
        show(editando ? t("atualizadaToast") : t("publicadaToast"), "success");
        return;
      }
      if (r.status === 401 || (r.status === 403 && j.error !== "empresa_rejeitada")) contaRecusada();
      setErro(t(`erros.${j.error === "sem_empresa" || j.error === "empresa_rejeitada" ? j.error : r.status === 404 ? "sumiu" : "publicar"}`));
    } catch {
      setErro(t("erros.publicar"));
    } finally {
      setEnviando(false);
    }
  };

  const recomecar = () => {
    setColado("");
    setPublicada(null);
    irParaConferir(rascunhoVazio(), "manual");
    setPasso("colar");
  };

  // ── Sem login de recrutador ──
  if (!liberado) {
    const proximo =
      conta.estado === "mfa" ? `/entrar/codigo?volta=%2Fpublicar`
      : conta.estado === "sem_perfil" ? `/entrar/perfil?volta=%2Fpublicar`
      : conta.estado === "mfa_obrigatorio" ? `/conta/seguranca?volta=%2Fpublicar`
      : conta.estado === "ok" ? null
      : linkEntrar("/publicar");
    const corpo = conta.estado === "ok" ? t("gateCandidate") : conta.estado === "mfa_obrigatorio" ? t("mfaBody") : t("gateBody");
    return (
      <div>
        <AppHeader area="recrutador" active="/publicar" />
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

  const semEmpresa = empresa === null;
  const rejeitada = empresa?.validacaoStatus === "rejeitado";

  return (
    <div>
      <AppHeader area="recrutador" active="/publicar" />
      <main className="mx-auto max-w-page px-4 py-6 md:px-6">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="mt-1 max-w-[640px] text-sm text-muted">
          {t("intro")} <a href="/ia#leitura-vaga" className="underline">{t("comoIa")}</a>
        </p>

        {empresa === undefined ? (
          <p aria-busy="true" className="mt-4 text-sm text-muted">{tg("loading")}</p>
        ) : semEmpresa || rejeitada ? (
          <div role="status" data-testid="sem-empresa" className="mt-4 max-w-[640px] rounded-card border border-line bg-surface px-6 py-8">
            <p className="font-semibold">{semEmpresa ? t("semEmpresaTitle") : t("rejeitadaTitle")}</p>
            <p className="mt-1 text-sm text-muted">{semEmpresa ? t("semEmpresaBody") : t("rejeitadaBody")}</p>
            {semEmpresa ? (
              <a href="/empresa" className={buttonClasses("primary", "md", "mt-4 hover:no-underline hover:text-white")}>{t("cadastrarEmpresa")}</a>
            ) : null}
          </div>
        ) : passo === "publicada" && publicada ? (
          <Card className="mt-4 max-w-[640px]">
            <CardBody>
              <div role="status" data-testid="vaga-publicada">
                <p className="font-semibold">{publicada.atualizada ? t("atualizadaTitle") : t("publicadaTitle")}</p>
                <p className="mt-1 text-sm text-muted">{empresa?.validacaoStatus === "validado" ? t("publicadaBody") : t("publicadaBodyPendente")}</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <a href={`/vagas?q=${encodeURIComponent(publicada.titulo)}`} className={buttonClasses("secondary", "md", "hover:no-underline")}>{t("verNaBusca")}</a>
                <Button onClick={recomecar}>{t("outra")}</Button>
              </div>
            </CardBody>
          </Card>
        ) : passo === "colar" ? (
          <Card className="mt-4 max-w-[760px]">
            <CardBody>
              <form onSubmit={ler} className="flex flex-col gap-4" noValidate>
                <Field label={t("colarLabel")} hint={t("colarHint")}>
                  <Textarea className="md:h-auto" rows={12} value={colado} onChange={(e) => setColado(e.target.value)} maxLength={20000} />
                </Field>
                {erro ? <p role="alert" className="text-[13px] text-danger">{erro}</p> : null}
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="submit" disabled={lendo || colado.trim().length < 40} aria-busy={lendo}>{lendo ? t("lendo") : t("ler")}</Button>
                  <Button type="button" variant="ghost" onClick={() => irParaConferir(rascunhoVazio(), "manual")}>{t("semColar")}</Button>
                </div>
              </form>
            </CardBody>
          </Card>
        ) : (
          <Card className="mt-4 max-w-[760px]">
            <CardBody>
              {origem !== "manual" ? (
                <p role="status" className="mb-4 rounded-card bg-brand-soft px-3.5 py-2.5 text-[13px] text-brand-ink">
                  {origem === "ia" ? t("lidaIa") : t("lidaRegras")}
                </p>
              ) : null}

              {editando ? (
                <div role="status" data-testid="editando" className="mb-4 rounded-card border border-line bg-canvas px-3.5 py-3 text-[13px]">
                  <p>{t("editando", { titulo: editando.titulo })}</p>
                  <Button variant="ghost" size="sm" className="mt-2" onClick={() => setEditando(null)}>{t("publicarComoNova")}</Button>
                </div>
              ) : duplicadas.length ? (
                <div role="status" data-testid="duplicada" className="mb-4 rounded-card bg-warning-soft px-3.5 py-3 text-[13px] text-warning-ink">
                  <p className="font-semibold">{t("duplicadaTitle")}</p>
                  <ul className="mt-1.5 flex flex-col gap-2">
                    {duplicadas.map((d) => (
                      <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span>{t("duplicadaItem", { titulo: d.titulo, data: diaMes(d.updatedAt, locale) })}</span>
                        <Button variant="secondary" size="sm" onClick={() => setEditando(d)}>{t("atualizarExistente")}</Button>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2">{t("duplicadaHint")}</p>
                </div>
              ) : null}

              <form onSubmit={publicar} className="flex flex-col gap-4" noValidate>
                <Field label={t("titulo")}>
                  <Input ref={tituloRef} value={form.titulo} onChange={set("titulo")} maxLength={120} required aria-invalid={erro === t("erros.titulo")} />
                </Field>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label={t("nivel")}>
                    <Select value={form.nivel} onChange={set("nivel")}>
                      <option value="">{t("naoInformado")}</option>
                      {NIVEIS.map((n) => <option key={n} value={n}>{t(`niveis.${ascii(n)}`)}</option>)}
                    </Select>
                  </Field>
                  <Field label={t("regime")}>
                    <Select value={form.regime} onChange={set("regime")}>
                      <option value="">{t("naoInformado")}</option>
                      {REGIMES.map((r) => <option key={r} value={r}>{t(`regimes.${ascii(r)}`)}</option>)}
                    </Select>
                  </Field>
                  <Field label={t("modo")}>
                    <Select value={form.modo} onChange={set("modo")}>
                      <option value="">{t("naoInformado")}</option>
                      {MODOS.map((m) => <option key={m} value={m}>{t(`modos.${m}`)}</option>)}
                    </Select>
                  </Field>
                  <Field label={t("cidade")} hint={t("cidadeHint")}>
                    <Input value={form.cidade} onChange={set("cidade")} maxLength={80} />
                  </Field>
                </div>
                <Field label={t("skills")} hint={desconhecidas.length ? undefined : t("skillsHint")} error={desconhecidas.length ? t("skillsDesconhecidas", { lista: desconhecidas.join(", ") }) : undefined}>
                  <Input value={form.skills} onChange={set("skills")} aria-invalid={desconhecidas.length > 0} />
                </Field>

                <fieldset className="flex flex-col gap-3">
                  <legend className="mb-1 text-[13px] font-medium">{t("faixa")}</legend>
                  <div className="grid gap-4 md:grid-cols-3">
                    <Field label={t("faixaDe")}>
                      <Input inputMode="numeric" value={form.faixaDe} onChange={set("faixaDe")} aria-invalid={faixaInvertida} />
                    </Field>
                    <Field label={t("faixaAte")}>
                      <Input inputMode="numeric" value={form.faixaAte} onChange={set("faixaAte")} aria-invalid={faixaInvertida} />
                    </Field>
                    <Field label={t("moeda")}>
                      <Select value={form.faixaMoeda} onChange={set("faixaMoeda")}>
                        {MOEDAS.map((m) => <option key={m} value={m}>{m}</option>)}
                      </Select>
                    </Field>
                  </div>
                  {faixa ? (
                    <div data-testid="faixa-sugerida" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-card border border-line bg-canvas px-3.5 py-2.5 text-[13px]">
                      <span>{t("faixaSugerida", { faixa: formatFaixa(faixa.de, faixa.ate, faixa.moeda, locale), count: faixa.base })}</span>
                      <Button variant="secondary" size="sm" onClick={() => setForm((f) => ({ ...f, faixaDe: String(faixa.de), faixaAte: String(faixa.ate), faixaMoeda: faixa.moeda as Form["faixaMoeda"] }))}>
                        {t("usarFaixa")}
                      </Button>
                    </div>
                  ) : null}
                </fieldset>

                <Field label={t("descricao")} hint={t("linhaHint")}>
                  <Textarea className="md:h-auto" rows={7} value={form.descricao} onChange={set("descricao")} />
                </Field>
                <Field label={t("beneficios")} hint={t("linhaHint")}>
                  <Textarea className="md:h-auto" rows={4} value={form.beneficios} onChange={set("beneficios")} />
                </Field>

                {erro ? <p role="alert" className="text-[13px] text-danger">{erro}</p> : null}
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="submit" disabled={enviando || !form.titulo.trim()} aria-busy={enviando}>{editando ? t("atualizar") : t("publicar")}</Button>
                  <Button type="button" variant="ghost" onClick={() => { setPasso("colar"); setErro(null); }}>{t("voltar")}</Button>
                </div>
              </form>
            </CardBody>
          </Card>
        )}
      </main>
    </div>
  );
}
