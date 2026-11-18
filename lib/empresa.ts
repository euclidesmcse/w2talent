/**
 * Empresa do recrutador (2.1a, plano 2.1 aprovado em 2026-11-18).
 * - D1: a conta do recrutador fica ligada a uma empresa (CompanyMember). Quem cadastra vira "dono".
 * - D2: vaga de empresa ainda não validada aparece com a etiqueta "Empresa não verificada".
 * - D3: criar, editar, renovar e arquivar vaga só com login de recrutador (empresa vem do vínculo,
 *   nunca do pedido) ou com a sessão do admin (seed e suporte).
 */
import { NextResponse } from "next/server";
import type { PrismaClient } from "@prisma/client";
import { adminSecretUsable, isAdminRequest } from "./admin-auth";
import { exigirConta, NO_STORE, type Conta } from "./sessao";

type Db = PrismaClient;

export type StatusEmpresa = "pendente" | "validado" | "rejeitado";
export type Empresa = {
  id: string;
  nome: string;
  site: string | null;
  cnpj: string | null;
  emailContato: string | null;
  validacaoStatus: StatusEmpresa;
};
export type DadosEmpresa = { nome: string; site: string | null; cnpj: string | null; emailContato: string | null };
export type ErroEmpresa = "nome" | "site" | "cnpj" | "emailContato";

const SELECT = { id: true, nome: true, site: true, cnpj: true, emailContato: true, validacaoStatus: true } as const;

