# W2Talent — Design Doc v2 (visão ampliada)

**Data:** 2026-11-08
**Autor:** Euclides + Claude (thread "Planejar a nova versão do W2Talent")
**Status:** 📝 RASCUNHO PARA REVISÃO — nada de código muda até o Euclides aprovar este documento
**Base:** `docs/superpowers/specs/2026-11-07-w2talent-design.md` (v1). Tudo da v1 continua valendo, **exceto onde esta v2 diz o contrário** (ver §2).

---

## 0. Como usar este documento

- É o **passo 1 de 4** do plano de evolução (ver §12). Ele fecha *o quê* o produto faz.
- O *como* técnico detalhado (passo 2), o visual (passo 3) e o backlog (passo 4) vêm depois, cada um com aprovação.
- Itens marcados **[DECIDIDO]** foram fechados com o Euclides. Itens **[PROPOSTA]** são recomendação, aguardando OK. Itens **[ABERTO]** precisam de resposta (ver §11).

---

## 1. Visão em uma frase

> **Uma plataforma web + app, limpa e leve como o site da Cloudflare, onde candidatos se candidatam a várias vagas de uma vez — mas só às que revisaram e aprovaram — e recrutadores encontram, comparam e agendam candidatos em minutos, com uma IA especialista em RH apoiando os dois lados o tempo todo.**

**Problema de mercado:** os sites atuais obrigam clicar vaga por vaga e enviar candidatura uma a uma. Não existe forma de enviar várias candidaturas de uma vez **sem virar spam**. Do outro lado, o RH recebe CVs em formatos diferentes, sem padrão, e não tem apoio para filtrar, comparar e agendar.

**Tese (mantida da v1, ampliada):** inteligência no meio, simplicidade nas pontas — e **nenhum dos dois lados fica sozinho**: sempre há IA (coach + chat) apoiando candidato e recrutador.

---

## 2. O que muda em relação à v1

| Tema | v1 (2026-11-07) | v2 (esta) |
|------|-----------------|-----------|
| Código | — | **[DECIDIDO]** Evoluir o código atual (Next.js 15 + OpenNext na Cloudflare). Só o visual é refeito do zero. |
| Visual | Split-stage, Bodoni Moda/Jost, slate/sage/blush/olive | **[PROPOSTA]** Design system novo, estilo Cloudflare: fonte sans (Inter/system), fundo branco/cinza, 1 cor de destaque, alta densidade de informação, zero decoração. Ver §3. |
| Plataforma | Web + PWA leve | **[DECIDIDO]** PWA instalável primeiro; app de loja (iOS/Android) depois, empacotando o mesmo código. |
| Autenticação | OTP por celular (obrigatório) + JWT | **[PROPOSTA]** Login Google e Microsoft primeiro, MFA por app autenticador (TOTP), conta própria só como última opção. Celular deixa de ser obrigatório. Ver §4. |
| Candidatura em lote | Seleciona (☐) → `Candidatar (N)` | **Aprovar antes de enviar:** cada vaga precisa ser revisada e **aprovada/assinada** pelo candidato; só as aprovadas entram no envio em lote; vagas já enviadas ficam marcadas e bloqueadas. Ver §5. |
| Entrada do CV | PDF/DOCX/LinkedIn + form | Várias formas (arquivo, foto, texto colado, LinkedIn, **conversa com a IA**, form) + **ficha mínima obrigatória** para o RH. Ver §6. |
| Resumo do CV | `resumo3linhas` | **Ficha W2 padronizada** gerada pela IA a cada CV criado/atualizado. Ver §6.3. |
| Recrutador | Busca + contato em lote | + publicar vaga fácil **sem duplicar**, filtros ricos, **resumos em tabela** (exportar/compartilhar), **dashboard RH com agendamento**. Ver §7. |
| IA | Extração, embeddings, score, coach (Fase 2) | **LLM especialista em RH** com coach para os dois lados, **chat de suporte**, aprendizado de padrões. Ver §8. |
| Modelos de IA | OmniRoute fixo | **[DECIDIDO]** Workers AI + APIs comerciais via **Cloudflare AI Gateway** decidindo por custo, **e** o admin pode cadastrar qualquer API (OpenRouter, DeepSeek, Kimi, Qwen…), com checagem de compatibilidade e aviso. Ver §9. |
| Idiomas | PT-BR + EN, ES na Fase 2 | **[DECIDIDO]** PT-BR, EN e ES revisados no lançamento; **demais idiomas por tradução automática com IA**. Ver §10. |
| Anti-goal NG1 (sem pipeline/entrevistas) | Fora do MVP | **Revisto:** entra um pipeline **leve** + agendamento (sem testes técnicos nem vídeo). Continua proibido virar "Gupy 2.0". |

