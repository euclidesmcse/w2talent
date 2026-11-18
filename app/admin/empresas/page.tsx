"use client";
/**
 * Validação das empresas (2.1a, D2). O admin confere os dados e valida ou recusa.
 * Recusar arquiva as vagas ativas da empresa. Acesso pela senha do admin (ADMIN_SECRET).
 */
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { AppHeader } from "@/components/app-header";
import { AdminLoginCard } from "@/components/admin-login";
import { Button, Card, Table, THead, Th, Tr, Td, useToast } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import { intlTag } from "@/lib/locale";

type Status = "pendente" | "validado" | "rejeitado";
type Linha = { id: string; nome: string; site: string | null; cnpj: string | null; status: Status; criadaEm: string; membros: { email: string; papel: string }[]; vagasAtivas: number };

const TOM: Record<Status, string> = {
  pendente: "bg-warning-soft text-warning-ink",
  validado: "bg-success-soft text-success-ink",
  rejeitado: "bg-danger-soft text-danger-ink",
};

function cnpjFormatado(c: string | null): string {
  if (!c || c.length !== 14) return c ?? "—";
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
}

export default function AdminEmpresasPage() {
  const t = useTranslations("adminEmpresas");
  const ta = useTranslations("admin");
  const te = useTranslations("empresa");
  const locale = useLocale();
  const { show } = useToast();
  const [auth, setAuth] = React.useState<"loading" | "login" | "disabled" | "ok">("loading");
  const [linhas, setLinhas] = React.useState<Linha[]>([]);
  const [temMais, setTemMais] = React.useState(false);
  const [carregando, setCarregando] = React.useState(false);
  // Só a leitura mais nova vale ("Mostrar mais" e a recarga depois de uma decisão podem se cruzar).
  const ultima = React.useRef(0);
  const paginasRef = React.useRef(1);
  const [confirmando, setConfirmando] = React.useState<string | null>(null);
  const [ocupado, setOcupado] = React.useState<string | null>(null);

  /** Recarrega as páginas já abertas (até `ate`), para a lista não encolher depois de uma decisão. */
  const load = React.useCallback(async (ate = 1) => {
    const minha = ++ultima.current;
    // Quantas páginas a lista deve ter: uma decisão no meio de "Mostrar mais" recarrega todas elas.
    paginasRef.current = ate;
    setCarregando(true);
    try {
      const todas: Linha[] = [];
      let mais = false;
      for (let p = 1; p <= ate; p++) {
        const res = await fetch(`/api/admin/empresas?pagina=${p}`, { cache: "no-store" });
        const j = (await res.json().catch(() => ({}))) as { empresas?: Linha[]; temMais?: boolean; error?: string };
        if (minha !== ultima.current) return;
        if (res.status === 401) return setAuth("login");
        if (j.error === "admin_desligado") return setAuth("disabled");
        if (!res.ok) throw new Error(j.error ?? "erro");
        for (const e of j.empresas ?? []) if (!todas.some((x) => x.id === e.id)) todas.push(e);
        mais = !!j.temMais;
        if (!mais) break;
      }
      if (minha !== ultima.current) return;
      setLinhas(todas);
      setTemMais(mais);
      setAuth("ok");
    } catch {
      if (minha !== ultima.current) return;
      setAuth((a) => (a === "loading" ? "login" : a));
      show(t("erro"), "error");
    } finally {
      if (minha === ultima.current) setCarregando(false);
    }
  }, [show, t]);

  const loadRef = React.useRef(load);
  loadRef.current = load;
  React.useEffect(() => {
    void loadRef.current();
  }, []);

  const decidir = async (l: Linha, acao: "validar" | "rejeitar") => {
    setOcupado(l.id);
    try {
      const res = await fetch("/api/admin/empresas", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: l.id, acao }) });
      const j = (await res.json().catch(() => ({}))) as { arquivadas?: number };
      if (res.status === 401) return setAuth("login");
      if (!res.ok) throw new Error();
      show(acao === "validar" ? t("validada") : t("rejeitada", { count: j.arquivadas ?? 0 }), "success");
      setConfirmando(null);
      await load(paginasRef.current);
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

  const data = (iso: string) => new Date(iso).toLocaleDateString(intlTag(locale), { day: "2-digit", month: "2-digit", year: "numeric" });

  return (
    <>
      <AppHeader
        area="admin"
        active="/admin/empresas"
        right={auth === "ok" ? <Button variant="secondary" size="sm" onClick={logout}>{ta("logout")}</Button> : null}
      />
      <main className="mx-auto flex max-w-page flex-col gap-5 px-4 py-6 md:px-6">
        <div>
          <h1 className="text-[22px] font-semibold">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted">{t("intro")}</p>
        </div>
        {auth === "loading" ? <p aria-busy="true" className="text-sm text-muted">{ta("loading")}</p> : null}
        {auth === "disabled" ? (
          <Card className="max-w-md p-5">
            <p role="alert" className="text-sm">{ta("login.disabled")}</p>
          </Card>
        ) : null}
        {auth === "login" ? <AdminLoginCard onDone={() => load()} titulo={t("loginTitle")} /> : null}
        {auth === "ok" ? (
          linhas.length === 0 ? (
            <p className="text-sm text-muted">{t("vazio")}</p>
          ) : (
            <Card>
              <Table minWidth={860}>
                <THead>
                  <Th>{te("nome")}</Th>
                  <Th>{t("cnpj")}</Th>
                  <Th>{t("membros")}</Th>
                  <Th>{t("vagas")}</Th>
                  <Th>{t("criada")}</Th>
                  <Th>{te("statusLabel")}</Th>
                  <Th>{t("acoes")}</Th>
                </THead>
                <tbody>
                  {linhas.map((l) => (
                    <Tr key={l.id} data-empresa={l.id}>
                      <Td>
                        <strong className="block font-semibold">{l.nome}</strong>
                        {l.site && /^https?:\/\//i.test(l.site) ? (
                          <a href={l.site} target="_blank" rel="noopener noreferrer" className="text-[13px] underline underline-offset-2">
                            {l.site.replace(/^https?:\/\//, "")}
                          </a>
                        ) : null}
                      </Td>
                      <Td className="font-mono text-[13px]">{cnpjFormatado(l.cnpj)}</Td>
                      <Td className="text-[13px]">{l.membros.map((m) => m.email).join(", ") || "—"}</Td>
                      <Td>{l.vagasAtivas}</Td>
                      <Td className="text-[13px]">{data(l.criadaEm)}</Td>
                      <Td>
                        <span className={cn("inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-semibold", TOM[l.status])}>{te(`status.${l.status}`)}</span>
                      </Td>
                      <Td>
                        {confirmando === l.id ? (
                          <div className="flex flex-col items-start gap-2">
                            <span role="alert" className="text-[13px]">{t("confirmar", { name: l.nome })}</span>
                            <div className="flex gap-2">
                              <Button size="sm" variant="primary" disabled={ocupado === l.id} onClick={() => decidir(l, "rejeitar")}>{t("rejeitar")}</Button>
                              <Button size="sm" variant="secondary" onClick={() => setConfirmando(null)}>{ta("providers.cancel")}</Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            {l.status !== "validado" ? (
                              <Button size="sm" variant="primary" disabled={ocupado === l.id} onClick={() => decidir(l, "validar")}>{t("validar")}</Button>
                            ) : null}
                            {l.status !== "rejeitado" ? (
                              <Button size="sm" variant="secondary" disabled={ocupado === l.id} onClick={() => setConfirmando(l.id)}>{t("rejeitar")}</Button>
                            ) : null}
                          </div>
                        )}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
              {temMais ? (
                <div className="border-t border-line-soft p-4">
                  <Button variant="secondary" size="sm" disabled={carregando} onClick={() => load(paginasRef.current + 1)}>{t("mais")}</Button>
                </div>
              ) : null}
            </Card>
          )
        ) : null}
      </main>
    </>
  );
}
