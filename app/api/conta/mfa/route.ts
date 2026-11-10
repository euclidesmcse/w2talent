/**
 * Código do autenticador depois do login social (1.5.5). Confere o código (ou um código de
 * recuperação) pelo Better Auth, libera a sessão e, se pedido, lembra o aparelho por 30 dias.
 */
import { NextRequest, NextResponse } from "next/server";
import { contaDoPedido, NO_STORE } from "@/lib/sessao";
import { APARELHO_COOKIE, APARELHO_DIAS, assinarAparelho } from "@/lib/aparelho";
import { chaveUso, consumirUso } from "@/lib/uso-diario";

/** Tentativas de código por conta e por dia (o Better Auth não limita a conferência com sessão já aberta). */
const LIMITE_TENTATIVAS_MFA_DIA = 10;

export async function POST(req: NextRequest) {
  const conta = await contaDoPedido(req);
  if (!conta) return NextResponse.json({ error: "login" }, { status: 401, headers: NO_STORE });
  if (!conta.mfaPendente) return NextResponse.json({ ok: true }, { headers: NO_STORE });
  const body = (await req.json().catch(() => ({}))) as { codigo?: unknown; recuperacao?: unknown; confiar?: unknown };
  const codigo = typeof body.codigo === "string" ? body.codigo.replace(/\s+/g, "") : "";
  if (!codigo || codigo.length > 32) return NextResponse.json({ error: "codigo_invalido" }, { status: 400, headers: NO_STORE });
  const { prisma } = await import("@/lib/prisma");
  // Conta antes de conferir (pedidos em paralelo também contam): 10 tentativas por dia.
  const uso = await consumirUso(prisma, await chaveUso("mfa", conta.id), LIMITE_TENTATIVAS_MFA_DIA);
  if (!uso.permitido) return NextResponse.json({ error: "muitas_tentativas" }, { status: 429, headers: NO_STORE });
  const { getAuth, segredoDoLogin } = await import("@/lib/auth-server");
  const api = getAuth().api;
  try {
    if (body.recuperacao === true) await api.verifyBackupCode({ body: { code: codigo }, headers: req.headers });
    else await api.verifyTOTP({ body: { code: codigo }, headers: req.headers });
  } catch {
    return NextResponse.json({ error: "codigo_invalido" }, { status: 400, headers: NO_STORE });
  }
  await prisma.session.update({ where: { id: conta.sessaoId }, data: { mfaPendente: false } });
  const res = NextResponse.json({ ok: true }, { headers: NO_STORE });
  if (body.confiar === true) {
    res.cookies.set(APARELHO_COOKIE, await assinarAparelho(conta.id, segredoDoLogin()), {
      httpOnly: true,
      secure: req.nextUrl.protocol === "https:",
      sameSite: "lax",
      path: "/",
      maxAge: APARELHO_DIAS * 86_400,
    });
  }
  return res;
}
