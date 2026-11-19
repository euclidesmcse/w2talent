"use client";
/**
 * 3.6b Admin > Dados de treino (D4–D7). Contagem por tarefa e status, progresso até 500 aprovados,
 * revisão de um exemplo por vez, exportação JSONL dos aprovados (fora da prova fixa) e comparação do
 * modelo atual com outro modelo cadastrado na prova fixa. Acesso pela senha do admin.
 */
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { AppHeader } from "@/components/app-header";
import { AdminLoginCard } from "@/components/admin-login";
import { Button, Card, Select, Table, THead, Th, Tr, Td, useToast } from "@/components/ui";
import { intlTag } from "@/lib/locale";

type Tarefa = "ficha_w2" | "extract_vacancy";
type Linha = { tarefa: Tarefa; pendente: number; aprovado: number; descartado: number; paraTreino: number; prova: number; minimo: number; podeTreinar: boolean };
type Exemplo = { id: string; tarefa: Tarefa; idioma: string | null; entrada: string; saidaIa: string; saidaFinal: string; corrigido: boolean; prova: boolean; criadoEm: string };
type Exportacao = { tarefa: Tarefa; quantidade: number; quem: string; em: string };
type Modelo = { id: string; rotulo: string };
type Resultado = { id: string; rotulo: string; nota: number; falhas: number; custoUsd: number; erro: string | null };
type Comparacao = { tarefa: Tarefa; n: number; atual: Resultado; outro: Resultado };
type Estado = {
  tarefas: Linha[];
  exportacoes: Exportacao[];
  modelos: Record<Tarefa, { atual: Modelo; outros: Modelo[] }>;
  exemplo: Exemplo | null;
  maxComparacao: number;
};

/** JSON guardado como texto: mostra formatado; texto simples fica como está. */
function bonito(s: string): string {
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}

function Bloco({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <h3 className="text-[13px] font-semibold">{titulo}</h3>
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-control border border-line bg-canvas p-3 font-mono text-[12px] text-ink">{bonito(texto)}</pre>
    </div>
  );
}

