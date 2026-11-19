/**
 * 3.6b Admin > Dados de treino. Só com o cookie de admin (lib/admin-auth.ts); POST só da mesma origem.
 * GET: resumo por tarefa e status, exportações recentes, modelo atual e modelos comparáveis;
 *      ?revisar=<tarefa> traz também o próximo exemplo pendente.
 * POST { acao: "aprovar" | "descartar", id }
 *      { acao: "exportar", tarefa } → arquivo JSONL (só aprovados fora da prova fixa), com registro
 *      { acao: "apagar_tarefa", tarefa, confirmar: true }
 *      { acao: "comparar", tarefa, modelo, limite? } → nota do modelo atual e do escolhido na prova fixa
 */
import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { adminGuard } from "@/lib/admin-request";
import { AdminInputError } from "@/lib/ai/admin";
import { sha256Hex } from "@/lib/admin-auth";
import { ipDaRequisicao } from "@/lib/uso-diario";
import { TAREFAS_TREINO, isTarefaTreino } from "@/lib/treino";
import {
  apagarTarefa,
  compararModelos,
  exportarTarefa,
  modeloAtual,
  modelosComparaveis,
  proximoPendente,
  resumoTreino,
  revisarExemplo,
  tarefaOuErro,
  MAX_COMPARACAO,
} from "@/lib/treino-admin";

export const dynamic = "force-dynamic";
const NO_STORE = { "cache-control": "no-store" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

export async function GET(req: NextRequest) {
  const denied = await adminGuard(req);
  if (denied) return denied;
  try {
    const db = getPrisma();
    const resumo = await resumoTreino(db);
    const modelos: Record<string, { atual: { id: string; rotulo: string }; outros: { id: string; rotulo: string }[] }> = {};
    for (const t of TAREFAS_TREINO) {
      const atual = await modeloAtual(db, t);
      modelos[t] = { atual: { id: atual.id, rotulo: atual.rotulo }, outros: (await modelosComparaveis(db, t)).filter((m) => m.id !== atual.id) };
    }
    const r = req.nextUrl.searchParams.get("revisar");
    const exemplo = isTarefaTreino(r) ? await proximoPendente(db, r) : null;
    return json({ ...resumo, modelos, exemplo, maxComparacao: MAX_COMPARACAO });
  } catch (err) {
    console.error("[admin/treino] falhou: resumo", (err as { code?: string })?.code ?? (err as Error)?.name);
    return json({ error: "erro_interno" }, 500);
  }
}

export async function POST(req: NextRequest) {
  const denied = await adminGuard(req, { write: true });
  if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const db = getPrisma();
  try {
    switch (body.acao) {
      case "aprovar":
      case "descartar":
        await revisarExemplo(db, body.id, body.acao);
        return json({ ok: true });
      case "exportar": {
        const tarefa = tarefaOuErro(body.tarefa);
        // O admin é uma senha só: "quem" = admin + hash do IP (nunca o IP).
        const quem = `admin:${(await sha256Hex(`w2-treino-export:${ipDaRequisicao(req)}`)).slice(0, 16)}`;
        const r = await exportarTarefa(db, tarefa, quem);
        const dia = new Date().toISOString().slice(0, 10);
        return new NextResponse(r.conteudo, {
          status: 200,
          headers: {
            ...NO_STORE,
            "content-type": "application/x-ndjson; charset=utf-8",
            "content-disposition": `attachment; filename="w2talent-treino-${tarefa}-${dia}.jsonl"`,
            "x-quantidade": String(r.quantidade),
          },
        });
      }
      case "apagar_tarefa": {
        const tarefa = tarefaOuErro(body.tarefa);
        if (body.confirmar !== true) return json({ error: "confirmar_obrigatorio" }, 400);
        return json({ ok: true, apagados: await apagarTarefa(db, tarefa) });
      }
      case "comparar": {
        const { aiAdminEnv } = await import("@/lib/ai");
        return json(await compararModelos(db, { tarefa: body.tarefa, modelo: body.modelo, limite: body.limite }, aiAdminEnv()));
      }
      default:
        return json({ error: "acao_invalida" }, 400);
    }
  } catch (err) {
    if (err instanceof AdminInputError) return json({ error: err.code }, err.code === "nao_encontrado" ? 404 : 400);
    console.error("[admin/treino] falhou:", String(body.acao).slice(0, 20), (err as { code?: string })?.code ?? (err as Error)?.name);
    return json({ error: "erro_interno" }, 500);
  }
}
