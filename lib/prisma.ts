import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Prisma sem binário Rust (engineType = "client") + driver adapter `pg`.
 *
 * - No Cloudflare Worker a conexão vem do binding HYPERDRIVE (pool do Hyperdrive na
 *   frente do Neon). O Worker não pode reaproveitar um socket entre requisições, então
 *   criamos um PrismaClient por requisição (chave: o ExecutionContext da requisição).
 * - Fora do Worker (next dev, jest, scripts) usa DATABASE_URL com um cliente global.
 */

type HyperdriveBinding = { connectionString: string };

const log: ("error" | "warn" | "query")[] =
  process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"];

export function createPrismaClient(connectionString: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }), log });
}

/** Contexto do Worker quando rodando via OpenNext; undefined em node/jest. */
function workerContext(): { hyperdrive?: HyperdriveBinding; ctx: object } | undefined {
  const sym = Symbol.for("__cloudflare-context__");
  const cf = (globalThis as Record<symbol, unknown>)[sym] as
    | { env?: { HYPERDRIVE?: HyperdriveBinding }; ctx?: object }
    | undefined;
  if (!cf?.ctx) return undefined;
  return { hyperdrive: cf.env?.HYPERDRIVE, ctx: cf.ctx };
}

const perRequest = new WeakMap<object, PrismaClient>();
const globalForPrisma = globalThis as unknown as { __w2Prisma?: PrismaClient };

export function getPrisma(): PrismaClient {
  const wc = workerContext();
  if (wc) {
    // Dentro do Worker: um cliente por requisição (sockets não podem ser compartilhados).
    let client = perRequest.get(wc.ctx);
    if (!client) {
      const url = wc.hyperdrive?.connectionString ?? process.env.DATABASE_URL;
      if (!url) throw new Error("Banco não configurado: defina o binding HYPERDRIVE ou DATABASE_URL.");
      client = createPrismaClient(url);
      perRequest.set(wc.ctx, client);
    }
    return client;
  }
  if (!globalForPrisma.__w2Prisma) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("Banco não configurado: defina o binding HYPERDRIVE ou DATABASE_URL.");
    globalForPrisma.__w2Prisma = createPrismaClient(url);
  }
  return globalForPrisma.__w2Prisma;
}

/** De onde vem a conexão atual (para diagnóstico, sem expor a URL). */
export function dbSource(): "hyperdrive" | "database_url" | "nenhuma" {
  if (workerContext()?.hyperdrive?.connectionString) return "hyperdrive";
  return process.env.DATABASE_URL ? "database_url" : "nenhuma";
}

/**
 * Mantém a API antiga (`import { prisma } from "@/lib/prisma"`): cada acesso resolve o
 * cliente certo para a requisição atual.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_t, prop) {
    const client = getPrisma();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export default prisma;
