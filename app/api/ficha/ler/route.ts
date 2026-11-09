import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { docToText } from "@/lib/doc-to-text";
import { lerCv, MAX_CV_CHARS, type ChatFn } from "@/lib/ficha-ai";
import { chaveUso, consumirUso, ipDaRequisicao, LIMITE_LEITURAS_DIA } from "@/lib/uso-diario";
import { sameOrigin } from "@/lib/admin-request";

/**
 * "Minha ficha", passo 1 (1.5.10): lê um CV (PDF/DOCX/PDF do LinkedIn ou texto colado) e devolve a
 * ficha preenchida para o candidato conferir. Nada é salvo. Exige o aceite de leitura pela IA.
 */
const MAX_ARQUIVO_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "origem_invalida" }, { status: 403 });
  let texto = "";
  let aceite = false;
  let arquivo: File | null = null;
  const tipo = req.headers.get("content-type") ?? "";
  try {
    if (tipo.includes("multipart/form-data")) {
      const form = await req.formData();
      aceite = form.get("aceiteIa") === "true";
      const file = form.get("arquivo");
      if (file && typeof file === "object" && "arrayBuffer" in file) arquivo = file as File;
      else texto = String(form.get("texto") ?? "");
    } else {
      const body = (await req.json().catch(() => ({}))) as { texto?: unknown; aceiteIa?: unknown };
      aceite = body.aceiteIa === true;
      texto = typeof body.texto === "string" ? body.texto : "";
    }
  } catch (e) {
    console.warn("[ficha/ler] pedido ilegível:", e instanceof Error ? e.name : e);
    return NextResponse.json({ error: "arquivo_ilegivel" }, { status: 422 });
  }
  if (!aceite) return NextResponse.json({ error: "aceite_ia_obrigatorio" }, { status: 400 });
  if (arquivo && arquivo.size > MAX_ARQUIVO_BYTES) return NextResponse.json({ error: "arquivo_grande" }, { status: 413 });
  if (!arquivo && texto.trim().length < 30) return NextResponse.json({ error: "texto_curto" }, { status: 422 });

  // O limite vem antes de qualquer trabalho de IA, inclusive a conversão do PDF/DOCX (toMarkdown).
  try {
    const uso = await consumirUso(prisma, await chaveUso("ler", ipDaRequisicao(req)), LIMITE_LEITURAS_DIA);
    if (!uso.permitido) return NextResponse.json({ error: "limite_dia" }, { status: 429 });
  } catch (e) {
    console.error("[ficha/ler] limite:", e instanceof Error ? e.name : e);
  }

  if (arquivo) {
    try {
      texto = await docToText(await arquivo.arrayBuffer(), arquivo.name || "cv");
    } catch (e) {
      console.warn("[ficha/ler] arquivo ilegível:", e instanceof Error ? e.name : e);
      return NextResponse.json({ error: "arquivo_ilegivel" }, { status: 422 });
    }
  }
  texto = texto.slice(0, MAX_CV_CHARS);
  if (texto.trim().length < 30) return NextResponse.json({ error: "texto_curto" }, { status: 422 });

  const { getAiRouter } = await import("@/lib/ai");
  let chat: ChatFn | null = null;
  try {
    const router = getAiRouter();
    chat = (task, r) => router.chat(task, r);
  } catch {
    chat = null;
  }
  const r = await lerCv(texto, chat);
  return NextResponse.json({ ficha: r.ficha, origem: r.origem, aviso: r.aviso ?? null }, { headers: { "cache-control": "no-store" } });
}

export const dynamic = "force-dynamic";
