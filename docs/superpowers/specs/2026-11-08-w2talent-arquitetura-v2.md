# W2Talent — Arquitetura v2 (Cloudflare + IA de RH)

**Data:** 2026-11-08
**Autor:** Euclides + Claude (thread "Planejar a nova versão do W2Talent")
**Status:** ✅ APROVADO por Euclides em 2026-11-08. Passo 2 de 4 do plano (ver `2026-11-08-w2talent-design-v2.md` §12).
**Depende de:** `2026-11-08-w2talent-design-v2.md` (o *quê*). Este documento é o *como*.

> **Premissas:** Q1–Q6 da spec v2 §11 foram assumidas conforme a recomendação, por escolha do Euclides em 2026-11-08 ("sigo com suas recomendações"). Cada uma aparece marcada **[Q#]** onde influencia uma decisão. Se alguma mudar, só a seção marcada precisa ser revista.
>
> | Q | Premissa assumida |
> |---|-------------------|
> | Q1 | Celular **opcional** (só para notificações) |
> | Q2 | Só o **admin da plataforma** cadastra APIs de LLM |
> | Q3 | Agenda integra **Google Calendar e Microsoft Outlook** desde a primeira versão do dashboard |
> | Q4 | **Postgres + pgvector** (Neon) ligado à Cloudflare via **Hyperdrive** |
> | Q5 | Automações críticas vão para **Cloudflare Cron/Queues**; n8n fica para o que não é crítico |
> | Q6 | Lançamento focado em **TI**, com modelo de dados pronto para qualquer área |

---

## 1. Visão geral

```
                         ┌──────────────── Cloudflare ────────────────────────────────────────┐
 Navegador / PWA  ──────►│ Worker "w2talent" (Next.js 15 via OpenNext)                        │
 (web, celular)          │   ├─ páginas SSR + API routes                                      │
                         │   ├─ Better Auth (Google, Microsoft, e-mail) + TOTP                │
                         │   └─ AI Router ──► AI Gateway ──► Workers AI / Claude / OpenAI /   │
                         │                                   OpenRouter / DeepSeek / Kimi / … │
                         │ Durable Objects: chat (1 por conversa), rate limit por usuário     │
                         │ Queues: ia-jobs, notificacoes, reindex                             │
                         │ Cron Triggers: higiene CV/vaga, pesos de ranking, agregados        │
                         │ R2: arquivos de CV, fotos, exportações                             │
                         │ KV: cache de traduções de interface, flags                         │
                         │ Hyperdrive ──────────────────────────────────────────┐             │
                         │ Turnstile (anti-bot), Email Routing (via.w2talent.com)│             │
                         └──────────────────────────────────────────────────────┼─────────────┘
                                                                                 ▼
                                                           Neon Postgres 16 + pgvector  [Q4]
                                                           (branch staging / branch prod)

 Servidor local (192.168.1.254): n8n para automações NÃO críticas + ambiente de desenvolvimento  [Q5]
```

**Princípio:** tudo que está no caminho do usuário roda na Cloudflare. O servidor de casa não pode derrubar o produto.

---

## 2. Runtime web

- **Mantém:** Next.js 15 + OpenNext no Worker `w2talent`, com a config versionada desde a PR #3 (`wrangler.jsonc`, versões fixas).
- **UI:** Tailwind + shadcn/ui (componentes acessíveis, sem peso extra). O design system novo é o passo 3.
- **PWA:** manifest + service worker (offline para "Minhas candidaturas" e para a lista "Selecionadas"). Um app de loja virá depois, com Capacitor empacotando o mesmo PWA.
- **Cache:** habilitar o cache incremental do OpenNext em R2 (hoje o build avisa que está desligado).

---

## 3. Dados

### 3.1 Banco — [Q4]
- **Neon Postgres 16 + pgvector**, com **branches** `staging` e `prod`. Cada PR pode ganhar um branch efêmero de banco.
- Acesso pelo Worker via **Hyperdrive** (pool de conexões + cache de leitura na borda).
- **Prisma no Worker:** o motor padrão do Prisma não roda em Workers. Precisa do *driver adapter* (`@prisma/adapter-pg` sobre Hyperdrive, ou `@prisma/adapter-neon`). **Risco a validar primeiro (spike de 1 dia):** é por isso que o staging de hoje cai em `lib/demo-data.ts`, já que ainda não existe banco real conectado.
- O `w2talent-db` local (Docker :5437) continua só para desenvolvimento e sai no fim (`docs/INFRA_TEMPORARIA.md`).

### 3.2 Arquivos
- **R2** `w2talent-files`: CVs originais (PDF/DOCX/foto), fotos de perfil e exportações (CSV/XLSX/PDF). Links assinados com expiração. Exportações compartilhadas expiram em 7 dias por padrão.

### 3.3 Mudanças no modelo de dados (resumo)

| Área | Novo / alterado |
|------|-----------------|
| Identidade | `User`, `Account` (Google/Microsoft/credencial), `Session`, `TwoFactor`, `Verification` (tabelas do Better Auth). `CandidateProfile.userId` e `ConsentLog.userId` passam a apontar para `User.id`. **Corrige o bug do consentimento LGPD que não era gravado** (achado na PR #3). |
| Empresa | `Organization` (= CompanyProfile) + `Membership` (recrutadores de uma empresa, papéis `owner`/`recruiter`/`viewer`). |
| Aprovar antes de enviar | `Shortlist` (vagas selecionadas) + `ApplicationApproval` (`candidateId`, `vacancyId`, `vacancyVersionHash`, `approvedAt`, `ip`, `userAgent`). `Vacancy.versionHash` recalculado a cada edição relevante; se o hash muda, a aprovação cai. O índice único `(candidateId, vacancyId)` em `Application` continua bloqueando reenvio. |
| Ficha mínima | `CandidateProfile.completude` + validação dos campos obrigatórios da spec v2 §6.2. `celular` passa a ser opcional **[Q1]**. |
| Ficha W2 | `CandidateCard` (versionada: `profileVersion`, `modelId`, `json`, `geradaEm`, `revisadaPeloCandidato`). |
| Antiduplicação de vagas | `Vacancy.fingerprint` (título normalizado + local + empresa) com índice único parcial `WHERE status='ativa'` + checagem semântica por embedding (similaridade > 0,90 pede confirmação). |
| Pipeline e agenda | `PipelineStage` (por aplicação), `Interview` (horário, link, status), `CalendarConnection` (token OAuth criptografado), `AvailabilitySlot`, `BookingLink`. **[Q3]** |
| IA | `LlmProvider`, `LlmModel`, `CompatibilityReport`, `TaskRoute`, `AiInteraction` (auditoria: tarefa, modelo, tokens, custo, latência, hash da entrada). |
| Aprendizado | `FeedbackSignal` (tipo, ator, alvo, peso), `RankingWeights` (escopo: global/área/empresa/recrutador), `MarketStat` (agregados anônimos). |
| Áreas além de TI | `Taxonomy` passa a ter `area` (TI primeiro; saúde, vendas etc. depois, sem migração estrutural). **[Q6]** |
| Suporte | `SupportConversation`, `SupportTicket` (escalonamento para humano). |

---

## 4. Autenticação e segurança

### 4.1 Biblioteca: **Better Auth** — [PROPOSTA]
Motivo: roda em Workers, usa o mesmo Postgres via Prisma e já traz Google, Microsoft, e-mail/senha, **TOTP com códigos de recuperação**, passkeys e organizações/membros. Isso evita escrever autenticação na mão. Alternativa avaliada: Auth.js. Ela tem um suporte mais fraco a MFA e organizações, e precisaria de código próprio para o TOTP.

### 4.2 Provedores
- **Google** (OAuth 2.0 / OIDC): escopos `openid email profile`.
- **Microsoft** (Entra ID, tenant `common`): aceita contas pessoais (Hotmail/Outlook/Live) **e** corporativas.
- **E-mail + senha**: última opção na tela, com verificação por link, senha com hash (scrypt/argon2) e Turnstile no cadastro.
- **Agenda [Q3]:** os escopos de calendário (`calendar.events` no Google, `Calendars.ReadWrite` + `OnlineMeetings.ReadWrite` na Microsoft) são pedidos **só quando o recrutador conecta a agenda** (consentimento incremental), nunca no login.

### 4.3 MFA
- **TOTP (RFC 6238)**, compatível com Google Authenticator e Microsoft Authenticator. Cadastro via QR code, 10 códigos de recuperação e "lembrar este dispositivo por 30 dias".
- **Obrigatório** para membros de empresa e para contas de e-mail/senha. **Opcional** para candidatos que entram com Google/Microsoft.

### 4.4 Migração do login atual
O OTP por celular + JWT próprio (`lib/auth.ts`) é substituído. Como ainda não há usuários reais (só dados demo), **não é preciso migrar contas**: basta trocar o fluxo e apagar o código antigo junto com os testes de OTP.

### 4.5 Proteções
Cookies `httpOnly`/`Secure`/`SameSite=Lax`, CSRF do Better Auth, rate limit por IP e por usuário (Durable Object), Turnstile no cadastro e no envio em lote, cabeçalhos de segurança (CSP) em `public/_headers` e alerta por e-mail em login de dispositivo novo.

---

## 5. Camada de IA

### 5.1 Componentes
```
lib/ai/
  tasks.ts        → catálogo de tarefas + requisitos (tabela §5.2)
  providers/      → adaptadores: openai-compatible, anthropic, google, workers-ai
  router.ts       → escolhe o modelo por tarefa (custo, fallback, limites)
  compat.ts       → bateria de testes de compatibilidade (§5.4)
  keys.ts         → criptografia das chaves (AES-GCM, chave mestra em Worker Secret)
  audit.ts        → grava AiInteraction
```
Todas as chamadas saem pelo **Cloudflare AI Gateway** (`gateway.ai.cloudflare.com/.../w2talent`), com cache, limite, log de custo e retry.

### 5.2 Tarefas e requisitos

| Tarefa | JSON estruturado | Ferramentas | Contexto mín. | Visão | Padrão sugerido |
|--------|:---:|:---:|:---:|:---:|-----------------|
| `extract_cv` (CV → canônico) | ✔ | — | 32k | ✔ se for foto | modelo comercial médio |
| `extract_vacancy` | ✔ | — | 16k | — | modelo comercial médio |
| `ficha_w2` | ✔ | — | 32k | — | modelo comercial de qualidade |
| `match_explain` | ✔ | — | 16k | — | modelo barato |
| `coach_candidate` / `coach_recruiter` | — | — | 32k | — | modelo comercial de qualidade |
| `support_chat` | — | ✔ | 32k | — | modelo comercial de qualidade |
| `compose_message` | — | — | 8k | — | modelo barato |
| `translate_ui` / `translate_content` | — | — | 8k | — | Workers AI ou modelo barato |
| `embed` | — | — | 512 tokens | — | **Workers AI `@cf/baai/bge-m3`** (multilíngue, 1024 dims, compatível com o `vector(1024)` atual) |

### 5.3 Provedores cadastráveis — [Q2: só admin]
- **"Compatível com OpenAI"** (`baseURL` + chave) cobre **OpenRouter, DeepSeek, Kimi (Moonshot), Qwen (DashScope modo compatível), Groq, Mistral, Together** e qualquer outro que siga esse padrão.
- Adaptadores nativos: **Anthropic** (Claude), **Google** (Gemini) e **Workers AI** (binding `AI`, sem chave).
- Ao cadastrar: validar a chave → listar modelos (`/models` quando existir) → admin escolhe → rodar `compat.ts`.

### 5.4 Teste de compatibilidade
Para cada modelo × tarefa, roda chamadas curtas e determinísticas:
1. **JSON:** pede um objeto com schema fixo e valida com zod. Falha → *"não gera JSON estruturado de forma confiável (2 de 3 tentativas inválidas)"*.
2. **Ferramentas:** oferece uma ferramenta fictícia e confere se ela é chamada com os argumentos certos.
3. **Contexto:** lê o limite nos metadados do provedor e, se não houver, faz uma chamada no limite exigido.
4. **Visão:** envia uma imagem pequena com texto conhecido.
5. **Idiomas:** 3 perguntas curtas em PT/EN/ES com resposta verificável.
6. **Embeddings:** confere a dimensão. Se for diferente de 1024, avisa que **troca exige reindexar**.
7. **Latência e custo:** mede o tempo e lê o preço configurado.

O resultado fica em `CompatibilityReport`. O painel mostra ✔/✖ por tarefa com a **explicação em português** e sugere modelos que passaram.

### 5.5 Roteamento
`TaskRoute` por tarefa: `modo = automático | fixo`. No automático, usa o **mais barato que passou** no teste, com fallback na ordem de custo. Respeita orçamento diário por tarefa e por usuário. Se um provedor falhar 3× em 5 min, o router o pula por 10 min (circuit breaker).

### 5.6 Segurança das chaves
Chaves criptografadas com AES-GCM. A chave mestra fica em um **Worker Secret** (`AI_KEYS_MASTER`), nunca no banco nem no repositório. O painel só mostra os 4 últimos caracteres e nenhuma API devolve a chave.

### 5.7 Privacidade (LGPD) no envio para LLMs
- Antes de mandar um CV para um provedor externo, **remove o contato** (e-mail, telefone, endereço) e o substitui por marcadores. O LLM não precisa disso.
- Cada provedor tem a flag `aceitaDadosPessoais` e uma nota sobre o DPA ou a política de retenção. Tarefas com dados pessoais só usam provedores marcados.
- Consentimento `iaReescrita` (v1) checado antes de qualquer chamada sobre o perfil do candidato.

---

## 6. Busca e ranking
- **Híbrida** (mantida): `ts_rank` + cosseno no pgvector, agora com embeddings reais (`bge-m3`) em vez do stub de zeros (`lib/embeddings.ts`).
- Índice **HNSW** no pgvector para as colunas `embedding`.
- **Match explicado:** score determinístico (pesos da v1 §5.3) calculado no SQL/TS. A LLM **só redige a explicação**, nunca decide a nota. Assim o ranking fica auditável e barato.
- Filtros = colunas indexadas. A busca em linguagem natural é convertida em filtros + texto por `match_explain`/parser leve e cacheada por consulta.

---

## 7. Aprendizado de padrões
1. **Sinais** (`FeedbackSignal`): aprovou/descartou vaga, abriu ficha, contatou, avançou etapa, contratou.
2. **Cron diário** recalcula `RankingWeights` por escopo com atualização bayesiana simples: pesos limitados a ±50% do padrão e mínimo de 30 sinais antes de sair do global.
3. **Agregados de mercado** (`MarketStat`): skills em alta, faixa salarial por cargo/região, tempo de contratação. Só publica quando há **≥ 10 registros** (anonimato).
4. **Memória por usuário:** preferências inferidas, que o usuário pode ver e apagar.
5. **Futuro:** fine-tuning de um modelo aberto com dados anonimizados e consentidos, fora do escopo desta fase.

---

## 8. Chat de suporte e coach
- **Durable Object** `ChatSession` por conversa: guarda o histórico, faz streaming (SSE) e aplica o rate limit.
- **Base de conhecimento:** páginas de ajuda em Markdown no repo (`content/ajuda/*.md`), indexadas no pgvector na hora do deploy.
- **Ferramentas do chat:** `buscar_vagas`, `explicar_match`, `status_candidatura`, `abrir_ticket`. Sempre no escopo do usuário logado; o chat nunca enxerga dados de terceiros.
- **Escalonamento:** baixa confiança ou o pedido "falar com humano" cria um `SupportTicket` e manda e-mail para o admin.
- **Coach:** as mesmas peças, com prompts próprios para candidato e recrutador, alimentados por `MarketStat`.

---

## 9. Automação e notificações — [Q5]

| Rotina | Onde roda | Frequência |
|--------|-----------|------------|
| Higiene de CV (180d) e de vaga (14d), purge D+30 | Cron Trigger → Queue `notificacoes` | diária |
| E-mails transacionais (aviso de expiração, nova candidatura, convite de entrevista) | Queue `notificacoes` → provedor de e-mail | sob demanda |
| Extração de CV, Ficha W2, embeddings | Queue `ia-jobs` (retry com backoff, dead-letter) | sob demanda |
| Reindexação (troca de modelo de embedding) | Queue `reindex` | sob demanda |
| Pesos de ranking + agregados de mercado | Cron Trigger | diária |
| Relatórios internos, integrações de marketing, testes | **n8n** no servidor local | livre |

- **E-mail de saída:** Resend (já previsto na v1), com domínio `w2talent.com` (SPF/DKIM/DMARC).
- **Proxy `via.w2talent.com` (entrada):** Cloudflare Email Routing → Email Worker, que associa a resposta à `proxyThreadId` e libera o contato (decisão B da v1).
- O workflow `n8n/workflows/hygiene.json` é aposentado quando o Cron entrar.

---

## 10. Idiomas
- `next-intl` (mantido). Catálogos **PT-BR, EN, ES** revisados em `messages/`.
- **Outros idiomas:** na primeira visita a um idioma sem catálogo, o Worker gera a tradução via `translate_ui`, guarda no **KV** (`i18n:{locale}:{hash-do-catálogo}`) e mostra o selo "tradução automática". Quando o catálogo PT-BR muda, o hash muda e a tradução é refeita sob demanda.
- RTL: `dir="rtl"` por locale e CSS com propriedades lógicas (`ms-`/`me-` no Tailwind).
- Conteúdo (vagas/CVs): idioma original + `translate_content` sob demanda, com cache por (id, versão, idioma).

---

## 11. Ambientes, CI e observabilidade
| | Staging | Produção |
|-|---------|----------|
| URL | `w2talent.euclidespns.workers.dev` | `w2talent.com` (só com ordem explícita) |
| Banco | Neon branch `staging` | Neon branch `prod` |
| IA | AI Gateway `w2talent-staging`, orçamento baixo | AI Gateway `w2talent` |
| Segredos | Worker Secrets por ambiente (`wrangler.jsonc` → `env.staging` / `env.production`) | idem |

- **CI** (já verde desde a PR #3): testes com Postgres + build + bundle OpenNext. Novo: `prisma migrate deploy` no staging após merge na `main`.
- **Observabilidade:** Workers Logs (já ligado) + AI Gateway analytics + `AiInteraction` para custo por tarefa.
- **Preview por PR:** comando de deploy de não-produção `npm run upload` no painel (pendente de confirmação na aba "Previews Base").

---

## 12. Ordem de implementação sugerida (entra no backlog do passo 4)
1. **Spike de banco:** Neon + Hyperdrive + Prisma driver adapter no Worker, com uma rota lendo do banco real. *(desbloqueia todo o resto)*
2. **Login novo:** Better Auth + Google/Microsoft/e-mail + TOTP; remove o OTP antigo; corrige a FK do `ConsentLog`.
3. **AI Router + AI Gateway + cadastro de provedores + teste de compatibilidade** (o painel admin pode ser simples no início).
4. **Embeddings reais (`bge-m3`) + Ficha W2 + ficha mínima** (Queue `ia-jobs`).
5. **Aprovar antes de enviar** (Shortlist, ApplicationApproval, versionHash).
6. **Cron/Queues de higiene e e-mail** (aposenta o n8n de higiene).
7. Depois disso começam a Fase 2 da spec v2 e o novo visual (passo 3), em paralelo.

---

## 13. Riscos e pontos a validar
| Risco | Mitigação |
|-------|-----------|
| Prisma em Workers (driver adapter, tamanho do bundle) | Spike #1. Plano B: Drizzle ORM, que é nativo em Workers, mas exige reescrever o acesso a dados. |
| Custo de LLM com volume | Roteamento por custo, cache no AI Gateway, score determinístico (a LLM só explica) e orçamento diário. |
| Envio de dados pessoais a provedores externos | Remoção de contato antes do envio + flag `aceitaDadosPessoais` + consentimento. |
| Qualidade variável de modelos "traga sua API" | Teste de compatibilidade obrigatório antes de ativar + monitoramento da taxa de JSON inválido em produção. |
| Dependência do servidor local | Nada crítico roda nele [Q5]. |
| Trocar o modelo de embedding | Dimensão fixa 1024 + reindexação por Queue com aviso no painel. |

---

**Aprovação:** ✅ Euclides, 2026-11-08. Próximo: passo 3 (design system + protótipo navegável).
