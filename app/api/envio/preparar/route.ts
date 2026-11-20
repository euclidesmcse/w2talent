/**
 * Coach IA por vaga (plano 2026-11-20, D1–D8): "Preparar para esta vaga" na tela Aprovar.
 * Candidato logado com Ficha W2 publicada; vaga que ainda pode ser aprovada. Devolve a sugestão
 * (resumo, destaques, carta, "por que se destaca" e o CV inteiro para a vaga, já passados pela trava
 * contra invenção) e as lacunas por regra.
 * Nada é guardado aqui: o que a pessoa aceitar vai junto ao aprovar.
 */
import { NextRequest, NextResponse } from "next/server";
import { pedidoDeEnvio, NO_STORE } from "@/lib/envio-request";
import { mesmaOrigem } from "@/lib/empresa";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

export async function POST(req: NextRequest) {
  if (!mesmaOrigem(req)) return json({ error: "origem_invalida" }, 403);
  const p = await pedidoDeEnvio(req);
  if ("erro" in p) return p.erro;
  const { db, perfil, body } = p;
  if (body.aceiteIa !== true) return json({ error: "aceite_ia_obrigatorio" }, 400);
  if (!perfil.w2) return json({ error: "sem_ficha_w2" }, 409);
  const vacancyId = typeof body.vacancyId === "string" ? body.vacancyId.slice(0, 64) : "";
  if (!vacancyId) return json({ error: "vaga_obrigatoria" }, 400);

  const { estadoDasVagas, snapshotVaga } = await import("@/lib/envio");
  const [item] = await estadoDasVagas(db, perfil, [vacancyId]);
  if (!item?.vaga || item.estado === "nao_encontrada") return json({ error: "nao_encontrada" }, 404);
  if (item.estado === "enviada") return json({ error: "ja_enviada" }, 409);
  if (item.estado === "indisponivel") return json({ error: "indisponivel" }, 409);
  // A tela mostrou outra versão da vaga: recarrega antes de preparar.
  if (typeof body.hash === "string" && body.hash && body.hash !== item.hash) return json({ error: "mudou" }, 409);

  const { chaveUso, consumirUso, LIMITE_COACH_VAGA_DIA } = await import("@/lib/uso-diario");
  const uso = await consumirUso(db, await chaveUso("coach-vaga", perfil.id), LIMITE_COACH_VAGA_DIA);
  if (!uso.permitido) return json({ error: "limite_dia" }, 429);

  const cv = await db.candidateCv.findUnique({ where: { profileId: perfil.id }, select: { texto: true } }).catch(() => null);
  try {
    const { prepararParaVaga, idiomaCoach } = await import("@/lib/coach-vaga");
    const { getAiRouter } = await import("@/lib/ai");
    const router = getAiRouter();
    const proposta = await prepararParaVaga(
      { ficha: perfil.ficha, w2: perfil.w2, vaga: snapshotVaga(item.vaga), cvTexto: cv?.texto ?? null, idioma: idiomaCoach(perfil.w2.idioma) },
      (task, q) => router.chat(task, q),
    );
    const { registrarSinal } = await import("@/lib/sinais");
    await registrarSinal(db, { tipo: "coach_preparado", ator: "candidato", candidateId: perfil.id, vacancyId, dados: { removidos: proposta.removidos.length, cv: "1" } }).catch(() => {});
    return json({
      proposta: { resumo: proposta.resumo, destaques: proposta.destaques, carta: proposta.carta, porQue: proposta.porQue, cv: proposta.cv, removidos: proposta.removidos },
      lacunas: item.lacunas,
      hash: item.hash,
    });
  } catch (e) {
    console.warn("[envio/preparar] IA falhou:", e instanceof Error ? e.name : e);
    return json({ error: "ia" }, 502);
  }
}

export const dynamic = "force-dynamic";
