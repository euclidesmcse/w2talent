import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { NO_STORE } from "@/lib/sessao";
import { mesmaOrigem } from "@/lib/empresa";
import { cancelarPeloCandidato, codigoValido, enfileirarPendentes, escolherHorario, verPorCodigo } from "@/lib/entrevista";
import { enqueueEmail } from "@/lib/notifications";

/**
 * 2.5a Página do candidato (/agendar?c=<código>), sem login: o código do e-mail é a chave.
 * Corpo: { c, acao: "ver" | "escolher" | "cancelar", inicio?, fuso? }. POST para o código não ir para logs de URL da API.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { c?: unknown; acao?: unknown; inicio?: unknown; fuso?: unknown };
  if (!codigoValido(body.c)) return NextResponse.json({ error: "nao_encontrada" }, { status: 404, headers: NO_STORE });
  const acao = body.acao ?? "ver";
  if (acao !== "ver" && !mesmaOrigem(req)) return NextResponse.json({ error: "origem_invalida" }, { status: 403, headers: NO_STORE });
  const appUrl = process.env.APP_URL || req.nextUrl.origin;
  const now = new Date();
  try {
    if (acao === "escolher" || acao === "cancelar") {
      const r =
        acao === "escolher"
          ? await escolherHorario(prisma, body.c, body.inicio, body.fuso, now, { appUrl })
          : await cancelarPeloCandidato(prisma, body.c, now, { appUrl });
      if (!r.ok) {
        const status = r.erro === "nao_encontrada" ? 404 : 409;
        return NextResponse.json({ error: r.erro, visao: await verPorCodigo(prisma, body.c, now) }, { status, headers: NO_STORE });
      }
      await enfileirarPendentes(prisma, [r.id], enqueueEmail).catch((e) => console.error("[agenda] fila:", e instanceof Error ? e.name : e));
    } else if (acao !== "ver") {
      return NextResponse.json({ error: "acao" }, { status: 422, headers: NO_STORE });
    }
    const visao = await verPorCodigo(prisma, body.c, new Date());
    if (!visao) return NextResponse.json({ error: "nao_encontrada" }, { status: 404, headers: NO_STORE });
    return NextResponse.json({ ok: true, visao }, { headers: NO_STORE });
  } catch (e) {
    console.error("[agendar] falhou:", e instanceof Error ? e.name : e);
    return NextResponse.json({ error: "erro" }, { status: 500, headers: NO_STORE });
  }
}

export const dynamic = "force-dynamic";
