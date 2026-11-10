/** Estado do login para as telas (1.5.5): quem está logado e o que falta (perfil, código). */
import { NextRequest, NextResponse } from "next/server";
import { contaDoPedido, NO_STORE } from "@/lib/sessao";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { provedoresConfigurados } = await import("@/lib/auth-server");
  const config = { provedores: provedoresConfigurados(), turnstileSiteKey: process.env.TURNSTILE_SECRET_KEY && process.env.TURNSTILE_SITE_KEY ? process.env.TURNSTILE_SITE_KEY : null };
  const conta = await contaDoPedido(req).catch(() => null);
  if (!conta) return NextResponse.json({ estado: "anonimo", config }, { headers: NO_STORE });
  const estado = conta.mfaPendente ? "mfa" : !conta.perfil ? "sem_perfil" : conta.perfil === "recrutador" && !conta.mfaLigado ? "mfa_obrigatorio" : "ok";
  // Com o código pendente, só o nome (a tela pede o código); o resto depois.
  const dados = conta.mfaPendente
    ? { nome: conta.nome }
    : { nome: conta.nome, email: conta.email, perfil: conta.perfil, mfaLigado: conta.mfaLigado };
  return NextResponse.json({ estado, conta: dados, config }, { headers: NO_STORE });
}
