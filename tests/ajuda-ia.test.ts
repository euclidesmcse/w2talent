/**
 * 2.6a-2 perguntas na Ajuda. As partes puras rodam sempre; as do banco só num Postgres local
 * (com pgvector, como o do CI). O embedder e a IA são falsos.
 */
import type { PrismaClient } from "@prisma/client";
import {
  CORTE_SIMILARIDADE,
  emailParaEquipe,
  emailValido,
  garantirIndice,
  lerRespostaIa,
  perguntaValida,
  perguntarAjuda,
  trechosDoIdioma,
  type ChatAjudaFn,
} from "../lib/ajuda-ia";
import type { Embedder } from "../lib/embeddings";
import { chaveUso, consumirUso, LIMITE_PERGUNTAS_AJUDA_DIA } from "../lib/uso-diario";

const IDIOMAS = ["pt-BR", "en", "es"] as const;

/** Vetor de "saco de palavras": textos iguais dão 1, sem palavras em comum dão 0. */
function vetor(texto: string): number[] {
  const v = new Array(1024).fill(0);
  for (const w of texto.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []) {
    let h = 0;
    for (const c of w) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    v[h % 1024] += 1;
  }
  const n = Math.hypot(...v) || 1;
  return v.map((x) => x / n);
}
const embed: Embedder = async (texts) => texts.map(vetor);

