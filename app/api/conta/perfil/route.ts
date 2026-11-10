/**
 * Escolher o perfil na primeira entrada (decisão 3): candidato ou recrutador, uma vez só.
 * Candidato aceita os consentimentos obrigatórios; cada aceite vai para o ConsentLog com o texto.
 */
import { NextRequest, NextResponse } from "next/server";
import { contaDoPedido, NO_STORE } from "@/lib/sessao";
import { CONSENTIMENTOS, CONSENTIMENTOS_OBRIGATORIOS, CONSENTIMENTO_VERSAO, textoConsentimento } from "@/lib/consentimento";

export async function POST(req: NextRequest) {
  const conta = await contaDoPedido(req);
  if (!conta) return NextResponse.json({ error: "login" }, { status: 401, headers: NO_STORE });
  if (conta.mfaPendente) return NextResponse.json({ error: "mfa" }, { status: 401, headers: NO_STORE });
  if (conta.perfil) return NextResponse.json({ error: "perfil_ja_escolhido", perfil: conta.perfil }, { status: 409, headers: NO_STORE });
  const body = (await req.json().catch(() => ({}))) as { perfil?: string; consentimentos?: Record<string, unknown>; idioma?: string };
  const perfil = body.perfil === "candidato" || body.perfil === "recrutador" ? body.perfil : null;
  if (!perfil) return NextResponse.json({ error: "perfil_invalido" }, { status: 400, headers: NO_STORE });
  const aceitos = CONSENTIMENTOS.filter((t) => body.consentimentos?.[t] === true);
  if (perfil === "candidato" && CONSENTIMENTOS_OBRIGATORIOS.some((t) => !aceitos.includes(t))) {
    return NextResponse.json({ error: "consentimento_obrigatorio" }, { status: 400, headers: NO_STORE });
  }
  const idioma = req.headers.get("x-locale") ?? body.idioma ?? "pt-BR";
  const { prisma } = await import("@/lib/prisma");
  // updateMany com perfil nulo: duas abas ao mesmo tempo não trocam o perfil já escolhido.
  const r = await prisma.$transaction(async (tx) => {
    const feito = await tx.user.updateMany({ where: { id: conta.id, perfil: null }, data: { perfil } });
    if (feito.count === 0) return false;
    if (perfil === "candidato") {
      await tx.consentLog.createMany({
        data: aceitos.map((tipo) => ({ userId: conta.id, tipo, versao: CONSENTIMENTO_VERSAO, texto: textoConsentimento(tipo, idioma), baseLegal: "consentimento" })),
      });
    }
    return true;
  });
  if (!r) return NextResponse.json({ error: "perfil_ja_escolhido" }, { status: 409, headers: NO_STORE });
  return NextResponse.json({ ok: true, perfil }, { headers: NO_STORE });
}