export default function AdminTreinoPage() {
  const t = useTranslations("adminTreino");
  const ta = useTranslations("admin");
  const locale = useLocale();
  const { show } = useToast();
  const [auth, setAuth] = React.useState<"loading" | "login" | "disabled" | "ok">("loading");
  const [estado, setEstado] = React.useState<Estado | null>(null);
  const [revisando, setRevisando] = React.useState<Tarefa | null>(null);
  const [ocupado, setOcupado] = React.useState<string | null>(null);
  const [tarefaComp, setTarefaComp] = React.useState<Tarefa>("extract_vacancy");
  const [modeloComp, setModeloComp] = React.useState("");
  const [comparacao, setComparacao] = React.useState<Comparacao | null>(null);
  const [erroComp, setErroComp] = React.useState<string | null>(null);
  const revisandoRef = React.useRef<Tarefa | null>(null);
  revisandoRef.current = revisando;

  const load = React.useCallback(async () => {
    try {
      const q = revisandoRef.current ? `?revisar=${revisandoRef.current}` : "";
      const res = await fetch(`/api/admin/treino${q}`, { cache: "no-store" });
      const j = (await res.json().catch(() => ({}))) as Partial<Estado> & { error?: string };
      if (res.status === 401) return setAuth("login");
      if (j.error === "admin_desligado") return setAuth("disabled");
      if (!res.ok || !j.tarefas) throw new Error(j.error ?? "erro");
      setEstado(j as Estado);
      setAuth("ok");
    } catch {
      setAuth((a) => (a === "loading" ? "login" : a));
      show(t("erro"), "error");
    }
  }, [show, t]);

  const loadRef = React.useRef(load);
  loadRef.current = load;
  React.useEffect(() => {
    void loadRef.current();
  }, []);

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/admin/treino", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (res.status === 401) {
      setAuth("login");
      throw new Error("login");
    }
    return res;
  };

  const nomeTarefa = (x: Tarefa) => t(`tarefas.${x}`);
  const num = (x: number) => x.toLocaleString(intlTag(locale));
  const pct = (x: number) => x.toLocaleString(intlTag(locale), { style: "percent", maximumFractionDigits: 0 });
  const usd = (x: number) => x.toLocaleString(intlTag(locale), { style: "currency", currency: "USD", maximumFractionDigits: 4 });
  const data = (iso: string) => new Date(iso).toLocaleString(intlTag(locale), { dateStyle: "short", timeStyle: "short" });

  const revisar = async (tarefa: Tarefa) => {
    setRevisando(tarefa);
    revisandoRef.current = tarefa;
    await load();
    requestAnimationFrame(() => document.getElementById("revisao-titulo")?.focus());
  };

  const decidir = async (acao: "aprovar" | "descartar") => {
    const ex = estado?.exemplo;
    if (!ex) return;
    setOcupado(acao);
    try {
      const res = await post({ acao, id: ex.id });
      if (!res.ok) throw new Error();
      show(acao === "aprovar" ? t("aprovou") : t("descartou"), "success");
      await load();
    } catch {
      show(t("erro"), "error");
    } finally {
      setOcupado(null);
    }
  };

  const exportar = async (tarefa: Tarefa) => {
    setOcupado(`exportar:${tarefa}`);
    try {
      // Até 5.000 por arquivo: com mais, baixa uma parte por vez (1, 2, ...).
      let total = 0;
      let partes = 1;
      for (let parte = 1; parte <= partes; parte++) {
        const res = await post({ acao: "exportar", tarefa, parte });
        if (!res.ok) throw new Error();
        partes = Math.max(1, Number(res.headers.get("x-partes") ?? 1));
        total += Number(res.headers.get("x-quantidade") ?? 0);
        const blob = await res.blob();
        const nome = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? `treino-${tarefa}-${parte}.jsonl`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = nome;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      show(t("exportou", { count: total }), "success");
      await load();
    } catch {
      show(t("erro"), "error");
    } finally {
      setOcupado(null);
    }
  };

  const apagar = async (tarefa: Tarefa) => {
    if (!window.confirm(t("apagarConfirma", { tarefa: nomeTarefa(tarefa) }))) return;
    setOcupado(`apagar:${tarefa}`);
    try {
      const res = await post({ acao: "apagar_tarefa", tarefa, confirmar: true });
      const j = (await res.json().catch(() => ({}))) as { apagados?: number };
      if (!res.ok) throw new Error();
      show(t("apagou", { count: j.apagados ?? 0 }), "success");
      await load();
    } catch {
      show(t("erro"), "error");
    } finally {
      setOcupado(null);
    }
  };

  const comparar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!modeloComp) return;
    setOcupado("comparar");
    setErroComp(null);
    setComparacao(null);
    try {
      const res = await post({ acao: "comparar", tarefa: tarefaComp, modelo: modeloComp });
      const j = (await res.json().catch(() => ({}))) as Comparacao & { error?: string };
      if (!res.ok) {
        const conhecidos = ["prova_vazia", "orcamento_insuficiente", "mesmo_modelo", "modelo_nao_serve", "modelo_atual_nao_serve"];
        return setErroComp(t(`erros.${conhecidos.includes(j.error ?? "") ? j.error : "comparar"}`));
      }
      setComparacao(j);
      await load();
    } catch {
      setErroComp(t("erros.comparar"));
    } finally {
      setOcupado(null);
    }
  };

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => undefined);
    setEstado(null);
    setAuth("login");
  };

  const ex = estado?.exemplo ?? null;
  const modelosDaTarefa = estado?.modelos?.[tarefaComp];

  return (
    <>
      <AppHeader area="admin" active="/admin/treino" right={auth === "ok" ? <Button variant="secondary" size="sm" onClick={logout}>{ta("logout")}</Button> : null} />
      <main className="mx-auto flex max-w-page flex-col gap-5 px-4 py-6 md:px-6">
        <div>
          <h1 className="text-[22px] font-semibold">{t("title")}</h1>
          <p className="mt-1 max-w-[760px] text-sm text-muted">{t("intro")}</p>
          <p className="mt-1 max-w-[760px] text-sm text-muted">{t("regra", { count: estado?.tarefas[0]?.minimo ?? 500 })}</p>
          <p className="mt-1 max-w-[760px] text-sm text-muted">{t("lora")}</p>
        </div>
        {auth === "loading" ? <p aria-busy="true" className="text-sm text-muted">{ta("loading")}</p> : null}
        {auth === "disabled" ? (
          <Card className="max-w-md p-5">
            <p role="alert" className="text-sm">{ta("login.disabled")}</p>
          </Card>
        ) : null}
        {auth === "login" ? <AdminLoginCard onDone={() => load()} titulo={t("loginTitle")} /> : null}

        {auth === "ok" && estado ? (
          <>
            <Card>
              <Table minWidth={900}>
                <caption className="px-4 pt-4 text-left text-[13px] text-muted">{t("legenda")}</caption>
                <THead>
                  <Th>{t("tarefa")}</Th>
                  <Th>{t("status.pendente")}</Th>
                  <Th>{t("status.aprovado")}</Th>
                  <Th>{t("status.descartado")}</Th>
                  <Th>{t("progresso")}</Th>
                  <Th>{t("acoes")}</Th>
                </THead>
                <tbody>
                  {estado.tarefas.map((l) => {
                    const p = Math.min(1, l.aprovado / l.minimo);
                    return (
                      <Tr key={l.tarefa} data-tarefa={l.tarefa}>
                        <th scope="row" className="px-2 py-3 text-left align-middle font-semibold first:pl-4">{nomeTarefa(l.tarefa)}</th>
                        <Td>{num(l.pendente)}</Td>
                        <Td>
                          <span className="block">{num(l.aprovado)}</span>
                          <span className="text-[13px] text-muted">{t("treinoProva", { treino: l.paraTreino, prova: l.prova })}</span>
                        </Td>
                        <Td>{num(l.descartado)}</Td>
                        <Td className="min-w-[180px]">
                          <div className="h-2 w-full overflow-hidden rounded-pill bg-neutral-soft" aria-hidden="true">
                            <div className="h-full bg-brand-solid" style={{ width: `${Math.round(p * 100)}%` }} />
                          </div>
                          <span className="mt-1 block text-[13px] text-muted">
                            {l.podeTreinar ? t("pronto", { count: l.minimo }) : t("faltam", { atual: l.aprovado, minimo: l.minimo, pct: pct(p) })}
                          </span>
                        </Td>
                        <Td>
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="secondary" data-action="revisar" onClick={() => revisar(l.tarefa)} disabled={!l.pendente}>{t("revisar")}</Button>
                            <Button size="sm" variant="secondary" data-action="exportar" onClick={() => exportar(l.tarefa)} disabled={ocupado === `exportar:${l.tarefa}` || !l.paraTreino}>{t("exportar")}</Button>
                            <Button size="sm" variant="ghost" data-action="apagar" onClick={() => apagar(l.tarefa)} disabled={ocupado === `apagar:${l.tarefa}`}>{t("apagar")}</Button>
                          </div>
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
            </Card>

            {revisando ? (
              <Card className="p-5" data-testid="revisao">
                <h2 id="revisao-titulo" tabIndex={-1} className="text-base font-semibold">{t("revisaoTitulo", { tarefa: nomeTarefa(revisando) })}</h2>
                {ex ? (
                  <div className="mt-3 flex flex-col gap-4">
                    <p className="text-[13px] text-muted">
                      {ex.corrigido ? t("corrigido") : t("semCorrecao")}
                      {ex.prova ? ` · ${t("naProva")}` : ""}
                      {ex.idioma ? ` · ${ex.idioma}` : ""} · {data(ex.criadoEm)}
                    </p>
                    <p className="text-[13px] text-muted">{t("revisaoDica")}</p>
                    <div className="grid gap-4 lg:grid-cols-3">
                      <Bloco titulo={t("entrada")} texto={ex.entrada} />
                      <Bloco titulo={t("saidaIa")} texto={ex.saidaIa} />
                      <Bloco titulo={t("saidaFinal")} texto={ex.saidaFinal} />
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Button data-action="aprovar" onClick={() => decidir("aprovar")} disabled={!!ocupado}>{t("aprovar")}</Button>
                      <Button variant="secondary" data-action="descartar" onClick={() => decidir("descartar")} disabled={!!ocupado}>{t("descartar")}</Button>
                      <Button variant="ghost" onClick={() => setRevisando(null)}>{t("fecharRevisao")}</Button>
                    </div>
                  </div>
                ) : (
                  <p role="status" className="mt-2 text-sm text-muted">{t("nadaPendente")}</p>
                )}
              </Card>
            ) : null}

            <Card className="p-5">
              <h2 className="text-base font-semibold">{t("compararTitulo")}</h2>
              <p className="mt-1 max-w-[760px] text-[13px] text-muted">{t("compararIntro", { count: estado.maxComparacao })}</p>
              <form onSubmit={comparar} className="mt-3 flex flex-wrap items-end gap-3">
                <label className="flex min-w-[200px] flex-col gap-1 text-sm">
                  <span>{t("tarefa")}</span>
                  <Select value={tarefaComp} onChange={(e) => { setTarefaComp(e.target.value as Tarefa); setModeloComp(""); setComparacao(null); }}>
                    {estado.tarefas.map((l) => <option key={l.tarefa} value={l.tarefa}>{nomeTarefa(l.tarefa)}</option>)}
                  </Select>
                </label>
                <label className="flex min-w-[260px] flex-col gap-1 text-sm">
                  <span>{t("outroModelo")}</span>
                  <Select value={modeloComp} onChange={(e) => setModeloComp(e.target.value)}>
                    <option value="">{t("escolha")}</option>
                    {(modelosDaTarefa?.outros ?? []).map((m) => <option key={m.id} value={m.id}>{m.rotulo}</option>)}
                  </Select>
                </label>
                <Button type="submit" data-action="comparar" disabled={!modeloComp || ocupado === "comparar"} aria-busy={ocupado === "comparar"}>
                  {ocupado === "comparar" ? t("comparando") : t("comparar")}
                </Button>
              </form>
              <p className="mt-2 text-[13px] text-muted">{t("atual", { modelo: modelosDaTarefa?.atual.rotulo ?? "—" })}</p>
              {!modelosDaTarefa?.outros.length ? <p className="mt-1 text-[13px] text-muted">{t("semModelos")}</p> : null}
              {erroComp ? <p role="alert" className="mt-2 text-[13px] text-danger">{erroComp}</p> : null}
              {comparacao ? (
                <div className="mt-4" data-testid="comparacao">
                  <Table minWidth={560}>
                    <caption className="pb-2 text-left text-[13px] text-muted">{t("resultadoLegenda", { count: comparacao.n, tarefa: nomeTarefa(comparacao.tarefa) })}</caption>
                    <THead>
                      <Th>{t("modelo")}</Th>
                      <Th>{t("nota")}</Th>
                      <Th>{t("falhas")}</Th>
                      <Th>{t("custo")}</Th>
                    </THead>
                    <tbody>
                      {[{ r: comparacao.atual, k: "rotuloAtual" }, { r: comparacao.outro, k: "rotuloOutro" }].map(({ r, k }) => (
                        <Tr key={k}>
                          <th scope="row" className="px-2 py-3 text-left align-middle font-normal first:pl-4">
                            <strong className="block font-semibold">{r.rotulo}</strong>
                            <span className="text-[13px] text-muted">{t(k)}</span>
                          </th>
                          <Td className="font-semibold">{pct(r.nota)}</Td>
                          <Td>{num(r.falhas)}</Td>
                          <Td>{usd(r.custoUsd)}</Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                  <p className="mt-2 text-[13px] text-muted">{t("notaExplica")}</p>
                </div>
              ) : null}
            </Card>

            <Card className="p-5">
              <h2 className="text-base font-semibold">{t("exportacoesTitulo")}</h2>
              {estado.exportacoes.length ? (
                <ul className="mt-2 flex flex-col gap-1 text-sm">
                  {estado.exportacoes.map((e, i) => (
                    <li key={i}>{t("exportacaoItem", { data: data(e.em), tarefa: nomeTarefa(e.tarefa), count: e.quantidade, quem: e.quem })}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted">{t("semExportacoes")}</p>
              )}
            </Card>
          </>
        ) : null}
      </main>
    </>
  );
}