---

## 3. Princípios de UX (estilo Cloudflare) — [PROPOSTA]

1. **Leve de verdade:** página inicial < 100 KB de JS, carrega em < 1 s em 4G. Sem carrossel, sem animação decorativa, sem pop-up.
2. **Uma tela, uma tarefa:** cada tela tem uma ação principal óbvia (botão de destaque único).
3. **Informação densa e escaneável:** tabelas limpas no desktop, cards no celular, mesmo conteúdo (contrato da v1 §5.2 mantido).
4. **Busca no centro:** campo de busca em linguagem natural sempre visível + filtros em chips; o resultado entende "DevOps remoto PJ 15k inglês".
5. **Tipografia e cor:** fonte sans (Inter ou fonte do sistema), cinzas neutros, **1 cor de marca** para ação, verde/amarelo/vermelho só para status. Modo claro e escuro.
6. **Ajuda sempre a 1 clique:** botão de chat da IA fixo, que sabe em que tela o usuário está.
7. **Acessibilidade WCAG 2.1 AA** (mantido da v1) + suporte a idiomas da direita para a esquerda (árabe, hebraico).
8. **Zero "papagaiada":** nada que não ajude a encontrar, decidir ou agir.

O protótipo navegável destas telas é o **passo 3** (aprovação do visual antes do código).

---

## 4. Autenticação e segurança — [PROPOSTA]

**Ordem de preferência na tela de login:**
1. **Entrar com Google**
2. **Entrar com Microsoft** (contas pessoais Hotmail/Outlook/Live **e** contas corporativas Entra ID)
3. *Última opção, visualmente secundária:* criar conta com e-mail + senha (e-mail verificado por link).

**MFA (segundo fator):**
- Padrão **TOTP (RFC 6238)** — funciona com **Google Authenticator, Microsoft Authenticator**, Authy, 1Password etc. Cadastro por QR code + 10 códigos de recuperação.
- **Recrutador/empresa:** MFA obrigatório (acessa dados pessoais de candidatos).
- **Candidato com conta própria (e-mail/senha):** MFA obrigatório.
- **Candidato via Google/Microsoft:** MFA opcional e incentivado (o provedor já protege a conta).
- Futuro: passkeys (biometria do celular) como alternativa.

**Outros:** Cloudflare Turnstile contra bots no cadastro, rate limit, sessão com cookie seguro (httpOnly), log de acesso, e-mail de alerta em login novo.

**Impacto na v1:** celular deixa de ser ID obrigatório (C3 da v1). Fica **opcional** para notificações WhatsApp/SMS. Ver pergunta Q1 em §11.

---

## 5. Candidato: aprovar antes de enviar (anti-spam)

### 5.1 Estados de uma vaga para o candidato

```
encontrada → selecionada (☐) → revisada (abriu os detalhes) → APROVADA (assinou) → enviada ✓
                                                              ↘ descartada
```

### 5.2 Fluxo
1. Busca/filtra e marca vagas de interesse (☐) — vão para a **lista "Selecionadas"** (persistente, entre páginas e dispositivos).
2. Na lista "Selecionadas", cada vaga mostra **match % + o que falta** (IA). O candidato **precisa abrir cada vaga** para ver os detalhes.
3. Para cada vaga ele clica **"Aprovar candidatura"**. Essa é a **assinatura**: uma ação deliberada registrada com data/hora, versão da vaga e confirmação "Li a vaga e quero me candidatar". *(Opcional por vaga: mensagem curta personalizada, sugerida pela IA.)*
4. Botão único **"Enviar aprovadas (N)"** envia todas as aprovadas de uma vez, com resultado por item.
5. Vagas enviadas ganham selo **"Enviada em dd/mm"** e **não podem ser selecionadas de novo** (bloqueio no servidor, não só na tela).

### 5.3 Regras anti-spam
- Não dá para aprovar sem ter aberto a vaga.
- Se a vaga mudar depois da aprovação (salário, requisitos), a aprovação **cai** e o candidato precisa reaprovar.
- Limites da v1 mantidos como padrão configurável: **10 por envio, 30 por dia**.
- Se o match for muito baixo (ex.: < 40%), a IA **avisa** ("faltam 4 dos 5 requisitos obrigatórios") — não bloqueia, mas exige confirmar.
- Painel **"Minhas candidaturas"**: enviada → visualizada → respondida → entrevista → resultado.

