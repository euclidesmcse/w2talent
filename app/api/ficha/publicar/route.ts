import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirConta, NO_STORE } from "@/lib/sessao";
import { camposFaltando, fichaToProfile, sanitizeFicha, sanitizeFichaW2 } from "@/lib/ficha";
import { candidateExpiresAt } from "@/lib/hygiene";
import { runInBackground } from "@/lib/background";

/**
 * "Minha ficha", Publicar (1.5.10): o candidato logado (1.5.5) publica o próprio perfil.
 * O perfil entra na busca com a Ficha W2 e é indexado em segundo plano.
 */
export async function POST(req: NextRequest) {
  const r = await exigirConta(req, { perfil: "candidato" });
  if ("erro" in r) return r.erro;
  const body = (await req.json().catch(() => ({}))) as { ficha?: unknown; fichaW2?: unknown; recibo?: unknown; cv?: { mostrar?: unknown; texto?: unknown } };
  const ficha = sanitizeFicha(body.ficha);
  const falta = camposFaltando(ficha);
  if (falta.length) return NextResponse.json({ error: "ficha_incompleta", falta }, { status: 422 });
  const w2 = sanitizeFichaW2(body.fichaW2);
  if (!w2) return NextResponse.json({ error: "ficha_w2_ausente" }, { status: 422 });

  // Um perfil por conta: userId é o id da conta (aleatório, não é o e-mail).
  const userId = r.conta.id;
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
    // 2.7b: o texto mudou (ou a ficha acabou de ser publicada): traduz para os outros idiomas em segundo plano.
    // A tradução nunca impede a publicação; o Cron diário pega o que ficar para trás.
    try {
      const { pedirTraducaoFichas } = await import("@/lib/traducao");
      await pedirTraducaoFichas(prisma, [p.id], 1);
    } catch (e) {
      console.warn("[ficha/publicar] tradução não pedida:", e instanceof Error ? e.name : e);
    }
    // Linha do tempo (D3): liga, troca ou desliga o CV completo. Nunca impede a publicação.
    let cvCompleto: boolean | undefined;
    let cvErro = false;
    if (body.cv && typeof body.cv.mostrar === "boolean") {
      try {
        const { aplicarCvCompleto } = await import("@/lib/cv-completo");
        cvCompleto = await aplicarCvCompleto(prisma, { userId, profileId: p.id, mostrar: body.cv.mostrar, texto: body.cv.texto, idioma: w2.idioma });
      } catch (e) {
        console.warn("[ficha/publicar] CV completo:", e instanceof Error ? e.name : e);
        // A ficha foi publicada, mas o pedido do CV (ligar ou apagar) não: a tela avisa e deixa tentar de novo.
        cvErro = true;
      }
    }
    // 3.6a: com o consentimento "treinoIA" ligado e o recibo da IA, guarda o exemplo anonimizado.
    // Nunca impede a publicação.
    if (body.recibo) {
      try {
        const { capturarExemplo, conhecidosDoCandidato } = await import("@/lib/treino");
        const { segredoDoLogin } = await import("@/lib/segredo-login");
        await capturarExemplo(prisma, {
          userId,
          tarefa: "ficha_w2",
          recibo: body.recibo,
          final: { resumo: w2.resumo, destaques: w2.destaques },
          conhecidos: await conhecidosDoCandidato(prisma, userId, ficha),
          segredo: segredoDoLogin(),
        });
      } catch (e) {
        console.warn("[ficha/publicar] exemplo de treino:", e instanceof Error ? e.name : e);
      }
    }
    return NextResponse.json({ ok: true, id: p.id, cvCompleto, ...(cvErro ? { cvErro: true } : {}) }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("[ficha/publicar] falhou:", e instanceof Error ? e.name : e);
    return NextResponse.json({ error: "erro" }, { status: 500 });
  }
}

/** A tela pergunta se pode mostrar o botão Publicar (candidato logado) e se já há perfil publicado. */
export async function GET(req: NextRequest) {
  const r = await exigirConta(req, { perfil: "candidato" });
  if ("erro" in r) return NextResponse.json({ podePublicar: false }, { headers: NO_STORE });
  const p = await prisma.candidateProfile
    .findUnique({ where: { userId: r.conta.id }, select: { id: true, status: true, cv: { select: { id: true } } } })
    .catch(() => null);
  return NextResponse.json({ podePublicar: true, publicado: !!p && p.status === "ativo", cvCompleto: !!p?.cv }, { headers: NO_STORE });
}

export const dynamic = "force-dynamic";
