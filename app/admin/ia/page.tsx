"use client";
/**
 * Admin de IA (1.5.8): cadastrar APIs, listar e testar modelos, ver qual modelo faz cada tarefa.
 * Acesso temporário por senha (ADMIN_SECRET) até o login do 1.5.5.
 */
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { AppHeader } from "@/components/app-header";
import { Button, Card, CardBody, CardHeader, Field, Input, Select, Table, THead, Th, Tr, Td, useToast } from "@/components/ui";
import { intlTag } from "@/lib/locale";

type TestCell = { ok: boolean; detalhe?: string | null; latenciaMs?: number | null };
type Tests = Partial<Record<TestName, TestCell>>;
type TestName = "texto" | "json" | "ferramentas" | "idiomas" | "contexto_longo" | "embeddings";
type Model = {
  id: string;
  modelo: string;
  contexto: number | null;
  precoEntrada: number | null;
  precoSaida: number | null;
  embedding: boolean;
  embeddingDim: number | null;
  ativo: boolean;
  tests: Tests;
  testadoEm: string | null;
};
type Provider = {
  id: string;
  nome: string;
  tipo: string;
  baseUrl: string | null;
  gatewayPath: string | null;
  chaveFinal: string | null;
  temChave: boolean;
  ativo: boolean;
  aceitaDadosPessoais: boolean;
  modelos: Model[];
};
type Route = { tarefa: string; modo: "automatico" | "fixo" | "travado"; modelos: string[]; motivo: string; fora: Record<string, string[]> };
type Task = { tarefa: string; kind: "chat" | "embed"; json: boolean; minContext: number | null; personalData: boolean; padrao: string; travada: boolean };
type State = { providers: Provider[]; routes: Route[]; tasks: Task[]; gastoHojeUsd: number; orcamentoDiarioUsd: number };
type Estimate = { itens: { id: string; custoUsd: number | null }[]; totalUsd: number; semPreco: number; gastoHojeUsd: number; orcamentoDiarioUsd: number; cabeNoOrcamento: boolean };

const KINDS = ["OPENAI_COMPATIBLE", "ANTHROPIC", "GOOGLE", "WORKERS_AI"] as const;
const MAX_TEST = 10;

class ApiError extends Error {
  constructor(readonly code: string, readonly status: number, readonly extra: Record<string, unknown> = {}) {
    super(code);
  }
}

async function api<T = unknown>(body?: Record<string, unknown>): Promise<T> {
  const res = await fetch("/api/admin/ai", body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(String(data?.error ?? "generic"), res.status, data);
  return (body ? data.result : data) as T;
}

function useUsd() {
  const locale = useLocale();
  return React.useCallback(
    (v: number) => new Intl.NumberFormat(intlTag(locale), { style: "currency", currency: "USD", maximumFractionDigits: v > 0 && v < 0.01 ? 4 : 2 }).format(v),
    [locale],
  );
}

export default function AdminIaPage() {
  const t = useTranslations("admin");
  const usd = useUsd();
  const { show: showToast } = useToast();
  const [auth, setAuth] = React.useState<"loading" | "login" | "disabled" | "ok">("loading");
  const [state, setState] = React.useState<State | null>(null);

  const load = React.useCallback(async () => {
    try {
      setState(await api<State>());
      setAuth("ok");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setAuth("login");
      else if (e instanceof ApiError && e.code === "admin_desligado") setAuth("disabled");
      else {
        setAuth((a) => (a === "loading" ? "login" : a));
        showToast(t("errors.generic"), "error");
      }
    }
  }, [t, showToast]);

  // Só na abertura da página; depois, cada ação chama load() de novo.
  const loadRef = React.useRef(load);
  loadRef.current = load;
  React.useEffect(() => {
    void loadRef.current();
  }, []);

  /** Mensagem traduzida de um erro da API (cai no genérico se o código não tiver texto). */
  const errorText = React.useCallback(
    (e: unknown) => {
      if (e instanceof ApiError) {
        if (e.status === 401) {
          setAuth("login");
          return t("errors.nao_autenticado");
        }
        if (t.has(`errors.${e.code}`)) return t(`errors.${e.code}`, { detalhe: String(e.extra.detalhe ?? "") });
      }
      return t("errors.generic");
    },
    [t],
  );

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => undefined);
    setState(null);
    setAuth("login");
  };

  return (
    <>
      <AppHeader
        area="admin"
        active="/admin/ia"
        right={auth === "ok" ? <Button variant="secondary" size="sm" onClick={logout}>{t("logout")}</Button> : null}
      />
      <main className="mx-auto flex max-w-page flex-col gap-5 px-4 py-6 md:px-6">
        <div>
          <h1 className="text-[22px] font-semibold">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted">{t("intro")}</p>
          {state ? (
            <p className="mt-2 text-sm tabular-nums text-ink-soft">{t("spentToday", { spent: usd(state.gastoHojeUsd), budget: usd(state.orcamentoDiarioUsd) })}</p>
          ) : null}
        </div>
        {auth === "loading" ? <p className="text-sm text-muted">{t("loading")}</p> : null}
        {auth === "disabled" ? (
          <Card>
            <CardBody>
              <p role="alert" className="text-sm">{t("login.disabled")}</p>
            </CardBody>
          </Card>
        ) : null}
        {auth === "login" ? <LoginCard onDone={load} /> : null}
        {auth === "ok" && state ? (
          <>
            <ProvidersCard state={state} reload={load} errorText={errorText} />
            <ModelsCard state={state} reload={load} errorText={errorText} />
            <RoutesCard state={state} reload={load} errorText={errorText} />
          </>
        ) : null}
      </main>
    </>
  );
}

