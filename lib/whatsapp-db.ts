/**
 * 3.5a Canal WhatsApp no banco (plano https://claude.ai/artifact/B1kcRjUJ5emNK2W4Xu9WSW). Ver lib/whatsapp.ts.
 * - D3: em Minha conta a pessoa digita o celular, recebe um código de 6 dígitos (modelo de autenticação),
 *   confirma e aceita o texto de consentimento (ConsentLog tipo "whatsapp", versionado). Desligado por padrão.
 *   Guardamos só o SHA-256 do código; vale 10 minutos e 5 tentativas; até 3 códigos por conta por dia.
 * - D4: desligar em Minha conta vale na hora (e avisos ainda na fila não saem).
 * - D5: até 3 avisos por dia por pessoa; do mesmo tipo no mesmo dia, um só (WhatsappAviso único por
 *   candidato + tipo + dia de Brasília); fora das 8h–20h o aviso espera na fila até as 8h.
 * - D6: a fila leva só o id do aviso; a entrega confere de novo se a pessoa ainda quer e monta o texto.
 *   O e-mail nunca deixa de sair: quem chama põe o e-mail primeiro e o WhatsApp nunca lança.
 * 3.5b: `tratarRecebidas` (webhook da Meta): SAIR desliga na hora; outra mensagem ganha uma resposta automática.
 */
import type { PrismaClient } from "@prisma/client";
import type { MensagemWhatsapp, ResultadoEntrega } from "./fila";
import { CONSENTIMENTO_WHATSAPP_VERSAO, textoConsentimento } from "./consentimento";
import { chaveUso, consumirUso } from "./uso-diario";
import { timingSafeEqualStr } from "./secret";
import {
  AVISOS_POR_DIA,
  CAMINHO_AVISO,
  CODIGOS_POR_DIA,
  CODIGO_MAX_TENTATIVAS,
  CODIGO_VALIDADE_MS,
  MODELOS,
  WHATSAPP_MAX_TENTATIVAS,
  codigoExpirado,
  configDoAmbiente,
  corpoModelo,
  corpoTexto,
  destinoPermitido,
  diaDoAviso,
  ehPedidoDeSair,
  enviarWhatsapp,
  formatoCodigo,
  gerarCodigo6,
  hashCodigoWhatsapp,
  idiomaPeloNumero,
  idiomaWhatsapp,
  mascararNumero,
  modoTeste,
  normalizarNumero,
  segundosAteJanela,
  textoAutoResposta,
  textoConfirmaSair,
  variantesDoNumero,
  type ConfigWhatsapp,
  type MotivoNumero,
  type Recebida,
  type TipoAviso,
} from "./whatsapp";

type Db = PrismaClient;
export type EnfileirarWhatsapp = (m: MensagemWhatsapp, delaySeconds?: number) => Promise<void>;
/** Linhas de aviso mais velhas que isto saem no Cron diário. */
export const AVISOS_GUARDA_DIAS = 30;
const DIA_MS = 86_400_000;

const PERFIL_WA = {
  id: true,
  userId: true,
  celular: true,
  idiomaOriginal: true,
  whatsappOpt: true,
  whatsappNumero: true,
  whatsappVerificadoEm: true,
  whatsappCodigoHash: true,
  whatsappCodigoNumero: true,
  whatsappCodigoExpira: true,
  whatsappCodigoTentativas: true,
} as const;

type PerfilWa = { whatsappOpt: boolean; whatsappNumero: string | null; whatsappVerificadoEm: Date | null };

/** Avisos só com o interruptor ligado e o número confirmado. */
export function whatsappLigado(p: PerfilWa | null | undefined): p is PerfilWa & { whatsappNumero: string } {
  return !!p && p.whatsappOpt && !!p.whatsappVerificadoEm && !!p.whatsappNumero;
}

// ---------------------------------------------------------------------------------------------
// Minha conta (D3, D4)
// ---------------------------------------------------------------------------------------------

