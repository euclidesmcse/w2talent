# W2Talent — Instruções para Agentes (OpenCode / Muse / Codex)

> **Leia este arquivo assim que abrir este projeto.** Ele é a fonte rápida do contexto — economiza 10 perguntas.
> Fonte da verdade do código: **https://github.com/euclidesmcse/w2talent** (sempre `git push origin main`).

## O que é

**W2Talent (w2talent.com)** — Conector simples **Candidatos ↔ Empresas** inspirado no apinfo.com.
- Tese: **lista limpa** + **1-clique em lote (10/lote, 30/dia) sem Outlook**, via proxy `via.w2talent.com` (LGPD granular, libera ao responder).
- Staging: https://w2talent.euclidespns.workers.dev — **onde fica até publicar** (não indexado, `noindex`).
- Domínio final: https://w2talent.com — **ainda não publicado** (não adicionar custom domain sem ordem explícita do Euclides).
- Repo: https://github.com/euclidesmcse/w2talent — fonte da verdade.
- Demo sem banco: 10 vagas + 5 candidatos estáticos em `lib/demo-data.ts` (fallback quando `DATABASE_URL` ausente nos isolates do Workers).

## Stack

Next.js 15.5 + Tailwind 3.4 + PostCSS + next-intl (PT-BR/EN) + PWA (`manifest.json`).
Prisma 6.5 + Postgres `pgvector:pg16` (`vector(1024)` + `tsvector`, hybrid `ts_rank 0.6 + cosine 0.4`).
Auth OTP 5min (E.164 BR) + JWT `w2talent_token` + LGPD 4 consentimentos versionados.
Deploy: Cloudflare Pages/Workers via **OpenNext** (`@opennextjs/cloudflare`). Ver seção Deploy abaixo.
Tests: `npm test -- --runInBand` — 11 suítes, 129 pass, 3 skipped (DATABASE_URL ausente).

## Onde parou (atualizar a cada etapa)

- **2026-11-06 — Fase 1 MVP concluída:** 10 tasks (1..10) + final review + fix wave. Tags `v0.1.0-fase1-mvp`, `v0.1.1-w2talent-rebrand`, `f612963`.
- **2026-11-06 — Rebrand:** `apinfo2` → `w2talent`, repo renomeado, `via.w2talent.com`, storage keys `w2talent:*`.
- **2026-11-06 — Staging live:** Cloudflare Pages `w2talent` no ar em `workers.dev`, auto-deploy em `git push origin main`.
- **2026-11-06 — DB local:** `w2talent-db` (Docker `pgvector:pg16` porta **5437**) migrado + seed `demo-company` 10 vagas/5 candidatos. Gerenciado por `scripts/db.sh` (ver `docs/INFRA_TEMPORARIA.md` — remover ao final, migrar para Neon/Supabase com pgvector em produção).
- **2026-11-06 — Visual:** Landing split-stage (taste-skill, Bodoni Moda/Jost, slate/sage/blush/olive) + headers olive/sage em `/vagas` e `/candidatos`. Tela branca sem CSS corrigida (a097ba0). `/` 404 corrigida (f6f2071).
- **2026-11-08 — Visão v2 APROVADA:** `docs/superpowers/specs/2026-11-08-w2talent-design-v2.md` (login Google/Microsoft + TOTP, aprovar-antes-de-enviar, Ficha W2 por IA, dashboard RH + agenda, LLM de RH com AI Gateway + cadastro de qualquer API, PT/EN/ES + tradução automática, visual estilo Cloudflare). Decisões fechadas: evoluir código atual, PWA primeiro, AI Gateway + APIs cadastráveis, PT/EN/ES.
- **2026-11-08 — Infra:** PR #3 merged — config Cloudflare versionada (`npm run deploy`), CI com Postgres+pgvector verde. Preview de PR falhava; Euclides ajustou os comandos de build no painel em 2026-11-08 (ver seção Deploy).
- **2026-11-08 — Arquitetura v2 APROVADA:** `docs/superpowers/specs/2026-11-08-w2talent-arquitetura-v2.md` (Q1–Q6 assumidas pela recomendação; Neon+Hyperdrive, Better Auth+TOTP, AI Router via AI Gateway, Queues/Cron, bge-m3).
- **2026-11-08 — Passo 3 (protótipo) APROVADO:** canvas privado https://claude.ai/artifact/Sr4RAnTcV9Cs3N88YmeUMs com 9 telas: design system, Login (Google/Microsoft + autenticador), Vagas (seleção), Selecionadas (abrir → conferir → aprovar → enviar em lote), Celular/PWA com assistente, Candidatos + Ficha W2, Publicar vaga (aviso de duplicada), Painel RH + agenda, Admin de IA (cadastro de API + compatibilidade por tarefa). Visual: Inter, azul #1F4FD8, fundo #F7F8FA, sem enfeites.
- **2026-11-08 — Passo 4:** backlog v2 em `docs/superpowers/plans/2026-11-08-w2talent-backlog-v2.md` (Fase 1.5 com 15 itens, Fase 2, Fase 3), APROVADO.
- **2026-11-08 — Item 1.5.1 (spike banco):** código pronto no PR #5 (Prisma 6.19 sem binário + adapter pg, cliente por requisição no Worker, `GET /api/health/db`). Testado local com Hyperdrive simulado. Plano **Free**: leitura de CV trocada de pdf-parse/mammoth para Workers AI `toMarkdown`, Worker ficou em 1,9 MiB gzip (limite 3 MiB). Notas: `docs/spikes/2026-11-08-neon-hyperdrive-prisma.md`.
- **Próximo:** Euclides cria Neon + Hyperdrive (passos no doc do spike) → adicionar ID do Hyperdrive no `wrangler.jsonc`, merge do PR #5, conferir `/api/health/db` em staging → item 1.5.2.