type CardProps = { state: State; reload: () => Promise<void>; errorText: (e: unknown) => string };

function LoginCard({ onDone }: { onDone: () => Promise<void> }) {
  const t = useTranslations("admin");
  const locale = useLocale();
  const [senha, setSenha] = React.useState("");
  const [error, setError] = React.useState<string | undefined>();
  const [busy, setBusy] = React.useState(false);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const res = await fetch("/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ senha }) });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSenha("");
        await onDone();
        return;
      }
      if (data.error === "bloqueado" && data.ate) {
        setError(t("login.locked", { time: new Date(data.ate).toLocaleTimeString(intlTag(locale), { hour: "2-digit", minute: "2-digit" }) }));
      } else if (data.error === "admin_desligado") setError(t("login.disabled"));
      else if (data.error === "senha_errada") setError(t("login.wrong"));
      else setError(t("errors.generic"));
    } catch {
      setError(t("errors.generic"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="max-w-md">
      <CardHeader title={t("login.title")} />
      <CardBody>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <p className="text-sm text-muted">{t("login.hint")}</p>
          <Field label={t("login.password")} error={error}>
            <Input type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} aria-invalid={!!error} required />
          </Field>
          <div>
            <Button type="submit" disabled={busy || !senha}>{t("login.submit")}</Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

function ProvidersCard({ state, reload, errorText }: CardProps) {
  const t = useTranslations("admin");
  const toast = useToast();
  const [adding, setAdding] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [keyFor, setKeyFor] = React.useState<string | null>(null);
  const [newKey, setNewKey] = React.useState("");

  const act = async (id: string, body: Record<string, unknown>, ok?: (r: any) => string) => {
    setBusy(id);
    try {
      const r = await api(body);
      if (ok) toast.show(ok(r), "success");
      await reload();
      return true;
    } catch (e) {
      toast.show(errorText(e), "error");
      return false;
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader
        title={t("providers.title")}
        action={<Button size="sm" variant={adding ? "secondary" : "primary"} onClick={() => setAdding((a) => !a)}>{adding ? t("providers.cancel") : t("providers.add")}</Button>}
      />
      {adding ? <AddProviderForm errorText={errorText} onDone={async () => { setAdding(false); await reload(); }} /> : null}
      {state.providers.length === 0 ? (
        <CardBody><p className="text-sm text-muted">{t("providers.empty")}</p></CardBody>
      ) : (
        <ul className="divide-y divide-line-soft">
          {state.providers.map((p) => (
            <li key={p.id} className="flex flex-col gap-3 px-4 py-3.5">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{p.nome}</div>
                  <div className="text-[13px] text-muted">
                    {t(`providers.kinds.${p.tipo}`)} · {p.gatewayPath ?? p.baseUrl ?? "—"} · {p.chaveFinal ? t("providers.keyEnding", { hint: p.chaveFinal }) : t("providers.noKey")}
                  </div>
                </div>
                <label className="flex items-center gap-2 text-[13px]">
                  <input type="checkbox" checked={p.ativo} disabled={busy === p.id} onChange={(e) => act(p.id, { action: "updateProvider", id: p.id, ativo: e.target.checked })} />
                  {t("providers.active")}
                </label>
                <label className="flex items-center gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    checked={p.aceitaDadosPessoais}
                    disabled={busy === p.id}
                    onChange={(e) => act(p.id, { action: "updateProvider", id: p.id, aceitaDadosPessoais: e.target.checked })}
                  />
                  {t("routes.personal")}
                </label>
                <Button size="sm" variant="secondary" disabled={busy === p.id} onClick={() => act(p.id, { action: "listModels", id: p.id }, (r) => t("providers.listed", { total: r.listados, novos: r.novos }))}>
                  {t("providers.listModels")}
                </Button>
                {p.tipo !== "WORKERS_AI" ? (
                  <Button size="sm" variant="ghost" onClick={() => { setKeyFor(keyFor === p.id ? null : p.id); setNewKey(""); }}>{t("providers.newKey")}</Button>
                ) : null}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-danger"
                  disabled={busy === p.id}
                  onClick={() => { if (window.confirm(t("providers.confirmRemove", { name: p.nome }))) void act(p.id, { action: "deleteProvider", id: p.id }); }}
                >
                  {t("providers.remove")}
                </Button>
              </div>
              {keyFor === p.id ? (
                <form
                  className="flex flex-wrap items-end gap-2"
                  onSubmit={async (ev) => {
                    ev.preventDefault();
                    if (await act(p.id, { action: "updateProvider", id: p.id, chave: newKey })) { setKeyFor(null); setNewKey(""); }
                  }}
                >
                  <Field label={t("providers.key")} className="min-w-[240px] flex-1">
                    <Input type="password" autoComplete="off" value={newKey} onChange={(e) => setNewKey(e.target.value)} required />
                  </Field>
                  <Button type="submit" size="md" disabled={!newKey || busy === p.id}>{t("providers.saveKey")}</Button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function AddProviderForm({ onDone, errorText }: { onDone: () => Promise<void>; errorText: (e: unknown) => string }) {
  const t = useTranslations("admin");
  const [tipo, setTipo] = React.useState<(typeof KINDS)[number]>("OPENAI_COMPATIBLE");
  const [nome, setNome] = React.useState("");
  const [baseUrl, setBaseUrl] = React.useState("");
  const [gatewayPath, setGatewayPath] = React.useState("");
  const [chave, setChave] = React.useState("");
  const [pessoais, setPessoais] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>();
  const [busy, setBusy] = React.useState(false);
  const workers = tipo === "WORKERS_AI";

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await api({ action: "addProvider", tipo, nome, baseUrl, gatewayPath, chave, aceitaDadosPessoais: pessoais });
      setChave("");
      await onDone();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-4 border-b border-line-soft bg-canvas px-4 py-4 md:grid-cols-2">
      <Field label={t("providers.kind")}>
        <Select value={tipo} onChange={(e) => setTipo(e.target.value as (typeof KINDS)[number])}>
          {KINDS.map((k) => <option key={k} value={k}>{t(`providers.kinds.${k}`)}</option>)}
        </Select>
      </Field>
      <Field label={t("providers.name")}>
        <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder={t("providers.namePlaceholder")} maxLength={60} required />
      </Field>
      {!workers ? (
        <>
          <Field label={t("providers.gatewayPath")} hint={t("providers.gatewayPathHint")}>
            <Input value={gatewayPath} onChange={(e) => setGatewayPath(e.target.value)} maxLength={60} />
          </Field>
          <Field label={t("providers.baseUrl")} hint={t("providers.baseUrlHint")}>
            <Input type="url" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://" maxLength={300} />
          </Field>
          <Field label={t("providers.key")} hint={t("providers.keyHint")} className="md:col-span-2">
            <Input type="password" autoComplete="off" value={chave} onChange={(e) => setChave(e.target.value)} required />
          </Field>
          <label className="flex items-start gap-2 text-[13px] md:col-span-2">
            <input type="checkbox" className="mt-0.5" checked={pessoais} onChange={(e) => setPessoais(e.target.checked)} />
            <span>
              <span className="font-medium">{t("providers.personalData")}</span>
              <span className="block text-muted">{t("providers.personalDataHint")}</span>
            </span>
          </label>
        </>
      ) : null}
      {error ? <p role="alert" className="text-sm text-danger md:col-span-2">{error}</p> : null}
      <div className="md:col-span-2">
        <Button type="submit" disabled={busy}>{t("providers.save")}</Button>
      </div>
    </form>
  );
}

function TestMark({ cell }: { cell?: TestCell }) {
  const t = useTranslations("admin");
  if (!cell) return <span className="text-muted-soft" title={t("models.notTested")}>—<span className="sr-only">{t("models.notTested")}</span></span>;
  return cell.ok ? (
    <span className="text-success" title={cell.detalhe ?? t("models.passed")}>✓<span className="sr-only">{t("models.passed")}</span></span>
  ) : (
    <span className="text-danger" title={cell.detalhe ?? t("models.failed")}>✗<span className="sr-only">{t("models.failed")}</span></span>
  );
}

function usePriceField({ model, field, label }: { model: Model; field: "precoEntrada" | "precoSaida"; label: string }) {
  const toastCtx = useToast();
  const t = useTranslations("admin");
  const initial = model[field] == null ? "" : String(model[field]);
  const [v, setV] = React.useState(initial);
  React.useEffect(() => setV(initial), [initial]);
  const save = async (reload: () => Promise<void>) => {
    if (v.trim() === initial) return;
    try {
      await api({ action: "updateModel", id: model.id, [field]: v.trim() === "" ? null : v.trim() });
      await reload();
    } catch {
      toastCtx.show(t("errors.numero_invalido"), "error");
      setV(initial);
    }
  };
  return { v, setV, save, label };
}

function ModelsCard({ state, reload, errorText }: CardProps) {
  const t = useTranslations("admin");
  const usd = useUsd();
  const toast = useToast();
  const locale = useLocale();
  const models = state.providers.flatMap((p) => p.modelos.map((m) => ({ ...m, provider: p })));
  const [sel, setSel] = React.useState<string[]>([]);
  const [long, setLong] = React.useState(false);
  const [estimate, setEstimate] = React.useState<Estimate | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => setEstimate(null), [sel, long]);

  const toggle = (id: string) =>
    setSel((s) => {
      if (s.includes(id)) return s.filter((x) => x !== id);
      if (s.length >= MAX_TEST) {
        toast.show(t("models.maxSelected", { max: MAX_TEST }), "warning");
        return s;
      }
      return [...s, id];
    });

  const doEstimate = async () => {
    setBusy(true);
    try {
      setEstimate(await api<Estimate>({ action: "estimate", modelos: sel, contextoLongo: long }));
    } catch (e) {
      toast.show(errorText(e), "error");
    } finally {
      setBusy(false);
    }
  };

  const run = async () => {
    setBusy(true);
    try {
      await api({ action: "test", modelos: sel, contextoLongo: long });
      toast.show(t("models.done"), "success");
      setSel([]);
      await reload();
    } catch (e) {
      toast.show(errorText(e), "error");
    } finally {
      setBusy(false);
    }
  };

  const warnings = (m: Model & { provider: Provider }) => {
    const out: string[] = [];
    if (!m.ativo || !m.provider.ativo) out.push(t("models.warnOff"));
    const failed = (Object.entries(m.tests) as [TestName, TestCell][]).filter(([, c]) => !c.ok).map(([k]) => t(`tests.${k}`));
    if (!Object.keys(m.tests).length) out.push(t("models.warnNotTested"));
    else if (failed.length) out.push(t("models.warnFailed", { tests: failed.join(", ") }));
    if (m.precoEntrada == null && m.precoSaida == null) out.push(t("models.warnNoPrice"));
    return out;
  };

  const latency = (m: Model) => {
    const ms = m.tests.texto?.latenciaMs ?? m.tests.embeddings?.latenciaMs;
    if (ms == null) return "—";
    return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
  };

  return (
    <Card>
      <CardHeader title={t("models.title")} action={sel.length ? <span className="text-[13px] text-muted">{t("models.selectedCount", { count: sel.length })}</span> : null} />
      {models.length === 0 ? (
        <CardBody><p className="text-sm text-muted">{t("models.empty")}</p></CardBody>
      ) : (
        <>
          <Table minWidth={1080}>
            <THead>
              <Th className="w-8"><span className="sr-only">{t("models.select", { model: "" })}</span></Th>
              <Th>{t("models.model")}</Th>
              <Th>{t("models.text")}</Th>
              <Th>{t("models.json")}</Th>
              <Th>{t("models.tools")}</Th>
              <Th>{t("models.context")}</Th>
              <Th>{t("models.langs")}</Th>
              <Th>{t("models.embeddings")}</Th>
              <Th>{t("models.latency")}</Th>
              <Th>{t("models.price")}</Th>
              <Th>{t("models.warning")}</Th>
            </THead>
            <tbody>
              {models.map((m) => (
                <Tr key={m.id} selected={sel.includes(m.id)}>
                  <Td>
                    <input type="checkbox" checked={sel.includes(m.id)} onChange={() => toggle(m.id)} aria-label={t("models.select", { model: m.modelo })} />
                  </Td>
                  <Td>
                    <div className="max-w-[260px] truncate font-mono text-[13px]" title={m.modelo}>{m.modelo}</div>
                    <div className="text-xs text-muted">
                      {m.provider.nome}
                      {m.embedding ? ` · ${t("models.embeddingModel")}` : ""}
                      {m.testadoEm ? ` · ${t("models.testedAt", { date: new Date(m.testadoEm).toLocaleDateString(intlTag(locale)) })}` : ""}
                    </div>
                  </Td>
                  <Td>{m.embedding ? "" : <TestMark cell={m.tests.texto} />}</Td>
                  <Td>{m.embedding ? "" : <TestMark cell={m.tests.json} />}</Td>
                  <Td>{m.embedding ? "" : <TestMark cell={m.tests.ferramentas} />}</Td>
                  <Td className="whitespace-nowrap">
                    {m.contexto ? `${Math.round(m.contexto / 1000)}k` : "—"} {m.embedding ? null : <TestMark cell={m.tests.contexto_longo} />}
                  </Td>
                  <Td>{m.embedding ? "" : <TestMark cell={m.tests.idiomas} />}</Td>
                  <Td>{m.embedding ? <TestMark cell={m.tests.embeddings} /> : ""}</Td>
                  <Td className="whitespace-nowrap">{latency(m)}</Td>
                  <Td><PriceCell model={m} reload={reload} /></Td>
                  <Td className="max-w-[240px] text-xs text-ink-soft">{warnings(m).join(" ")}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <div className="flex flex-col gap-3 border-t border-line-soft px-4 py-3.5">
            <label className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" checked={long} onChange={(e) => setLong(e.target.checked)} />
              {t("models.longContext")}
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" disabled={!sel.length || busy} onClick={doEstimate}>{t("models.estimate")}</Button>
              <Button disabled={!estimate || !estimate.cabeNoOrcamento || busy} onClick={run}>{t("models.run")}</Button>
              {busy ? <span role="status" className="text-[13px] text-muted">{t("models.running")}</span> : null}
            </div>
            {estimate ? (
              <p role="status" className="text-sm tabular-nums">
                {t("models.estimateResult", { count: sel.length, total: usd(estimate.totalUsd), spent: usd(estimate.gastoHojeUsd), budget: usd(estimate.orcamentoDiarioUsd) })}
                {estimate.semPreco ? ` ${t("models.estimateNoPrice", { count: estimate.semPreco })}` : ""}
                {!estimate.cabeNoOrcamento ? <strong className="ml-1 text-danger">{t("models.overBudget")}</strong> : null}
              </p>
            ) : null}
          </div>
        </>
      )}
    </Card>
  );
}

function PriceCell({ model, reload }: { model: Model; reload: () => Promise<void> }) {
  const t = useTranslations("admin");
  const pin = usePriceField({ model, field: "precoEntrada", label: t("models.priceIn", { model: model.modelo }) });
  const pout = usePriceField({ model, field: "precoSaida", label: t("models.priceOut", { model: model.modelo }) });
  return (
    <div className="flex items-center gap-1">
      {[pin, pout].map((p, i) => (
        <React.Fragment key={i}>
          {i ? <span className="text-muted">/</span> : null}
          <Input
            inputMode="decimal"
            className="h-8 !w-[84px] px-2 text-[13px]"
            aria-label={p.label}
            value={p.v}
            onChange={(e) => p.setV(e.target.value)}
            onBlur={() => void p.save(reload)}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          />
        </React.Fragment>
      ))}
    </div>
  );
}

function RoutesCard({ state, reload, errorText }: CardProps) {
  const t = useTranslations("admin");
  const toast = useToast();
  const [busy, setBusy] = React.useState<string | null>(null);
  const byId = new Map(state.providers.flatMap((p) => p.modelos.map((m) => [m.id, { ...m, provider: p.nome }] as const)));
  const nameOf = (id: string) => {
    const m = byId.get(id);
    return m ? `${m.provider} · ${m.modelo}` : id;
  };

  const set = async (tarefa: string, body: Record<string, unknown>) => {
    setBusy(tarefa);
    try {
      await api({ action: "setRoute", tarefa, ...body });
      await reload();
    } catch (e) {
      toast.show(errorText(e), "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader title={t("routes.title")} />
      <p className="px-4 pt-3 text-[13px] text-muted">{t("routes.hint")}</p>
      <ul className="divide-y divide-line-soft">
        {state.tasks.map((task) => {
          const r = state.routes.find((x) => x.tarefa === task.tarefa);
          if (!r) return null;
          const taskName = t(`routes.names.${task.tarefa}`);
          const candidates = [...byId.values()].filter((m) => m.embedding === (task.kind === "embed"));
          const fora = Object.entries(r.fora);
          return (
            <li key={task.tarefa} className="flex min-w-0 flex-col gap-2 px-4 py-3.5 [overflow-wrap:anywhere]">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="min-w-[180px] flex-1">
                  <div className="font-semibold">{taskName}</div>
                  {task.personalData ? <div className="text-xs text-muted">{t("routes.personal")}</div> : null}
                </div>
                {task.travada ? null : (
                  <>
                    <Select
                      className="h-8 text-[13px] md:!w-44"
                      aria-label={t("routes.modeFor", { task: taskName })}
                      value={r.modo === "fixo" ? "fixo" : "automatico"}
                      disabled={busy === task.tarefa}
                      onChange={(e) => {
                        if (e.target.value === "automatico") void set(task.tarefa, { modo: "automatico" });
                        else if (candidates[0]) void set(task.tarefa, { modo: "fixo", modelo: r.modelos[0] && byId.has(r.modelos[0]) ? r.modelos[0] : candidates[0].id });
                      }}
                    >
                      <option value="automatico">{t("routes.auto")}</option>
                      <option value="fixo" disabled={!candidates.length}>{t("routes.pinned")}</option>
                    </Select>
                    {r.modo === "fixo" ? (
                      <Select
                        className="h-8 text-[13px] md:!w-80"
                        aria-label={t("routes.pinModel", { task: taskName })}
                        value={r.modelos[0] ?? ""}
                        disabled={busy === task.tarefa}
                        onChange={(e) => void set(task.tarefa, { modo: "fixo", modelo: e.target.value })}
                      >
                        {candidates.map((m) => <option key={m.id} value={m.id}>{m.provider} · {m.modelo}</option>)}
                      </Select>
                    ) : null}
                  </>
                )}
              </div>
              <div className="text-[13px]">
                {task.travada ? (
                  <span className="text-ink-soft">{t("routes.lockedNote", { model: task.padrao })}</span>
                ) : (
                  <>
                    <span className="text-muted">{t("routes.uses")}: </span>
                    {r.modelos.length ? (
                      <span className="font-mono">{[...r.modelos.map(nameOf), ...(r.modo === "automatico" ? [t("routes.reserve", { model: task.padrao })] : [])].join(" → ")}</span>
                    ) : (
                      <span className="font-mono">{t("routes.onlyDefault", { model: task.padrao })}</span>
                    )}
                    <span className="ml-2 text-muted">{t(`routes.motivo.${r.motivo}`)}</span>
                  </>
                )}
              </div>
              {fora.length && !task.travada ? (
                <details className="text-[13px]">
                  <summary className="cursor-pointer text-brand">{t("routes.why")}</summary>
                  <ul className="mt-1 flex flex-col gap-0.5 pl-4">
                    {fora.map(([id, rs]) => (
                      <li key={id}>
                        <span className="font-mono">{nameOf(id)}</span>: {rs.map((c) => (t.has(`reasons.${c}`) ? t(`reasons.${c}`) : c)).join(", ")}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
