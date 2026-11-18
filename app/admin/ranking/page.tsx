"use client";
/**
 * Ranking adaptativo (3.1, D7). O admin vê os pesos de cada escopo ao lado do padrão, quantos sinais
 * sustentam cada um e pode desligar um escopo (volta ao padrão) ou religar. Acesso pela senha do admin.
 */
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { AppHeader } from "@/components/app-header";
import { AdminLoginCard } from "@/components/admin-login";
import { Button, Card, Table, THead, Th, Tr, Td, useToast } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import { intlTag } from "@/lib/locale";

const PARTES = ["skills", "nivel", "condicoes", "recencia", "completude"] as const;
type Parte = (typeof PARTES)[number];
type Pesos = Record<Parte, number>;
type Linha = {
  escopo: "global" | "empresa";
  escopoId: string;
  empresaNome: string | null;
  pesos: Partial<Pesos> | null;
  n: number;
  nPositivos: number;
  nNegativos: number;
  desligado: boolean;
  atualizadoEm: string;
};
type Situacao = "emUso" | "poucos" | "desligado";

const TOM: Record<Situacao, string> = {
  emUso: "bg-success-soft text-success-ink",
  poucos: "bg-warning-soft text-warning-ink",
  desligado: "bg-neutral-soft text-ink-soft",
};

const chave = (l: Pick<Linha, "escopo" | "escopoId">) => `${l.escopo}:${l.escopoId}`;