/** CNPJ com 14 dígitos e os dois dígitos verificadores certos (pontuação é ignorada). */
export function cnpjValido(raw: string): boolean {
  const d = raw.replace(/\D/g, "");
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const dv = (base: string) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = base.split("").reduce((s, c, i) => s + Number(c) * pesos[i], 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = dv(d.slice(0, 12));
  const d2 = dv(d.slice(0, 12) + d1);
  return d.endsWith(`${d1}${d2}`);
}

/** Endereço do site: aceita "empresa.com.br" (vira https://) e recusa o que não for http(s). */
export function normalizarSite(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const comEsquema = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(comEsquema);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (!u.hostname.includes(".") || u.username || u.password) return null;
    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

const EMAIL = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/;

/** Confere e limpa o que veio da tela. Campos vazios viram null; o nome é obrigatório. */
export function validarEmpresa(input: unknown): { ok: true; dados: DadosEmpresa } | { ok: false; campo: ErroEmpresa } {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const nome = str(o.nome).replace(/\s+/g, " ");
  if (nome.length < 2 || nome.length > 120) return { ok: false, campo: "nome" };
  const siteRaw = str(o.site);
  const site = siteRaw ? normalizarSite(siteRaw) : null;
  if (siteRaw && (!site || site.length > 200)) return { ok: false, campo: "site" };
  const cnpjRaw = str(o.cnpj);
  if (cnpjRaw && !cnpjValido(cnpjRaw)) return { ok: false, campo: "cnpj" };
  const email = str(o.emailContato).toLowerCase();
  if (email && (email.length > 200 || !EMAIL.test(email))) return { ok: false, campo: "emailContato" };
  return { ok: true, dados: { nome, site, cnpj: cnpjRaw ? cnpjRaw.replace(/\D/g, "") : null, emailContato: email || null } };
}

export async function empresaDaConta(db: Db, userId: string): Promise<Empresa | null> {
  const m = await db.companyMember.findUnique({ where: { userId }, select: { company: { select: SELECT } } });
  return (m?.company as Empresa | undefined) ?? null;
}

export class EmpresaErro extends Error {
  constructor(public codigo: "ja_tem_empresa" | "cnpj_em_uso" | "sem_empresa") {
    super(codigo);
  }
}

function campoUnico(e: unknown): string {
  const err = e as { code?: string; meta?: { target?: unknown; driverAdapterError?: { cause?: { constraint?: { fields?: string[] } } } } };
  if (err?.code !== "P2002") return "";
  const t = err.meta?.target ?? err.meta?.driverAdapterError?.cause?.constraint?.fields;
  return Array.isArray(t) ? t.join(",") : String(t ?? "");
}

/** Cadastra a empresa e liga a conta como dona. Uma empresa por conta; CNPJ não se repete. */
export async function cadastrarEmpresa(db: Db, userId: string, dados: DadosEmpresa): Promise<Empresa> {
  try {
    return await db.$transaction(async (tx) => {
      if (await tx.companyMember.findUnique({ where: { userId }, select: { id: true } })) throw new EmpresaErro("ja_tem_empresa");
      if (dados.cnpj && (await tx.companyProfile.findUnique({ where: { cnpj: dados.cnpj }, select: { id: true } }))) throw new EmpresaErro("cnpj_em_uso");
      const c = await tx.companyProfile.create({ data: { ...dados, validacaoStatus: "pendente" }, select: SELECT });
      await tx.companyMember.create({ data: { userId, companyId: c.id, papel: "dono" } });
      return c as Empresa;
    });
  } catch (e) {
    // Dois pedidos ao mesmo tempo: a restrição única do banco decide.
    const campo = campoUnico(e);
    if (campo.includes("cnpj")) throw new EmpresaErro("cnpj_em_uso");
    if (campo.includes("userId")) throw new EmpresaErro("ja_tem_empresa");
    throw e;
  }
}

/**
 * Atualiza os dados da empresa da conta. Mudar nome ou CNPJ de uma empresa já validada
 * volta a validação para "pendente" (o admin confere de novo), para ninguém trocar de identidade.
 * Empresa rejeitada não muda por aqui.
 */
export async function atualizarEmpresa(db: Db, userId: string, dados: DadosEmpresa): Promise<Empresa> {
  const atual = await empresaDaConta(db, userId);
  if (!atual) throw new EmpresaErro("sem_empresa");
  const mudouIdentidade = atual.nome !== dados.nome || (atual.cnpj ?? null) !== dados.cnpj;
  const validacaoStatus: StatusEmpresa =
    atual.validacaoStatus === "rejeitado" ? "rejeitado" : mudouIdentidade ? "pendente" : atual.validacaoStatus;
  try {
    const c = await db.companyProfile.update({
      where: { id: atual.id },
      data: { ...dados, validacaoStatus, ...(validacaoStatus !== atual.validacaoStatus ? { validacaoData: null } : {}) },
      select: SELECT,
    });
    return c as Empresa;
  } catch (e) {
    if (campoUnico(e).includes("cnpj")) throw new EmpresaErro("cnpj_em_uso");
    throw e;
  }
}

/** POST de outro site é recusado nas rotas que gravam (o cookie da sessão vai junto em formulários). */
export function mesmaOrigem(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(req.url).host;
  } catch {
    return false;
  }
}

export type AcessoVaga = { tipo: "admin" } | { tipo: "recrutador"; conta: Conta; empresa: Empresa };

function nega(status: number, erro: string) {
  return { erro: NextResponse.json({ error: erro }, { status, headers: NO_STORE }) };
}

/**
 * Quem pode gravar vagas (D3): o admin (cookie de admin válido) ou o recrutador logado com
 * autenticador e empresa não rejeitada. A empresa vem do vínculo da conta.
 */
export async function acessoVaga(req: Request, db: Db): Promise<{ acesso: AcessoVaga } | { erro: NextResponse }> {
  if (!mesmaOrigem(req)) return nega(403, "origem_invalida");
  if (adminSecretUsable(process.env.ADMIN_SECRET) && (await isAdminRequest(req).catch(() => false))) return { acesso: { tipo: "admin" } };
  const r = await exigirConta(req, { perfil: "recrutador" });
  if ("erro" in r) return r;
  const empresa = await empresaDaConta(db, r.conta.id);
  if (!empresa) return nega(409, "sem_empresa");
  if (empresa.validacaoStatus === "rejeitado") return nega(403, "empresa_rejeitada");
  return { acesso: { tipo: "recrutador", conta: r.conta, empresa } };
}

/** A vaga é da empresa de quem pede? O admin pode todas. */
export function podeMexer(acesso: AcessoVaga, companyId: string): boolean {
  return acesso.tipo === "admin" || acesso.empresa.id === companyId;
}

export type EmpresaPublica = { nome: string; verificada: boolean };

/** Nome da empresa e se ela já foi validada, para a lista e o detalhe das vagas (D2). */
export async function anexarEmpresas<T extends { companyId?: string | null }>(db: Db, itens: T[]): Promise<(T & { company?: EmpresaPublica })[]> {
  const ids = [...new Set(itens.map((i) => i.companyId).filter((x): x is string => !!x))];
  if (!ids.length) return itens;
  const rows = await db.companyProfile.findMany({ where: { id: { in: ids } }, select: { id: true, nome: true, validacaoStatus: true } });
  const porId = new Map(rows.map((r) => [r.id, { nome: r.nome, verificada: r.validacaoStatus === "validado" }]));
  return itens.map((i) => (i.companyId && porId.has(i.companyId) ? { ...i, company: porId.get(i.companyId)! } : i));
}

/** Validar ou rejeitar a empresa (admin). Rejeitar arquiva as vagas ativas dela. */
export async function decidirEmpresa(db: Db, companyId: string, acao: "validar" | "rejeitar", agora = new Date()): Promise<{ arquivadas: number } | null> {
  return db.$transaction(async (tx) => {
    const c = await tx.companyProfile.findUnique({ where: { id: companyId }, select: { id: true } });
    if (!c) return null;
    await tx.companyProfile.update({
      where: { id: companyId },
      data: { validacaoStatus: acao === "validar" ? "validado" : "rejeitado", validacaoData: agora },
    });
    if (acao === "validar") return { arquivadas: 0 };
    const r = await tx.vacancy.updateMany({ where: { companyId, status: "ativa" }, data: { status: "arquivada" } });
    return { arquivadas: r.count };
  });
}

/**
 * Para as rotas que mexem numa vaga (editar, renovar, arquivar): quem pede precisa poder gravar
 * vagas e a vaga precisa ser da empresa dele. Vaga de outra empresa responde 404 (não revela que existe).
 */
export async function exigirDonoDaVaga(
  req: Request,
  db: Db,
  vacancyId: string,
): Promise<{ acesso: AcessoVaga; vaga: { id: string; companyId: string; status: string; expiresAt: Date; renovacoes: number; createdAt: Date; updatedAt: Date } } | { erro: NextResponse }> {
  const a = await acessoVaga(req, db);
  if ("erro" in a) return a;
  const vaga = await db.vacancy.findUnique({
    where: { id: vacancyId },
    select: { id: true, companyId: true, status: true, expiresAt: true, renovacoes: true, createdAt: true, updatedAt: true },
  });
  if (!vaga || !podeMexer(a.acesso, vaga.companyId)) return nega(404, "vaga não encontrada");
  return { acesso: a.acesso, vaga };
}