export type EstadoWhatsapp = {
  /** Sem ficha ainda não há onde guardar o número. */
  temFicha: boolean;
  ligado: boolean;
  /** Número confirmado (da própria pessoa). */
  numero: string | null;
  /** Sugestão para o campo: o celular da ficha. */
  sugestao: string | null;
  /** Código pedido e ainda válido. */
  pendente: { numero: string; expiraEm: string } | null;
  modoTeste: boolean;
};

export async function estadoWhatsapp(db: Db, userId: string, now = new Date(), cfg: ConfigWhatsapp = configDoAmbiente()): Promise<EstadoWhatsapp> {
  const p = await db.candidateProfile.findUnique({ where: { userId }, select: PERFIL_WA });
  const teste = modoTeste(cfg);
  if (!p) return { temFicha: false, ligado: false, numero: null, sugestao: null, pendente: null, modoTeste: teste };
  const pend =
    p.whatsappCodigoHash && p.whatsappCodigoNumero && !codigoExpirado(p.whatsappCodigoExpira, now) && p.whatsappCodigoTentativas < CODIGO_MAX_TENTATIVAS
      ? { numero: p.whatsappCodigoNumero, expiraEm: p.whatsappCodigoExpira!.toISOString() }
      : null;
  return {
    temFicha: true,
    ligado: whatsappLigado(p),
    numero: whatsappLigado(p) ? p.whatsappNumero : null,
    sugestao: p.celular ?? null,
    pendente: pend,
    modoTeste: teste,
  };
}

export type ErroCodigo = "sem_ficha" | "limite" | "envio" | MotivoNumero;

export type OpcoesWa = { cfg?: ConfigWhatsapp; fetch?: typeof fetch; now?: Date; gerar?: () => string };

/** Pede um código para o número. No modo teste, guarda o pedido mas nada sai (D7). */
export async function pedirCodigo(
  db: Db,
  userId: string,
  numeroBruto: unknown,
  idioma: string | null | undefined,
  opts: OpcoesWa = {},
): Promise<{ ok: true; numero: string; expiraEm: string; modoTeste: boolean } | { ok: false; erro: ErroCodigo }> {
  const now = opts.now ?? new Date();
  const cfg = opts.cfg ?? configDoAmbiente();
  const n = normalizarNumero(numeroBruto);
  if (!n.ok) return { ok: false, erro: n.motivo };
  const p = await db.candidateProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!p) return { ok: false, erro: "sem_ficha" };
  const uso = await consumirUso(db, await chaveUso("wa-codigo", userId), CODIGOS_POR_DIA, now);
  if (!uso.permitido) return { ok: false, erro: "limite" };
  const codigo = (opts.gerar ?? gerarCodigo6)();
  const expira = new Date(now.getTime() + CODIGO_VALIDADE_MS);
  await db.candidateProfile.update({
    where: { id: p.id },
    data: {
      whatsappCodigoHash: await hashCodigoWhatsapp(p.id, n.numero, codigo),
      whatsappCodigoNumero: n.numero,
      whatsappCodigoExpira: expira,
      whatsappCodigoTentativas: 0,
    },
  });
  const teste = modoTeste(cfg) || !destinoPermitido(cfg, n.numero);
  if (teste) {
    console.log(`[whatsapp] modo teste: código para ${mascararNumero(n.numero)} não enviado.`);
  } else {
    const r = await enviarWhatsapp(cfg, corpoModelo({ numero: n.numero, modelo: MODELOS.codigo, idioma: idiomaWhatsapp(idioma), codigo }), opts.fetch);
    if (r.resultado !== "ok") {
      console.error(`[whatsapp] código para ${mascararNumero(n.numero)} não saiu (${r.status ?? r.erro}).`);
      return { ok: false, erro: "envio" };
    }
  }
  return { ok: true, numero: n.numero, expiraEm: expira.toISOString(), modoTeste: teste };
}

export type ErroConfirmar = "sem_ficha" | "sem_pedido" | "expirado" | "tentativas" | "codigo" | "consentimento";

/**
 * Confere o código. Cada tentativa conta antes de comparar (5 no máximo); certo, liga os avisos para o
 * número do pedido e grava o consentimento no ConsentLog com o texto no idioma da pessoa.
 */
