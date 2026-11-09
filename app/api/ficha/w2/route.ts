import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { camposFaltando, sanitizeFicha } from "@/lib/ficha";
import { gerarFichaW2 } from "@/lib/ficha-ai";
import { chaveUso, consumirUso, ipDaRequisicao, LIMITE_FICHAS_W2_DIA } from "@/lib/uso-diario";
import { sameOrigin } from "@/lib/admin-request";
import { isValidLocale, defaultLocale } from "@/i18n";

/** "Minha ficha", passo 3 (1.5.11): escreve a Ficha W2 a partir da ficha conferida. Nada é salvo. */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "origem_invalida" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { ficha?: unknown; idioma?: unknown; aceiteIa?: unknown };
  if (body.aceiteIa !== true) return NextResponse.json({ error: "aceite_ia_obrigatorio" }, { status: 400 });
  const ficha = sanitizeFicha(body.ficha);
  const falta = camposFaltando(ficha);
  if (falta.length) return NextResponse.json({ error: "ficha_incompleta", falta }, { status: 422 });
  const idioma = typeof body.idioma === "string" && isValidLocale(body.idioma) ? body.idioma : defaultLocale;

  try {
    const uso = await consumirUso(prisma, await chaveUso("w2", ipDaRequisicao(req)), LIMITE_FICHAS_W2_DIA);
    if (!uso.permitido) return NextResponse.json({ error: "limite_dia" }, { status: 429 });
  } catch (e) {
    console.error("[ficha/w2] limite:", e instanceof Error ? e.name : e);
  }

  try {
    const { getAiRouter } = await import("@/lib/ai");
    const router = getAiRouter();
    const w2 = await gerarFichaW2(ficha, idioma, (task, r) => router.chat(task, r));
    return NextResponse.json({ fichaW2: w2 }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    const nome = e instanceof Error ? e.name : "erro";
    console.error("[ficha/w2] IA falhou:", nome);
    return NextResponse.json({ error: nome === "AiBudgetError" ? "ia_orcamento" : "ia_indisponivel" }, { status: 503 });
  }
}

export const dynamic = "force-dynamic";
