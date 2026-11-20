import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { docToText } from "@/lib/doc-to-text";
import { lerCv, MAX_CV_CHARS, type ChatFn } from "@/lib/ficha-ai";
import { limparCv } from "@/lib/cv-completo";
import { chaveUso, consumirUso, ipDaRequisicao, LIMITE_LEITURAS_DIA } from "@/lib/uso-diario";
import { sameOrigin } from "@/lib/admin-request";
import type { EtapaLeitura } from "@/lib/importar-cv";

/**
 * "Minha ficha", passo 1 (1.5.10): lê um CV (PDF/DOCX/PDF do LinkedIn ou texto colado) e devolve a
 * ficha preenchida para o candidato conferir. Nada é salvo. Exige o aceite de leitura pela IA.
 * Linha do tempo (D3): devolve também o texto do CV já limpo (sem contatos), que só é guardado
 * ao publicar se o candidato marcar "Mostrar meu CV completo".
 * Importar CV (plano 2026-11-20, D2): com `Accept: application/x-ndjson`, responde uma linha por
 * etapa que terminou ({"etapa":"arquivo"}…) e por último o resultado; sem isso, o JSON de sempre.
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

  const pedirEtapas = (req.headers.get("accept") ?? "").includes("application/x-ndjson");
  const trabalho = (emitir: (e: EtapaLeitura) => void) => lerEmEtapas({ arquivo, texto }, emitir);
  if (!pedirEtapas) {
    const r = await trabalho(() => {});
    return "error" in r
      ? NextResponse.json({ error: r.error }, { status: 422 })
      : NextResponse.json(r, { headers: { "cache-control": "no-store" } });
  }

  // Importar CV (D2): uma linha por etapa que terminou de fato, e por último o resultado (ou o erro).
  const enc = new TextEncoder();
  const corpo = new ReadableStream<Uint8Array>({
    async start(ctrl) {
      const linha = (o: unknown) => ctrl.enqueue(enc.encode(`${JSON.stringify(o)}\n`));
      try {
        linha(await trabalho((etapa) => linha({ etapa })));
      } catch (e) {
        console.error("[ficha/ler] etapas:", e instanceof Error ? e.name : e);
        linha({ error: "geral" });
      } finally {
        ctrl.close();
      }
    },
  });
  return new Response(corpo, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}

type Resultado = { ficha: unknown; origem: string; aviso: string | null; cvTexto: string } | { error: string };

async function lerEmEtapas(entrada: { arquivo: File | null; texto: string }, emitir: (e: EtapaLeitura) => void): Promise<Resultado> {
  let texto = entrada.texto;
  if (entrada.arquivo) {
    try {
      texto = await docToText(await entrada.arquivo.arrayBuffer(), entrada.arquivo.name || "cv");
    } catch (e) {
      console.warn("[ficha/ler] arquivo ilegível:", e instanceof Error ? e.name : e);
      return { error: "arquivo_ilegivel" };
    }
  }
  texto = texto.slice(0, MAX_CV_CHARS);
  if (texto.trim().length < 30) return { error: "texto_curto" };
  emitir("arquivo");

  // Contatos e documentos saem antes da IA (lerCv tira de novo do que manda para o modelo).
  const cvTexto = limparCv(texto);
  emitir("contatos");

  const { getAiRouter } = await import("@/lib/ai");
  let chat: ChatFn | null = null;
  try {
    const router = getAiRouter();
    chat = (task, r) => router.chat(task, r);
  } catch {
    chat = null;
  }
  const r = await lerCv(texto, chat);
  emitir("ia");
  emitir("organizar");
  return { ficha: r.ficha, origem: r.origem, aviso: r.aviso ?? null, cvTexto };
}

export const dynamic = "force-dynamic";