export async function confirmarCodigo(
  db: Db,
  userId: string,
  codigo: unknown,
  aceite: unknown,
  idioma: string | null | undefined,
  now = new Date(),
): Promise<{ ok: true; numero: string } | { ok: false; erro: ErroConfirmar }> {
  if (aceite !== true) return { ok: false, erro: "consentimento" };
  const p = await db.candidateProfile.findUnique({ where: { userId }, select: PERFIL_WA });
  if (!p) return { ok: false, erro: "sem_ficha" };
  if (!p.whatsappCodigoHash || !p.whatsappCodigoNumero) return { ok: false, erro: "sem_pedido" };
  if (codigoExpirado(p.whatsappCodigoExpira, now)) return { ok: false, erro: "expirado" };
  // Conta a tentativa de forma atômica: pedidos em paralelo não passam das 5.
  const conta = await db.candidateProfile.updateMany({
    where: { id: p.id, whatsappCodigoHash: p.whatsappCodigoHash, whatsappCodigoTentativas: { lt: CODIGO_MAX_TENTATIVAS } },
    data: { whatsappCodigoTentativas: { increment: 1 } },
  });
  if (conta.count === 0) return { ok: false, erro: "tentativas" };
  const numero = p.whatsappCodigoNumero;
  const certo = formatoCodigo(codigo) && timingSafeEqualStr(await hashCodigoWhatsapp(p.id, numero, codigo), p.whatsappCodigoHash);
  if (!certo) return { ok: false, erro: p.whatsappCodigoTentativas + 1 >= CODIGO_MAX_TENTATIVAS ? "tentativas" : "codigo" };
  const ligou = await db.$transaction(async (tx) => {
    // Só quem ainda tem este código pendente liga (duas abas não gravam o consentimento duas vezes).
    const r = await tx.candidateProfile.updateMany({
      where: { id: p.id, whatsappCodigoHash: p.whatsappCodigoHash },
      data: {
        whatsappNumero: numero,
        whatsappOpt: true,
        whatsappVerificadoEm: now,
        whatsappCodigoHash: null,
        whatsappCodigoNumero: null,
        whatsappCodigoExpira: null,
        whatsappCodigoTentativas: 0,
      },
    });
    if (r.count === 0) return false;
    await tx.consentLog.create({
      data: { userId, tipo: "whatsapp", versao: CONSENTIMENTO_WHATSAPP_VERSAO, texto: textoConsentimento("whatsapp", idioma ?? "pt-BR"), baseLegal: "consentimento", createdAt: now },
    });
    return true;
  });
  if (!ligou) return { ok: false, erro: "sem_pedido" };
  return { ok: true, numero };
}

/**
 * Desliga na hora (botão em Minha conta; SAIR no 3.5b). Apaga o número e o código pendente; avisos ainda
 * na fila ficam "desligado" e não saem. Ligar de novo pede outro código e outro aceite.
 */
export async function desligarWhatsapp(db: Db, quem: { userId: string } | { candidateId: string }): Promise<boolean> {
  const where = "userId" in quem ? { userId: quem.userId } : { id: quem.candidateId };
  const p = await db.candidateProfile.findFirst({ where, select: { id: true, whatsappOpt: true, whatsappNumero: true } });
  if (!p) return false;
  await db.$transaction([
    db.candidateProfile.update({
      where: { id: p.id },
      data: {
        whatsappOpt: false,
        whatsappNumero: null,
        whatsappVerificadoEm: null,
        whatsappCodigoHash: null,
        whatsappCodigoNumero: null,
        whatsappCodigoExpira: null,
        whatsappCodigoTentativas: 0,
      },
    }),
    db.whatsappAviso.updateMany({ where: { candidateId: p.id, status: { in: ["fila", "enviando"] } }, data: { status: "desligado" } }),
  ]);
  return p.whatsappOpt || !!p.whatsappNumero;
}

// ---------------------------------------------------------------------------------------------
// Avisos (D2, D5)
// ---------------------------------------------------------------------------------------------

export type ResultadoAviso = "fila" | "junto" | "limite" | "desligado" | "erro";

const ENVIANDO_EXPIRA_MS = 2 * 60_000;

