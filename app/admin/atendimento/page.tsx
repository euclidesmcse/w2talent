"use client";
/**
 * 2.6b-1 Admin > Atendimento: conversas "Falar com uma pessoa" da Ajuda. A equipe lê, responde (sem IA,
 * D7) e encerra. Vê só o que a pessoa escreveu, a tela de onde veio e o tipo de conta (D3).
 * Acesso pela senha do admin (ADMIN_SECRET). ?id=X abre direto a conversa (link do e-mail da equipe).
 */
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { AppHeader } from "@/components/app-header";
import { AdminLoginCard } from "@/components/admin-login";
import { Button, Card, Select, Textarea, useToast } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import type { ConversaAdmin, FiltroAdmin, LinhaAdmin } from "@/lib/atendimento";
import { intlTag } from "@/lib/locale";

const TEXTO_MAX = 2000;

export default function AdminAtendimentoPage() {
  const t = useTranslations("adminAtendimento");
  const ta = useTranslations("admin");
  const locale = useLocale();
  const { show } = useToast();
  const [auth, setAuth] = React.useState<"loading" | "login" | "disabled" | "ok">("loading");
  const [filtro, setFiltro] = React.useState<FiltroAdmin>("aberta");
  const [linhas, setLinhas] = React.useState<LinhaAdmin[]>([]);
  const [temMais, setTemMais] = React.useState(false);
  const [paginas, setPaginas] = React.useState(1);
  const [atualId, setAtualId] = React.useState<string | null>(null);
  const [atual, setAtual] = React.useState<ConversaAdmin | null>(null);
  const [resposta, setResposta] = React.useState("");
  const [ocupado, setOcupado] = React.useState(false);
  const [confirmando, setConfirmando] = React.useState(false);
  const ultima = React.useRef(0);

  const lerJson = async (res: Response) => (await res.json().catch(() => ({}))) as Record<string, unknown>;

  const carregarLista = React.useCallback(async (f: FiltroAdmin, ate: number) => {
    const minha = ++ultima.current;
    try {
      const todas: LinhaAdmin[] = [];
      let mais = false;
      for (let p = 1; p <= ate; p++) {
        const res = await fetch(`/api/admin/atendimento?status=${f}&pagina=${p}`, { cache: "no-store" });
        const j = await lerJson(res);
        if (minha !== ultima.current) return;
        if (res.status === 401) return setAuth("login");
        if (j.error === "admin_desligado") return setAuth("disabled");
        if (!res.ok) throw new Error();
        for (const c of (j.conversas as LinhaAdmin[]) ?? []) if (!todas.some((x) => x.id === c.id)) todas.push(c);
        mais = !!j.temMais;
        if (!mais) break;
      }
      setLinhas(todas);
      setTemMais(mais);
      setAuth("ok");
    } catch {
      if (minha !== ultima.current) return;
      setAuth((a) => (a === "loading" ? "login" : a));
      show(t("erro"), "error");
    }
  }, [show, t]);

  // Só a resposta da conversa selecionada por último vale: uma resposta atrasada de outra é descartada.
  const selecionada = React.useRef<string | null>(null);
  const carregarConversa = React.useCallback(async (id: string) => {
    selecionada.current = id;
    try {
      const res = await fetch(`/api/admin/atendimento?id=${encodeURIComponent(id)}`, { cache: "no-store" });
      const j = await lerJson(res);
      if (selecionada.current !== id) return;
      if (res.status === 401) return setAuth("login");
      if (!res.ok) throw new Error();
      const c = j.conversa as ConversaAdmin;
      setAtual(c && c.id === id ? c : null);
    } catch {
      if (selecionada.current !== id) return;
      setAtual(null);
      show(t("erro"), "error");
    }
  }, [show, t]);

  const iniciar = React.useCallback(async () => {
    await carregarLista("aberta", 1);
    const id = new URLSearchParams(window.location.search).get("id");
    if (id) {
      setAtualId(id);
      await carregarConversa(id);
    }
  }, [carregarLista, carregarConversa]);

  const iniciarRef = React.useRef(iniciar);
  iniciarRef.current = iniciar;
  React.useEffect(() => {
    void iniciarRef.current();
  }, []);

  const abrir = (id: string) => {
    setAtualId(id);
    setAtual(null);
    setResposta("");
    setConfirmando(false);
    void carregarConversa(id);
  };

  const atualizar = async () => {
    await carregarLista(filtro, paginas);
    if (atualId) await carregarConversa(atualId);
  };

  const agir = async (acao: "responder" | "encerrar") => {
    // Age sobre a conversa que está na tela, não só sobre a selecionada.
    if (!atual || atual.id !== atualId) return;
    const id = atual.id;
    if (acao === "responder" && !resposta.trim()) return;
    setOcupado(true);
    try {
      const res = await fetch("/api/admin/atendimento", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(acao === "responder" ? { id, acao, texto: resposta.trim() } : { id, acao }),
      });
      const j = await lerJson(res);
      if (res.status === 401) return setAuth("login");
      if (res.status === 409) show(t("erroEncerrada"), "error");
      else if (!res.ok) throw new Error();
      else if (acao === "responder") {
        setResposta("");
        show(j.emailEnviado === false ? t("semEmail") : t("respondidaOk"), j.emailEnviado === false ? "error" : "success");
      } else {
        setConfirmando(false);
        show(t("encerradaOk"), "success");
      }
      await atualizar();
    } catch {
      show(t("erro"), "error");
    } finally {
      setOcupado(false);
    }
  };

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => undefined);
    setLinhas([]);
    setAtual(null);
    setAuth("login");
  };

  const quando = (iso: string) => new Date(iso).toLocaleString(intlTag(locale), { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const conta = (c: { logado: boolean; perfil: string | null }) =>
    !c.logado ? t("semLogin") : c.perfil === "recrutador" ? t("recrutador") : c.perfil === "candidato" ? t("candidato") : "—";
  const situacao = (l: LinhaAdmin) => (l.status === "encerrada" ? t("encerrada") : l.aguardando ? t("aguardando") : t("respondida"));

  return (
    <>
      <AppHeader
        area="admin"
        active="/admin/atendimento"
        right={auth === "ok" ? <Button variant="secondary" size="sm" onClick={logout}>{ta("logout")}</Button> : null}
      />
      <main className="mx-auto flex max-w-page flex-col gap-5 px-4 py-6 md:px-6">
        <div>
          <h1 className="text-[22px] font-semibold">{t("title")}</h1>
          <p className="mt-1 max-w-[80ch] text-sm text-muted">{t("intro")}</p>
        </div>
        {auth === "loading" ? <p aria-busy="true" className="text-sm text-muted">{ta("loading")}</p> : null}
        {auth === "disabled" ? (
          <Card className="max-w-md p-5">
            <p role="alert" className="text-sm">{ta("login.disabled")}</p>
          </Card>
        ) : null}
        {auth === "login" ? <AdminLoginCard onDone={() => iniciar()} titulo={t("loginTitle")} /> : null}
        {auth === "ok" ? (
          <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
            <section aria-labelledby="atendimento-lista" className="flex flex-col gap-3">
              <h2 id="atendimento-lista" className="sr-only">{t("lista")}</h2>
              <div className="flex items-end gap-2">
                <label className="flex flex-col gap-1 text-[13px] font-medium">
                  {t("filtro")}
                  <Select
                    value={filtro}
                    onChange={(e) => {
                      const f = e.target.value as FiltroAdmin;
                      setFiltro(f);
                      setPaginas(1);
                      void carregarLista(f, 1);
                    }}
                  >
                    <option value="aberta">{t("filtroAberta")}</option>
                    <option value="encerrada">{t("filtroEncerrada")}</option>
                    <option value="todas">{t("filtroTodas")}</option>
                  </Select>
                </label>
                <Button variant="secondary" size="sm" onClick={() => void atualizar()}>{t("atualizar")}</Button>
              </div>
              {linhas.length === 0 ? (
                <p className="text-sm text-muted">{t("vazio")}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {linhas.map((l) => (
                    <li key={l.id}>
                      <button
                        type="button"
                        onClick={() => abrir(l.id)}
                        aria-current={atualId === l.id ? "true" : undefined}
                        data-conversa-id={l.id}
                        className={cn(
                          "flex w-full flex-col gap-1 rounded-card border bg-surface p-3 text-left hover:border-brand",
                          atualId === l.id ? "border-brand" : "border-line",
                        )}
                      >
                        <span className="flex flex-wrap items-center gap-2 text-[12px]">
                          <span className={cn("rounded-pill px-2 py-0.5 font-semibold", l.aguardando ? "bg-warning-soft text-warning-ink" : "bg-neutral-soft text-ink-soft")}>{situacao(l)}</span>
                          <span className="text-muted">{conta(l)} · {quando(l.ultimaEm)}</span>
                        </span>
                        <span className="line-clamp-2 text-[14px] text-ink">{l.previa}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {temMais ? (
                <div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setPaginas(paginas + 1);
                      void carregarLista(filtro, paginas + 1);
                    }}
                  >
                    {t("mais")}
                  </Button>
                </div>
              ) : null}
            </section>

            <section aria-labelledby="atendimento-conversa" className="flex flex-col gap-4">
              <h2 id="atendimento-conversa" className="sr-only">{t("title")}</h2>
              {!atual ? (
                <p className="text-sm text-muted">{t("escolha")}</p>
              ) : (
                <Card className="flex flex-col gap-4 p-5" data-conversa={atual.status}>
                  <p className="text-[13px] text-muted">
                    {conta(atual)}
                    {atual.tela ? ` · ${t("tela", { tela: atual.tela })}` : ""} · {atual.idioma} · {quando(atual.criadaEm)}
                  </p>
                  <ol className="flex flex-col gap-3">
                    {atual.mensagens.map((m) => (
                      <li
                        key={m.id}
                        data-autor={m.autor}
                        className={cn(
                          "flex max-w-[90%] flex-col gap-1 rounded-card border px-4 py-3",
                          m.autor === "equipe" ? "self-end border-brand-soft bg-brand-soft text-brand-ink" : "self-start border-line bg-surface text-ink",
                        )}
                      >
                        <span className="text-[12px] font-semibold">
                          {m.autor === "equipe" ? t("equipe") : t("pessoa")} · <time dateTime={m.em} className="font-normal">{quando(m.em)}</time>
                        </span>
                        <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{m.texto}</p>
                      </li>
                    ))}
                  </ol>
                  {atual.status === "encerrada" ? (
                    <p className="rounded-control bg-neutral-soft px-4 py-3 text-ink-soft">{t("encerrada")}</p>
                  ) : (
                    <>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          void agir("responder");
                        }}
                        className="flex flex-col gap-2 border-t border-line-soft pt-4"
                      >
                        <label htmlFor="atendimento-resposta" className="text-[13px] font-medium">{t("respostaRotulo")}</label>
                        <Textarea id="atendimento-resposta" rows={4} maxLength={TEXTO_MAX} value={resposta} onChange={(e) => setResposta(e.target.value)} />
                        <div>
                          <Button type="submit" disabled={ocupado || !resposta.trim()} data-action="responder-conversa">{t("responder")}</Button>
                        </div>
                      </form>
                      <div className="flex flex-col items-start gap-2 border-t border-line-soft pt-4">
                        {confirmando ? (
                          <>
                            <span role="alert" className="text-[13px]">{t("confirmarEncerrar")}</span>
                            <div className="flex gap-2">
                              <Button size="sm" variant="primary" disabled={ocupado} onClick={() => void agir("encerrar")} data-action="confirmar-encerrar">{t("encerrar")}</Button>
                              <Button size="sm" variant="secondary" onClick={() => setConfirmando(false)}>{t("cancelar")}</Button>
                            </div>
                          </>
                        ) : (
                          <Button size="sm" variant="secondary" onClick={() => setConfirmando(true)} data-action="encerrar-conversa">{t("encerrar")}</Button>
                        )}
                      </div>
                    </>
                  )}
                </Card>
              )}
            </section>
          </div>
        ) : null}
      </main>
    </>
  );
}
