/** 1.5.9: texto do vetor, indexação com hash, vetor da busca (cache + limite de tempo) e reindexação. */
import {
  candidateEmbeddingText,
  embeddingHash,
  vacancyEmbeddingText,
  EMBEDDING_MODEL,
  type Embedder,
} from "../lib/embeddings";
import { indexVacancy, indexCandidate, indexPending, markForReindex, EMBED_BATCH } from "../lib/indexing";
import { queryVector, buildVacancySearchSql, normalizeQuery, searchVacanciesDb } from "../lib/search-db";
import { createRouter, type AiStore } from "../lib/ai/router";
import { encryptApiKey } from "../lib/ai/keys";
import { expandQuery } from "../lib/search-synonyms";

const DIM = 1024;
const vec = (x: number) => new Array(DIM).fill(x);

/** Embedder falso que conta chamadas e textos. */
function fakeEmbedder(delayMs = 0) {
  const calls: string[][] = [];
  const embed: Embedder = async (texts) => {
    calls.push(texts);
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    return texts.map(() => vec(0.01));
  };
  return { embed, calls };
}

type Captured = { sql: string; values: unknown[] };
/** Banco falso: responde $queryRaw por um roteador de SQL e guarda os $executeRaw. */
function fakeDb(answer: (sql: string, values: unknown[]) => unknown[]) {
  const executed: Captured[] = [];
  const toCall = (a: any, rest: unknown[]): Captured =>
    a && typeof a.sql === "string" ? { sql: a.sql, values: a.values } : { sql: (a as string[]).join("?"), values: rest };
  const db = {
    $queryRaw: jest.fn(async (a: any, ...rest: unknown[]) => {
      const c = toCall(a, rest);
      return answer(c.sql, c.values);
    }),
    $executeRaw: jest.fn(async (a: any, ...rest: unknown[]) => {
      executed.push(toCall(a, rest));
      return 1;
    }),
  };
  return { db: db as any, executed };
}