function ehUnico(e: unknown): boolean {
  return (e as { code?: string })?.code === "P2002";
}

/**
 * Põe um aviso na fila, se a pessoa quiser. Do mesmo tipo no mesmo dia, junta com o que já existe
 * (o assunto passa a ser o mais novo, se ainda não saiu). Até 3 por dia. Nunca lança.
 */
export async function avisarWhatsapp(
  db: Db,
  a: { candidateId: string; tipo: TipoAviso; refId: string },
  enqueue: EnfileirarWhatsapp,
  now = new Date(),
): Promise<ResultadoAviso> {
  try {
    const p = await db.candidateProfile.findUnique({ where: { id: a.candidateId }, select: { whatsappOpt: true, whatsappNumero: true, whatsappVerificadoEm: true } });
    if (!whatsappLigado(p)) return "desligado";
    const dia = diaDoAviso(now);
    const chave = { candidateId_tipo_dia: { candidateId: a.candidateId, tipo: a.tipo, dia } };
    const existe = await db.whatsappAviso.findUnique({ where: chave, select: { id: true, status: true } });
    if (existe) {
      if (existe.status === "fila") await db.whatsappAviso.updateMany({ where: { id: existe.id, status: "fila" }, data: { refId: a.refId } });
      return "junto";
    }
    const doDia = () => db.whatsappAviso.count({ where: { candidateId: a.candidateId, dia, status: { not: "desligado" } } });
    if ((await doDia()) >= AVISOS_POR_DIA) return "limite";
    let id: string;
    try {
      id = (await db.whatsappAviso.create({ data: { candidateId: a.candidateId, tipo: a.tipo, refId: a.refId, dia, createdAt: now }, select: { id: true } })).id;
    } catch (e) {
      if (ehUnico(e)) return "junto";
      throw e;
    }
    // Confere depois de gravar: dois avisos ao mesmo tempo não passam de 3.
    if ((await doDia()) > AVISOS_POR_DIA) {
      await db.whatsappAviso.deleteMany({ where: { id } });
      return "limite";
    }
    try {
      await enqueue({ tipo: "whatsapp", avisoId: id, aviso: a.tipo }, segundosAteJanela(now));
    } catch (e) {
      await db.whatsappAviso.deleteMany({ where: { id } });
      console.error(`[whatsapp] aviso ${a.tipo} não entrou na fila:`, e instanceof Error ? e.message : e);
      return "erro";
    }
    return "fila";
  } catch (e) {
    console.error(`[whatsapp] aviso ${a.tipo} falhou:`, e instanceof Error ? e.name : e);
    return "erro";
  }
}

/** Aviso sobre uma candidatura (vista, etapa, entrevista). Nunca lança. */
export async function avisarPelaCandidatura(
  db: Db,
  applicationId: string,
  tipo: Extract<TipoAviso, "vista" | "etapa" | "entrevista">,
  enqueue: EnfileirarWhatsapp,
  now = new Date(),
): Promise<ResultadoAviso> {
  try {
    const app = await db.application.findUnique({ where: { id: applicationId }, select: { candidateId: true } });
    if (!app) return "desligado";
    return await avisarWhatsapp(db, { candidateId: app.candidateId, tipo, refId: applicationId }, enqueue, now);
  } catch (e) {
    console.error(`[whatsapp] aviso ${tipo} falhou:`, e instanceof Error ? e.name : e);
    return "erro";
  }
}

/** A equipe respondeu a conversa de uma conta de candidato. Nunca lança. */
export async function avisarAtendimento(db: Db, userId: string | null, conversaId: string, enqueue: EnfileirarWhatsapp, now = new Date()): Promise<ResultadoAviso> {
  if (!userId) return "desligado";
  try {
    const p = await db.candidateProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!p) return "desligado";
    return await avisarWhatsapp(db, { candidateId: p.id, tipo: "atendimento", refId: conversaId }, enqueue, now);
  } catch (e) {
    console.error("[whatsapp] aviso de atendimento falhou:", e instanceof Error ? e.name : e);
    return "erro";
  }
}

