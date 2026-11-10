/**
 * Rotas de envio (1.5.13): o candidato logado (1.5.5) aprova e envia como o perfil que publicou em
 * "Minha ficha". O perfil vem da sessão, nunca do corpo do pedido.
 */
import { NextRequest, NextResponse } from "next/server";
import type { PrismaClient } from "@prisma/client";
import { exigirConta, NO_STORE } from "./sessao";
import { perfilDaConta, type PerfilEnvio } from "./envio";

export { NO_STORE };

export async function pedidoDeEnvio(
  req: NextRequest,
): Promise<{ erro: NextResponse } | { db: PrismaClient; perfil: PerfilEnvio; body: Record<string, unknown> }> {
  const r = await exigirConta(req, { perfil: "candidato" });
  if ("erro" in r) return { erro: r.erro };
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { prisma } = await import("./prisma");
  const perfil = await perfilDaConta(prisma, r.conta.id);
  if (!perfil) return { erro: NextResponse.json({ error: "perfil_nao_publicado" }, { status: 404, headers: NO_STORE }) };
  return { db: prisma, perfil, body: body ?? {} };
}
