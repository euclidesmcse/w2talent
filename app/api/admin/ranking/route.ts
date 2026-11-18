/**
 * Ranking adaptativo (3.1, D7). GET: os pesos de cada escopo (global primeiro, depois as empresas com
 * mais exemplos), com o padrão e o mínimo de exemplos para comparar.
 * POST {escopo, escopoId, desligado}: desliga (volta ao padrão) ou religa um escopo.
 * Só com o cookie de admin (lib/admin-auth.ts).
 */
import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";
import { adminGuard } from "@/lib/admin-request";
import { MIN_EXEMPLOS, PESOS_PADRAO } from "@/lib/ranking";

const NO_STORE = { "cache-control": "no-store" };
const MAX_LINHAS = 200;

const SELECT = { escopo: true, escopoId: true, pesos: true, n: true, nPositivos: true, nNegativos: true, desligado: true, atualizadoEm: true } as const;

export async function GET(req: NextRequest) {
  const denied = await adminGuard(req);
  if (denied) return denied;
  try {
    const db = getPrisma();
    const [global, empresas] = await Promise.all([
      db.rankingWeights.findFirst({ where: { escopo: "global", escopoId: "" }, select: SELECT }),
      db.rankingWeights.findMany({
        where: { escopo: "empresa" },
        orderBy: [{ n: "desc" }, { escopoId: "asc" }],
        take: MAX_LINHAS - 1,
        select: SELECT,
      }),
    ]);
    const ids = empresas.map((e) => e.escopoId);
    const nomes = new Map(
      ids.length ? (await db.companyProfile.findMany({ where: { id: { in: ids } }, select: { id: true, nome: true } })).map((c) => [c.id, c.nome]) : [],
    );
    const linhas = [
      ...(global ? [{ ...global, empresaNome: null }] : []),
      ...empresas.map((e) => ({ ...e, empresaNome: nomes.get(e.escopoId) ?? null })),
    ];
    return NextResponse.json({ padrao: PESOS_PADRAO, minimo: MIN_EXEMPLOS, linhas }, { headers: NO_STORE });
  } catch (err) {
    console.error("[admin/ranking] falhou: lista", (err as { code?: string })?.code ?? (err as Error)?.name);
    return NextResponse.json({ error: "erro_interno" }, { status: 500, headers: NO_STORE });
  }
}

export async function POST(req: NextRequest) {
  const denied = await adminGuard(req, { write: true });
  if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as { escopo?: unknown; escopoId?: unknown; desligado?: unknown };
  const escopo = body.escopo === "global" || body.escopo === "empresa" ? body.escopo : null;
  const escopoId = typeof body.escopoId === "string" && body.escopoId.length <= 64 ? body.escopoId : null;
  const desligado = typeof body.desligado === "boolean" ? body.desligado : null;
  // O global não tem id; a empresa precisa de um.
  const idOk = escopo === "global" ? escopoId === "" : !!escopoId;
  if (!escopo || escopoId === null || desligado === null || !idOk) {
    return NextResponse.json({ error: "pedido_invalido" }, { status: 400, headers: NO_STORE });
  }
  try {
    const db = getPrisma();
    if (escopo === "empresa" && !(await db.companyProfile.findUnique({ where: { id: escopoId }, select: { id: true } }))) {
      return NextResponse.json({ error: "nao_encontrada" }, { status: 404, headers: NO_STORE });
    }
    const linha = await db.rankingWeights.upsert({
      where: { escopo_escopoId: { escopo, escopoId } },
      create: { escopo, escopoId, desligado, pesos: { ...PESOS_PADRAO } as unknown as Prisma.InputJsonValue, n: 0, nPositivos: 0, nNegativos: 0 },
      update: { desligado },
      select: SELECT,
    });
    return NextResponse.json({ ok: true, linha }, { headers: NO_STORE });
  } catch (err) {
    console.error("[admin/ranking] falhou: desligar", (err as { code?: string })?.code ?? (err as Error)?.name);
    return NextResponse.json({ error: "erro_interno" }, { status: 500, headers: NO_STORE });
  }
}
