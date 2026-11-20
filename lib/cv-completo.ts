/**
 * CV completo da linha do tempo (2026-11-20, D3). O texto só é guardado com o consentimento
 * "cvCompleto" do candidato e sempre limpo: sem e-mail, telefone, links, documentos e endereço.
 * Fica na tabela CandidateCv, separada do perfil, e sai com o perfil (higiene) ou ao desligar.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { redactContacts } from "./ai/redact";
import { CV_COMPLETO_TIPO, CV_COMPLETO_VERSAO, textoCvCompleto } from "./consentimento";

export const MAX_CV_TEXTO = 60_000;

type Db = Pick<PrismaClient, "candidateCv" | "consentLog" | "$transaction">;

/** Texto do CV pronto para guardar: contatos e qualquer link trocados por marcadores, espaços arrumados. */
export function limparCv(texto: unknown): string {
  if (typeof texto !== "string") return "";
  const semContatos = redactContacts(texto.slice(0, MAX_CV_TEXTO * 2))
    .replace(/\bhttps?:\/\/\S+/gi, "[LINK]")
    .replace(/\bwww\.\S+/gi, "[LINK]");
  return semContatos
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_CV_TEXTO);
}

/** O consentimento vale pela linha mais recente do tipo. */
export async function cvCompletoLigado(db: Pick<PrismaClient, "consentLog">, userId: string): Promise<boolean> {
  const l = await db.consentLog.findFirst({ where: { userId, tipo: CV_COMPLETO_TIPO }, orderBy: { createdAt: "desc" }, select: { baseLegal: true } });
  return !!l && l.baseLegal !== "revogacao";
}

/**
 * Pedido do candidato ao publicar: `mostrar` liga ou desliga; `texto` (opcional) troca o CV guardado.
 * Ligado sem texto novo mantém o que já estava. Desligado apaga o texto e os resumos.
 * Devolve se ficou com CV guardado.
 */
export async function aplicarCvCompleto(
  db: Db,
  opts: { userId: string; profileId: string; mostrar: boolean; texto?: unknown; idioma: string },
): Promise<boolean> {
  const { userId, profileId, idioma } = opts;
  const ligadoAntes = await cvCompletoLigado(db, userId);
  if (!opts.mostrar) {
    await db.candidateCv.deleteMany({ where: { profileId } });
    if (ligadoAntes) {
      await db.consentLog.create({ data: { userId, tipo: CV_COMPLETO_TIPO, versao: CV_COMPLETO_VERSAO, texto: textoCvCompleto(idioma, true), baseLegal: "revogacao" } });
    }
    return false;
  }
  const texto = limparCv(opts.texto);
  if (texto.length >= 30) {
    // Texto novo: os resumos antigos não valem mais.
    await db.candidateCv.upsert({ where: { profileId }, create: { profileId, texto }, update: { texto, resumos: Prisma.DbNull } });
  }
  if (!ligadoAntes) {
    await db.consentLog.create({ data: { userId, tipo: CV_COMPLETO_TIPO, versao: CV_COMPLETO_VERSAO, texto: textoCvCompleto(idioma), baseLegal: "consentimento" } });
  }
  return !!(await db.candidateCv.findUnique({ where: { profileId }, select: { id: true } }));
}
