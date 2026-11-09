/**
 * Rotas de envio (1.5.13) no modo de teste do admin: até o login (1.5.5), só o admin envia, como o
 * perfil publicado em "Minha ficha" com o e-mail informado. Depois do login, o perfil vem da sessão.
 */
import { NextRequest, NextResponse } from "next/server";
import type { PrismaClient } from "@prisma/client";
import { adminGuard } from "./admin-request";
import { perfilDoEmail, type PerfilEnvio } from "./envio";

export const NO_STORE = { "cache-control": "no-store" };

export async function pedidoDeEnvio(
  req: NextRequest,
): Promise<{ erro: NextResponse } | { db: PrismaClient; perfil: PerfilEnvio; body: Record<string, unknown> }> {
  const guard = await adminGuard(req, { write: true });
  if (guard) return { erro: guard };
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { prisma } = await import("./prisma");
  const perfil = await perfilDoEmail(prisma, body?.email);
  if (!perfil) return { erro: NextResponse.json({ error: "perfil_nao_publicado" }, { status: 404, headers: NO_STORE }) };
  return { db: prisma, perfil, body: body ?? {} };
}
