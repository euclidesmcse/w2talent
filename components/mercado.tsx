"use client";
/**
 * 3.2a Inteligência de mercado: a parte da tela /mercado que busca e mostra os números.
 * `MercadoTela` cuida da busca (competência + modo, guardados na URL) e do carregamento;
 * `MercadoResultado` só desenha a resposta de GET /api/mercado (testado em tests/mercado-rota.test.ts).
 * Grupo abaixo do mínimo mostra "Ainda poucos dados" e quanto falta; nunca mínimo nem máximo.
 */
import * as React from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { Button, Field, Input, Select } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import { formatFaixa, nomeRegime } from "@/lib/format";
import { formatMoney } from "@/lib/locale";
import type { Demanda, Faixa, GrupoFaixa, GrupoPretensao } from "@/lib/mercado";
import { MODOS_MERCADO, modoValido, tempoLegivel, vagasPorFicha, variacaoPct, type MercadoApi, type ModoMercado } from "@/lib/mercado-tela";
import { getSkill, listSkills, normalizeSkill } from "@/lib/taxonomy";

type Estado = { t: "carregando" } | { t: "erro" } | { t: "ok"; dados: MercadoApi };

export function MercadoTela() {
  const t = useTranslations("mercado");
  const tf = useTranslations("ficha");
  const [skillId, setSkillId] = React.useState<string | null>(null);
  const [modo, setModo] = React.useState<ModoMercado | null>(null);
  const [texto, setTexto] = React.useState("");
  const [desconhecida, setDesconhecida] = React.useState<string | null>(null);
  const [pronto, setPronto] = React.useState(false);
  const [estado, setEstado] = React.useState<Estado>({ t: "carregando" });
  const listaId = React.useId();

  // Endereço compartilhável: /mercado?skill=python&modo=remoto
  React.useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const s = getSkill(sp.get("skill") ?? "");
      if (s) {
        setSkillId(s.id);
        setTexto(s.label);
      }
      setModo(modoValido(sp.get("modo")));
    } catch {}
    setPronto(true);
  }, []);

  const carregar = React.useCallback(async (skill: string | null, m: ModoMercado | null) => {
    setEstado({ t: "carregando" });
    const q = new URLSearchParams();
    if (skill) q.set("skill", skill);
    if (m) q.set("modo", m);
    try {
      const qs = q.toString();
      const r = await fetch(`/api/mercado${qs ? `?${qs}` : ""}`);
      if (!r.ok) throw new Error(String(r.status));
      setEstado({ t: "ok", dados: (await r.json()) as MercadoApi });
    } catch {
      setEstado({ t: "erro" });
    }
  }, []);

  React.useEffect(() => {
    if (!pronto) return;
    void carregar(skillId, modo);
    try {
      const url = new URL(window.location.href);
      if (skillId) url.searchParams.set("skill", skillId);
      else url.searchParams.delete("skill");
      if (modo) url.searchParams.set("modo", modo);
      else url.searchParams.delete("modo");
      window.history.replaceState(null, "", url.toString());
    } catch {}
  }, [pronto, skillId, modo, carregar]);

  const escolher = (id: string | null) => {
    setDesconhecida(null);
    setSkillId(id);
    setTexto(id ? (getSkill(id)?.label ?? id) : "");
  };

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    const bruto = texto.trim();
    if (!bruto) return escolher(null);
    const id = normalizeSkill(bruto);
    if (!id) return setDesconhecida(bruto);
    escolher(id);
  };

  return (
    <div className="mx-auto flex max-w-page flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <form role="search" aria-label={t("buscaLabel")} onSubmit={enviar} className="flex flex-wrap items-end gap-3 rounded-card border border-line bg-surface p-4" data-testid="mercado-busca">
        <datalist id={listaId}>
          {listSkills().map((s) => (
            <option key={s.id} value={s.label} />
          ))}
        </datalist>
        <Field label={t("skill")} error={desconhecida ? t("skillDesconhecida", { texto: desconhecida }) : undefined} hint={t("skillAjuda")} className="min-w-0 flex-[1_1_260px]">
          <Input
            list={listaId}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={t("skillPlaceholder")}
            autoComplete="off"
            aria-invalid={desconhecida ? true : undefined}
            data-testid="mercado-skill"
          />
        </Field>
        <Field label={t("modo")} className="w-full md:mb-[26px] md:w-[200px]">
          <Select value={modo ?? ""} onChange={(e) => setModo(modoValido(e.target.value))} data-testid="mercado-modo">
            <option value="">{t("modoTodos")}</option>
            {MODOS_MERCADO.map((m) => <option key={m} value={m}>{tf(`modo_${m}`)}</option>)}
          </Select>
        </Field>
        <div className="flex gap-2 md:mb-[26px]">
          <Button type="submit" variant="primary" size="md">{t("ver")}</Button>
          {skillId ? (
            <Button type="button" variant="ghost" size="md" onClick={() => escolher(null)}>{t("limpar")}</Button>
          ) : null}
        </div>
      </form>

      <div aria-live="polite" aria-busy={estado.t === "carregando"}>
        {estado.t === "carregando" ? (
          <p className="text-sm text-muted">{t("carregando")}</p>
        ) : estado.t === "erro" ? (
          <div role="alert" className="rounded-card border border-line bg-surface px-6 py-8 text-center">
            <p className="text-sm">{t("erro")}</p>
            <Button variant="secondary" size="md" className="mt-3" onClick={() => void carregar(skillId, modo)}>{t("tentar")}</Button>
          </div>
        ) : (
          <MercadoResultado dados={estado.dados} onSkill={escolher} />
        )}
      </div>
    </div>
  );
}