/**
 * Cron diário: vagas que a pessoa aprovou e ainda não enviou, vencendo entre 24 e 48 horas a partir de
 * agora (o Cron roda uma vez por dia, então cada vaga entra uma vez). Um aviso por pessoa, sobre a que
 * vence primeiro. Também apaga as linhas de aviso com mais de 30 dias.
 */
export async function avisarAprovadasVencendo(db: Db, enqueue: EnfileirarWhatsapp, now = new Date()): Promise<{ avisos: number; apagados: number }> {
  const { count: apagados } = await db.whatsappAviso.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - AVISOS_GUARDA_DIAS * DIA_MS) } } });
  const rows = await db.applicationApproval.findMany({
    where: {
      candidate: { whatsappOpt: true, whatsappVerificadoEm: { not: null }, whatsappNumero: { not: null } },
      vacancy: { status: "ativa", expiresAt: { gte: new Date(now.getTime() + DIA_MS), lt: new Date(now.getTime() + 2 * DIA_MS) } },
    },
    select: { candidateId: true, vacancyId: true, vacancy: { select: { expiresAt: true } } },
    orderBy: { vacancy: { expiresAt: "asc" } },
    take: 2000,
  });
  if (!rows.length) return { avisos: 0, apagados };
  const enviadas = await db.application.findMany({
    where: { OR: rows.map((r) => ({ candidateId: r.candidateId, vacancyId: r.vacancyId })) },
    select: { candidateId: true, vacancyId: true },
  });
  const ja = new Set(enviadas.map((e) => `${e.candidateId}|${e.vacancyId}`));
  const porPessoa = new Map<string, string>();
  for (const r of rows) if (!ja.has(`${r.candidateId}|${r.vacancyId}`) && !porPessoa.has(r.candidateId)) porPessoa.set(r.candidateId, r.vacancyId);
  let avisos = 0;
  for (const [candidateId, vacancyId] of porPessoa) {
    if ((await avisarWhatsapp(db, { candidateId, tipo: "aprovadas", refId: vacancyId }, enqueue, now)) === "fila") avisos++;
  }
  return { avisos, apagados };
}

// ---------------------------------------------------------------------------------------------
// Entrega (D6, D7)
// ---------------------------------------------------------------------------------------------

/** Textos do modelo, montados na hora: nome da vaga e da empresa (ou nada). null = o assunto sumiu. */
async function textosDoAviso(db: Db, a: { tipo: string; refId: string; candidateId: string; userId: string }, now: Date): Promise<string[] | null> {
  if (a.tipo === "vista" || a.tipo === "etapa" || a.tipo === "entrevista") {
    const app = await db.application.findFirst({
      where: { id: a.refId, candidateId: a.candidateId },
      select: { vacancy: { select: { titulo: true } }, company: { select: { nome: true } } },
    });
    if (!app?.vacancy) return null;
    return [app.vacancy.titulo, app.company.nome];
  }
  if (a.tipo === "aprovadas") {
    const ap = await db.applicationApproval.findUnique({
      where: { candidateId_vacancyId: { candidateId: a.candidateId, vacancyId: a.refId } },
      select: { vacancy: { select: { titulo: true, status: true, expiresAt: true, company: { select: { nome: true } } } } },
    });
    if (!ap || ap.vacancy.status !== "ativa" || ap.vacancy.expiresAt.getTime() <= now.getTime()) return null;
    const enviada = await db.application.count({ where: { candidateId: a.candidateId, vacancyId: a.refId } });
    if (enviada) return null;
    return [ap.vacancy.titulo, ap.vacancy.company.nome];
  }
  if (a.tipo === "atendimento") {
    const c = await db.conversa.findFirst({ where: { id: a.refId, userId: a.userId }, select: { id: true } });
    return c ? [] : null;
  }
  return null;
}

export type OpcoesEntregaWa = { cfg?: ConfigWhatsapp; fetch?: typeof fetch; now?: Date };

/**
 * Entrega um aviso. Já entregue (fila repetida): ok sem enviar. Pessoa desligou no meio do caminho:
 * desiste. Fora do horário: volta para a fila até as 8h. Sem os segredos da Meta: "modo teste", ok.
 */
