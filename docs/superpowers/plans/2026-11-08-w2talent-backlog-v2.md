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
| 1.5.1 | 🧪 Spike banco | Neon + Hyperdrive + Prisma driver adapter no Worker; uma rota lê do banco real em staging; medir tamanho do bundle. Se falhar: decidir Drizzle (plano B) com o Euclides. | — | ✅ 2026-11-08, PR #5 (Neon + Hyperdrive + Prisma adapter pg; ver `docs/spikes/2026-11-08-neon-hyperdrive-prisma.md`) |
| 1.5.2 | Migração de dados | Schema atual no Neon (pgvector); `DATABASE_URL` só via Hyperdrive; seed demo; CI continua com Postgres local. | 1.5.1 | ✅ 2026-11-08, entregue junto com o 1.5.1 (PR #5): migrations e dados de exemplo no Neon pelo `migrate-neon.yml`, Worker só via Hyperdrive, CI com Postgres local |
| 1.5.3 | Segurança pendente da Fase 1.1 | `timingSafeEqual` no webhook; correção do IDOR em `GET /api/applications/batch`; testes. | — | ✅ 2026-11-08, PR #7 (também fechou o IDOR no POST, que confiava no `candidateId` do corpo) |
| 1.5.4 | Design system no código | Tokens (Inter, #1F4FD8, #F7F8FA, bordas #E5E7EB), componentes base (botão, input, tabela, chip, cartão, toast) iguais ao protótipo; remove o visual antigo da landing. | — | ✅ 2026-11-08, PR #8 (vitrine em `/design`; Lighthouse CI + axe no CI) + PR #9 (logo e melhorias) |
| 1.5.5 | Login novo | Better Auth: Google, Microsoft (Entra "common") e e-mail como última opção; TOTP (Google/Microsoft Authenticator) + códigos de recuperação; Turnstile; remove o OTP por telefone; **corrige FK do `ConsentLog` para `User`** (consentimento LGPD passa a gravar). | 1.5.2 | ✅ (e-mail e senha ficaram para um PR seguinte) |
| 1.5.6 | i18n PT/EN/ES | Textos de interface revisados nos três idiomas; seletor no cabeçalho; base para tradução automática (cache em KV) na Fase 2. | 1.5.4 | ✅ PR #10 (mesmo endereço, cookie `NEXT_LOCALE`) |
| 1.5.7 | AI Router + AI Gateway | Adaptadores OpenAI-compatível, Anthropic, Google e Workers AI; roteamento por custo por tarefa; chaves cifradas (AES-GCM, `AI_KEYS_MASTER`); orçamento diário. | 1.5.2 | ✅ PR #11 (plano: https://claude.ai/artifact/3EbNpTQKyDB4rtpdeBesQJ) |
| 1.5.8 | Admin de IA | Tela do protótipo: cadastrar API, listar modelos, teste de compatibilidade (JSON, ferramentas, contexto, visão, idiomas, embeddings, latência) com aviso em português do porquê; só admin da plataforma. | 1.5.7 | ✅ (PR do Admin de IA) |
| 1.5.9 | Embeddings reais | `@cf/baai/bge-m3` (1024 dim) pelo roteador, em segundo plano ao salvar (`waitUntil`) + rota `/api/ai/reindex` para os existentes; busca híbrida no banco (0,6 texto + 0,4 vetor). A Queue `ia-jobs` foi para o 1.5.15. | 1.5.7 | ✅ (PR #13) |
| 1.5.10 | Ficha mínima + entrada de dados | Campos obrigatórios da spec §6.2; entrada por upload de CV (PDF/DOCX), LinkedIn (PDF exportado), formulário e conversa com a IA. | 1.5.5 | ✅ (publicar pela conta de candidato desde o 1.5.5) |
| 1.5.11 | Ficha W2 | Resumo padronizado gerado pela IA (`CandidateCard`), editável pelo candidato antes de publicar; contatos removidos antes de enviar a provedores externos. | 1.5.9, 1.5.10 | 🔄 em PR |
| 1.5.12 | Buscar vagas (candidato) | Tela "Vagas" do protótipo: busca em linguagem natural, chips "A IA entendeu", tabela com match e lacunas, seleção. | 1.5.4, 1.5.9 | ✅ (PR #17) |
| 1.5.13 | Aprovar antes de enviar | Shortlist + `ApplicationApproval` com `vacancyVersionHash`; abrir → conferir → aprovar uma por uma → enviar em lote (10 por envio, 30 por dia); enviada fica marcada e não pode reenviar; se a vaga mudar, a aprovação cai. | 1.5.12 | ✅ (pela conta de candidato desde o 1.5.5) |
| 1.5.14 | PWA | Manifest, ícones, offline básico, layout de celular do protótipo. | 1.5.13 | ✅ (plano https://claude.ai/artifact/4qvsrs7fnDRVxPGW4ZB4rS) |
| 1.5.15 | Cron/Queues de higiene | Higiene 180d/14d e e-mails (Resend) em Cron/Queues da Cloudflare; n8n fica só para o não crítico. Aviso de vaga vencendo espera a ligação recrutador ↔ empresa (2.1); Queue `ia-jobs` com o 1.5.10. | 1.5.2 | ✅ PR #20 |

**Marco da Fase 1.5:** candidato entra com Google/Microsoft, monta a Ficha W2, busca vagas e envia em lote com aprovação. Staging em `workers.dev`. Publicar em `w2talent.com` **só com ordem do Euclides**.

---

## Fase 2 — Recrutador completo

| # | Item | Entrega / critério de pronto | Status |
|---|------|------------------------------|--------|
| 2.0 | Transparência da IA | Página pública `/ia` (3 idiomas): onde a IA aparece, que dados usa, quem decide, fornecedores, pedido de revisão (LGPD art. 20); selo "Como usamos IA" na Ficha W2 e nas vagas parecidas. Plano "IA para RH (SAP)" https://claude.ai/artifact/5JpSxKFhEGzLpnCMY5fbXA (A1). | ✅ PR #34 |
| 2.1 | Publicar vaga | Colar texto → IA estrutura; campos mínimos; **aviso de duplicada** (similaridade de embedding + empresa) com "atualizar existente"; coach de faixa salarial. Do plano SAP: **revisor de viés** no texto (regras PT/EN/ES + sugestão da IA, avisa e não bloqueia; vale também para a Ficha W2) e **perguntas de entrevista** geradas das competências (A3, A4). Plano https://claude.ai/artifact/XP96UhxpLXV4nrjA9Mi8Ua (D1–D6) em 3 PRs: **2.1a** empresa do recrutador + vagas só com login; **2.1b** tela Publicar vaga; **2.1c** revisor de viés e perguntas. | ✅ 2.1a (PR #36) · ✅ 2.1b (PR #37) · ✅ 2.1c (PR #38) |
| 2.2 | Candidatos + filtros | Tabela com filtros ricos, match explicado, Ficha W2 ao lado (tela do protótipo). Do plano SAP: **competências próximas** (mapa estático na taxonomia) contam parte do match e aparecem na explicação (A5). Plano https://claude.ai/artifact/Udj9hgTWMke2wKGtBQuxjE (D1–D6) em 3 PRs: **2.2a** competências próximas; **2.2b** vaga de referência, match do recrutador e filtros; **2.2c** Ficha W2 ao lado. | ✅ 2.2a (PR #39) · ✅ 2.2b (PR #40) · ✅ 2.2c |
| 2.3 | Resumos em tabela | Selecionar, comparar, exportar (CSV/XLSX/PDF) e receber resumos em tabela. Plano https://claude.ai/artifact/TyS3xB9BxT8c19yBEBiLV2 (D1–D6) em 2 PRs: **2.3a** comparar lado a lado; **2.3b** exportar CSV, Excel e PDF. Candidaturas recebidas em tabela vão para o 2.4; link de compartilhar fica para um item próprio. | ✅ 2.3a · ✅ 2.3b |
| 2.4 | Painel RH | Vagas com funil leve (novas, triagem, entrevista, proposta), métricas básicas. Plano https://claude.ai/artifact/BF4gHm5j3CEtxxCt37T29p (D1–D6) em 3 PRs: **2.4a** /rh com vagas e números + migração; **2.4b** candidaturas da vaga em tabela por match com etapas (inclui "receber candidaturas em tabela" do 2.3); **2.4c** contato liberado na Entrevista + e-mail ao candidato. | ✅ 2.4a · ✅ 2.4b · ✅ 2.4c |
| 2.5 | Agenda | Google Calendar e Outlook/Microsoft 365; link de agendamento com horários livres. Plano https://claude.ai/artifact/6hNYCyyQGaiAHpNk2YcKLL (D1–D7) em 3 PRs: **2.5a** horários digitados + link para o candidato escolher + convite .ics + migração; **2.5b** Google Agenda (livre/ocupado, Meet); **2.5c** Outlook/Microsoft 365 (Teams). | ✅ 2.5a · ⏳ 2.5b · ⏳ 2.5c |
| 2.6 | Coach + chat de suporte | Coach do candidato e do RH; chat de suporte com escalonamento para pessoa (Durable Objects). Do plano SAP: **2.6a** assistente de dúvidas só com textos do W2Talent (embeddings no Neon, sem dado pessoal, sem resposta segura → e-mail do admin pela fila) (A6); **2.6b** chat ao vivo com escalonamento; depois "o que falta para as vagas" no `/painel` (B1). Plano 2.6a https://claude.ai/artifact/6rdLK68qJGL4gWHTXucY2G (D1–D6). Plano B1 https://claude.ai/artifact/FZUugjHKYCrDcsxboLh9vg (D1–D6). | ✅ 2.6a (PRs #42 e #43), ✅ B1; falta 2.6b |
| 2.7 | Idiomas automáticos | Texto escrito por pessoas (vaga, Ficha W2) traduzido por IA para pt-BR/en/es, guardado no Neon (tabela `Traducao`, em vez de KV), aviso "Tradução automática · Ver original". Plano https://claude.ai/artifact/B4uemTny9TbLz5zQrBo98T (D1–D6): **2.7a** vagas + migração; **2.7b** Ficha W2. | ✅ 2.7a (PR #51) · ✅ 2.7b |
| 2.8 | Sinais de aprendizado | `FeedbackSignal` (aprovou, rejeitou, contratou) gravado para a Fase 3. Antecipado pelo plano SAP (A2), logo depois do 2.0. | ✅ (aprovou, desfez, caiu, enviou; recrutador: ficha vista, etapa, exportou, entrevista) |

---

## Fase 3 — Inteligência e escala

| # | Item | Status |
|---|------|--------|
| 3.1 | Ranking adaptativo (`RankingWeights` por recrutador/vaga a partir dos sinais) | ⏳ |
| 3.2 | Inteligência de mercado (`MarketStat`: faixas, demanda por skill). Plano https://claude.ai/artifact/REZMdpPqMMgLgUvwxXYRox (D1–D7): **3.2a** tabela + Cron + página pública `/mercado`; **3.2b** números no `/painel`, `/publicar` e `/rh`. | ✅ 3.2a · ✅ 3.2b |
| 3.3 | App nas lojas (a partir do PWA) | ⏳ |
| 3.4 | Integração com ATS (feeder) | ⏳ |
| 3.5 | Canal WhatsApp | ⏳ |
| 3.6 | Ajuste fino de modelo aberto com dados anonimizados e consentidos | ⏳ |

---

## Pendências fora do backlog
- Preview de PR na Cloudflare falha (comando de não-produção no painel). Aguardando log ou print do Euclides.
- Trocar o token de API da Cloudflare emprestado de outro projeto (opcional).
- `w2talent-db` local continua no Docker; não migrar para K8s sem pedido.