export default function AdminRankingPage() {
  const t = useTranslations("adminRanking");
  const ta = useTranslations("admin");
  const locale = useLocale();
  const { show } = useToast();
  const [auth, setAuth] = React.useState<"loading" | "login" | "disabled" | "ok">("loading");
  const [linhas, setLinhas] = React.useState<Linha[]>([]);
  const [padrao, setPadrao] = React.useState<Pesos | null>(null);
  const [minimo, setMinimo] = React.useState(30);
  const [ocupado, setOcupado] = React.useState<string | null>(null);
  const ultima = React.useRef(0);

  const load = React.useCallback(async () => {
    const minha = ++ultima.current;
    try {
      const res = await fetch("/api/admin/ranking", { cache: "no-store" });
      const j = (await res.json().catch(() => ({}))) as { padrao?: Pesos; minimo?: number; linhas?: Linha[]; error?: string };
      if (minha !== ultima.current) return;
      if (res.status === 401) return setAuth("login");
      if (j.error === "admin_desligado") return setAuth("disabled");
      if (!res.ok) throw new Error(j.error ?? "erro");
      setLinhas(j.linhas ?? []);
      if (j.padrao) setPadrao(j.padrao);
      if (typeof j.minimo === "number") setMinimo(j.minimo);
      setAuth("ok");
    } catch {
      if (minha !== ultima.current) return;
      setAuth((a) => (a === "loading" ? "login" : a));
      show(t("erro"), "error");
    }
  }, [show, t]);

  const loadRef = React.useRef(load);
  loadRef.current = load;
  React.useEffect(() => {
    void loadRef.current();
  }, []);

  const nomeDe = (l: Linha) => (l.escopo === "global" ? t("global") : l.empresaNome ?? t("empresaSemNome", { id: l.escopoId }));

  const alternar = async (l: Linha) => {
    const k = chave(l);
    const desligado = !l.desligado;
    setOcupado(k);
    try {
      const res = await fetch("/api/admin/ranking", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ escopo: l.escopo, escopoId: l.escopoId, desligado }),
      });
      if (res.status === 401) return setAuth("login");
      if (!res.ok) throw new Error();
      show(desligado ? t("desligou", { name: nomeDe(l) }) : t("religou", { name: nomeDe(l) }), "success");
      await load();
    } catch {
      show(t("erro"), "error");
    } finally {
      setOcupado(null);
    }
  };

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => undefined);
    setLinhas([]);
    setAuth("login");
  };

  const globalDesligado = linhas.some((l) => l.escopo === "global" && l.desligado);
  const situacao = (l: Linha): Situacao => (l.desligado ? "desligado" : l.escopo === "empresa" && globalDesligado ? "desligado" : l.n >= minimo ? "emUso" : "poucos");
  // D4: o global desligado leva todas as empresas ao padrão; empresa com poucos sinais usa o global.
  const rotulo = (l: Linha, s: Situacao) =>
    l.escopo === "empresa" && !l.desligado && globalDesligado ? "status.globalDesligado" : s === "poucos" && l.escopo === "empresa" ? "status.poucosEmpresa" : `status.${s}`;
  const num = (x: number) => x.toLocaleString(intlTag(locale), { maximumFractionDigits: 1 });
  const data = (iso: string) => new Date(iso).toLocaleDateString(intlTag(locale), { day: "2-digit", month: "2-digit", year: "numeric" });
  const temGlobal = linhas.some((l) => l.escopo === "global");
  // Sem linha global (o Cron ainda não rodou), o admin ainda pode desligar o global de antemão.
  const linhasTela: Linha[] = temGlobal || auth !== "ok"
    ? linhas
    : [{ escopo: "global", escopoId: "", empresaNome: null, pesos: null, n: 0, nPositivos: 0, nNegativos: 0, desligado: false, atualizadoEm: "" }, ...linhas];

  return (
    <>
      <AppHeader
        area="admin"
        active="/admin/ranking"
        right={auth === "ok" ? <Button variant="secondary" size="sm" onClick={logout}>{ta("logout")}</Button> : null}
      />
      <main className="mx-auto flex max-w-page flex-col gap-5 px-4 py-6 md:px-6">
        <div>
          <h1 className="text-[22px] font-semibold">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted">{t("intro")}</p>
          <p className="mt-1 text-sm text-muted">{t("regra", { count: minimo })}</p>
        </div>
        {auth === "loading" ? <p aria-busy="true" className="text-sm text-muted">{ta("loading")}</p> : null}
        {auth === "disabled" ? (
          <Card className="max-w-md p-5">
            <p role="alert" className="text-sm">{ta("login.disabled")}</p>
          </Card>
        ) : null}
        {auth === "login" ? <AdminLoginCard onDone={() => load()} titulo={t("loginTitle")} /> : null}
        {auth === "ok" ? (
          <Card>
            <Table minWidth={980}>
              <caption className="px-4 pt-4 text-left text-[13px] text-muted">{t("legenda")}</caption>
              <THead>
                <Th>{t("escopo")}</Th>
                <Th>{t("sinais")}</Th>
                {PARTES.map((p) => (
                  <Th key={p}>{t(`partes.${p}`)}</Th>
                ))}
                <Th>{t("situacao")}</Th>
                <Th>{t("acoes")}</Th>
              </THead>
              <tbody>
                {linhasTela.map((l) => {
                  const k = chave(l);
                  const s = situacao(l);
                  const nome = nomeDe(l);
                  return (
                    <Tr key={k} data-escopo={k}>
                      <th scope="row" className="px-2 py-3 text-left align-middle font-normal first:pl-4">
                        <strong className="block font-semibold">{nome}</strong>
                        {l.atualizadoEm ? <span className="text-[13px] text-muted">{t("atualizado", { date: data(l.atualizadoEm) })}</span> : null}
                      </th>
                      <Td>
                        <span className="block">{l.n}</span>
                        <span className="text-[13px] text-muted">{t("posNeg", { pos: l.nPositivos, neg: l.nNegativos })}</span>
                      </Td>
                      {PARTES.map((p) => {
                        const v = l.pesos?.[p];
                        const d = padrao?.[p];
                        return (
                          <Td key={p} className="whitespace-nowrap">
                            {typeof v === "number" ? num(v) : "—"}{" "}
                            {typeof d === "number" ? <span className="text-muted">({num(d)})</span> : null}
                          </Td>
                        );
                      })}
                      <Td>
                        <span className={cn("inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-semibold", TOM[s])}>{t(rotulo(l, s))}</span>
                      </Td>
                      <Td>
                        <Button
                          size="sm"
                          variant={l.desligado ? "primary" : "secondary"}
                          disabled={ocupado === k}
                          aria-label={l.desligado ? t("religarDe", { name: nome }) : t("desligarDe", { name: nome })}
                          data-action={l.desligado ? "religar" : "desligar"}
                          onClick={() => alternar(l)}
                        >
                          {l.desligado ? t("religar") : t("desligar")}
                        </Button>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </Card>
        ) : null}
      </main>
    </>
  );
}
