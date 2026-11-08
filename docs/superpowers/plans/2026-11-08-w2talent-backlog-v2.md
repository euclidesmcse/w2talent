# W2Talent — Backlog v2 por fases (passo 4)

**Data:** 2026-11-08 · **Status:** ✅ aprovado pelo Euclides em 2026-11-08
**Base:** spec v2 (`../specs/2026-11-08-w2talent-design-v2.md`), arquitetura v2 (`../specs/2026-11-08-w2talent-arquitetura-v2.md`), protótipo aprovado (canvas privado https://claude.ai/artifact/Sr4RAnTcV9Cs3N88YmeUMs).

## Como usar
- Cada item é um PR pequeno, com testes, que deixa `main` deployável na Cloudflare.
- Ordem = dependência. Não pular itens marcados como bloqueadores.
- Ao terminar um item: marcar ✅ aqui, anotar data e PR, e atualizar "Onde parou" no `AGENTS.md`.
- Regra do dono: qualquer dúvida de solução é combinada antes de codar.
- Legenda: ⏳ a fazer · 🔄 em andamento · ✅ feito · 🧪 spike (pode mudar o plano).

---

## Fase 1.5 — Fundação v2

| # | Item | Entrega / critério de pronto | Depende de | Status |
|---|------|------------------------------|------------|--------|
| 1.5.1 | 🧪 Spike banco | Neon + Hyperdrive + Prisma driver adapter no Worker; uma rota lê do banco real em staging; medir tamanho do bundle. Se falhar: decidir Drizzle (plano B) com o Euclides. | — | ⏳ |
| 1.5.2 | Migração de dados | Schema atual no Neon (pgvector); `DATABASE_URL` só via Hyperdrive; seed demo; CI continua com Postgres local. | 1.5.1 | ⏳ |
| 1.5.3 | Segurança pendente da Fase 1.1 | `timingSafeEqual` no webhook; correção do IDOR em `GET /api/applications/batch`; testes. | — | ⏳ |
| 1.5.4 | Design system no código | Tokens (Inter, #1F4FD8, #F7F8FA, bordas #E5E7EB), componentes base (botão, input, tabela, chip, cartão, toast) iguais ao protótipo; remove o visual antigo da landing. | — | ⏳ |
| 1.5.5 | Login novo | Better Auth: Google, Microsoft (Entra "common") e e-mail como última opção; TOTP (Google/Microsoft Authenticator) + códigos de recuperação; Turnstile; remove o OTP por telefone; **corrige FK do `ConsentLog` para `User`** (consentimento LGPD passa a gravar). | 1.5.2 | ⏳ |
| 1.5.6 | i18n PT/EN/ES | Textos de interface revisados nos três idiomas; seletor no cabeçalho; base para tradução automática (cache em KV) na Fase 2. | 1.5.4 | ⏳ |
| 1.5.7 | AI Router + AI Gateway | Adaptadores OpenAI-compatível, Anthropic, Google e Workers AI; roteamento por custo por tarefa; chaves cifradas (AES-GCM, `AI_KEYS_MASTER`); orçamento diário. | 1.5.2 | ⏳ |
| 1.5.8 | Admin de IA | Tela do protótipo: cadastrar API, listar modelos, teste de compatibilidade (JSON, ferramentas, contexto, visão, idiomas, embeddings, latência) com aviso em português do porquê; só admin da plataforma. | 1.5.7 | ⏳ |
| 1.5.9 | Embeddings reais | `@cf/baai/bge-m3` (1024 dim) via Queue `ia-jobs`; reindexação das vagas e candidatos existentes. | 1.5.7 | ⏳ |
| 1.5.10 | Ficha mínima + entrada de dados | Campos obrigatórios da spec §6.2; entrada por upload de CV (PDF/DOCX), LinkedIn (PDF exportado), formulário e conversa com a IA. | 1.5.5 | ⏳ |
| 1.5.11 | Ficha W2 | Resumo padronizado gerado pela IA (`CandidateCard`), editável pelo candidato antes de publicar; contatos removidos antes de enviar a provedores externos. | 1.5.9, 1.5.10 | ⏳ |
| 1.5.12 | Buscar vagas (candidato) | Tela "Vagas" do protótipo: busca em linguagem natural, chips "A IA entendeu", tabela com match e lacunas, seleção. | 1.5.4, 1.5.9 | ⏳ |
| 1.5.13 | Aprovar antes de enviar | Shortlist + `ApplicationApproval` com `vacancyVersionHash`; abrir → conferir → aprovar uma por uma → enviar em lote (10 por envio, 30 por dia); enviada fica marcada e não pode reenviar; se a vaga mudar, a aprovação cai. | 1.5.12 | ⏳ |
| 1.5.14 | PWA | Manifest, ícones, offline básico, layout de celular do protótipo. | 1.5.13 | ⏳ |
| 1.5.15 | Cron/Queues de higiene | Higiene 180d/14d e e-mails (Resend) em Cron/Queues da Cloudflare; n8n fica só para o não crítico. | 1.5.2 | ⏳ |

**Marco da Fase 1.5:** candidato entra com Google/Microsoft, monta a Ficha W2, busca vagas e envia em lote com aprovação. Staging em `workers.dev`. Publicar em `w2talent.com` **só com ordem do Euclides**.

---

## Fase 2 — Recrutador completo

| # | Item | Entrega / critério de pronto | Status |
|---|------|------------------------------|--------|
| 2.1 | Publicar vaga | Colar texto → IA estrutura; campos mínimos; **aviso de duplicada** (similaridade de embedding + empresa) com "atualizar existente"; coach de faixa salarial. | ⏳ |
| 2.2 | Candidatos + filtros | Tabela com filtros ricos, match explicado, Ficha W2 ao lado (tela do protótipo). | ⏳ |
| 2.3 | Resumos em tabela | Selecionar, comparar, exportar (CSV/XLSX/PDF) e receber resumos em tabela. | ⏳ |
| 2.4 | Painel RH | Vagas com funil leve (novas, triagem, entrevista, proposta), métricas básicas. | ⏳ |
| 2.5 | Agenda | Google Calendar e Outlook/Microsoft 365; link de agendamento com horários livres. | ⏳ |
| 2.6 | Coach + chat de suporte | Coach do candidato e do RH; chat de suporte com escalonamento para pessoa (Durable Objects). | ⏳ |
| 2.7 | Idiomas automáticos | Outros idiomas por tradução com IA, cache em KV, aviso de "tradução automática". | ⏳ |
| 2.8 | Sinais de aprendizado | `FeedbackSignal` (aprovou, rejeitou, contratou) gravado para a Fase 3. | ⏳ |

---

## Fase 3 — Inteligência e escala

| # | Item | Status |
|---|------|--------|
| 3.1 | Ranking adaptativo (`RankingWeights` por recrutador/vaga a partir dos sinais) | ⏳ |
| 3.2 | Inteligência de mercado (`MarketStat`: faixas, demanda por skill) | ⏳ |
| 3.3 | App nas lojas (a partir do PWA) | ⏳ |
| 3.4 | Integração com ATS (feeder) | ⏳ |
| 3.5 | Canal WhatsApp | ⏳ |
| 3.6 | Ajuste fino de modelo aberto com dados anonimizados e consentidos | ⏳ |

---

## Pendências fora do backlog
- Preview de PR na Cloudflare falha (comando de não-produção no painel). Aguardando log ou print do Euclides.
- Trocar o token de API da Cloudflare emprestado de outro projeto (opcional).
- `w2talent-db` local continua no Docker; não migrar para K8s sem pedido.
