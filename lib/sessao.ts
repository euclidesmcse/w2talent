/**
 * Conta do pedido (1.5.5): lê a sessão do Better Auth e aplica as regras do W2Talent.
 * - sem sessão → 401 "login"
 * - sessão esperando o código do autenticador → 401 "mfa"
 * - perfil errado → 403 "perfil"; sem perfil escolhido → 403 "sem_perfil"
 * - recrutador sem autenticador ligado → 403 "mfa_obrigatorio" (decisão 2)
 */
import { NextResponse } from "next/server";
import type { Perfil } from "./auth-server";

export type Conta = {
  id: string;
  nome: string;
  email: string;
  perfil: Perfil | null;
  mfaLigado: boolean;
  mfaPendente: boolean;
  sessaoId: string;
};

export const NO_STORE = { "cache-control": "no-store" };

export async function contaDoPedido(req: Request): Promise<Conta | null> {
  const s = await import("./auth-server")
    .then(({ getAuth }) => getAuth().api.getSession({ headers: req.headers }))
    .catch(() => null);
  if (!s?.user || !s.session) return null;
  const u = s.user as typeof s.user & { perfil?: string | null; twoFactorEnabled?: boolean | null };
  const sess = s.session as typeof s.session & { mfaPendente?: boolean | null };
  const perfil = u.perfil === "candidato" || u.perfil === "recrutador" ? u.perfil : null;
  return { id: u.id, nome: u.name, email: u.email, perfil, mfaLigado: !!u.twoFactorEnabled, mfaPendente: !!sess.mfaPendente, sessaoId: sess.id };
}

export type Exigencia = { perfil?: Perfil };

export async function exigirConta(req: Request, exige: Exigencia = {}): Promise<{ conta: Conta } | { erro: NextResponse }> {
  return regrasDaConta(await contaDoPedido(req), exige);
}

/** As regras de acesso, separadas da leitura da sessão (testadas sem o Better Auth). */
export function regrasDaConta(conta: Conta | null, exige: Exigencia = {}): { conta: Conta } | { erro: NextResponse } {
  const nega = (status: number, erro: string) => ({ erro: NextResponse.json({ error: erro }, { status, headers: NO_STORE }) });
  if (!conta) return nega(401, "login");
  if (conta.mfaPendente) return nega(401, "mfa");
  if (exige.perfil) {
    if (!conta.perfil) return nega(403, "sem_perfil");
    if (conta.perfil !== exige.perfil) return nega(403, "perfil");
  }
  if (conta.perfil === "recrutador" && !conta.mfaLigado) return nega(403, "mfa_obrigatorio");
  return { conta };
}