/** Caixa com rolagem lateral para a tabela no celular; focável para quem usa teclado (axe: scrollable-region-focusable). */
function Tabela({ id, legenda, minWidth, children }: { id: string; legenda: string; minWidth: number; children: React.ReactNode }) {
  return (
    <div role="region" aria-labelledby={`${id}-legenda`} tabIndex={0} className="overflow-x-auto rounded-card border border-line bg-surface">
      <table className="w-full border-collapse text-sm tabular-nums" style={{ minWidth }} data-tabela={id}>
        <caption id={`${id}-legenda`} className="sr-only">{legenda}</caption>
        {children}
      </table>
    </div>
  );
}

const TH = "px-3 py-2.5 text-left text-xs font-medium text-muted";
const TD = "border-t border-line-soft px-3 py-3 align-top";
const FIXA = "sticky left-0 z-[1] bg-surface";

function Secao({ id, titulo, ajuda, children }: { id: string; titulo: string; ajuda?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-3" data-secao={id}>
      <div className="flex flex-col gap-1">
        <h2 id={id} className="text-xl font-semibold">{titulo}</h2>
        {ajuda ? <p className="max-w-[72ch] text-sm text-muted">{ajuda}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function MercadoResultado({ dados, onSkill }: { dados: MercadoApi; onSkill?: (id: string) => void }) {
  const t = useTranslations("mercado");
  const tf = useTranslations("ficha");
  const fmt = useFormatter();
  const locale = useLocale();

  if (!dados.semana) {
    return (
      <div role="status" className="rounded-card border border-line bg-surface px-6 py-10 text-center" data-testid="mercado-vazio">
        <p className="font-semibold">{t("vazioTitulo")}</p>
        <p className="mx-auto mt-1 max-w-[56ch] text-sm text-muted">{t("vazioTexto")}</p>
      </div>
    );
  }

  const nome = (id: string) => dados.nomes[id] ?? id;
  const escopo = dados.skill ? dados.skill.label : t("escopoTodas");
  const escopoModo = dados.modo ? `${escopo} · ${tf(`modo_${dados.modo}`)}` : escopo;
  const num = (n: number) => fmt.number(n);
  const dinheiro = (v: number, moeda: string) => formatMoney(v, locale, moeda);
  const meio = (f: Faixa, moeda: string) => formatFaixa(f.p25, f.p75, moeda, locale);
  const regime = (g: { regime: string; moeda: string }) => (g.moeda && g.moeda !== "BRL" ? t("regimeMoeda", { regime: nomeRegime(g.regime, locale), moeda: g.moeda }) : nomeRegime(g.regime, locale));
  const nivel = (n: string) => tf(`sen_${n}`);
  const faltam = (f: { registros: number; empresas: number }, tipo: "vagas" | "fichas") =>
    [f.registros > 0 ? t(tipo === "vagas" ? "faltamVagas" : "faltamFichas", { n: f.registros }) : null, f.empresas > 0 ? t("faltamEmpresas", { n: f.empresas }) : null]
      .filter(Boolean)
      .join(" · ");
  const tempo = (h: number) => {
    const x = tempoLegivel(h);
    return x.unidade === "horas" ? t("horas", { n: fmt.number(x.valor, { maximumFractionDigits: 1 }) }) : t("dias", { n: x.valor });
  };
  const linkSkill = (id: string) => (
    <a
      href={`/mercado?skill=${encodeURIComponent(id)}`}
      aria-label={t("verSkillLabel", { skill: nome(id) })}
      className="font-medium text-brand underline-offset-2 hover:underline"
      onClick={onSkill ? (e) => { e.preventDefault(); onSkill(id); window.scrollTo({ top: 0 }); } : undefined}
    >
      {nome(id)}
    </a>
  );
  const poucos = (texto: string) => (
    <span className="text-muted" data-poucos="">
      <span className="font-medium text-ink-soft">{t("poucos")}</span>
      {texto ? ` · ${texto}` : ""}
    </span>
  );

  const semana = fmt.dateTime(new Date(`${dados.semana}T00:00:00Z`), { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div className="flex flex-col gap-10" data-testid="mercado-resultado">
      <p className="text-[13px] text-muted" data-testid="mercado-semana">{t("atualizado", { data: semana })}</p>

      {dados.skill ? (
        <section aria-labelledby="mercado-resumo" className="rounded-card border border-line bg-surface p-5" data-testid="mercado-resumo">
          <h2 id="mercado-resumo" className="text-lg font-semibold">{t("resumoTitulo", { skill: dados.skill.label })}</h2>
          {dados.demanda ? (
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-4 md:grid-cols-4">
              {(
                [
                  ["resumoVagas", num(dados.demanda.vagas)],
                  ["resumoFichas", num(dados.demanda.fichas)],
                  ["resumoRazao", vagasPorFicha(dados.demanda) == null ? "—" : fmt.number(vagasPorFicha(dados.demanda)!, { maximumFractionDigits: 2 })],
                  ["resumoRecentes", num(dados.demanda.recentes)],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="flex flex-col gap-1">
                  <dt className="text-[13px] text-muted">{t(k)}</dt>
                  <dd className="font-display text-[24px] font-semibold leading-none tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-2 text-sm">{dados.demandaFaltamEmpresas > 0 ? poucos(t("faltamEmpresas", { n: dados.demandaFaltamEmpresas })) : t("resumoSemVagas")}</p>
          )}
        </section>
      ) : null}

      <Secao id="mercado-faixas" titulo={t("faixasTitulo")} ajuda={t("faixasAjuda")}>
        {dados.faixas.length === 0 ? (
          <p className="rounded-card border border-line bg-surface px-4 py-6 text-sm text-muted">{t("faixasVazio")}</p>
        ) : (
          <Tabela id="tab-faixas" legenda={t("faixasLegenda", { escopo: escopoModo })} minWidth={720}>
            <colgroup><col /><col /></colgroup>
            <colgroup span={2} />
            <colgroup span={2} />
            <colgroup><col /></colgroup>
            <thead>
              <tr>
                <th scope="col" rowSpan={2} className={cn(TH, FIXA, "align-bottom")}>{t("colNivel")}</th>
                <th scope="col" rowSpan={2} className={cn(TH, "align-bottom")}>{t("colRegime")}</th>
                <th scope="colgroup" colSpan={2} className={cn(TH, "pb-0 text-ink")}>{t("colDe")}</th>
                <th scope="colgroup" colSpan={2} className={cn(TH, "pb-0 text-ink")}>{t("colAte")}</th>
                <th scope="col" rowSpan={2} className={cn(TH, "align-bottom")}>{t("colVagas")}</th>
              </tr>
              <tr>
                <th scope="col" className={TH}>{t("colMediana")}</th>
                <th scope="col" className={TH}>{t("colMeio")}</th>
                <th scope="col" className={TH}>{t("colMediana")}</th>
                <th scope="col" className={TH}>{t("colMeio")}</th>
              </tr>
            </thead>
            <tbody>
              {dados.faixas.map((g: GrupoFaixa) => (
                <tr key={`${g.nivel}|${g.regime}|${g.moeda}`} data-grupo={`${g.nivel}|${g.regime}|${g.moeda}`}>
                  <th scope="row" className={cn(TD, FIXA, "text-left font-medium")}>{nivel(g.nivel)}</th>
                  <td className={TD}>{regime(g)}</td>
                  {g.de && g.ate ? (
                    <>
                      <td className={cn(TD, "font-semibold")}>{dinheiro(g.de.p50, g.moeda)}</td>
                      <td className={cn(TD, "whitespace-nowrap text-ink-soft")}>{meio(g.de, g.moeda)}</td>
                      <td className={cn(TD, "font-semibold")}>{dinheiro(g.ate.p50, g.moeda)}</td>
                      <td className={cn(TD, "whitespace-nowrap text-ink-soft")}>{meio(g.ate, g.moeda)}</td>
                    </>
                  ) : (
                    <td colSpan={4} className={TD}>{poucos(faltam(g.faltam, "vagas"))}</td>
                  )}
                  <td className={TD}>{num(g.n)}</td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        )}
      </Secao>

      <Secao id="mercado-pretensao" titulo={t("pretTitulo")} ajuda={dados.pretensoesTodosModos ? `${t("pretAjuda")} ${t("pretTodosModos")}` : t("pretAjuda")}>
        {dados.pretensoes.length === 0 ? (
          <p className="rounded-card border border-line bg-surface px-4 py-6 text-sm text-muted">{t("pretVazio")}</p>
        ) : (
          <Tabela id="tab-pretensao" legenda={t("pretLegenda", { escopo })} minWidth={560}>
            <thead>
              <tr>
                <th scope="col" className={cn(TH, FIXA)}>{t("colNivel")}</th>
                <th scope="col" className={TH}>{t("colRegime")}</th>
                <th scope="col" className={TH}>{t("colMediana")}</th>
                <th scope="col" className={TH}>{t("colMeio")}</th>
                <th scope="col" className={TH}>{t("colFichas")}</th>
              </tr>
            </thead>
            <tbody>
              {dados.pretensoes.map((g: GrupoPretensao) => (
                <tr key={`${g.nivel}|${g.regime}|${g.moeda}`} data-grupo={`${g.nivel}|${g.regime}|${g.moeda}`}>
                  <th scope="row" className={cn(TD, FIXA, "text-left font-medium")}>{nivel(g.nivel)}</th>
                  <td className={TD}>{regime(g)}</td>
                  {g.valor ? (
                    <>
                      <td className={cn(TD, "font-semibold")}>{dinheiro(g.valor.p50, g.moeda)}</td>
                      <td className={cn(TD, "whitespace-nowrap text-ink-soft")}>{meio(g.valor, g.moeda)}</td>
                    </>
                  ) : (
                    <td colSpan={2} className={TD}>{poucos(faltam(g.faltam, "fichas"))}</td>
                  )}
                  <td className={TD}>{num(g.n)}</td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        )}
      </Secao>

      <div className="grid gap-10 lg:grid-cols-2">
        <Secao id="mercado-pedidas" titulo={t("pedidasTitulo")} ajuda={t("pedidasAjuda")}>
          {dados.maisPedidas.length === 0 ? (
            <p className="rounded-card border border-line bg-surface px-4 py-6 text-sm text-muted">{t("pedidasVazio")}</p>
          ) : (
            <Tabela id="tab-pedidas" legenda={t("pedidasLegenda")} minWidth={420}>
              <thead>
                <tr>
                  <th scope="col" className={cn(TH, FIXA)}>{t("colSkill")}</th>
                  <th scope="col" className={TH}>{t("colVagas")}</th>
                  <th scope="col" className={TH}>{t("colFichas")}</th>
                  <th scope="col" className={TH}>{t("colRazao")}</th>
                </tr>
              </thead>
              <tbody>
                {dados.maisPedidas.map((d: Demanda) => {
                  const r = vagasPorFicha(d);
                  return (
                    <tr key={d.skillId} data-skill={d.skillId}>
                      <th scope="row" className={cn(TD, FIXA, "text-left font-normal")}>{linkSkill(d.skillId)}</th>
                      <td className={TD}>{num(d.vagas)}</td>
                      <td className={TD}>{num(d.fichas)}</td>
                      <td className={TD}>{r == null ? "—" : fmt.number(r, { maximumFractionDigits: 2 })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </Tabela>
          )}
        </Secao>

        <Secao id="mercado-alta" titulo={t("altaTitulo")} ajuda={t("altaAjuda")}>
          {dados.emAlta.length === 0 ? (
            <p className="rounded-card border border-line bg-surface px-4 py-6 text-sm text-muted">{t("altaVazio")}</p>
          ) : (
            <Tabela id="tab-alta" legenda={t("altaLegenda")} minWidth={420}>
              <thead>
                <tr>
                  <th scope="col" className={cn(TH, FIXA)}>{t("colSkill")}</th>
                  <th scope="col" className={TH}>{t("colRecentes")}</th>
                  <th scope="col" className={TH}>{t("colAnteriores")}</th>
                  <th scope="col" className={TH}>{t("colVariacao")}</th>
                </tr>
              </thead>
              <tbody>
                {dados.emAlta.map((d: Demanda) => {
                  const v = variacaoPct(d);
                  return (
                    <tr key={d.skillId} data-skill={d.skillId}>
                      <th scope="row" className={cn(TD, FIXA, "text-left font-normal")}>{linkSkill(d.skillId)}</th>
                      <td className={TD}>{num(d.recentes)}</td>
                      <td className={TD}>{num(d.anteriores)}</td>
                      <td className={cn(TD, "font-semibold text-success-ink")}>{v == null ? t("novo") : `+${fmt.number(v)}%`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </Tabela>
          )}
        </Secao>
      </div>

      <Secao id="mercado-resposta" titulo={t("respostaTitulo")} ajuda={t("respostaAjuda")}>
        <div className="rounded-card border border-line bg-surface p-5" data-testid="mercado-resposta">
          {dados.respostaHoras ? (
            <dl className="flex flex-col gap-1">
              <dt className="text-[13px] text-muted">{t("colMediana")}</dt>
              <dd className="font-display text-[28px] font-semibold leading-none tabular-nums">{tempo(dados.respostaHoras.p50)}</dd>
              <dt className="sr-only">{t("colMeio")}</dt>
              <dd className="mt-2 text-sm text-ink-soft">{t("respostaMeio", { de: tempo(dados.respostaHoras.p25), ate: tempo(dados.respostaHoras.p75) })}</dd>
            </dl>
          ) : (
            <p className="text-sm">{poucos("")}</p>
          )}
        </div>
      </Secao>
    </div>
  );
}