export async function entregarAviso(db: Db, m: MensagemWhatsapp, tentativa: number, opts: OpcoesEntregaWa = {}): Promise<ResultadoEntrega> {
  const now = opts.now ?? new Date();
  const cfg = opts.cfg ?? configDoAmbiente();
  const a = await db.whatsappAviso.findUnique({
    where: { id: m.avisoId },
    select: {
      id: true, tipo: true, refId: true, status: true, candidateId: true, dia: true, tentativas: true, updatedAt: true,
      candidate: { select: { userId: true, idiomaOriginal: true, whatsappOpt: true, whatsappNumero: true, whatsappVerificadoEm: true } },
    },
  });
  if (!a) return { resultado: "desistir", erro: "aviso_apagado" };
  // "enviando" parado há mais de 2 minutos = a entrega anterior caiu no meio: pode tentar de novo.
  const limiteEnviando = new Date(now.getTime() - ENVIANDO_EXPIRA_MS);
  const enviandoParado = a.status === "enviando" && a.updatedAt < limiteEnviando;
  if (a.status !== "fila" && !enviandoParado) return { resultado: a.status === "desligado" ? "desistir" : "ok", erro: a.status };
  const grava = (status: string, erro: string | null, extra: Record<string, unknown> = {}) =>
    db.whatsappAviso.update({ where: { id: a.id }, data: { status, erro, tentativas: { increment: 1 }, ...extra } });

  if (!whatsappLigado(a.candidate)) {
    await db.whatsappAviso.update({ where: { id: a.id }, data: { status: "desligado" } });
    return { resultado: "desistir", erro: "desligado" };
  }
  const espera = segundosAteJanela(now);
  if (espera > 0) return { resultado: "repetir", erro: "fora_do_horario", atrasoSeg: espera };

  // Aviso que ficou para outro dia (falha perto das 20h, fila atrasada): passa a contar no dia de hoje,
  // com o mesmo limite de 3 por dia e um por tipo (D5). Se hoje já tem um do mesmo tipo ou já bateu 3, desiste.
  const hoje = diaDoAviso(now);
  if (a.dia !== hoje) {
    try {
      const { count } = await db.whatsappAviso.updateMany({ where: { id: a.id, status: { in: ["fila", "enviando"] } }, data: { dia: hoje } });
      if (!count) return { resultado: "ok", erro: "ja_tratado" };
    } catch (e) {
      if (!ehUnico(e)) throw e;
      await grava("desistiu", "junto");
      return { resultado: "desistir", erro: "junto" };
    }
    const doDia = await db.whatsappAviso.count({ where: { candidateId: a.candidateId, dia: hoje, status: { not: "desligado" } } });
    if (doDia > AVISOS_POR_DIA) {
      await grava("desistiu", "limite");
      return { resultado: "desistir", erro: "limite" };
    }
  }

  // Reserva o aviso antes de enviar: duas entregas ao mesmo tempo não mandam duas vezes.
  const reservado = await db.whatsappAviso.updateMany({
    where: { id: a.id, OR: [{ status: "fila" }, { status: "enviando", updatedAt: { lt: limiteEnviando } }] },
    data: { status: "enviando", updatedAt: now },
  });
  if (!reservado.count) return { resultado: "ok", erro: "ja_tratado" };

  const tipo = a.tipo as TipoAviso;
  const textos = await textosDoAviso(db, { tipo, refId: a.refId, candidateId: a.candidateId, userId: a.candidate.userId }, now);
  if (!textos) {
    await grava("desistiu", "sem_assunto");
    return { resultado: "desistir", erro: "sem_assunto" };
  }
  const numero = a.candidate.whatsappNumero;
  if (modoTeste(cfg) || !destinoPermitido(cfg, numero)) {
    const motivo = modoTeste(cfg) ? "modo_teste" : "fora_da_lista_teste";
    console.log(`[whatsapp] ${motivo}: aviso ${tipo} para ${mascararNumero(numero)} não enviado.`);
    await grava("modo_teste", motivo === "modo_teste" ? null : motivo);
    return { resultado: "ok", erro: motivo };
  }
  const corpo = corpoModelo({
    numero,
    modelo: MODELOS[tipo],
    idioma: idiomaWhatsapp(a.candidate.idiomaOriginal),
    textos,
    botaoUrl: tipo === "aprovadas" ? `${CAMINHO_AVISO.aprovadas}?v=${encodeURIComponent(a.refId)}` : CAMINHO_AVISO[tipo],
  });
  const r = await enviarWhatsapp(cfg, corpo, opts.fetch);
  if (r.resultado === "ok") {
    await grava("enviado", null, { enviadoEm: now });
    return { resultado: "ok", status: r.status };
  }
  // Conta as tentativas de envio de verdade (a.tentativas) também: a espera da noite volta à fila como mensagem nova.
  const ultima = r.resultado === "desistir" || tentativa >= WHATSAPP_MAX_TENTATIVAS || a.tentativas + 1 >= WHATSAPP_MAX_TENTATIVAS;
  await grava(ultima ? "desistiu" : "fila", r.erro ?? null);
  return { resultado: r.resultado, status: r.status, erro: r.erro ?? null };
}