describe("texto que vira vetor (decisão 2)", () => {
  it("vaga: título, nível, local, competências com sinônimos e descrição", () => {
    const t = vacancyEmbeddingText({
      titulo: "Engenheiro Cloud",
      nivel: "Sênior",
      regime: "CLT",
      localidade: "São Paulo",
      stack: [{ skillId: "aws" }],
      descricaoBullets: ["Cuidar da infraestrutura AWS", "Contato: rh@empresa.com"],
    });
    expect(t).toMatch(/Engenheiro Cloud/);
    expect(t).toMatch(/Sênior · CLT/);
    expect(t).toMatch(/AWS/);
    expect(t).not.toMatch(/rh@empresa\.com/);
    expect(t).toMatch(/\[EMAIL\]/);
  });

  it("perfil: nunca nome, e-mail ou telefone, mesmo que venham no objeto", () => {
    const t = candidateEmbeddingText({
      titulo: "Analista Cloud",
      resumo3linhas: "5 anos com AWS. Fale comigo: (11) 98765-4321",
      objetivoCrescimento: "Ser Tech Lead",
      localidade: "Recife",
      stack: [{ skillId: "kubernetes" }],
      ...({ nome: "Ana Lima", email: "ana@x.com", celular: "+5511987654321" } as object),
    });
    expect(t).toMatch(/Analista Cloud/);
    expect(t).toMatch(/Objetivo: Ser Tech Lead/);
    for (const s of ["Ana Lima", "ana@x.com", "98765", "+5511987654321"]) expect(t).not.toContain(s);
  });

  it("hash muda com o texto e com o modelo", async () => {
    const a = await embeddingHash("x");
    expect(await embeddingHash("x")).toBe(a);
    expect(await embeddingHash("y")).not.toBe(a);
    expect(await embeddingHash("x", "outro-modelo")).not.toBe(a);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("indexação com hash (decisão 5)", () => {
  const vaga = { key: "v1", titulo: "Dev React", stack: [], descricaoBullets: [], embeddingModel: null, embeddingHash: null, semVetor: true };

  it("vaga sem vetor: pede ao modelo e grava vetor, tsvector, modelo e hash", async () => {
    const { embed, calls } = fakeEmbedder();
    const { db, executed } = fakeDb(() => [vaga]);
    expect(await indexVacancy("v1", { db, embed })).toBe("indexado");
    expect(calls).toHaveLength(1);
    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toMatch(/UPDATE "Vacancy" SET embedding = \?::vector/);
    expect(executed[0].sql).toMatch(/to_tsvector\('portuguese'/);
    expect(executed[0].values).toContain(EMBEDDING_MODEL);
    expect(String(executed[0].values[0])).toMatch(/^\[0\.01,/);
  });

  it("texto igual e mesmo modelo: não chama o modelo de novo", async () => {
    const hash = await embeddingHash(vacancyEmbeddingText(vaga));
    const { embed, calls } = fakeEmbedder();
    const { db, executed } = fakeDb(() => [{ ...vaga, embeddingHash: hash, embeddingModel: EMBEDDING_MODEL, semVetor: false }]);
    expect(await indexVacancy("v1", { db, embed })).toBe("igual");
    expect(calls).toHaveLength(0);
    expect(executed).toHaveLength(0);
  });

  it("perfil inexistente: nao_encontrado, sem chamar o modelo", async () => {
    const { embed, calls } = fakeEmbedder();
    const { db } = fakeDb(() => []);
    expect(await indexCandidate("u1", { db, embed })).toBe("nao_encontrado");
    expect(calls).toHaveLength(0);
  });

  it("salvar marca como pendente; o reindex procura hash vazio", async () => {
    const { db, executed } = fakeDb(() => []);
    await markForReindex("vacancy", "v1", { db });
    expect(executed[0].sql).toMatch(/"embeddingHash" = NULL, "searchVector" = NULL/);
    const seen: string[] = [];
    const { db: db2 } = fakeDb((sql) => (seen.push(sql), /count\(\*\)/.test(sql) ? [{ n: 0 }] : []));
    await indexPending("candidate", 5, { db: db2, embed: fakeEmbedder().embed });
    expect(seen.every((q) => /"embeddingHash" IS NULL/.test(q))).toBe(true);
  });

  it("pendentes: manda em lotes e diz quantos faltam", async () => {
    const rows = Array.from({ length: 23 }, (_, i) => ({ ...vaga, key: `v${i}` }));
    const { embed, calls } = fakeEmbedder();
    const { db, executed } = fakeDb((sql) => (/count\(\*\)/.test(sql) ? [{ n: BigInt(4) }] : rows));
    const r = await indexPending("vacancy", 50, { db, embed });
    expect(r).toEqual({ indexados: 23, pendentes: 4 });
    expect(calls.map((c) => c.length)).toEqual([EMBED_BATCH, EMBED_BATCH, 3]);
    expect(executed).toHaveLength(23);
  });
});

describe("vetor da busca: cache de 7 dias e limite de 1,2 s (decisão 3)", () => {
  it("busca vazia não chama nada", async () => {
    const { embed, calls } = fakeEmbedder();
    const { db } = fakeDb(() => []);
    expect(await queryVector("   ", { db, embed })).toBeNull();
    expect(calls).toHaveLength(0);
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });

  it("no cache: devolve o guardado sem chamar o modelo; a chave é só o hash do texto", async () => {
    const { embed, calls } = fakeEmbedder();
    const { db } = fakeDb(() => [{ v: JSON.stringify(vec(0.5)) }]);
    const v = await queryVector("Engenheiro de Nuvem", { db, embed });
    expect(v).toHaveLength(DIM);
    expect(calls).toHaveLength(0);
    const values = (db.$queryRaw.mock.calls[0] as unknown[]).slice(1);
    expect(values.join(" ")).not.toMatch(/nuvem/i);
  });

  it("fora do cache: chama o modelo e guarda", async () => {
    const { embed, calls } = fakeEmbedder();
    const { db, executed } = fakeDb(() => []);
    const v = await queryVector("Engenheiro  de nuvem", { db, embed });
    expect(v).toHaveLength(DIM);
    expect(calls[0]).toEqual(["engenheiro de nuvem"]);
    expect(executed[0].sql).toMatch(/INSERT INTO "QueryEmbedding"/);
  });

  it("modelo lento: sai sem vetor no limite e termina em segundo plano", async () => {
    const { embed } = fakeEmbedder(80);
    const { db, executed } = fakeDb(() => []);
    const t0 = Date.now();
    expect(await queryVector("devops", { db, embed, timeoutMs: 20 })).toBeNull();
    expect(Date.now() - t0).toBeLessThan(70);
    await new Promise((r) => setTimeout(r, 120));
    expect(executed.some((e) => /INSERT INTO "QueryEmbedding"/.test(e.sql))).toBe(true);
  });

  it("modelo com erro: busca segue só por texto", async () => {
    const { db } = fakeDb(() => []);
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    const embed: Embedder = async () => {
      throw new Error("fora do ar");
    };
    expect(await queryVector("devops", { db, embed })).toBeNull();
    spy.mockRestore();
  });

  it("normaliza maiúsculas e espaços", () => {
    expect(normalizeQuery("  Cloud   AWS ")).toBe("cloud aws");
  });

  it("página além do fim: mantém o total", async () => {
    const { db } = fakeDb((_sql, values) => (values.includes(40) ? [] : [{ _total: BigInt(12), _rank: 0, _tsRank: 0, _vecRank: 0 }]));
    const r = await searchVacanciesDb({ page: 3, pageSize: 20 }, { db });
    expect(r.items).toHaveLength(0);
    expect(r.total).toBe(12);
    expect(r.hasAny).toBe(true);
  });

  it("sem texto buscado: lista os mais recentes, sem nota", () => {
    const sql = buildVacancySearchSql({ page: 1, pageSize: 20 }, null).sql;
    expect(sql).toMatch(/ORDER BY v\."updatedAt" DESC/);
    expect(sql).not.toMatch(/websearch_to_tsquery/);
  });
});

describe("equivalências e significado só reordena (decisão de 2026-11-09)", () => {
  it("cada termo vira um grupo; o resto do texto fica", () => {
    const e = expandQuery("engenheiro nuvem aws");
    expect(e.rest).toBe("aws");
    expect(e.anyOf).toEqual([expect.arrayContaining(["nuvem", "cloud", "nube"]), expect.arrayContaining(["engenheiro", "engineer"])]);
    expect(e.noneOf).toEqual([]);
  });

  it("combina idiomas sem limite: developer database acha desenvolvedor + banco de dados", () => {
    const e = expandQuery("developer database");
    expect(e.rest).toBe("");
    expect(e.anyOf).toHaveLength(2);
    expect(e.anyOf.flat()).toEqual(expect.arrayContaining(["desenvolvedor", "banco de dados"]));
  });

  it("exclusão vale para os equivalentes", () => {
    const e = expandQuery("aws -cloud");
    expect(e.rest).toBe("aws -cloud");
    expect(e.anyOf).toEqual([]);
    expect(e.noneOf).toEqual(expect.arrayContaining(["nuvem", "nube"]));
  });

  it("palavra inteira, termo longo primeiro, aspas e or sem expansão", () => {
    expect(expandQuery("dadosx").anyOf).toEqual([]);
    expect(expandQuery("banco de dados").anyOf).toHaveLength(1);
    expect(expandQuery("cozinheiro de restaurante").anyOf).toEqual([]);
    expect(expandQuery('"analista cloud"').anyOf).toEqual([]);
    expect(expandQuery("cloud or aws").anyOf).toEqual([]);
  });

  it("SQL: entra só o que bate no texto; o vetor só entra na nota", () => {
    const q = buildVacancySearchSql({ q: "nuvem", page: 1, pageSize: 20 }, vec(0.01));
    expect(q.sql).toMatch(/WHERE s\."_textMatch"\s/);
    expect(q.sql).not.toMatch(/_vecRank" >=/);
    expect(q.sql).toMatch(/phraseto_tsquery/);
    expect(q.values).toEqual(expect.arrayContaining(["nuvem", "cloud", "nube"]));
  });
});

describe("roteador: embeddings com dados pessoais", () => {
  it("fornecedor externo recebe o texto sem contatos", async () => {
    const MASTER = Buffer.alloc(32, 7).toString("base64");
    const calls: string[] = [];
    const fetchFn = (async (_url: string, init: RequestInit) => {
      calls.push(String(init.body));
      return new Response(JSON.stringify({ data: [{ embedding: [1, 2] }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const store: AiStore = {
      route: async () => ({
        mode: "automatico",
        candidates: [
          {
            providerId: "ext",
            providerName: "Externo",
            kind: "OPENAI_COMPATIBLE",
            gatewayPath: "openai",
            encryptedKey: await encryptApiKey("sk-1", MASTER),
            acceptsPersonalData: true,
            modelId: "m",
            model: "text-embedding-3-small",
            priceIn: 0,
            priceOut: 0,
          },
        ],
      }),
      spentTodayUsd: async () => 0,
      record: async () => {},
    };
    const r = createRouter(store, { fetch: fetchFn, gateway: { accountId: "a", id: "g" }, globalDailyBudgetUsd: 1, master: MASTER });
    await r.embed("embed", ["Analista, ana@x.com, (11) 98765-4321"]);
    expect(calls[0]).not.toMatch(/ana@x\.com|98765/);
    expect(calls[0]).toMatch(/\[EMAIL\]/);
  });
});

describe("rota /api/ai/reindex", () => {
  const OLD = process.env.CRON_SECRET;
  afterAll(() => {
    process.env.CRON_SECRET = OLD;
  });
  it("fecha sem o segredo e recusa o segredo na URL", async () => {
    process.env.CRON_SECRET = "s3gredo";
    const { POST } = await import("../app/api/ai/reindex/route");
    const { NextRequest } = await import("next/server");
    expect((await POST(new NextRequest("http://x/api/ai/reindex", { method: "POST" }))).status).toBe(401);
    expect((await POST(new NextRequest("http://x/api/ai/reindex?cron_secret=s3gredo", { method: "POST" }))).status).toBe(401);
  });
});
