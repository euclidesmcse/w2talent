import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirConta, NO_STORE } from "@/lib/sessao";
import { empresaDaConta, mesmaOrigem } from "@/lib/empresa";
import { avisoEnfileirado, ehEtapa, marcarVista, mudarEtapa } from "@/lib/rh-candidaturas";
import { enqueueEmail, enqueueWebhook } from "@/lib/notifications";

/**
 * 2.4b Mudar a etapa de uma candidatura (D1/D2) ou marcar como vista ao abrir a ficha (D3).
 * Corpo: { de, para } (etapas) ou { visto: true }. Só a empresa da vaga; 404 para as outras.
 * 2.4c (D4): a primeira ida para Entrevista libera o contato e põe o aviso ao candidato na fila.
 * 3.4b: a mudança vai para o webhook da empresa ("candidatura.etapa"), se estiver ligado.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await exigirConta(req, { perfil: "recrutador" });
  if ("erro" in r) return r.erro;
  if (!mesmaOrigem(req)) return NextResponse.json({ error: "origem_invalida" }, { status: 403, headers: NO_STORE });
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { de?: unknown; para?: unknown; visto?: unknown };
  const visto = body.visto === true;
  if (!visto && !(ehEtapa(body.de) && ehEtapa(body.para))) {
    return NextResponse.json({ error: "etapa" }, { status: 422, headers: NO_STORE });
  }
  try {
    const empresa = await empresaDaConta(prisma, r.conta.id);
    if (!empresa || !id) return NextResponse.json({ error: "nao_encontrada" }, { status: 404, headers: NO_STORE });
    if (visto) {
      const achou = await marcarVista(prisma, empresa.id, id);
      return NextResponse.json(achou ? { ok: true } : { error: "nao_encontrada" }, { status: achou ? 200 : 404, headers: NO_STORE });
    }
    const appUrl = process.env.APP_URL || req.nextUrl.origin;
    const res = await mudarEtapa(prisma, empresa.id, id, body.de as never, body.para as never, new Date(), { appUrl, enviarWebhook: enqueueWebhook });
    if (!res.ok) return NextResponse.json({ error: res.erro }, { status: res.erro === "mudou" ? 409 : 404, headers: NO_STORE });
    const { aviso, ...resposta } = res;
    if (aviso) {
      // Depois do commit: a etapa e a liberação já valem. Se a fila falhar, o aviso continua em
      // emailPendente e o Cron diário tenta de novo (reenviarEmailsPendentes).
      try {
        await enqueueEmail(aviso);
        await avisoEnfileirado(prisma, id, aviso);
      } catch (e) {
        console.error(`[rh/candidaturas] aviso de entrevista ${id} não entrou na fila:`, e instanceof Error ? e.message : e);
      }
    }
    return NextResponse.json(resposta, { headers: NO_STORE });
  } catch (e) {
    console.error("[rh/candidaturas] falhou:", e instanceof Error ? e.name : e);
    return NextResponse.json({ error: "erro" }, { status: 500, headers: NO_STORE });
  }
}

export const dynamic = "force-dynamic";
