/**
 * 3.6a (D2): consentimento "treinoIA" da conta logada (candidato ou recrutador).
 * GET ?idioma=: { ligado, texto, versao }. POST { ligar: boolean, idioma }: liga ou desliga;
 * desligar apaga os exemplos de treino da pessoa (`apagados`).
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirConta, NO_STORE } from "@/lib/sessao";
import { sameOrigin } from "@/lib/admin-request";
import { TREINO_IA_VERSAO, textoTreinoIa } from "@/lib/consentimento";
import { mudarTreino, treinoLigado } from "@/lib/treino";
import { segredoDoLogin } from "@/lib/segredo-login";
import { defaultLocale, isValidLocale } from "@/i18n";

export const dynamic = "force-dynamic";

const idiomaDe = (v: unknown) => (typeof v === "string" && isValidLocale(v) ? v : defaultLocale);

export async function GET(req: NextRequest) {
  const r = await exigirConta(req);
  if ("erro" in r) return r.erro;
  const idioma = idiomaDe(req.nextUrl.searchParams.get("idioma"));
  try {
    return NextResponse.json({ ligado: await treinoLigado(prisma, r.conta.id), texto: textoTreinoIa(idioma), versao: TREINO_IA_VERSAO }, { headers: NO_STORE });
  } catch (e) {
    console.error("[conta/treino] leitura:", e instanceof Error ? e.name : e);
    return NextResponse.json({ error: "erro" }, { status: 500, headers: NO_STORE });
  }
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "origem_invalida" }, { status: 403, headers: NO_STORE });
  const r = await exigirConta(req);
  if ("erro" in r) return r.erro;
  const body = (await req.json().catch(() => ({}))) as { ligar?: unknown; idioma?: unknown };
  if (typeof body.ligar !== "boolean") return NextResponse.json({ error: "pedido_invalido" }, { status: 400, headers: NO_STORE });
  try {
    const out = await mudarTreino(prisma, r.conta.id, body.ligar, idiomaDe(body.idioma), segredoDoLogin());
    return NextResponse.json(out, { headers: NO_STORE });
  } catch (e) {
    console.error("[conta/treino] mudar:", e instanceof Error ? e.name : e);
    return NextResponse.json({ error: "erro" }, { status: 500, headers: NO_STORE });
  }
}
