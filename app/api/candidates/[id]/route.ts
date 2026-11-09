import { NextRequest, NextResponse } from "next/server";
import { validateForPublish, publishDraft, buildTsvectorText } from "@/lib/cv-extract";
import { runInBackground } from "@/lib/background";
import { indexCandidate } from "@/lib/indexing";

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  try {
    const body = await req.json().catch(() => ({} as any));
    const canonico = body.canonico ?? body.draft ?? body;
    const draft = canonico && canonico.titulo !== undefined ? canonico : body.canonico ?? body;

    try {
      validateForPublish(draft);
    } catch (e: any) {
      const status = e.status ?? e.statusCode ?? 400;
      return NextResponse.json({ error: e.message }, { status });
    }

    const published = await publishDraft(draft);

    try {
      const { prisma } = await import("@/lib/prisma");
      const expiresAt = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);
      const tsvector = buildTsvectorText(draft);
      // celular já normalizado por validateForPublish (E.164 BR), sem placeholder fake
      const celularNorm = published.draft.celular;
      await prisma.candidateProfile
        .upsert({
          where: { userId: params.id },
          create: {
            userId: params.id,
            nome: draft.nome ?? draft.titulo ?? "Candidato",
            titulo: draft.titulo ?? "Profissional",
            objetivoCrescimento: draft.objetivoCrescimento,
            localidade: draft.localidade ?? null,
            stack: draft.stack ?? [],
            experiencias: draft.experiencias ?? [],
            celular: celularNorm,
            email: draft.email ?? draft.contato?.email ?? "candidate@example.com",
            status: "ativo",
            expiresAt,
          },
          update: {
            titulo: draft.titulo ?? undefined,
            objetivoCrescimento: draft.objetivoCrescimento,
            localidade: draft.localidade ?? undefined,
            stack: draft.stack ?? undefined,
            celular: celularNorm,
            status: "ativo",
            expiresAt,
          },
        })
        .catch(() => {});
      try {
        // Texto já entra na busca na hora; o vetor (bge-m3) vem em segundo plano (1.5.9).
        // Hash zerado = pendente: se o vetor falhar, o reindex pega depois.
        await prisma.$executeRaw`UPDATE "CandidateProfile" SET "searchVector" = to_tsvector('portuguese', ${tsvector}), "embeddingHash" = NULL WHERE "userId" = ${params.id}`;
      } catch {}
      runInBackground("indexar perfil", () => indexCandidate(params.id));
    } catch {}

    return NextResponse.json(
      {
        id: params.id,
        ativo: published.draft,
        draft: published.draft,
        tsvector: published.tsvector,
        status: "ativo",
      },
      { status: 200 }
    );
  } catch (e: any) {
    const status = e.status ?? e.statusCode ?? 500;
    return NextResponse.json({ error: e.message ?? "erro interno publish" }, { status });
  }
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  return NextResponse.json({ id: params.id, message: "use PUT para publicar" }, { status: 200 });
}
