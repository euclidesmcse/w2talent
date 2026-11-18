/**
 * Empresa do recrutador (2.1a, D1). GET: a empresa ligada à conta (ou null).
 * POST: cadastra e liga a conta como dona (uma vez). PATCH: atualiza os dados.
 * Só recrutador logado com o autenticador ligado.
 */
import { NextRequest, NextResponse } from "next/server";
import { exigirConta, NO_STORE } from "@/lib/sessao";
import { atualizarEmpresa, cadastrarEmpresa, empresaDaConta, EmpresaErro, mesmaOrigem, validarEmpresa } from "@/lib/empresa";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

export async function GET(req: NextRequest) {
  const r = await exigirConta(req, { perfil: "recrutador" });
  if ("erro" in r) return r.erro;
  const { prisma } = await import("@/lib/prisma");
  return json({ empresa: await empresaDaConta(prisma, r.conta.id) });
}

async function gravar(req: NextRequest, modo: "criar" | "atualizar") {
  if (!mesmaOrigem(req)) return json({ error: "origem_invalida" }, 403);
  const r = await exigirConta(req, { perfil: "recrutador" });
  if ("erro" in r) return r.erro;
  const v = validarEmpresa(await req.json().catch(() => ({})));
  if (!v.ok) return json({ error: "campo_invalido", campo: v.campo }, 400);
  const { prisma } = await import("@/lib/prisma");
  try {
    const empresa = modo === "criar" ? await cadastrarEmpresa(prisma, r.conta.id, v.dados) : await atualizarEmpresa(prisma, r.conta.id, v.dados);
    return json({ empresa }, modo === "criar" ? 201 : 200);
  } catch (e) {
    if (e instanceof EmpresaErro) return json({ error: e.codigo }, e.codigo === "sem_empresa" ? 404 : e.codigo === "rejeitada" ? 403 : 409);
    console.error("conta/empresa", (e as { code?: string })?.code ?? (e as Error)?.name ?? "erro");
    return json({ error: "erro_interno" }, 500);
  }
}

export const POST = (req: NextRequest) => gravar(req, "criar");
export const PATCH = (req: NextRequest) => gravar(req, "atualizar");