## Fontes da verdade (ler nesta ordem ao abrir o projeto)

0. `docs/superpowers/plans/2026-11-08-w2talent-backlog-v2.md` (o que fazer agora) + `docs/superpowers/specs/2026-11-08-w2talent-design-v2.md` + `2026-11-08-w2talent-arquitetura-v2.md` — visão e arquitetura v2 (prevalece sobre a v1 onde houver conflito; status no topo do doc).
1. `docs/superpowers/specs/2026-11-07-w2talent-design.md` — design aprovado (intent, fases, schema canônico, fluxos lote 10/30, hygiene 180d/14d, LGPD decisão B).
2. `docs/superpowers/plans/2026-11-07-w2talent-fase1-mvp.md` — plano 10 tasks (file structure, interfaces, review focus).
3. `.superpowers/sdd/2026-11-07-w2talent-fase1-mvp/progress.md` — ledger (tasks 1..10 complete, deferred minors, rulings, adjudications).
4. `docs/INFRA_TEMPORARIA.md` — o que é temporário (w2talent-db:5437) e como remover ao final.
5. `docs/GUIA_TRABALHO.md` — como continuar de outro notebook via SSH 192.168.1.254 (tmux, Remote-SSH, troubleshooting).

## Deploy — Cloudflare Pages (auto-deploy, 100% grátis)

> **Staging atual:** só `workers.dev`. `w2talent.com` não está em Custom Domains — não publicar sem ordem explícita.

### Como funciona (já configurado, não precisa refazer)

- Projeto Cloudflare **Pages** `w2talent` conectado ao GitHub `euclidesmcse/w2talent` branch `main`.
- Trigger: **todo `git push origin main` → webhook GitHub → Cloudflare faz `git pull → build → deploy` sozinho.** Nenhum `wrangler deploy` manual.
- Provas: commits `ab4ced2`, `2427772`, `f6f2071`, `a097ba0`, `c9f2ccb`, `f41491b` viraram `Success` automáticos.

### Settings na Cloudflare (já salvos, documentados para referência)

- **Framework preset:** Next.js
- **Build command:** `npx prisma generate && npm run build`
- **Painel Cloudflare → w2talent → Settings → Build (desde 2026-11-08):** Build command `npx opennextjs-cloudflare build` · Deploy command `npx opennextjs-cloudflare deploy` · Non-production branch deploy command `npx opennextjs-cloudflare upload` (preview dos PRs). Localmente, `npm run deploy` faz build + deploy juntos. Plano **Workers Free**: Worker até 3 MiB gzip — medir com `npx wrangler deploy --dry-run --outdir /tmp/x` após o build. Config versionada no repo: `wrangler.jsonc`, `open-next.config.ts`, `public/_headers`; `wrangler` e `@opennextjs/cloudflare` com versão fixa no `package.json`. **Não** usar `npx wrangler deploy` puro: sem config no repo ele baixa a última versão e regenera tudo a cada build (causa de falhas intermitentes até 2026-11-08).
- **Output directory:** `.open-next` (gerenciado pelo OpenNext, não `.next`)
- **Node version:** 22 (detectado `nodejs@24.22.1` no build, mas alvo é Next 15.5)
- **Compatibility date:** `2026-11-04` (em `wrangler.jsonc`)

