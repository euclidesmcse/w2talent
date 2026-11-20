/**
 * CV por vaga (plano 2026-11-20 "CV por vaga", D4): os contatos da própria pessoa, só quando ela
 * pede o PDF do CV para baixar. O estado das vagas continua sem contato (é o que a empresa vê).
 */
import { NextRequest, NextResponse } from "next/server";
import { pedidoDeEnvio, NO_STORE } from "@/lib/envio-request";
import { mesmaOrigem } from "@/lib/empresa";

export async function POST(req: NextRequest) {
  if (!mesmaOrigem(req)) return NextResponse.json({ error: "origem_invalida" }, { status: 403, headers: NO_STORE });
  const p = await pedidoDeEnvio(req);
  if ("erro" in p) return p.erro;
  const f = p.perfil.ficha;
  return NextResponse.json({ nome: f.nome, email: f.email, celular: f.celular, localidade: f.localidade }, { headers: NO_STORE });
}

export const dynamic = "force-dynamic";