describe("trechos da ajuda", () => {
  it("cada artigo vira trechos por seção, sem sintaxe de link", () => {
    for (const l of IDIOMAS) {
      const t = trechosDoIdioma(l);
      expect(t.length).toBeGreaterThan(15);
      expect(new Set(t.map((x) => `${x.slug}#${x.ordem}`)).size).toBe(t.length);
      for (const x of t) {
        expect(x.texto).not.toMatch(/\]\(\//);
        expect(x.texto.startsWith(x.titulo)).toBe(true);
      }
    }
  });

  it("valida pergunta e e-mail", () => {
    expect(perguntaValida("oi")).toBe(false);
    expect(perguntaValida("Como envio?")).toBe(true);
    expect(perguntaValida("x".repeat(501))).toBe(false);
    expect(emailValido("ana@exemplo.com")).toBe(true);
    expect(emailValido("ana@exemplo")).toBe(false);
    expect(emailValido("<a>@x.com")).toBe(false);
  });

  it("lê o JSON da IA: respondido=false ou vazio é descartado e a fonte nunca falta", () => {
    expect(lerRespostaIa('{"respondido":false,"resposta":"chute","fontes":[1]}', 4)).toBeNull();
    expect(lerRespostaIa('{"respondido":true,"resposta":"  ","fontes":[1]}', 4)).toBeNull();
    expect(lerRespostaIa("não é json", 4)).toBeNull();
    expect(lerRespostaIa('{"respondido":true,"resposta":"Sim.","fontes":[9,0,"2"]}', 4)).toEqual({ resposta: "Sim.", fontes: [1] });
    expect(lerRespostaIa('{"respondido":true,"resposta":"Sim.","fontes":[2,2,3]}', 4)).toEqual({ resposta: "Sim.", fontes: [2, 3] });
  });

  it("e-mail para a equipe: escapa HTML, tira contatos da pergunta e leva o e-mail de quem perguntou", async () => {
    const m = await emailParaEquipe({ pergunta: "<b>oi</b> me liga 11 99999-0000", email: "ana@exemplo.com", locale: "pt-BR", tela: "/vagas" }, "contato@w2talent.com");
    expect(m.to).toBe("contato@w2talent.com");
    expect(m.html).toContain("&lt;b&gt;");
    expect(m.html).not.toContain("<b>oi");
    expect(m.text).not.toContain("99999");
    expect(m.text).toContain("ana@exemplo.com");
    expect(m.idempotencyKey.length).toBeLessThan(100);
  });
});

function localDb(url: string | undefined): boolean {
  try {
    return !!url && ["localhost", "127.0.0.1"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}
const describeDb = localDb(process.env.DATABASE_URL) ? describe : describe.skip;

describeDb("perguntas na ajuda (banco)", () => {
  let db: PrismaClient;
  beforeAll(async () => {
    const { createPrismaClient } = await import("../lib/prisma");
    db = createPrismaClient(process.env.DATABASE_URL!);
    await db.ajudaTrecho.deleteMany();
  });
  beforeEach(async () => {
    await db.perguntaSemResposta.deleteMany();
  });
  afterAll(async () => {
    await db?.$disconnect();
  });

  it("monta o índice uma vez por versão", async () => {
    expect(await garantirIndice(db, "pt-BR", embed)).toBe(true);
    expect(await garantirIndice(db, "pt-BR", embed)).toBe(false);
    expect(await db.ajudaTrecho.count({ where: { idioma: "pt-BR" } })).toBe(trechosDoIdioma("pt-BR").length);
  });

  it("abaixo do corte a IA não é chamada e a pergunta fica guardada", async () => {
    const chat = jest.fn<ReturnType<ChatAjudaFn>, Parameters<ChatAjudaFn>>();
    const r = await perguntarAjuda(db, { pergunta: "xyzzy plugh quux", locale: "pt-BR", tela: "/vagas" }, { embed, chat });
    expect(chat).not.toHaveBeenCalled();
    expect(r.tipo).toBe("sem_resposta");
    const salvo = await db.perguntaSemResposta.findFirstOrThrow();
    expect(salvo).toMatchObject({ motivo: "sem_trecho", tela: "/vagas", idioma: "pt-BR", enviadaEquipe: false });
    expect(salvo.similaridade ?? 0).toBeLessThan(CORTE_SIMILARIDADE);
  });

  it("responde com fonte quando a IA acha nos trechos", async () => {
    const alvo = trechosDoIdioma("pt-BR").find((t) => t.slug === "match" && t.ordem === 0)!;
    const chat: ChatAjudaFn = async () => ({ text: '{"respondido":true,"resposta":"É uma conta com pesos fixos.","fontes":[]}' });
    const r = await perguntarAjuda(db, { pergunta: alvo.texto.slice(0, 400), locale: "pt-BR" }, { embed, chat });
    expect(r).toEqual({ tipo: "resposta", resposta: "É uma conta com pesos fixos.", fontes: [{ slug: "match", titulo: alvo.titulo, secao: alvo.secao }] });
    expect(await db.perguntaSemResposta.count()).toBe(0);
  });

  it("descarta quando a IA diz que não sabe, e quando ela falha", async () => {
    const alvo = trechosDoIdioma("pt-BR")[0];
    const naoSabe: ChatAjudaFn = async () => ({ text: '{"respondido":false,"resposta":"","fontes":[]}' });
    const r1 = await perguntarAjuda(db, { pergunta: alvo.texto.slice(0, 400), locale: "pt-BR" }, { embed, chat: naoSabe });
    expect(r1).toMatchObject({ tipo: "sem_resposta", motivo: "ia_nao_sabe" });
    const falha: ChatAjudaFn = async () => {
      throw new Error("503");
    };
    const r2 = await perguntarAjuda(db, { pergunta: alvo.texto.slice(0, 400), locale: "pt-BR" }, { embed, chat: falha });
    expect(r2).toMatchObject({ tipo: "sem_resposta", motivo: "ia_falhou" });
    expect(await db.perguntaSemResposta.count()).toBe(2);
  });

  it("tira e-mail e telefone antes da IA e do banco", async () => {
    const enviados: string[] = [];
    const chat: ChatAjudaFn = async (_t, q) => {
      enviados.push(q.messages.map((m) => m.content).join("\n"));
      return { text: '{"respondido":false}' };
    };
    const alvo = trechosDoIdioma("pt-BR")[0];
    await perguntarAjuda(db, { pergunta: `${alvo.texto.slice(0, 300)} ana@exemplo.com 11 98888-7777`, locale: "pt-BR" }, { embed, chat });
    expect(enviados.join(" ")).not.toMatch(/ana@exemplo\.com|98888/);
    expect((await db.perguntaSemResposta.findFirstOrThrow()).texto).not.toMatch(/ana@exemplo\.com|98888/);
  });

  it("a 21ª pergunta do dia no mesmo IP é recusada", async () => {
    const chave = await chaveUso("ajuda-pergunta", `teste-${Date.now()}`);
    for (let i = 0; i < LIMITE_PERGUNTAS_AJUDA_DIA; i++) expect((await consumirUso(db, chave, LIMITE_PERGUNTAS_AJUDA_DIA)).permitido).toBe(true);
    expect((await consumirUso(db, chave, LIMITE_PERGUNTAS_AJUDA_DIA)).permitido).toBe(false);
  });
});
