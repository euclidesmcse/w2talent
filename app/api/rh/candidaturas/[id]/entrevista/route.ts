import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirConta, NO_STORE } from "@/lib/sessao";
import { empresaDaConta, mesmaOrigem } from "@/lib/empresa";
import { cancelarPeloRecrutador, enfileirarPendentes, oferecerEntrevista } from "@/lib/entrevista";
import { enqueueEmail } from "@/lib/notifications";

/**
 * 2.5a Agenda: o recrutador oferece horários (POST) ou cancela a entrevista (DELETE) de uma
 * candidatura da própria empresa. Corpo do POST: { duracaoMin, horarios: ISO[], linkReuniao?, fuso? }.
 * Os e-mails entram na fila depois do commit; se a fila falhar, o Cron diário tenta de novo.
 */
type Base = { ok: false; resp: Response } | { ok: true; contaId: string; companyId: string; appUrl: string };

async function base(req: NextRequest): Promise<Base> {
  const r = await exigirConta(req, { perfil: "recrutador" });
  if ("erro" in r) return { ok: false, resp: r.erro };
  if (!mesmaOrigem(req)) return { ok: false, resp: NextResponse.json({ error: "origem_invalida" }, { status: 403, headers: NO_STORE }) };
  const empresa = await empresaDaConta(prisma, r.conta.id);
  if (!empresa) return { ok: false, resp: NextResponse.json({ error: "nao_encontrada" }, { status: 404, headers: NO_STORE }) };
  return { ok: true, contaId: r.conta.id, companyId: empresa.id, appUrl: process.env.APP_URL || req.nextUrl.origin };
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const b = await base(req);
    if (!b.ok) return b.resp;
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const res = await oferecerEntrevista(
      prisma,
      {
        companyId: b.companyId,
        recrutadorId: b.contaId,
        applicationId: id,
        duracaoMin: body.duracaoMin,
        horarios: body.horarios,
        linkReuniao: body.linkReuniao,
        fuso: body.fuso,
        idioma: req.headers.get("x-locale"),
      },
      new Date(),
      { appUrl: b.appUrl },
    );
    if (!res.ok) {
      const status = res.erro === "nao_encontrada" ? 404 : 422;
      return NextResponse.json({ error: res.erro }, { status, headers: NO_STORE });
    }
    await enfileirarPendentes(prisma, res.ids, enqueueEmail).catch((e) => console.error("[agenda] fila:", e instanceof Error ? e.name : e));
    return NextResponse.json({ ok: true, entrevista: res.entrevista }, { headers: NO_STORE });
  } catch (e) {
    console.error("[rh/entrevista] falhou:", e instanceof Error ? e.name : e);
    return NextResponse.json({ error: "erro" }, { status: 500, headers: NO_STORE });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const b = await base(req);
    if (!b.ok) return b.resp;
    const { id } = await ctx.params;
    const res = await cancelarPeloRecrutador(prisma, b.companyId, id, new Date(), { appUrl: b.appUrl });
    if (!res.ok) return NextResponse.json({ error: res.erro }, { status: 404, headers: NO_STORE });
    await enfileirarPendentes(prisma, res.ids, enqueueEmail).catch((e) => console.error("[agenda] fila:", e instanceof Error ? e.name : e));
    return NextResponse.json({ ok: true, entrevista: res.entrevista }, { headers: NO_STORE });
  } catch (e) {
    console.error("[rh/entrevista] falhou:", e instanceof Error ? e.name : e);
    return NextResponse.json({ error: "erro" }, { status: 500, headers: NO_STORE });
  }
}

export const dynamic = "force-dynamic";
