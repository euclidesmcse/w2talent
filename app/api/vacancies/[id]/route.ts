import { NextRequest, NextResponse } from "next/server";
import { validateVacancy, normalizeVacancyStack, normalizeDescricaoBullets } from "@/lib/vacancy";
import { runInBackground } from "@/lib/background";
import { indexVacancy, markForReindex } from "@/lib/indexing";
import { exigirDonoDaVaga } from "@/lib/empresa";
import { renovar } from "@/lib/vaga-renovar";
import { pedirTraducaoDaVaga } from "@/lib/traducao-anexar";

function parseIdFromUrl(req: NextRequest): string {
  const parts = new URL(req.url).pathname.split("/").filter(Boolean);
  const vacIdx = parts.indexOf("vacancies");
  if (vacIdx !== -1 && parts[vacIdx + 1]) return parts[vacIdx + 1];
  return "";
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: paramId } = await ctx.params;
  const id = paramId ?? parseIdFromUrl(req);
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  try {
    const { prisma } = await import("@/lib/prisma");
    const vac = await prisma.vacancy.findUnique({ where: { id } });
    if (!vac) return NextResponse.json({ error: "vaga não encontrada" }, { status: 404 });
    return NextResponse.json({ ...vac, expiresAt: (vac.expiresAt as Date).toISOString?.() ?? vac.expiresAt }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "erro interno" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: paramId } = await ctx.params;
  const url = new URL(req.url);
  const id = paramId ?? parseIdFromUrl(req);
  const isRenew = url.pathname.endsWith("/renew") || url.searchParams.get("action") === "renew";
  const body: any = await req.json().catch(() => ({}));
  const wantRenew = isRenew || body?.action === "renew" || body?.renew === true;
  if (!wantRenew) {
    return NextResponse.json({ error: "use PATCH com {action:'renew'} para renovar" }, { status: 400 });
  }
  return renovar(req, id);
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: paramId } = await ctx.params;
  const id = paramId ?? parseIdFromUrl(req);
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  let body: any = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "payload inválido" }, { status: 400 }); }

  try {
    validateVacancy(body, { partial: true });
  } catch (e: any) {
    const status = e.status ?? e.statusCode ?? 400;
    return NextResponse.json({ error: e.message }, { status });
  }
  if (body.titulo !== undefined) {
    body.titulo = String(body.titulo).trim().slice(0, 120);
    if (!body.titulo) return NextResponse.json({ error: "titulo obrigatório" }, { status: 400 });
  }
  if (body.stack !== undefined) {
    const ids = normalizeVacancyStack(body.stack);
    body.stack = ids.map((skillId) => ({ skillId }));
  }
  if (body.descricaoBullets !== undefined || body.descricao !== undefined) {
    body.descricaoBullets = normalizeDescricaoBullets(body.descricaoBullets ?? body.descricao);
  }

  try {
    const { prisma } = await import("@/lib/prisma");
    // 2.1a (D3): só a empresa dona da vaga ou o admin; a empresa da vaga não muda por aqui.
    const r = await exigirDonoDaVaga(req, prisma, id);
    if ("erro" in r) return r.erro;
    // 2.1b: null limpa o campo (ex.: tirar a faixa); ausente deixa como está.
    const updated = await prisma.vacancy.update({
      where: { id },
      data: {
        titulo: body.titulo ?? undefined,
        stack: body.stack ?? undefined,
        descricaoBullets: body.descricaoBullets ?? undefined,
        beneficios: body.beneficios ? (normalizeDescricaoBullets(body.beneficios) as any) : undefined,
        nivel: body.nivel === undefined ? undefined : body.nivel,
        regime: body.regime === undefined ? undefined : body.regime,
        localidade: body.localidade === undefined ? undefined : body.localidade,
        faixaDe: body.faixaDe === undefined ? undefined : body.faixaDe,
        faixaAte: body.faixaAte === undefined ? undefined : body.faixaAte,
        faixaMoeda: body.faixaMoeda ?? undefined,
        tipoContrato: body.tipoContrato ?? undefined,
      },
    });
    // 1.5.9: marca como pendente (o reindex pega se o vetor falhar) e refaz em segundo plano.
    await markForReindex("vacancy", updated.id, { db: prisma }).catch(() => {});
    runInBackground("reindexar vaga", () => indexVacancy(updated.id));
    // 2.7a: texto mudou, a tradução antiga deixa de valer (hash); pede a nova em segundo plano.
    await pedirTraducaoDaVaga(prisma, updated.id);
    // 3.6a: "Atualizar a existente" depois da leitura pela IA também gera exemplo (com consentimento).
    if (body.treino) {
      const { capturarExemploVaga } = await import("@/lib/treino-vaga");
      await capturarExemploVaga(prisma, r.acesso, body.treino, updated.titulo);
    }
    return NextResponse.json({ ...updated, id: updated.id }, { status: 200 });
  } catch (e: any) {
    console.error("PUT vaga", e?.code ?? e?.name ?? "erro");
    return NextResponse.json({ error: "erro ao atualizar vaga" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: paramId } = await ctx.params;
  const id = paramId ?? parseIdFromUrl(req);
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  try {
    const { prisma } = await import("@/lib/prisma");
    const r = await exigirDonoDaVaga(req, prisma, id);
    if ("erro" in r) return r.erro;
    await prisma.vacancy.update({ where: { id }, data: { status: "arquivada" } });
    return NextResponse.json({ id, status: "arquivada" }, { status: 200 });
  } catch (e: any) {
    console.error("arquivar vaga", e?.code ?? e?.name ?? "erro");
    return NextResponse.json({ error: "erro ao arquivar" }, { status: 500 });
  }
}
