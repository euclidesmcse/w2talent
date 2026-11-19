/** Estado do login para as telas (1.5.5): quem está logado e o que falta (perfil, código). */
import { NextRequest, NextResponse } from "next/server";
import { contaDoPedido, NO_STORE } from "@/lib/sessao";

export const dynamic = "force-dynamic";

/** Login com e-mail e senha: a tela de Segurança mostra "Trocar senha" ou "Criar senha". */
async function temSenha(userId: string): Promise<boolean> {
  const { getPrisma } = await import("@/lib/prisma");
  const a = await getPrisma()
    .account.findFirst({ where: { userId, providerId: "credential", password: { not: null } }, select: { id: true } })
    .catch(() => null);
  return !!a;
}

export async function GET(req: NextRequest) {
  const { provedoresConfigurados } = await import("@/lib/auth-server");
  const { senhaDisponivel } = await import("@/lib/login-email");
  const config = { provedores: provedoresConfigurados(), senha: senhaDisponivel(), turnstileSiteKey: process.env.TURNSTILE_SECRET_KEY && process.env.TURNSTILE_SITE_KEY ? process.env.TURNSTILE_SITE_KEY : null };
  const conta = await contaDoPedido(req).catch(() => null);
  if (!conta) return NextResponse.json({ estado: "anonimo", config }, { headers: NO_STORE });
  const estado = conta.mfaPendente ? "mfa" : !conta.perfil ? "sem_perfil" : conta.perfil === "recrutador" && !conta.mfaLigado ? "mfa_obrigatorio" : "ok";
  // Com o código pendente, só o nome (a tela pede o código); o resto depois.
  const dados = conta.mfaPendente
    ? { nome: conta.nome }
    : { nome: conta.nome, email: conta.email, perfil: conta.perfil, mfaLigado: conta.mfaLigado, temSenha: await temSenha(conta.id) };
  return NextResponse.json({ estado, conta: dados, config }, { headers: NO_STORE });
}
