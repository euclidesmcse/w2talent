# W2Talent — w2talent.com

> **Conector simples Candidatos ↔ Empresas.** Inspirado no [apinfo.com](https://apinfo.com) (no ar desde 1997), agora com busca semântica, candidatura em lote e higiene automática. Marca própria, sem vínculo com o apinfo.

[![CI](https://github.com/euclidesmcse/w2talent/actions/workflows/ci.yml/badge.svg)](https://github.com/euclidesmcse/w2talent/actions)
[![Staging](https://img.shields.io/badge/staging-w2talent.euclidespns.workers.dev-2c3620)](https://w2talent.euclidespns.workers.dev)
[![Stack](https://img.shields.io/badge/stack-Next.js%2015%20%7C%20Prisma%20%7C%20pgvector-1c1c1c)](https://github.com/euclidesmcse/w2talent)

**Repo:** https://github.com/euclidesmcse/w2talent · **Staging (onde fica até publicar):** https://w2talent.euclidespns.workers.dev · **Domínio final (ainda não publicado):** https://w2talent.com · **CI:** https://github.com/euclidesmcse/w2talent/actions

---

## TL;DR

- O apinfo original funciona, mas parou em ColdFusion + listas textuais + fluxo via Outlook (30 vagas = 30 e-mails com subject copiado e PDF anexado).
- **W2Talent mantém a simplicidade e remove a fricção:** lista limpa com vocabulário único, busca natural (`Analista Cloud remoto CLT 12k`) e **1 clique em lote (até 10 vagas ou candidatos por vez, 30/dia)** sem abrir Outlook.
- Staging já está no ar (Cloudflare Pages, auto-deploy em `git push origin main`) com **10 vagas + 5 candidatos demo** navegáveis sem banco — em produção usa Postgres com `pgvector`.

---

## Demonstração (staging)

Abra e teste o fluxo em 30 segundos — sem login, sem banco:

1. **Vagas:** https://w2talent.euclidespns.workers.dev/vagas?q=Analista%20Cloud
   - Marque 3 vagas no `☐` → clique `🔍` numa para ver detalhes → feche sem perder seleção → `Candidatar (3)`.
2. **Candidatos:** https://w2talent.euclidespns.workers.dev/candidatos?q=Cloud
   - Mesmo padrão: `☐` + `🔍` + seleção persistente cross-page → `Contatar (3)`.

APIs diretas (JSON):

```bash
curl "https://w2talent.euclidespns.workers.dev/api/search/vacancies?q=Analista%20Cloud"
curl "https://w2talent.euclidespns.workers.dev/api/search/candidates?q=Cloud"
```

> Sem `DATABASE_URL` o search cai em `lib/demo-data.ts` (10 vagas/5 candidatos estáticos no bundle) — por isso o staging lista mesmo sem Postgres. Com Postgres, o mesmo código lê do banco.

---

## O que faz (Fase 1 MVP)

| Promessa | Como |
|---|---|
| **Lista limpa** | Tabela desktop / cards mobile, mesmo dado. `☐` checkbox + `🔍` lupa abre modal sem perder seleção. Faixa, regime, remoto e Top 3 skills sempre no mesmo lugar. `+2` skills truncadas. |
| **1-clique em lote** | Selecionar até **10** → **Candidatar** ou **Contatar**. Cada item vira um `id@via.w2talent.com` com CV canônico anexo. **30/dia** por usuário. Erro parcial `207` (2 ok + 1 expirada), sem rollback. |
| **Proxy LGPD (decisão B)** | Antes da resposta, contato mascarado (`🔒`). Ao **responder no proxy**, o contato direto é liberado implicitamente — sem clique bilateral. `consentLogs` versionados. |
| **Higiene automática** | **CV 180d** com 3 nudges (D150/D165/D175) + **Vaga 14d** (aviso D12, renova +14 com 1 clique). Arquiva sai da busca, purge LGPD em +30d. Cron `GET /api/cron/hygiene` idempotente (dedupe `userId+marco+date`) + n8n `n8n/workflows/hygiene.json`. |
| **Busca semântica** | Hybrid `ts_rank (0.6) + cosine vector (0.4)` com `multilingual-e5` (stub zero-vector no MVP, `lib/demo-data.ts` cobre staging). Sinônimos via taxonomia **500 skills** + typo `Analsita Cluod → Analista Cloud` com `emptyCTA`. |
| **Responsivo & i18n** | Mobile-first 360/768/1024/1280, `next-intl` PT-BR (default) / EN, `Intl.NumberFormat` por locale. PWA `manifest.json`, `theme #0a0a0a`. |

Fora do MVP (Fase 2/3 no spec): coach IA `objetivoCrescimento`, ranking `94% match` explicado, dashboard RH, alertas n8n top 20, swipe mobile, ATS feeder.

---

## Stack

- **App:** Next.js 15.5 (App Router, `force-dynamic`), React 19, Tailwind 3.4 + PostCSS + `app/globals.css`
- **i18n/PWA:** `next-intl` 3.26, `public/manifest.json`, `icons/`
- **DB:** Prisma 6.5 + Postgres `pgvector:pg16` (`vector(1024)` + `tsvector`, `postgresqlExtensions`)
- **Busca:** `lib/search.ts` (tsvector + pgvector hybrid), `lib/embeddings.ts`, `lib/taxonomy.ts` (500 skills)
- **Auth/LGPD:** OTP 5min (E.164 BR) + JWT `w2talent_token` + 4 consentimentos versionados (`lib/auth.ts`)
- **Proxy/Lote:** `lib/proxy.ts` (`via.w2talent.com`, `thr_*`, `app_*`, `BATCH 10 / DAILY 30`)
- **Demo sem banco:** `lib/demo-data.ts` (10 vagas + 5 candidatos) — fallback quando `vacancyStore` e DB vazios (Workers isolates)
- **Deploy:** Cloudflare Pages/Workers via OpenNext (`@opennextjs/cloudflare`, `wrangler.jsonc`, `open-next.config.ts`)

---

## Começando local

### Pré-requisitos

Node 22+, Docker (para Postgres local com pgvector).

### 1) Clonar e instalar

```bash
git clone https://github.com/euclidesmcse/w2talent.git
cd w2talent
npm ci
```

### 2) Subir Postgres local (recomendado: Docker direto, não K8s)

```bash
./scripts/db.sh up        # cria/inicia w2talent-db (pgvector:pg16) na porta 5437
./scripts/db.sh status    # CompanyProfile 1 / Vacancy 10 / CandidateProfile 5
# outros: ./scripts/db.sh logs | psql | reset | down
```

`DATABASE_URL` local (não commitar):

```bash
export DATABASE_URL="postgresql://w2talent:w2talent@localhost:5437/w2talent"
export JWT_SECRET="local-dev-jwt-change-me"
export CRON_SECRET="local-dev-cron-change-me"
```

Ou crie `~/.env` / use `direnv` — o repo ignora `.env*` (ver `docs/INFRA_TEMPORARIA.md` para o que é temporário).

### 3) Migrar e semear

```bash
npx prisma generate
npx prisma migrate dev --name init-w2talent   # ou: npx prisma migrate deploy (CI)
DATABASE_URL="postgresql://w2talent:w2talent@localhost:5437/w2talent" \
  npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-w2talent.ts
# seed valida: 500 skills (lib/taxonomy.ts) + semeia demo-company 10 vagas/5 candidatos
```

### 4) Rodar

```bash
DATABASE_URL="postgresql://w2talent:w2talent@localhost:5437/w2talent" npm run dev
# http://localhost:3000  →  /  /vagas?q=Analista%20Cloud  /candidatos?q=Cloud

npm test -- --runInBand   # 11 suítes, 129 pass, 3 skipped (sem DATABASE_URL)
npm run build             # Next 15.5, 15 rotas (validado no CI e no Pages)
```

Sem Postgres, o app ainda sobe e lista o demo estático — ideal para o `workers.dev`.

---

## Variáveis de ambiente

| Key | Local (dummy) | Produção (obrigatório) |
|-----|---------------|------------------------|
| `DATABASE_URL` | `postgresql://w2talent:w2talent@localhost:5437/w2talent` | Não usada: o Worker conecta no Neon pelo binding `HYPERDRIVE` (`wrangler.jsonc`); migrations pelo segredo `NEON_DATABASE_URL` no GitHub |
| `JWT_SECRET` | `local-dev-jwt-*` | `openssl rand -base64 32` (throw em prod se ausente; build permite `NEXT_PHASE=phase-production-build`) |
| `CRON_SECRET` | `local-dev-cron-*` | `openssl rand -base64 32` (protege `GET /api/cron/hygiene` + `PATCH` webhooks) |
| `WEBHOOK_SECRET` | — | opcional, fallback para `CRON_SECRET` |
| `PROXY_DOMAIN` | `via.w2talent.com` | `via.w2talent.com` |
| `NEXT_PUBLIC_BASE_URL` | `http://localhost:3000` | `https://w2talent.com` |
| `RESEND_API_KEY` | — | `re_xxx` (quando ligar e-mail real) |

Ver `.env.example` no repo.

---

## Estrutura

```
w2talent/
├── app/
│   ├── page.tsx                    # landing split-stage (Bodoni Moda/Jost, slate/sage/blush/olive)
│   ├── vagas/page.tsx              # lista vagas (header olive)
│   ├── candidatos/page.tsx         # busca candidatos (header sage)
│   ├── (app)/minhas-candidaturas/  # status enviado > visualizado > respondido
│   ├── api/
│   │   ├── auth/otp|verify         # OTP 5min + JWT
│   │   ├── candidates(|/[id]|/ingest)  # CV canônico (pdf-parse/mammoth)
│   │   ├── vacancies(|/[id]|/[id]/renew) # vaga canônica 14d + renew idempotente
│   │   ├── search/{vacancies,candidates} # hybrid tsvector+vector
│   │   ├── applications/batch      # POST lote 10/30 + PATCH webhook + GET (IDOR fix: exige JWT em prod)
│   │   ├── contacts/batch          # POST RH lote 1 template + PATCH proxy B
│   │   ├── cron/hygiene            # GET cron 180d/14d idempotente
│   │   └── seed/demo               # POST semeia demo (staging volátil)
│   └── layout.tsx + globals.css    # Tailwind + next-intl provider
├── components/                     # vacancy-table/cards, candidate-*, detail-modal, batch-bar, empty-state, cv-preview-form
├── lib/
│   ├── proxy.ts                    # Map in-memory MVP + Resend mock (TODO: Prisma+Redis)
│   ├── auth.ts                     # OTP + JWT + LGPD 4 flags
│   ├── search.ts                   # hybrid + demo-data fallback
│   ├── demo-data.ts                # 10 vagas + 5 candidatos (staging sem Postgres)
│   ├── taxonomy.ts                 # 500 skills + sinônimos
│   ├── hygiene.ts                  # ttl 14/180 + nudges D150/165/175 + purge
│   └── embeddings.ts               # multilingual-e5 stub
├── prisma/
│   ├── schema.prisma               # CompanyProfile, CandidateProfile, Vacancy, Application, OtpCode, ConsentLog
│   ├── migrations/                 # 20261106182402_init_w2talent
│   ├── seed-taxonomy.ts            # valida 500
│   └── seed-w2talent.ts            # demo-company 10/5
├── scripts/db.sh                   # up/down/reset/status/logs/psql para w2talent-db:5437
├── messages/                       # pt-BR.json, en.json
├── docs/
│   ├── superpowers/specs/2026-11-07-w2talent-design.md  # spec aprovado
│   ├── superpowers/plans/2026-11-07-w2talent-fase1-mvp.md # plano 10 tasks
│   ├── GUIA_TRABALHO.md            # como continuar de outro notebook via SSH 192.168.1.254
│   └── INFRA_TEMPORARIA.md         # o que remover ao final (w2talent-db)
├── AGENTS.md                       # handoff para qualquer agente (leia ao abrir o projeto)
└── vercel.json / wrangler.jsonc / open-next.config.ts
```

---

## Deploy (Cloudflare Pages — auto-deploy, 100% grátis)

> **Hoje:** só `workers.dev`. `w2talent.com` não está em Custom Domains — não publicar sem ordem explícita do Euclides.

- Projeto **Pages** `w2talent` conectado ao GitHub `euclidesmcse/w2talent` branch `main`.
- **Trigger:** todo `git push origin main` → webhook → `git pull → build → deploy` automático. Provas: `ab4ced2`, `2427772`, `f6f2071`, `a097ba0`, `c9f2ccb`, `f41491b` viraram `Success` sozinhos.
- **Build command:** `npx prisma generate && npm run build`
- **Deploy (OpenNext):** `opennextjs-cloudflare build && opennextjs-cloudflare deploy` (Output: `.open-next`)
- **Node:** 22 · **Compat date:** `2026-11-04` (`wrangler.jsonc`)
- **Variáveis no Pages → Settings → Variables:** ver tabela acima. Sem `DATABASE_URL` real o search usa `lib/demo-data.ts`.
- **Publicar w2talent.com (quando ordenado):** Cloudflare Dashboard → `w2talent` → `Settings` → `Domains & Routes` → `Add Custom Domain` → `w2talent.com` + `www.w2talent.com` → `Activate` (CNAME automático, domínio já está na conta).

Local vs Cloudflare:

```bash
git add -A && git commit -m "feat: ..." && git push origin main
# → workers.dev atualiza em ~2 min (aba Deployments → Success)
```

---

## Documentação

- **Spec (fonte da verdade):** `docs/superpowers/specs/2026-11-07-w2talent-design.md` — intent, fases (A→B→C), hygiene, LGPD decisão B, schema canônico
- **Plano:** `docs/superpowers/plans/2026-11-07-w2talent-fase1-mvp.md` — 10 tasks, file structure, interfaces, review focus
- **Ledger:** `.superpowers/sdd/2026-11-07-w2talent-fase1-mvp/progress.md` — tasks 1..10 complete, deferred minors, rulings, adjudications
- **Guias:** `docs/GUIA_TRABALHO.md` (outro notebook via SSH 192.168.1.254, `tmux`, Remote-SSH) · `docs/INFRA_TEMPORARIA.md` (o que é temporário)
- **Handoff agente:** `AGENTS.md` — leia ao abrir o projeto em nova sessão
- **CI:** `.github/workflows/ci.yml` — `prisma generate → jest → next build` em todo push/PR (badge acima)

---

## Roadmap

- **Fase 1 MVP — concluída (2026-11-06):** 10 tasks + final review + fix wave. Tags `v0.1.0-fase1-mvp`, `v0.1.1-w2talent-rebrand`, `f612963`.
- **Fase 1.1 polish:** PWA icons reais, `vaul` drawer, `timingSafeEqual` no webhook secret, `purge vacancy 30d`, embeddings OmniRoute reais, `GET /api/applications/batch` IDOR hardening.
- **Fase 2:** Coach IA `objetivoCrescimento`, ranking `94% match` explicado, dashboard RH, alertas n8n top 20, swipe mobile, ATS feeder.
- **Fase 3:** Auto-piloto conversacional (opt-in).
- **Visão v2 + arquitetura v2 (aprovadas, 2026-11-08):** reorganiza as fases em 1.5 Fundação v2 → 2 Recrutador completo → 3 Inteligência e escala. Ver `docs/superpowers/specs/2026-11-08-w2talent-design-v2.md` §12.

---

## Regras operacionais

- **Sempre** `git push origin main` após cada etapa — GitHub é a fonte, nunca só local. Outras pessoas colaboram por lá.
- **Nunca** publicar `w2talent.com` sem ordem explícita. Staging é `workers.dev`.
- **Não** migrar `w2talent-db` (Docker `5437`) para K8s sem pedido. Ver `docs/INFRA_TEMPORARIA.md` para remoção no final.
- **Sempre** ler `AGENTS.md` + `progress.md` ao abrir o projeto em nova sessão.

---

## Licença

Sem licença publicada ainda — trate como `All rights reserved` até o Euclides definir. Para colaborar, abra issue/PR em https://github.com/euclidesmcse/w2talent.