---

## 6. Candidato: entrada de dados fácil + ficha padronizada

### 6.1 Formas de entrada (o candidato escolhe)
1. Enviar arquivo (PDF, DOCX).
2. **Foto do CV** pelo celular (IA lê a imagem).
3. Colar texto.
4. Importar do LinkedIn (exportação PDF do perfil).
5. **Conversar com a IA:** "me conte sua experiência" — a IA entrevista e monta o CV.
6. Formulário manual.

Em todos os casos a IA extrai para o **schema canônico da v1 (§5.4)** e mostra **1 tela de revisão editável** antes de publicar (mantido da v1).

### 6.2 Ficha mínima obrigatória (o que o RH precisa ver) — [PROPOSTA]
Sem estes campos o candidato não consegue enviar candidaturas (a IA ajuda a completar):
- Cargo/título desejado e senioridade
- Top 5 competências com anos de experiência
- Última experiência (cargo, empresa, período)
- Localidade + modelo (remoto/híbrido/presencial) + disponibilidade para mudança
- Regime aceito (CLT/PJ/outros) e pretensão salarial (faixa)
- Idiomas com nível
- Disponibilidade para início
- Contato (e-mail verificado; celular opcional)

### 6.3 Ficha W2 (resumo padronizado pela IA)
Gerada **toda vez que o CV é criado ou atualizado**. Mesmo formato para todos os candidatos, para qualquer recrutador entender em 10 segundos:

```
┌ Ana S. · Engenheira Cloud Pleno · 6 anos · São Paulo (remoto) · CLT/PJ · R$ 12–15k · início 30 dias
│ Resumo: 3 linhas objetivas escritas pela IA
│ Competências: AWS (5a) · Terraform (4a) · Kubernetes (2a) · Python (3a) · CI/CD (4a)
│ Destaques: 3 conquistas com evidência ("reduziu custo AWS 30%")
│ Idiomas: PT nativo · EN avançado
│ Para a vaga X: 87% match — falta: certificação CKA
└ Atualizado há 3 dias · Ficha gerada pela IA, revisada pelo candidato
```

**Regras de ética e LGPD:** a IA **nunca** usa nem infere idade, gênero, raça, religião, estado civil, deficiência, foto ou endereço exato para resumir ou pontuar. O candidato vê e pode corrigir a própria ficha. Consentimento `iaReescrita` da v1 mantido. Decisão final sempre humana (LGPD art. 20 — direito de revisão de decisão automatizada).

---

## 7. Recrutador / RH

### 7.1 Publicar vaga sem esforço
- Colar a descrição, enviar arquivo, ou ditar para a IA → IA estrutura no schema canônico (título, nível, competências obrigatórias × desejáveis, regime, faixa, local) → 1 tela de revisão → publica.
- **Antiduplicação:** antes de publicar, o sistema compara com as vagas ativas da empresa (título normalizado + local + similaridade semântica). Se for parecida (ex.: > 90%), avisa: *"Parece igual à vaga 'DevOps Sr' publicada em 02/11 — renovar a existente ou publicar mesmo assim?"*. Uma empresa não pode ter duas vagas idênticas ativas.
- Higiene de 14 dias da v1 mantida.

### 7.2 Encontrar candidatos
- Busca em linguagem natural + filtros combináveis (competências, senioridade, local, modelo, regime, faixa, idiomas, disponibilidade, atualização).
- **Buscas salvas** com alerta ("3 novos perfis para DevOps Sr").
- Ranking com match explicado (v1 Fase 2: skills 40%, nível 20%, regime/local 20%, recência 10%, completude 10%) — pesos ajustáveis pelo aprendizado (§8.3).

### 7.3 Resumos em tabela (enviar e receber)
- Selecionar candidatos → **tabela comparativa** com as colunas da Ficha W2 (lado a lado).
- **Exportar** CSV/Excel/PDF e **compartilhar por link** (com expiração) com o gestor da vaga.
- **Receber** candidaturas de uma vaga já como tabela ordenada por match.
- Contato em lote via proxy (v1 mantido: 10/lote, 30/dia, 1 modelo de mensagem + preview).

