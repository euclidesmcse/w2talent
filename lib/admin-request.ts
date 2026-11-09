/**
 * Guardas comuns das rotas /api/admin (1.5.8): cookie de admin válido e pedido vindo do próprio site.
 */
import { NextRequest, NextResponse } from "next/server";
import { adminSecretUsable, isAdminRequest } from "./admin-auth";

/** POST de outro site é recusado (além do SameSite=Strict do cookie). */
export function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === req.nextUrl.host;
  } catch {
    return false;
  }
}

/** null = pode seguir; senão, a resposta de erro. */
export async function adminGuard(req: NextRequest, { write = false } = {}): Promise<NextResponse | null> {
  const noStore = { "cache-control": "no-store" };
  if (!adminSecretUsable(process.env.ADMIN_SECRET)) return NextResponse.json({ error: "admin_desligado" }, { status: 503, headers: noStore });
  if (write && !sameOrigin(req)) return NextResponse.json({ error: "origem_invalida" }, { status: 403, headers: noStore });
  if (!(await isAdminRequest(req))) return NextResponse.json({ error: "nao_autenticado" }, { status: 401, headers: noStore });
  return null;
}
