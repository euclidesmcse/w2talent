# Spike 1.5.1 — Neon + Hyperdrive + Prisma no Worker

**Data:** 2026-11-08 · **Resultado:** ✅ funciona localmente (Hyperdrive simulado pelo wrangler dev). Falta ligar o Neon real.

## O que mudou no código
- Prisma 6.5 → **6.19.3** com `engineType = "client"` (sem binário Rust) e `@prisma/adapter-pg` + `pg`.
- `lib/prisma.ts`: no Worker cria **um PrismaClient por requisição** (o Worker não deixa reaproveitar socket entre requisições; com cliente global a 2ª requisição travava). A conexão vem do binding `HYPERDRIVE`; sem ele, usa `DATABASE_URL`. Fora do Worker (dev, jest) continua um cliente global. A API `import { prisma } from "@/lib/prisma"` não mudou.
- `lib/format.ts`: funções de formatação saíram de `lib/search.ts` para os componentes do navegador não puxarem o `pg` (quebrava o build).
- `GET /api/health/db`: diz se o banco responde, se o pgvector está ativo, quantas vagas existem, a latência e a origem da conexão (`hyperdrive` ou `database_url`). Não mostra URL nem dados pessoais.

## Medições
| | main (Prisma 6.5) | spike (Prisma 6.19 client + pg) |
|---|---|---|
| Worker (gzip) | 2.645 KiB | **3.399 KiB** |
| Testes | 132 ✅ | 132 ✅ |
| `/api/health/db` local, 4 requisições seguidas | — | 10–16 ms, todas 200 |
| Via binding Hyperdrive local | — | 200, `via: "hyperdrive"` |

⚠️ **Limite do plano:** Workers Free aceita até 3 MiB (gzip); Workers Paid (US$ 5/mês) aceita 10 MiB. Com o spike o Worker passa de 3 MiB. Decisão pendente com o Euclides.

## Para ligar o Neon (passos do Euclides; nenhuma senha vai para o repositório)
1. Criar o projeto no Neon (região `aws-sa-east-1`, São Paulo), banco `w2talent`.
2. Do seu computador: `DATABASE_URL="<url direta do Neon>" npx prisma migrate deploy` (a migration já cria a extensão `vector`).
3. Criar o Hyperdrive: `npx wrangler hyperdrive create w2talent-db --connection-string="<url do Neon>"` (ou pelo painel: Storage & Databases → Hyperdrive).
4. Mandar o **ID** do Hyperdrive (não é segredo). Eu adiciono em `wrangler.jsonc`:
   `"hyperdrive": [{ "binding": "HYPERDRIVE", "id": "<ID>" }]`
5. Depois do deploy: abrir `https://w2talent.euclidespns.workers.dev/api/health/db` e conferir `"via": "hyperdrive"`.