### Variáveis no Pages → Settings → Variables (staging = dummy, prod = reais)

| Key | Staging (hoje) | Produção (quando migrar para Postgres real) |
|-----|----------------|---------------------------------------------|
| `DATABASE_URL` | `postgresql://dummy:dummy@localhost:5432/w2talent` | `postgresql://...` Neon/Supabase com `vector` extension |
| `JWT_SECRET` | `dummy-ci-jwt` | `openssl rand -base64 32` (obrigatório em prod, senão build/runtime dá `throw`) |
| `CRON_SECRET` | `dummy-ci-cron` | `openssl rand -base64 32` (protege `GET /api/cron/hygiene` + `PATCH` webhooks) |
| `WEBHOOK_SECRET` | — | opcional, fallback para `CRON_SECRET` |
| `PROXY_DOMAIN` | `via.w2talent.com` | `via.w2talent.com` |
| `NEXT_PUBLIC_BASE_URL` | `https://w2talent.com` | `https://w2talent.com` |

> Sem `DATABASE_URL` real o search usa `lib/demo-data.ts` (10 vagas/5 candidatos) — staging já lista sem banco.

### Como o agente usa (não precisa `wrangler login`)

```bash
# fluxo normal — Cloudflare faz o resto
git add -A && git commit -m "feat: ..." && git push origin main
# → https://w2talent.euclidespns.workers.dev atualiza em ~2 min (aba Deployments → Success)

# ver status local
git log --oneline -3
curl -s "https://w2talent.euclidespns.workers.dev/api/search/vacancies?q=Analista%20Cloud" | head -c 400
```

### Quando publicar w2talent.com (só com ordem do Euclides)

`Cloudflare Dashboard → w2talent → Settings → Domains & Routes → Add Custom Domain → w2talent.com + www.w2talent.com → Activate` (CNAME criado automaticamente, domínio já está na conta Cloudflare).

### Build local vs Cloudflare

- Local: `DATABASE_URL="postgresql://w2talent:w2talent@localhost:5437/w2talent" npm run build` precisa `w2talent-db` rodando (`./scripts/db.sh up`).
- Cloudflare: build passa com dummy `DATABASE_URL` porque `lib/auth.ts#getJwtSecret()` permite `phase-production-build` sem `JWT_SECRET` real (runtime ainda exige).

## Regras operacionais (obrigatórias)

- **SEMPRE** `git push origin main` após cada etapa — GitHub é a fonte, nunca só local. Outras pessoas colaboram por lá.
- **Nunca** publicar `w2talent.com` sem ordem explícita do Euclides. Staging é `workers.dev`.
- **Não** migrar `w2talent-db` para K8s sem pedido. Manter em Docker local até produção (ver `docs/INFRA_TEMPORARIA.md`).
- **Sempre** ler este `AGENTS.md` + `progress.md` ao abrir o projeto em nova sessão — antes de perguntar.
- **Sempre** rodar `npm test -- --runInBand` + `npm run build` antes de push (ou deixar CI que roda em todo push/PR).

## Comandos rápidos

```bash
cd ~/projetos/w2talent
git pull origin main
./scripts/db.sh status   # ou up / logs / psql / reset
# com DB local:
DATABASE_URL="postgresql://w2talent:w2talent@localhost:5437/w2talent" npm run dev   # http://localhost:3000
npm test -- --runInBand   # 11 suítes, 129 pass
npm run build             # Next 15.5, 15 rotas
# demo sem DB (staging):
curl -s "https://w2talent.euclidespns.workers.dev/api/search/vacancies?q=Cloud" | jq
curl -X POST "https://w2talent.euclidespns.workers.dev/api/seed/demo" # semeia Map in-memory (volátil, ver lib/demo-data.ts para persistente)
```