### 7.4 Dashboard RH
- **Vagas:** ativas, expirando, candidaturas por vaga, tempo médio de resposta.
- **Candidatos por vaga:** pipeline **leve** de etapas — *novo → em análise → entrevista → proposta → contratado / não seguiu*. Arrastar ou 1 clique. Sem formulários extras.
- **Agendamento:** conecta o calendário Google ou Microsoft do recrutador (mesmo login), o recrutador escolhe horários livres e o candidato **escolhe o horário por um link**; convite com link de reunião (Meet/Teams) gerado automaticamente; lembretes.
- **Métricas** (v1 G4 + North Star de liquidez da v1 §5.3).

---

## 8. IA especialista em RH ("W2 Assist")

### 8.1 Funções
| Função | Candidato | Recrutador |
|--------|-----------|------------|
| Extração/estruturação | CV → canônico | Descrição → vaga canônica |
| Ficha W2 | Gera e explica | Lê e compara |
| Match explicado | "87% — falta CKA" | "Top 20 para esta vaga, e por quê" |
| **Coach** | Como melhorar o CV, o que estudar para o objetivo (`objetivoCrescimento` da v1) | Como melhorar a vaga (faixa fora do mercado, requisitos demais), sugestão de filtros |
| **Chat de suporte** | "Por que não consigo enviar?", "Como funciona a aprovação?" | "Como exporto a tabela?", "Por que este candidato tem 60%?" |
| Redação | Mensagem de candidatura | Mensagem de contato, convite de entrevista |
| Tradução | Vagas no idioma do candidato | CVs no idioma do recrutador |

O chat é **contextual** (sabe a tela e os dados do usuário), responde com base em uma **base de conhecimento** da plataforma e **passa para um humano** (e-mail/ticket) quando não tem certeza.

### 8.2 Guarda-corpos
- Sem atributos sensíveis (§6.3). Toda pontuação tem explicação. Log de auditoria das sugestões.
- Usuário pode desligar coach/IA de reescrita (consentimentos v1).
- Custos controlados por limite diário por usuário e cache no AI Gateway.

### 8.3 Como ela "aprende padrões" — [PROPOSTA]
Em camadas, da mais simples à mais cara (não começamos treinando modelo):
1. **Sinais de uso:** cada ação vira sinal — vaga aprovada/descartada pelo candidato, candidato contatado/avançado/contratado pelo recrutador.
2. **Ranking adaptativo:** os sinais ajustam os pesos do match **por recrutador, por empresa e por área** (ex.: este RH valoriza inglês mais que o padrão).
3. **Inteligência de mercado:** agregados anônimos — competências em alta, faixas salariais por cargo/região, tempo médio de contratação — alimentam o coach dos dois lados.
4. **Memória por usuário:** preferências lembradas ("prefere PJ, remoto, fintech").
5. **Futuro (Fase 3+):** ajuste fino (fine-tuning/LoRA) de um modelo aberto com dados anonimizados e consentidos.

---

## 9. Provedores de LLM: AI Gateway + "traga sua API" — [DECIDIDO, detalhes PROPOSTA]

### 9.1 Roteamento padrão
- Todas as chamadas passam pelo **Cloudflare AI Gateway** (cache, limite, log, custo, fallback).
- **Workers AI** (modelos abertos da Cloudflare) para tarefas baratas e em volume: embeddings, classificação, tradução simples.
- **APIs comerciais** (Claude, OpenAI etc.) para tarefas que exigem mais qualidade: Ficha W2, coach, chat.
- O gateway escolhe por **custo**, com **cadeia de fallback** se um provedor cair.

### 9.2 Cadastro de qualquer API (painel admin)
1. Admin escolhe o provedor — **OpenRouter, DeepSeek, Kimi (Moonshot), Qwen (Alibaba), OpenAI, Anthropic, Google, Mistral, Groq, Workers AI** — ou **"Outro compatível com OpenAI"** (URL base + chave).
2. Informa chave da API e configurações (URL base, organização, limites, preço por token).
3. O sistema **lista os modelos disponíveis** daquela API e o admin seleciona.
4. **Teste automático de compatibilidade** por tarefa, antes de ativar:

| Requisito testado | Usado em |
|-------------------|----------|
| Saída JSON estruturada | Extração de CV/vaga, Ficha W2 |
| Chamada de ferramentas (function calling) | Chat de suporte, busca assistida |
| Janela de contexto mínima (ex.: 32k tokens) | CVs longos, comparação de candidatos |
| Leitura de imagem (visão) | Foto do CV |
| Qualidade em PT/EN/ES | Tudo |
| Embeddings (dimensão) | Busca semântica |
| Latência e custo | Roteamento |

