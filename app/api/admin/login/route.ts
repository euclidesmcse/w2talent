import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import {
  adminSecretUsable,
  afterFailure,
  cookieHeader,
  isLocked,
  passwordMatches,
  sha256Hex,
  signAdminSession,
} from "@/lib/admin-auth";
import { sameOrigin } from "@/lib/admin-request";

/**
 * Entrada no Admin de IA (1.5.8): senha do ADMIN_SECRET → cookie de 12 h.
 * Cinco erros seguidos do mesmo IP bloqueiam por 15 minutos (tabela AdminLoginLock, IP guardado como hash).
 */
export async function POST(req: NextRequest) {
  const noStore = { "cache-control": "no-store" };
  const secret = process.env.ADMIN_SECRET;
  if (!adminSecretUsable(secret)) return NextResponse.json({ error: "admin_desligado" }, { status: 503, headers: noStore });
  if (!sameOrigin(req)) return NextResponse.json({ error: "origem_invalida" }, { status: 403, headers: noStore });

  const body = (await req.json().catch(() => null)) as { senha?: unknown } | null;
  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "sem-ip";
  const chave = await sha256Hex(`w2-admin-ip:${ip}`);
  const db = getPrisma();
  const lock = await db.adminLoginLock.findUnique({ where: { chave } });
  const now = Date.now();
  if (isLocked(lock, now)) {
    return NextResponse.json({ error: "bloqueado", ate: lock!.bloqueadoAte }, { status: 429, headers: noStore });
  }

  if (!passwordMatches(body?.senha, secret)) {
    const next = afterFailure(lock, now);
    await db.adminLoginLock.upsert({ where: { chave }, create: { chave, ...next }, update: next });
    const status = next.bloqueadoAte ? 429 : 401;
    return NextResponse.json({ error: next.bloqueadoAte ? "bloqueado" : "senha_errada", ate: next.bloqueadoAte }, { status, headers: noStore });
  }

  if (lock) await db.adminLoginLock.delete({ where: { chave } }).catch(() => undefined);
  const s = await signAdminSession(secret, now);
  const res = NextResponse.json({ ok: true }, { headers: noStore });
  res.headers.append("set-cookie", cookieHeader(s.value, s.expires));
  return res;
}
