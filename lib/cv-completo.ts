/**
 * CV completo da linha do tempo (2026-11-20, D3). O texto só é guardado com o consentimento
 * "cvCompleto" do candidato e sempre limpo: sem e-mail, telefone, links, documentos e endereço.
 * Fica na tabela CandidateCv, separada do perfil, e sai com o perfil (higiene) ou ao desligar.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { redactContacts } from "./ai/redact";
import { CV_COMPLETO_TIPO, CV_COMPLETO_VERSAO, textoCvCompleto } from "./consentimento";

export const MAX_CV_TEXTO = 60_000;

/** Nomes de tecnologia que parecem endereço (asp.net, socket.io): ficam no texto. */
const TECNOLOGIAS_COM_PONTO = new Set(["asp.net", "vb.net", "ado.net", "socket.io", "fly.io", "engine.io", "chart.io", "ionic.io", "render.com", "heroku.com", "netlify.app", "vercel.app", "auth0.com", "segment.io", "mixpanel.com", "github.io", "readme.io"]);

type Db = Pick<PrismaClient, "candidateCv" | "consentLog" | "$transaction">;

/**
 * Endereços e documentos em inglês e espanhol (o redactContacts cobre os formatos do Brasil).
 * Rótulo + valor ("Address: ...", "DNI: ..."), ruas no formato "123 Main Street" e "Calle Mayor 12",
 * e números soltos de DNI, NIE e SSN.
 */
export function semDocumentosEEnderecos(t: string): string {
  return t
    .replace(/\b(?:address|home address|dirección|direccion|domicilio|endereço|endereco|morada)\s*:\s*[^\n]+/gi, "[ENDERECO]")
    .replace(/\b\d{1,5}\s+(?:[A-Z][\w'-]*\s+){1,3}(?:Street|St\.|Avenue|Ave\.|Road|Rd\.|Lane|Ln\.|Drive|Dr\.|Boulevard|Blvd\.?|Way|Court|Ct\.|Place|Square)(?![\w])[^\n]*/g, "[ENDERECO]")
    .replace(/\b(?:Calle|C\/|Avenida|Avda\.|Paseo|Plaza|Carretera|Ronda|Travesía)\s+[^\n,]{2,40},?\s*(?:n[ºo°.]\s*)?(?!(?:19|20)\d{2}\b)\d{1,5}\b[^\n]*/g, "[ENDERECO]")
    .replace(/\b(?:DNI|NIE|NIF|RUT|CURP|RFC|SSN|RG|CPF|CNPJ|CUIL|CUIT|passport(?: number| no\.?)?|pasaporte|passaporte)\s*(?:n[ºo°.]\s*)?[:#]?\s*[A-Z0-9][A-Z0-9.\-/]{4,}/gi, "[DOCUMENTO]")
    .replace(/\b(?:\d{8}[A-HJ-NP-TV-Z]|[XYZ]\d{7}[A-Z]|\d{3}-\d{2}-\d{4})\b/g, "[DOCUMENTO]")
    // Telefones (só na mesma linha) internacionais em grupos (+34 612 345 678, +44 7700 900123, +1 (415) 555-0100) e locais da Espanha e do Reino Unido.
    // Números de resultado (+12.000.000, +10 000 000) ficam: milhar com ponto ou vírgula, ou menos de 10 dígitos.
    .replace(/\+\d{1,3}(?:[ \t.-]?\(?\d{1,5}\)?){2,6}/g, (m) =>
      m.replace(/\D/g, "").length >= 10 && !/^\+\d{1,3}(?:[.,]\d{3})+$/.test(m) ? "[TELEFONE]" : m,
    )
    .replace(/(?<![\d.,])(?:[6789]\d{2}[ \t-]\d{3}[ \t-]\d{3}|[6789]\d{2}[ \t-]\d{2}[ \t-]\d{2}[ \t-]\d{2}|0\d{4}[ \t-]?\d{6})(?![\d.,])/g, "[TELEFONE]");
}

/** Texto do CV pronto para guardar: contatos e qualquer link trocados por marcadores, espaços arrumados. */
export function limparCv(texto: unknown): string {
  if (typeof texto !== "string") return "";
  const semContatos = redactContacts(semDocumentosEEnderecos(texto.slice(0, MAX_CV_TEXTO * 2)))
    .replace(/\bhttps?:\/\/\S+/gi, "[LINK]")
    .replace(/\bwww\.\S+/gi, "[LINK]")
    // Sem http nem www: domínio com caminho (ana.dev/portfolio) ou com terminação comum (blog.ana.com).
    // Só minúsculas na terminação, para não pegar ASP.NET; Node.js e Vue.js não estão na lista.
    .replace(/(?<![\w@.[-])(?:[a-z0-9-]+\.)+[a-z]{2,}\/\S*/gi, "[LINK]")
    .replace(/(?<![\w@.[-])(?:[a-z0-9-]+\.)+(?:com|net|org|dev|io|me|app|br|pt|es|co|ai|xyz|tech|site|info|page|link|online|blog|cloud)\b(?![\w-]|\.\w)/g, (m) =>
      TECNOLOGIAS_COM_PONTO.has(m) ? m : "[LINK]",
    );
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
  const guardado = texto.length >= 30 ? await db.candidateCv.findUnique({ where: { profileId }, select: { texto: true } }) : null;
  if (texto.length >= 30 && guardado?.texto !== texto) {
    // Texto novo: os resumos antigos não valem mais. O mesmo texto de novo mantém os resumos.
    await db.candidateCv.upsert({ where: { profileId }, create: { profileId, texto }, update: { texto, resumos: Prisma.DbNull } });
  }
  if (!ligadoAntes) {
    await db.consentLog.create({ data: { userId, tipo: CV_COMPLETO_TIPO, versao: CV_COMPLETO_VERSAO, texto: textoCvCompleto(idioma), baseLegal: "consentimento" } });
  }
  return !!(await db.candidateCv.findUnique({ where: { profileId }, select: { id: true } }));
}

// ── Para o recrutador (PR c) ───────────────────────────────────────────────

/** Ids dos perfis (entre os pedidos) que têm CV completo guardado. */
export async function perfisComCv(db: Pick<PrismaClient, "candidateCv">, ids: string[]): Promise<Set<string>> {
  const unicos = [...new Set(ids.filter((x) => typeof x === "string" && x))];
  if (!unicos.length) return new Set();
  const rows = await db.candidateCv.findMany({ where: { profileId: { in: unicos } }, select: { profileId: true } });
  return new Set(rows.map((r) => r.profileId));
}

type DbLeitura = Pick<PrismaClient, "candidateCv" | "candidateProfile" | "consentLog">;

/**
 * CV completo de um perfil ativo, só enquanto o consentimento continua ligado. Null em qualquer outro caso
 * (sem texto, perfil fora do ar ou consentimento revogado): a tela diz só que não está disponível.
 */
export async function cvDoPerfil(
  db: DbLeitura,
  profileId: string,
  now: Date = new Date(),
): Promise<{ texto: string; resumos: unknown; experiencias: unknown; userId: string } | null> {
  const p = await db.candidateProfile.findFirst({
    where: { id: profileId, status: "ativo", expiresAt: { gt: now } },
    select: { userId: true, experiencias: true, cv: { select: { texto: true, resumos: true } } },
  });
  if (!p?.cv) return null;
  if (!(await cvCompletoLigado(db, p.userId))) return null;
  return { texto: p.cv.texto, resumos: p.cv.resumos, experiencias: p.experiencias, userId: p.userId };
}
