/**
 * Linha do tempo, PR c (plano 2026-11-20, D3 e D4): CV completo e resumo por IA para o recrutador.
 * Só recrutador logado com autenticador; só perfil ativo cujo candidato ligou "Mostrar meu CV completo".
 * GET devolve o texto (já guardado sem contatos). POST devolve o resumo (geral + um por cargo), gerado
 * na primeira vez e guardado; resumos novos contam no limite diário de quem pede.
 */
import { NextRequest, NextResponse } from "next/server";
import { exigirConta, NO_STORE } from "@/lib/sessao";
import { mesmaOrigem } from "@/lib/empresa";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

type CvLido = NonNullable<Awaited<ReturnType<typeof import("@/lib/cv-completo").cvDoPerfil>>>;
type Leitura =
  | { erro: NextResponse }
  | { prisma: typeof import("@/lib/prisma").prisma; cv: CvLido; id: string; conta: { id: string } };

async function ler(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Leitura> {
  const acesso = await exigirConta(req, { perfil: "recrutador" });
  if ("erro" in acesso) return { erro: acesso.erro };
  const { id } = await ctx.params;
  const { prisma } = await import("@/lib/prisma");
  const { cvDoPerfil } = await import("@/lib/cv-completo");
  const cv = await cvDoPerfil(prisma, id);
  if (!cv) return { erro: json({ error: "sem_cv" }, 404) };
  return { prisma, cv, id, conta: acesso.conta };
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await ler(req, ctx);
  if ("erro" in r) return r.erro;
  return json({ texto: r.cv.texto });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!mesmaOrigem(req)) return json({ error: "origem_invalida" }, 403);
  const r = await ler(req, ctx);
  if ("erro" in r) return r.erro;
  const body = (await req.json().catch(() => ({}))) as { idioma?: unknown };
  const { sanitizeFicha } = await import("@/lib/ficha");
  const { resumoDoCv, idiomaResumo } = await import("@/lib/cv-resumo");
  const cargos = sanitizeFicha({ experiencias: r.cv.experiencias }).experiencias;
  const base = { profileId: r.id, texto: r.cv.texto, resumos: r.cv.resumos, cargos, idioma: idiomaResumo(body.idioma) };
  const guardado = await resumoDoCv(r.prisma, { ...base, chat: null });
  if (guardado.resumo) return json({ resumo: guardado.resumo });

  const { chaveUso, consumirUso, LIMITE_RESUMOS_CV_DIA } = await import("@/lib/uso-diario");
  const uso = await consumirUso(r.prisma, await chaveUso("resumo-cv", r.conta.id), LIMITE_RESUMOS_CV_DIA);
  if (!uso.permitido) return json({ error: "limite_dia" }, 429);
  try {
    const { getAiRouter } = await import("@/lib/ai");
    const router = getAiRouter();
    const out = await resumoDoCv(r.prisma, { ...base, chat: (task, q) => router.chat(task, q) });
    return json({ resumo: out.resumo });
  } catch (e) {
    console.warn("[cv/resumo] IA falhou:", e instanceof Error ? e.name : e);
    return json({ error: "ia" }, 502);
  }
}

export const dynamic = "force-dynamic";