// ---------------------------------------------------------------------------------------------
// Recebidas (3.5b, D4)
// ---------------------------------------------------------------------------------------------

export type ResultadoRecebida = "desligou" | "sair_sem_conta" | "respondida" | "ja_respondida" | "ignorada";

/**
 * Trata as mensagens que chegaram ao número do W2Talent (webhook da Meta, já com a assinatura conferida).
 * SAIR/STOP/PARAR/SALIR desliga na hora e confirma (uma vez por dia). Qualquer outra mensagem ganha UMA
 * resposta automática por dia por número ("este número só envia avisos; use o site"), no idioma da pessoa
 * quando ela tem conta. Sem IA. O texto recebido não é guardado nem vai para o log.
 */
export async function tratarRecebidas(
  db: Db,
  recebidas: Recebida[],
  opts: { cfg?: ConfigWhatsapp; fetch?: typeof fetch; now?: Date } = {},
): Promise<ResultadoRecebida[]> {
  const now = opts.now ?? new Date();
  const cfg = opts.cfg ?? configDoAmbiente();
  const out: ResultadoRecebida[] = [];
  for (const r of recebidas) {
    const variantes = variantesDoNumero(r.de);
    if (!variantes.length) {
      out.push("ignorada");
      continue;
    }
    // O mesmo número pode estar ligado em mais de uma conta: SAIR desliga todas.
    const perfis = await db.candidateProfile.findMany({
      where: { whatsappNumero: { in: variantes } },
      select: { id: true, idiomaOriginal: true },
      orderBy: { createdAt: "asc" },
    });
    const p = perfis[0];
    const idioma = p ? idiomaWhatsapp(p.idiomaOriginal) : idiomaPeloNumero(variantes[0]);
    const sair = ehPedidoDeSair(r.texto);
    if (sair) for (const x of perfis) await desligarWhatsapp(db, { candidateId: x.id });
    // Uma resposta por dia por número (e uma confirmação de SAIR): a contagem usa só o hash do número.
    const uso = await consumirUso(db, await chaveUso(sair ? "wa-sair" : "wa-auto", r.de), 1, now);
    const resultado: ResultadoRecebida = sair ? (p ? "desligou" : "sair_sem_conta") : uso.permitido ? "respondida" : "ja_respondida";
    out.push(resultado);
    if (!uso.permitido) continue;
    const texto = sair ? textoConfirmaSair(idioma) : textoAutoResposta(idioma);
    const numero = `+${r.de}`;
    if (modoTeste(cfg) || !destinoPermitido(cfg, numero)) {
      console.log(`[whatsapp] modo teste: resposta para ${mascararNumero(numero)} não enviada.`);
      continue;
    }
    const e = await enviarWhatsapp(cfg, corpoTexto(numero, texto), opts.fetch);
    if (e.resultado !== "ok") console.error(`[whatsapp] resposta para ${mascararNumero(numero)} não saiu (${e.status ?? e.erro}).`);
  }
  return out;
}
