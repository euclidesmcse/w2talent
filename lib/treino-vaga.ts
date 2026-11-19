/**
 * 3.6a: exemplo de treino da leitura da vaga (`extract_vacancy`), capturado quando o recrutador salva a vaga
 * que a IA leu em Publicar vaga. A tela manda `treino: { recibo, final }` junto com a vaga; `final` é o
 * rascunho conferido (o mesmo formato do que a IA devolveu). Admin não gera exemplo. Nunca lança.
 */
import type { PrismaClient } from "@prisma/client";
import type { AcessoVaga } from "./empresa";
import { sanitizarRascunho } from "./vaga-ai";

export async function capturarExemploVaga(db: PrismaClient, acesso: AcessoVaga, treino: unknown, tituloSalvo: string | null | undefined): Promise<string> {
  try {
    if (acesso.tipo !== "recrutador" || !treino || typeof treino !== "object") return "ignorado";
    const { recibo, final } = treino as { recibo?: unknown; final?: unknown };
    if (!recibo) return "ignorado";
    const rascunho = sanitizarRascunho(final);
    // O rascunho tem de ser a vaga que foi salva.
    if (!rascunho.titulo || rascunho.titulo !== String(tituloSalvo ?? "").trim().slice(0, 120)) return "final_diferente";
    const { capturarExemplo, conhecidosDoRecrutador } = await import("./treino");
    const { segredoDoLogin } = await import("./segredo-login");
    return await capturarExemplo(db, {
      userId: acesso.conta.id,
      tarefa: "extract_vacancy",
      recibo,
      final: rascunho,
      conhecidos: await conhecidosDoRecrutador(db, acesso.conta.id, acesso.empresa.id),
      segredo: segredoDoLogin(),
    });
  } catch (e) {
    console.warn("[treino] exemplo da vaga:", e instanceof Error ? e.name : e);
    return "erro";
  }
}