5. Se o modelo **não for compatível** com uma tarefa, o painel **avisa e explica o porquê** — ex.: *"O modelo X não suporta saída JSON estruturada, por isso não pode gerar a Ficha W2. Selecione outro para esta tarefa (sugestões: …)."* O modelo pode continuar ativo para as tarefas em que passou.
6. **Roteamento por tarefa:** para cada tarefa (extração, ficha, coach, chat, tradução, embeddings) o admin define modelo principal + reservas; o padrão é "automático por custo".

**Segurança:** chaves guardadas **criptografadas**, nunca exibidas de volta (só os 4 últimos caracteres), nunca no repositório.
**Atenção embeddings:** trocar o modelo de embeddings exige reindexar todos os CVs/vagas — o painel avisa e agenda a reindexação.

---

## 10. Idiomas — [DECIDIDO]

- **Lançamento:** PT-BR, EN e ES com textos de interface **revisados**.
- **Demais idiomas** (FR, DE, IT, árabe, hindi, chinês, japonês…): interface **traduzida automaticamente pela IA**, guardada em cache, com aviso "tradução automática — ajude a melhorar". Suporte a escrita da direita para a esquerda.
- **Conteúdo** (vagas e CVs): mantém o idioma original + tradução sob demanda (v1 Fase 2, sem duplicar embedding).
- **Busca entre idiomas:** embeddings multilíngues — um RH em inglês encontra CV em português.
- Idioma detectado pelo navegador, trocável a qualquer momento, lembrado no perfil.

---

## 11. Perguntas abertas (preciso das respostas do Euclides)

- **Q1. Celular:** pode deixar de ser obrigatório (ficar opcional para notificações), já que o login passa a ser Google/Microsoft? *(Recomendo: sim.)*
- **Q2. Quem cadastra APIs de IA:** só você (admin da plataforma) ou também cada empresa com a própria chave? *(Recomendo: só admin agora; empresa com chave própria vira recurso pago depois.)*
- **Q3. Agendamento:** integrar com Google Calendar e Microsoft Outlook já na primeira versão do dashboard? *(Recomendo: sim, os dois, reaproveitando o login.)*
- **Q4. Banco de dados em produção:** manter Postgres + pgvector (Neon, ligado à Cloudflare via Hyperdrive) ou migrar para os serviços nativos da Cloudflare (D1 + Vectorize)? *(Recomendo: manter Postgres — o código e o schema atuais já usam; a escolha final fica no passo 2.)*
- **Q5. n8n no servidor local:** em produção, depender do servidor da sua casa é arriscado (queda de luz/internet). Mover automações críticas (higiene, notificações) para Cloudflare Cron/Queues e deixar o n8n para automações não críticas? *(Recomendo: sim.)*
- **Q6. Público inicial:** continua TI no Brasil (ICP da v1: PMEs de TI sem ATS) ou já abrir para todas as áreas? *(Recomendo: TI primeiro, arquitetura pronta para todas.)*

---

## 12. Plano de evolução (aprovado em 2026-11-08)

| # | Passo | Entrega | Status |
|---|-------|---------|--------|
| 1 | Fechar a visão do produto | Este documento (spec v2) | 📝 em revisão |
| 2 | Arquitetura na Cloudflare + IA de RH | Spec técnica: auth, banco, filas, AI Gateway, registro de provedores, aprendizado | ⏳ aguarda passo 1 |
| 3 | UX e protótipo navegável | Design system + telas-chave clicáveis | ⏳ |
| 4 | Backlog por fases + "onde parou" | Plano executável (fases 1.5 → 3) + AGENTS.md atualizado | ⏳ |

### 12.1 Fases de produto propostas (detalhadas no passo 4)
- **Fase 1.5 — Fundação v2:** novo visual, login Google/Microsoft + TOTP, aprovar-antes-de-enviar, ficha mínima, Ficha W2, AI Gateway + cadastro de provedores, PT/EN/ES. *(Inclui os itens de segurança pendentes da Fase 1.1: `timingSafeEqual` no webhook e correção de IDOR em `GET /api/applications/batch`.)*
- **Fase 2 — Recrutador completo:** publicar vaga com antiduplicação, tabelas comparativas/exportação, dashboard RH + agendamento, coach dos dois lados, chat de suporte, idiomas automáticos.
- **Fase 3 — Inteligência e escala:** ranking adaptativo, inteligência de mercado, app nas lojas, feeder para ATS, canal WhatsApp (v1 Fase 3).

---

**Aprovação:** pendente. Ao aprovar, este documento passa a ser a fonte da verdade junto com a v1 (a v2 prevalece onde houver conflito).
