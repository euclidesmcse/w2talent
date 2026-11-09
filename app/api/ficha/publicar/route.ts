import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminGuard } from "@/lib/admin-request";
import { camposFaltando, fichaToProfile, sanitizeFicha, sanitizeFichaW2 } from "@/lib/ficha";
import { candidateExpiresAt } from "@/lib/hygiene";
import { runInBackground } from "@/lib/background";
import { userIdDoEmail } from "@/lib/envio";

/**
 * "Minha ficha", Publicar (1.5.10, decisão D1): até existir o login novo (1.5.5), só o admin publica,
 * para criar perfis de teste. O perfil entra na busca com a Ficha W2 e é indexado em segundo plano.
 */
export async function POST(req: NextRequest) {
  const guard = await adminGuard(req, { write: true });
  if (guard) return guard;
  const body = (await req.json().catch(() => ({}))) as { ficha?: unknown; fichaW2?: unknown };
  const ficha = sanitizeFicha(body.ficha);
  const falta = camposFaltando(ficha);
  if (falta.length) return NextResponse.json({ error: "ficha_incompleta", falta }, { status: 422 });
  const w2 = sanitizeFichaW2(body.fichaW2);
  if (!w2) return NextResponse.json({ error: "ficha_w2_ausente" }, { status: 422 });

  // userId aparece na busca: vai o hash do e-mail, nunca o e-mail.
  const userId = await userIdDoEmail(ficha.email);
  const now = new Date();
  const dados = {
    ...fichaToProfile(ficha),
    resumo3linhas: w2.resumo,
    fichaW2: w2,
    idiomaOriginal: w2.idioma,
    status: "ativo" as const,
    arquivadoEm: null,
    expiresAt: candidateExpiresAt(now),
  };
  try {
    const p = await prisma.candidateProfile.upsert({ where: { userId }, create: { userId, ...dados }, update: dados, select: { id: true, userId: true } });
    // O texto mudou: o índice antigo sai (a busca monta o texto na hora) e o vetor fica pendente.
    // Se a indexação em segundo plano falhar, o reindex encontra o perfil depois.
    await prisma.$executeRaw`UPDATE "CandidateProfile" SET "searchVector" = NULL, "embeddingHash" = NULL WHERE "userId" = ${p.userId}`;
    runInBackground("indexar perfil", async () => {
      const { indexCandidate } = await import("@/lib/indexing");
      await indexCandidate(p.userId);
    });
    return NextResponse.json({ ok: true, id: p.id }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("[ficha/publicar] falhou:", e instanceof Error ? e.name : e);
    return NextResponse.json({ error: "erro" }, { status: 500 });
  }
}

/** A tela pergunta se pode mostrar o botão Publicar (só para o admin, até o login novo). */
export async function GET(req: NextRequest) {
  const guard = await adminGuard(req);
  return NextResponse.json({ podePublicar: !guard }, { headers: { "cache-control": "no-store" } });
}

export const dynamic = "force-dynamic";
