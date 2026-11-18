/** Renovar vaga (rotas PATCH /api/vacancies/[id] e /renew). */
import { NextRequest, NextResponse } from "next/server";
import { renewIdempotent } from "./vacancy";
import { exigirDonoDaVaga } from "./empresa";

/** Renova por mais 14 dias (uma vez por dia). Só a empresa dona da vaga ou o admin (2.1a, D3). */
export async function renovar(req: NextRequest, id: string): Promise<NextResponse> {
  if (!id) return NextResponse.json({ error: "id obrigatório para renew" }, { status: 400 });
  try {
    const { prisma } = await import("@/lib/prisma");
    const r = await exigirDonoDaVaga(req, prisma, id);
    if ("erro" in r) return r.erro;
    const existing = r.vaga;
    const now = new Date();
    const { alreadyRenewed, renewed } = renewIdempotent(existing, now);
    if (alreadyRenewed) {
      return NextResponse.json(
        { id: existing.id, expiresAt: new Date(existing.expiresAt).toISOString(), renovacoes: existing.renovacoes, status: existing.status },
        { status: 200 }
      );
    }
    const updated = await prisma.vacancy.update({
      where: { id },
      data: { expiresAt: renewed!.expiresAt, renovacoes: renewed!.renovacoes, status: "ativa" },
    });
    return NextResponse.json(
      { id: updated.id, expiresAt: (updated.expiresAt as Date).toISOString(), renovacoes: updated.renovacoes, status: updated.status },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("renovar vaga", e?.code ?? e?.name ?? "erro");
    return NextResponse.json({ error: "erro interno" }, { status: 500 });
  }
}

