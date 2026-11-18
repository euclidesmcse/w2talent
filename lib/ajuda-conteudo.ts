// Gerado por scripts/ajuda-gerar.js a partir de content/ajuda. Não edite à mão: mude o .md e rode `node scripts/ajuda-gerar.js`.
import type { ArtigoBruto } from "./ajuda";

export const ARTIGOS: Record<"pt-BR" | "en" | "es", ArtigoBruto[]> = {
  "pt-BR": [
    {
      "slug": "o-que-e",
      "titulo": "O que é o W2Talent",
      "resumo": "Para que serve o site, para candidatos e para recrutadores.",
      "areas": [
        "publico",
        "candidato",
        "recrutador"
      ],
      "telas": [
        "/",
        "/ajuda/minhas-conversas"
      ],
      "ordem": 1,
      "corpo": "O W2Talent liga candidatos de tecnologia a vagas. O candidato encontra vagas, confere cada uma e envia em lote só as que aprovou. O recrutador recebe a Ficha W2, um resumo padronizado do candidato, com o match explicado.\n\n## Para candidatos\n\n- Usar o W2Talent é de graça.\n- Você monta sua ficha a partir do CV em [Minha ficha](/minha-ficha).\n- Você busca vagas escrevendo como falaria, por exemplo \"DevOps remoto PJ 15 mil\".\n- Só vai para a empresa o que você aprovou.\n\n## Para recrutadores\n\n- Você cadastra a empresa em [Minha empresa](/empresa).\n- Você publica a vaga colando o texto, e a IA organiza os campos.\n- Você busca candidatos e ordena pelo match com uma vaga sua.\n\n## Falar com uma pessoa\n\nNão achou a resposta na Ajuda? Em [Falar com uma pessoa](/ajuda/conversa), você escreve para a equipe do W2Talent, com ou sem login.\n\n- Sem login, você informa um e-mail. Com login, usamos o e-mail da conta.\n- A resposta aparece na própria conversa e avisamos no seu e-mail, com o link.\n- Guarde o link: é por ele que você volta à conversa. Quem tiver o link vê a conversa.\n- Com login, as conversas ficam em [Minhas conversas](/ajuda/minhas-conversas), no menu da sua conta, e você abre cada uma sem o link.\n- Quem responde é uma pessoa. Nada da conversa vai para IA.\n- A equipe vê só o que você escreveu, a tela de onde você veio e, com login, se a conta é de candidato ou de recrutador.\n- Limites: 3 conversas novas por dia e 30 mensagens por conversa por dia, até 2.000 caracteres cada.\n- A conversa é apagada 180 dias depois de encerrada, com todas as mensagens.\n\nEsta é a versão de testes. O site muda com frequência."
    },
    {
      "slug": "entrar-e-perfil",
      "titulo": "Entrar e escolher o perfil",
      "resumo": "Login com Google ou Microsoft e a escolha entre candidato e recrutador.",
      "areas": [
        "publico",
        "candidato",
        "recrutador"
      ],
      "telas": [
        "/entrar",
        "/entrar/perfil"
      ],
      "ordem": 2,
      "corpo": "Você entra com uma conta Google ou Microsoft (pessoal ou de empresa). Não há senha própria do W2Talent por enquanto.\n\n## Ver vagas não precisa de login\n\nQualquer pessoa vê e busca as vagas. O login é pedido quando você quer marcar uma vaga, publicar sua ficha, enviar candidaturas ou buscar candidatos.\n\n## Candidato ou recrutador\n\nNo primeiro acesso você escolhe o perfil da conta, uma vez só:\n\n- **Candidato:** monta a ficha, aprova e envia candidaturas. Ao escolher, você aceita os termos de uso e de dados.\n- **Recrutador:** cadastra a empresa, publica vagas e busca candidatos. Precisa do [autenticador](/ajuda/autenticador).\n\nUma conta é candidato ou recrutador, não os dois. Para usar os dois lados, use outra conta Google ou Microsoft.\n\nSe você entrar com Google e depois com Microsoft usando o mesmo e-mail, as duas viram a mesma conta."
    },
    {
      "slug": "autenticador",
      "titulo": "Autenticador e códigos de recuperação",
      "resumo": "Como ligar o código do aplicativo autenticador e o que fazer se perder o celular.",
      "areas": [
        "candidato",
        "recrutador"
      ],
      "telas": [
        "/conta/seguranca",
        "/entrar/codigo"
      ],
      "ordem": 3,
      "corpo": "O autenticador é a segunda etapa do login: além do Google ou Microsoft, você digita um código de 6 dígitos de um aplicativo no celular.\n\n- **Recrutador:** é obrigatório. Sem ele, as telas de recrutador ficam bloqueadas, e não dá para desligar.\n- **Candidato:** é opcional, mas recomendado.\n\n## Como ligar\n\n1. Abra [Segurança da conta](/conta/seguranca).\n2. Leia o QR code com um aplicativo autenticador (Google Authenticator, Microsoft Authenticator ou outro).\n3. Digite o código que aparece no aplicativo.\n4. Guarde os 10 códigos de recuperação em lugar seguro. Cada um funciona uma vez.\n\n## No dia a dia\n\nDepois de digitar o código, este aparelho fica lembrado por 30 dias. Em outro aparelho, ou depois disso, o código é pedido de novo.\n\n## Perdi o celular\n\nUse um dos códigos de recuperação no lugar do código do aplicativo. Depois, ligue o autenticador de novo no celular novo."
    },
    {
      "slug": "minha-ficha",
      "titulo": "Montar minha ficha a partir do CV",
      "resumo": "Os três passos de Minha ficha: CV, conferir os campos e gerar a Ficha W2.",
      "areas": [
        "candidato"
      ],
      "telas": [
        "/minha-ficha",
        "/painel"
      ],
      "ordem": 4,
      "corpo": "Em [Minha ficha](/minha-ficha) você transforma o CV numa ficha que as empresas leem em segundos.\n\n## Os três passos\n\n1. **Enviar o CV** em PDF ou Word (.docx), até 5 MB, ou colar o texto. A IA lê o texto e preenche os campos. Seu e-mail e telefone são lidos por regras e tirados do texto antes de ir para a IA.\n2. **Conferir os campos.** Corrija o que a leitura errou. A ficha precisa dos campos obrigatórios marcados; o [painel](/painel) mostra o que falta.\n3. **Gerar a Ficha W2.** A IA escreve um resumo curto e até 3 destaques. Depois você publica a ficha com sua conta de candidato.\n\n## Pretensão salarial\n\nMarque os regimes que aceita (CLT, PJ, estágio...) e informe o **mínimo** aceito em cada um. Exemplo: CLT a partir de R$ 12.000 e PJ a partir de R$ 18.000.\n\n## Limites\n\n- Até 10 leituras de CV e 20 Fichas W2 por dia.\n- O rascunho fica guardado neste navegador até você publicar."
    },
    {
      "slug": "ficha-w2",
      "titulo": "O que é a Ficha W2",
      "resumo": "O resumo padronizado do candidato que o recrutador lê.",
      "areas": [
        "candidato",
        "recrutador"
      ],
      "telas": [
        "/minha-ficha",
        "/candidatos"
      ],
      "ordem": 5,
      "corpo": "A Ficha W2 é um cartão padronizado do candidato. Todos os candidatos aparecem no mesmo formato, então o recrutador compara rápido.\n\n## O que tem na ficha\n\n- **Cabeçalho:** primeiro nome, cargo, anos de experiência, cidade e modelo de trabalho, regime e pretensão, e quando pode começar.\n- **Resumo:** até 3 frases escritas pela IA a partir da ficha.\n- **Destaques:** até 3 pontos fortes, também escritos pela IA.\n- **Competências e idiomas:** vêm da ficha que o candidato conferiu.\n\n## O que não tem\n\nA IA não recebe nem escreve nome completo, e-mail ou telefone. O contato fica protegido (veja [Meus dados e privacidade](/ajuda/privacidade)).\n\nO candidato pode gerar a Ficha W2 de novo depois de mudar a ficha. Saiba mais em [Como usamos IA](/ia#ficha-w2).\n\n## Aviso de dado sensível\n\nAs mesmas regras do revisor de viés das vagas olham o cargo, o objetivo, o resumo e os destaques. Se o texto conta a sua idade, estado civil, filhos, religião, saúde, aparência ou origem (por exemplo \"jovem\", \"casado\", \"boa aparência\", \"inglês nativo\"), aparece um aviso ao lado, com \"Tirar\" ou \"Trocar por\" quando há uma troca boa. Esses dados não ajudam na vaga e podem atrapalhar você. É só um aviso: você decide, e a ficha salva e publica do mesmo jeito. Essas regras rodam no seu navegador, sem IA. Veja em [Como usamos IA](/ia#revisor-vies).\n\n## Tradução automática\n\nPara recrutadores que usam o site em outro idioma, a IA traduz o título, o resumo, os destaques e os cargos da Ficha W2 publicada. Nome, empresas, cidades, números e competências ficam como estão, e o nome, o e-mail e o telefone não vão para a IA. O recrutador vê o aviso \"Tradução automática\" e pode abrir o original. O candidato continua vendo a ficha como escreveu. Se a ficha mudar, a tradução é refeita."
    },
    {
      "slug": "buscar-vagas",
      "titulo": "Buscar vagas",
      "resumo": "Como escrever a busca, os chips do que foi entendido e as áreas.",
      "areas": [
        "publico",
        "candidato"
      ],
      "telas": [
        "/vagas"
      ],
      "ordem": 6,
      "corpo": "Em [Vagas](/vagas) você escreve a busca como falaria e aperta Enter ou Buscar.\n\n## Exemplos\n\n- \"DevOps remoto PJ 15 mil\"\n- \"analista de dados pleno São Paulo\"\n- \"React sênior CLT\"\n\n## O que o W2Talent entende\n\nAbaixo da caixa aparecem chips com o que foi entendido: competências, regime, modelo de trabalho, nível e faixa. Clique no × de um chip para tirá-lo.\n\nAs competências procuram vagas que peçam qualquer uma delas. Regime, modelo, nível e faixa não escondem vagas: eles entram no [match](/ajuda/match).\n\n## Áreas\n\nAs pílulas abaixo da busca (Cloud, Dados, Front-end...) trazem as competências mais pedidas de cada área. Marcar uma escreve o nome dela na busca.\n\n## Vagas parecidas\n\nAo abrir uma vaga, aparecem até 5 vagas parecidas no fim do detalhe.\n\n## Tradução automática\n\nVagas escritas em outro idioma aparecem traduzidas para o idioma do site, com o aviso \"Tradução automática\". Clique em \"Ver original\" para ler o texto que a empresa escreveu e em \"Ver tradução\" para voltar. Nomes de tecnologia, números e contatos não são traduzidos. Uma vaga recém-publicada ou editada pode aparecer no original por alguns minutos, até a tradução ficar pronta. Veja [como usamos IA](/ia#traducao)."
    },
    {
      "slug": "match",
      "titulo": "Como o match é calculado",
      "resumo": "Os pesos do match, as competências próximas e o que \"falta\" quer dizer.",
      "areas": [
        "candidato",
        "recrutador"
      ],
      "telas": [
        "/vagas",
        "/candidatos",
        "/painel"
      ],
      "ordem": 7,
      "corpo": "O match é uma conta com pesos fixos. Não é IA e não usa idade, gênero, foto ou endereço.\n\n| Parte | Peso |\n| --- | --- |\n| Competências | 40 |\n| Nível | 20 |\n| Regime, modelo de trabalho e faixa | 20 |\n| Atualizada há pouco | 10 |\n| Cadastro completo | 10 |\n\nNa busca de vagas, as duas últimas linhas olham para a vaga: vaga publicada ou renovada há pouco e com todos os campos preenchidos. Para o recrutador, em Candidatos, olham para a ficha do candidato.\n\n## Competências próximas\n\nUma competência parecida conta metade. Exemplo: quem tem OpenShift ganha meio ponto numa vaga que pede Kubernetes. O texto mostra \"Kubernetes: tem OpenShift (próxima)\".\n\n## O que \"falta\" quer dizer\n\nAo lado do número aparece a primeira coisa que faltou, a de maior peso. Um critério que a vaga não pediu conta como atendido.\n\n## No seu painel\n\nCom a ficha publicada, o [painel](/painel) mostra o que mais falta nela para as vagas abertas mais parecidas (até 30, com match de 40% ou mais): as competências que faltam, as que você tem só uma parecida, e nível, regime ou modelo quando pesam. A faixa salarial não entra, para ninguém se sentir empurrado a pedir menos. Nada disso fica guardado.\n\n## Para o recrutador\n\nEm [Candidatos](/candidatos), escolha uma vaga em \"Para a vaga\" e a lista passa a sair pelo match com ela. É a mesma conta, olhando da vaga para a ficha."
    },
    {
      "slug": "aprovar-e-enviar",
      "titulo": "Aprovar e enviar candidaturas",
      "resumo": "Marcar vagas, conferir, aprovar e enviar em lote.",
      "areas": [
        "candidato"
      ],
      "telas": [
        "/vagas",
        "/vagas/aprovar"
      ],
      "ordem": 8,
      "corpo": "No W2Talent nada é enviado sem a sua aprovação, vaga por vaga.\n\n## Passo a passo\n\n1. Em [Vagas](/vagas), marque as vagas que interessam. Elas vão para a seleção, na barra de baixo.\n2. Abra [Revisar e aprovar](/vagas/aprovar). Cada vaga mostra o match com a sua ficha e o que falta.\n3. Leia e aprove uma por uma.\n4. Envie. Vão só as aprovadas, com a sua Ficha W2.\n\nPara enviar você precisa entrar como candidato e ter a ficha publicada.\n\n## Regras do envio\n\n- Até 10 vagas por envio e 30 candidaturas em 24 horas.\n- A mesma vaga nunca é enviada duas vezes.\n- Se a empresa mudar a vaga depois da sua aprovação, a aprovação cai e a vaga volta para você conferir.\n- Vaga vencida ou arquivada não é enviada.\n- A empresa recebe por e-mail e, se ligou a integração com ATS, também no sistema de seleção dela. O conteúdo é o mesmo, sem seu e-mail e telefone.\n\nDepois do envio, acompanhe em [Minhas candidaturas](/minhas-candidaturas)."
    },
    {
      "slug": "minhas-candidaturas",
      "titulo": "Acompanhar candidaturas",
      "resumo": "O que cada situação quer dizer em Minhas candidaturas.",
      "areas": [
        "candidato"
      ],
      "telas": [
        "/minhas-candidaturas",
        "/painel"
      ],
      "ordem": 9,
      "corpo": "Em [Minhas candidaturas](/minhas-candidaturas) aparece cada vaga enviada, com a data.\n\n## Situações\n\n- **Enviada:** a candidatura chegou à empresa.\n- **Vista:** a empresa abriu a sua ficha ou começou a analisar.\n- **Respondida:** a empresa quer seguir com você (entrevista ou proposta).\n- **Encerrada:** a empresa não vai seguir com esta candidatura, ou ela saiu de circulação.\n\n## Contato protegido\n\nA empresa fala com você por um endereço do W2Talent. Seu e-mail e telefone só aparecem para ela depois que você responde ou quando ela chama você para uma entrevista. Nesse caso, só a empresa daquela vaga vê o contato, e você recebe um aviso por e-mail.\n\nO [painel](/painel) mostra os mesmos números de forma resumida.\n\n## Entrevista\n\nQuando a empresa chama você para uma entrevista, chega um e-mail com um link para escolher um dos horários oferecidos. Os horários aparecem no seu fuso. Depois de escolher, você e a empresa recebem o convite para a agenda (.ics). Pelo mesmo link dá para trocar de horário ou cancelar até 12 horas antes. A entrevista marcada aparece em [Minhas candidaturas](/minhas-candidaturas)."
    },
    {
      "slug": "privacidade",
      "titulo": "Meus dados e privacidade",
      "resumo": "Contato protegido, por quanto tempo o perfil e as conversas ficam guardados e como pedir revisão.",
      "areas": [
        "publico",
        "candidato",
        "recrutador"
      ],
      "telas": [
        "/minha-ficha",
        "/renovar",
        "/ia",
        "/mercado"
      ],
      "ordem": 10,
      "corpo": "## Contato protegido\n\nNa busca de candidatos, e-mail e telefone aparecem mascarados (por exemplo, a***@e***.com). O contato completo só chega à empresa depois que você responde a ela ou quando ela chama você para uma entrevista numa vaga em que você se candidatou (e você recebe um aviso).\n\n## Sistema de seleção da empresa\n\nAlgumas empresas ligam a integração com o sistema de seleção delas (ATS). Nesse caso, a candidatura que você enviar também vai para esse sistema, com o mesmo conteúdo que você aprovou: a Ficha W2, sem e-mail, telefone nem links. O sistema também fica sabendo quando a empresa muda a etapa da sua candidatura, e o seu e-mail e telefone só vão para lá depois que ela chama você para entrevista. Lá, a candidatura segue as regras de privacidade da empresa.\n\n## Pretensão salarial\n\nA pretensão que você coloca na ficha aparece para recrutadores na sua Ficha W2 e na busca de candidatos. Nos números de mercado ([Mercado de TI](/mercado) e Publicar vaga), recrutadores veem só faixas agregadas de **10 ou mais fichas**, nunca a pretensão de alguém, e nunca o mínimo nem o máximo.\n\n## Quanto tempo o perfil fica na busca\n\n- O perfil publicado fica na busca por 180 dias.\n- Antes de vencer, você recebe lembretes por e-mail com o botão \"Continuo procurando\". Clicar renova por mais 180 dias.\n- Sem renovação, o perfil é arquivado e sai da busca.\n- Depois de 30 dias arquivado, ele é apagado, junto com as candidaturas.\n\n## Conversas com a equipe\n\nAs conversas em [Falar com uma pessoa](/ajuda/conversa) ficam guardadas até 180 dias depois de encerradas; aí são apagadas, com todas as mensagens. Com login, você as vê em [Minhas conversas](/ajuda/minhas-conversas). Quem responde é uma pessoa da equipe, e nada da conversa vai para IA.\n\n## IA e revisão por uma pessoa\n\nA IA ajuda a ler textos e a escrever resumos, mas não decide por ninguém. Se uma decisão automática afetou você, peça revisão por uma pessoa em contato@w2talent.com. Veja [Como usamos IA](/ia).\n\n## Ao sair\n\nSair da conta apaga deste navegador os rascunhos e a seleção guardados."
    },
    {
      "slug": "minha-empresa",
      "titulo": "Cadastrar a empresa",
      "resumo": "Dados da empresa, verificação e a etiqueta \"Empresa não verificada\".",
      "areas": [
        "recrutador"
      ],
      "telas": [
        "/empresa"
      ],
      "ordem": 11,
      "corpo": "Antes de publicar vagas, o recrutador cadastra a empresa em [Minha empresa](/empresa).\n\n## O que informar\n\n- Nome da empresa\n- CNPJ (os dígitos são conferidos)\n- Site\n- E-mail de contato\n\nCada conta de recrutador fica ligada a uma empresa.\n\n## Verificação\n\nA equipe do W2Talent confere os dados. Enquanto isso:\n\n- **Em verificação:** suas vagas já aparecem, com a etiqueta \"Empresa não verificada\".\n- **Verificada:** as vagas aparecem sem etiqueta.\n- **Recusada:** as vagas são arquivadas. Fale com contato@w2talent.com.\n\nMudar o nome ou o CNPJ de uma empresa verificada faz ela voltar para \"Em verificação\".\n\n## Integração com ATS\n\nSe a empresa usa um sistema de seleção (ATS), as candidaturas podem chegar lá também. Em [Minha empresa](/empresa), quem cadastrou a empresa informa um endereço https e clica em \"Salvar e ativar\".\n\n- A cada candidatura recebida, o W2Talent manda um `POST` com JSON para esse endereço (evento `candidatura.recebida`).\n- A cada mudança de etapa feita na tela da vaga, manda o evento `candidatura.etapa`.\n- O aviso leva a vaga, a candidatura (data, etapa, match e lacunas) e a Ficha W2 como o candidato aprovou: **sem e-mail, telefone nem links**. O e-mail e o telefone só vão depois que a candidatura passa pela Entrevista, como na tela.\n- Só endereço https público. Rede interna e localhost não funcionam.\n- \"Enviar teste\" manda o evento `teste` na hora. A tela mostra as últimas 20 entregas.\n- Se o seu sistema não responder, ou responder com erro 5xx ou 429, tentamos de novo até 10 vezes ao longo de algumas horas. Erro 4xx não é repetido.\n- \"Desativar\" para os envios. Nada fica guardado do conteúdo enviado, só a data e o resultado.\n\n## Mudança de etapa\n\nO evento `candidatura.etapa` tem o mesmo corpo do `candidatura.recebida`, com mais um campo, `data.mudanca`:\n\n- `de`: a etapa de antes.\n- `para`: a etapa nova.\n- `em`: quando mudou (igual a `occurred_at`).\n\nAs etapas vão com estes nomes: `nova`, `em_analise`, `entrevista`, `proposta`, `contratada` e `nao_seguiu`. O campo `data.candidatura.etapa` mostra a etapa na hora da entrega; se alguém mudou de novo nesse meio tempo, vale o `para` de cada aviso, na ordem de `occurred_at`. Quando a candidatura passa pela Entrevista (ou pula direto para Proposta ou Contratada), `data.candidato.contato` passa a trazer `email` e `celular`; antes disso, vem `null`.\n\n## Integração pausada\n\nCada entrega que não dá certo (sem resposta ou com um código fora da faixa 2xx) conta uma falha, inclusive as novas tentativas. Uma entrega que dá certo zera a contagem; o teste não conta. Com **50 falhas seguidas**, a integração fica \"Pausada\": nada mais é enviado e quem cadastrou a empresa recebe um e-mail.\n\nPara voltar, confira o endereço e o seu sistema, use \"Enviar teste\" e clique em \"Ativar\". A contagem volta a zero. O que aconteceu durante a pausa não é reenviado.\n\n## Conferir a assinatura\n\nAo ativar (ou em \"Gerar novo segredo\"), a tela mostra o segredo **uma vez**. Guarde no seu sistema. Cada aviso traz:\n\n- `X-W2Talent-Event`: o evento.\n- `X-W2Talent-Delivery`: o id do evento. Ele se repete nas novas tentativas; use para não gravar duas vezes.\n- `X-W2Talent-Signature`: `t=<segundos>,v1=<assinatura>`.\n\nPara conferir, calcule o HMAC-SHA256 em hexadecimal de `t` + `.` + o corpo exatamente como chegou, usando o segredo inteiro como chave, e compare com `v1`. Recuse avisos com `t` de mais de 5 minutos atrás."
    },
    {
      "slug": "publicar-vaga",
      "titulo": "Publicar uma vaga",
      "resumo": "Colar o texto, conferir os campos, avisos de vaga repetida e de viés, e por quanto tempo a vaga fica no ar.",
      "areas": [
        "recrutador"
      ],
      "telas": [
        "/publicar"
      ],
      "ordem": 12,
      "corpo": "Em [Publicar vaga](/publicar) você cola o texto da vaga e a IA preenche os campos. E-mails e telefones são tirados do texto antes.\n\n## Passo a passo\n\n1. Cole o texto e clique para ler.\n2. Confira título, nível, regime, modelo, cidade, competências, faixa e benefícios.\n3. Publique.\n\n## Avisos\n\n- **Vaga parecida:** se a sua empresa já tem uma vaga ativa parecida, aparece o aviso com \"Atualizar a existente\". Se for outra vaga, publique assim mesmo.\n- **Faixa sugerida:** com 5 ou mais vagas parecidas, aparece a faixa mediana delas.\n- **Mercado:** ao lado, os números do [Mercado de TI](/mercado) para a primeira competência, o nível, o regime e a moeda: a faixa das vagas e o que os candidatos pedem. A pretensão é sempre agregada, de 10 ou mais fichas; você nunca vê a pretensão de alguém por aqui. É só informativo.\n- **Revisor de viés:** termos sobre idade, gênero, aparência, origem, família, saúde ou religião ganham um aviso com sugestão de troca. Ele só avisa e não bloqueia. Você pode pedir à IA um texto sem esses termos.\n- **Perguntas de entrevista:** a IA sugere perguntas a partir das competências. Elas não são guardadas.\n\n## Quanto tempo a vaga fica no ar\n\nA vaga fica ativa por 14 dias. Para renovar, publique de novo e escolha \"Atualizar a existente\". Vaga vencida é arquivada.\n\nLimite: 30 leituras de texto por dia por conta."
    },
    {
      "slug": "buscar-candidatos",
      "titulo": "Buscar candidatos",
      "resumo": "Busca, vaga de referência, filtros e a Ficha W2 ao lado.",
      "areas": [
        "recrutador"
      ],
      "telas": [
        "/candidatos",
        "/candidatos/comparar"
      ],
      "ordem": 13,
      "corpo": "[Candidatos](/candidatos) é só para recrutador com login e autenticador.\n\n## Buscar\n\nEscreva o que procura, por exemplo \"analista cloud AWS\". A busca entende sinônimos: AWS e Cloud aparecem juntos.\n\n## Para a vaga\n\nEscolha uma vaga ativa da sua empresa em \"Para a vaga\". A lista passa a sair pelo [match](/ajuda/match) com ela, e cada linha mostra o que falta.\n\n## Filtros\n\nEm \"Filtros\" você combina competências (a ficha precisa ter todas), senioridade, modelo, regime, pretensão mensal até, idioma e nível, quando pode começar e ficha atualizada. Quem não informou disponibilidade ou pretensão continua aparecendo.\n\nOs filtros ficam no endereço da página, então dá para guardar ou compartilhar a busca.\n\n## Ver a Ficha W2\n\nNo computador, \"Ver\" abre a Ficha W2 ao lado da lista. No celular, abre numa janela. Com uma vaga escolhida, o topo mostra \"Para a vaga X: 87%\" e tudo o que falta.\n\n## Comparar\n\nMarque até 10 candidatos e use \"Comparar\" na barra de baixo. A tela mostra os candidatos lado a lado, com os campos da Ficha W2 em linhas e, com uma vaga escolhida, o match e o que falta. O contato aparece mascarado, como na busca. \"Tirar\" remove alguém da comparação e da seleção.\n\n\"Baixar CSV\" e \"Baixar Excel\" salvam a tabela com uma linha por candidato; \"Imprimir ou PDF\" abre a impressão do navegador, onde dá para salvar em PDF. Os arquivos são montados no seu navegador e levam o contato mascarado. O W2Talent guarda só que houve uma exportação, sem o conteúdo.\n\n## Tradução automática\n\nQuando a Ficha W2 foi escrita em outro idioma, a lista, a ficha e a comparação mostram o título, o resumo, os destaques e os cargos traduzidos para o idioma do site, com o aviso \"Tradução automática\". \"Ver original\" mostra o texto como o candidato escreveu. Nome, empresas, cidades, números e competências não são traduzidos. Os arquivos baixados (CSV, Excel e PDF) saem sempre com o texto original."
    },
    {
      "slug": "instalar-app",
      "titulo": "Instalar no celular e usar sem internet",
      "resumo": "Como instalar o W2Talent como app e o que funciona offline.",
      "areas": [
        "publico",
        "candidato",
        "recrutador"
      ],
      "telas": [
        "/",
        "/offline"
      ],
      "ordem": 14,
      "corpo": "O W2Talent funciona no navegador do computador e do celular, com a mesma conta.\n\n## Instalar como app\n\nQuando o navegador permite, aparece o botão \"Instalar app\" no topo. Ele cria um ícone na tela inicial, e o site abre como um app.\n\nNo iPhone, use o botão de compartilhar do Safari e \"Adicionar à Tela de Início\".\n\n## Sem internet\n\n- As telas que você já abriu (Vagas, Minha ficha, Minhas candidaturas) mostram a última cópia, com a data.\n- Aparece um aviso de que você está sem internet.\n- Enviar, publicar e buscar de novo esperam a conexão voltar."
    },
    {
      "slug": "ia",
      "titulo": "Como o W2Talent usa IA",
      "resumo": "Onde a IA aparece e onde ela não decide nada.",
      "areas": [
        "publico",
        "candidato",
        "recrutador"
      ],
      "telas": [
        "/ia"
      ],
      "ordem": 15,
      "corpo": "A IA ajuda em tarefas de texto. Ela não aprova, não reprova e não dá nota a ninguém.\n\n## Onde ela aparece\n\n- Ler o CV e preencher a ficha.\n- Escrever o resumo e os destaques da Ficha W2.\n- Ler o texto da vaga e preencher os campos.\n- Reescrever a vaga sem termos de viés, quando o recrutador pede.\n- Sugerir perguntas de entrevista.\n- Responder perguntas nesta ajuda, só com o que está nos artigos e sempre com o link da fonte.\n\n## Onde ela não entra\n\nO [match](/ajuda/match) é uma conta com pesos fixos. A busca usa texto e significado para ordenar, mas não esconde candidatos.\n\nA conversa em [Falar com uma pessoa](/ajuda/conversa) é respondida por uma pessoa da equipe. Nada dela vai para IA.\n\nA lista completa, com os dados que cada tarefa usa, está em [Como usamos IA](/ia)."
    },
    {
      "slug": "painel-rh",
      "titulo": "Painel RH",
      "resumo": "As vagas da empresa, as candidaturas que chegaram e os números de resposta.",
      "areas": [
        "recrutador"
      ],
      "telas": [
        "/rh"
      ],
      "ordem": 16,
      "corpo": "O [Painel RH](/rh) mostra as vagas da sua empresa e as candidaturas que chegaram a cada uma.\n\n## Números da empresa\n\n- **Vagas ativas** e as que **vencem em até 3 dias** (renove antes de vencer).\n- **Candidaturas** recebidas e quantas estão **na etapa Nova**.\n- **Tempo até a primeira resposta:** a média entre a candidatura chegar e você mudar a etapa dela pela primeira vez.\n- **Taxa de resposta:** quantas candidaturas já saíram de Nova alguma vez.\n\nOs números são só da sua empresa.\n\n## Vagas\n\nCada vaga mostra a situação, o total de candidaturas e as novas. Vaga ativa com faixa ganha a etiqueta \"abaixo\", \"dentro\" ou \"acima do mercado\": o meio da faixa dela contra a faixa das vagas da mesma primeira competência, nível, regime e moeda no [Mercado de TI](/mercado). Sem números suficientes para o grupo, não aparece etiqueta. Em \"Candidatos compatíveis\" você busca perfis parecidos com a vaga, mesmo de quem ainda não se candidatou.\n\n## Candidaturas de uma vaga\n\nEm \"Ver candidaturas\" aparecem as pessoas que se candidataram, da maior para a menor compatibilidade com a vaga.\n\n**Ordem ajustada:** depois de 30 decisões, a ordem passa a levar em conta quem a sua empresa leva para Entrevista (ou depois) e quem marca como Não seguiu. Só muda a ordem: a % de match continua a mesma conta, e nunca entram idade, gênero, foto, estado civil ou endereço. Acima da lista aparece \"Ordem ajustada pelo que sua empresa escolhe\"; em \"Ver na ordem padrão\" você volta para a ordem pela % de match. O mesmo vale em Candidatos, quando há uma vaga de referência. Detalhes em [Como usamos IA](/ia#ranking).\n\n- **Etapa:** Nova, Em análise, Entrevista, Proposta, Contratada ou Não seguiu. Mude com um clique; não há formulário.\n- **O que o candidato vê:** \"Vista\" quando você abre a ficha ou move para Em análise, \"Respondida\" a partir de Entrevista e \"Encerrada\" em Não seguiu. As etapas internas não aparecem para ele.\n- **Contato:** ao mover para Entrevista (ou depois), o e-mail e o telefone do candidato aparecem na lista, só para a sua empresa, e ele recebe um aviso por e-mail. Liberado uma vez, fica liberado.\n- **Agendar entrevista:** com o contato liberado, ofereça de 3 a 8 horários (30, 45 ou 60 minutos) e, se quiser, o link da reunião. O candidato escolhe um pelo link do e-mail e os dois recebem o convite para a agenda (.ics). Ele pode trocar ou cancelar até 12 horas antes. Mudar os horários cancela a oferta anterior.\n- **Comparar:** marque até 10 pessoas para compará-las lado a lado e exportar."
    },
    {
      "slug": "mercado",
      "titulo": "Mercado de TI",
      "resumo": "Faixa salarial das vagas, pretensão dos candidatos e competências em alta, sem login.",
      "areas": [
        "publico",
        "candidato",
        "recrutador"
      ],
      "telas": [
        "/mercado",
        "/painel",
        "/publicar",
        "/rh"
      ],
      "ordem": 17,
      "corpo": "A página [Mercado de TI](/mercado) mostra números tirados das vagas e fichas publicadas no W2Talent. É aberta a todos, sem login.\n\n## De onde vêm os números\n\n- Só das vagas ativas e das fichas ativas do próprio W2Talent. Não há IA nem dados de fora.\n- O cálculo roda uma vez por dia; a página diz a semana dos números.\n- Vagas e fichas de exemplo ficam de fora.\n\n## Como ler as tabelas\n\n- **Faixa salarial das vagas:** o \"de\" e o \"até\" anunciados, por nível e regime, em valor mensal. A **mediana** é o valor do meio; a coluna **25%–75%** mostra onde fica a metade das vagas.\n- **Pretensão dos candidatos:** o mínimo mensal pedido nas fichas, por nível e regime. As fichas não separam a pretensão por modelo de trabalho.\n- **Mais pedidas:** competências com mais vagas ativas, quantas fichas têm cada uma e quantas vagas há para cada ficha.\n- **Em alta:** vagas publicadas nos últimos 30 dias contra os 30 anteriores, só para competências com 5 ou mais vagas recentes.\n- **Tempo até a primeira resposta:** da candidatura até a empresa mudar a etapa pela primeira vez, no site todo, nos últimos 90 dias.\n\nEscolha uma competência e, se quiser, o modelo de trabalho (remoto, híbrido ou presencial) para ver só os números dela.\n\n## \"Ainda poucos dados\"\n\nPara ninguém ser identificado, um grupo só ganha números com **10 ou mais** vagas ou fichas e, quando vem de vagas, de **3 ou mais empresas**. Abaixo disso a tabela diz quanto falta, por exemplo \"faltam 4 vagas\". Nunca mostramos o mínimo nem o máximo.\n\n## Dentro do W2Talent\n\nOs mesmos números aparecem em três telas, sempre com a regra acima. A \"faixa das vagas\" vai do \"de\" mediano ao \"até\" mediano das vagas do grupo (mesma competência, nível, regime e moeda).\n\n- **No seu [painel](/painel) (candidato):** \"Sua pretensão e o mercado\" compara a pretensão mensal da ficha publicada com a faixa das vagas da sua primeira competência que já tem números, no seu nível e regime, e diz se ela está abaixo, dentro ou acima. Mostra também até 5 competências em alta, marcando as que você já tem.\n- **Em [Publicar vaga](/publicar):** ao lado da faixa sugerida, a faixa das vagas e a pretensão dos candidatos para a primeira competência, o nível, o regime e a moeda da vaga. A pretensão é sempre agregada, de 10 ou mais fichas, nunca a de alguém. É só informativo.\n- **No [Painel RH](/rh):** cada vaga ativa com faixa ganha a etiqueta \"abaixo\", \"dentro\" ou \"acima do mercado\", comparando o meio da faixa dela com a faixa das vagas do mesmo grupo. Sem números para o grupo, não aparece nada."
    }
  ],
  "en": [
    {
      "slug": "o-que-e",
      "titulo": "What W2Talent is",
      "resumo": "What the site does for candidates and for recruiters.",
      "areas": [
        "publico",
        "candidato",
        "recrutador"
      ],
      "telas": [
        "/",
        "/ajuda/minhas-conversas"
      ],
      "ordem": 1,
      "corpo": "W2Talent connects tech candidates with jobs. Candidates find jobs, check each one and send in a batch only the ones they approved. Recruiters get the W2 Profile, a standard summary of the candidate with the match explained.\n\n## For candidates\n\n- Using W2Talent is free.\n- You build your profile from your CV in [My profile](/minha-ficha).\n- You search the way you talk, for example \"remote DevOps contractor 15k\".\n- Only what you approved goes to the company.\n\n## For recruiters\n\n- You register the company in [My company](/empresa).\n- You post a job by pasting its text, and AI fills in the fields.\n- You search candidates and sort them by match with one of your jobs.\n\n## Talk to a person\n\nCould not find the answer in Help? In [Talk to a person](/ajuda/conversa), you write to the W2Talent team, signed in or not.\n\n- Not signed in, you give an e-mail. Signed in, we use the account e-mail.\n- The reply shows up in the conversation and we let you know by e-mail, with the link.\n- Keep the link: it is how you get back to the conversation. Anyone with the link can see the conversation.\n- Signed in, your conversations are in [My conversations](/ajuda/minhas-conversas), in your account menu, and you open each one without the link.\n- A person replies. Nothing in the conversation goes to AI.\n- The team only sees what you wrote, the screen you came from and, if you are signed in, whether the account is a candidate or a recruiter.\n- Limits: 3 new conversations per day and 30 messages per conversation per day, up to 2,000 characters each.\n- The conversation is deleted 180 days after it is closed, with all its messages.\n\nThis is the test version. The site changes often."
    },
    {
      "slug": "entrar-e-perfil",
      "titulo": "Signing in and choosing a profile",
      "resumo": "Sign in with Google or Microsoft and choose between candidate and recruiter.",
      "areas": [
        "publico",
        "candidato",
        "recrutador"
      ],
      "telas": [
        "/entrar",
        "/entrar/perfil"
      ],
      "ordem": 2,
      "corpo": "You sign in with a Google or Microsoft account (personal or work). W2Talent has no password of its own yet.\n\n## Browsing jobs needs no sign-in\n\nAnyone can see and search jobs. Sign-in is needed to mark a job, publish your profile, send applications or search candidates.\n\n## Candidate or recruiter\n\nOn your first visit you choose the account's profile, only once:\n\n- **Candidate:** builds a profile, approves and sends applications. When you choose it, you accept the terms of use and data terms.\n- **Recruiter:** registers the company, posts jobs and searches candidates. Needs the [authenticator](/ajuda/autenticador).\n\nAn account is either a candidate or a recruiter, not both. To use both sides, use another Google or Microsoft account.\n\nIf you sign in with Google and later with Microsoft using the same email, both become the same account."
    },
    {
      "slug": "autenticador",
      "titulo": "Authenticator and recovery codes",
      "resumo": "How to turn on the authenticator app code and what to do if you lose your phone.",
      "areas": [
        "candidato",
        "recrutador"
      ],
      "telas": [
        "/conta/seguranca",
        "/entrar/codigo"
      ],
      "ordem": 3,
      "corpo": "The authenticator is the second step of sign-in: besides Google or Microsoft, you type a 6-digit code from an app on your phone.\n\n- **Recruiter:** required. Without it, recruiter pages are blocked, and it cannot be turned off.\n- **Candidate:** optional, but recommended.\n\n## How to turn it on\n\n1. Open [Account security](/conta/seguranca).\n2. Scan the QR code with an authenticator app (Google Authenticator, Microsoft Authenticator or another).\n3. Type the code shown in the app.\n4. Keep the 10 recovery codes somewhere safe. Each one works once.\n\n## Day to day\n\nAfter you type the code, this device is remembered for 30 days. On another device, or after that, the code is asked again.\n\n## I lost my phone\n\nUse one of the recovery codes instead of the app code. Then turn on the authenticator again on the new phone."
    },
    {
      "slug": "minha-ficha",
      "titulo": "Building my profile from my CV",
      "resumo": "The three steps of My profile: CV, check the fields and create the W2 Profile.",
      "areas": [
        "candidato"
      ],
      "telas": [
        "/minha-ficha",
        "/painel"
      ],
      "ordem": 4,
      "corpo": "In [My profile](/minha-ficha) you turn your CV into a profile companies read in seconds.\n\n## The three steps\n\n1. **Send your CV** as PDF or Word (.docx), up to 5 MB, or paste the text. AI reads the text and fills in the fields. Your email and phone are read by rules and removed from the text before it goes to AI.\n2. **Check the fields.** Fix what the reading got wrong. The profile needs the required fields; the [dashboard](/painel) shows what is missing.\n3. **Create the W2 Profile.** AI writes a short summary and up to 3 highlights. Then you publish the profile with your candidate account.\n\n## Expected pay\n\nMark the contract types you accept (employee, contractor, internship...) and give the **minimum** you accept for each one.\n\n## Limits\n\n- Up to 10 CV readings and 20 W2 Profiles per day.\n- The draft stays in this browser until you publish."
    },
    {
      "slug": "ficha-w2",
      "titulo": "What the W2 Profile is",
      "resumo": "The standard candidate summary that recruiters read.",
      "areas": [
        "candidato",
        "recrutador"
      ],
      "telas": [
        "/minha-ficha",
        "/candidatos"
      ],
      "ordem": 5,
      "corpo": "The W2 Profile is a standard card for each candidate. Every candidate shows up in the same format, so recruiters compare quickly.\n\n## What is in it\n\n- **Header:** first name, role, years of experience, city and work model, contract type and expected pay, and when they can start.\n- **Summary:** up to 3 sentences written by AI from the profile.\n- **Highlights:** up to 3 strengths, also written by AI.\n- **Skills and languages:** taken from the profile the candidate checked.\n\n## What is not in it\n\nAI neither receives nor writes the full name, email or phone. Contact details stay protected (see [My data and privacy](/ajuda/privacidade)).\n\nCandidates can create the W2 Profile again after changing their profile. Learn more in [How we use AI](/ia#ficha-w2).\n\n## Sensitive data warning\n\nThe same rules as the job bias reviewer check the role, goal, summary and highlights. If the text tells your age, marital status, children, religion, health, looks or origin (for example \"young\", \"married\", \"good appearance\", \"native English\"), a warning shows up next to it, with \"Remove\" or \"Replace with\" when there is a good replacement. These details do not help with the job and may work against you. It is only a warning: you decide, and the profile saves and publishes either way. The rules run in your browser, without AI. See [How we use AI](/ia#revisor-vies).\n\n## Automatic translation\n\nFor recruiters using the site in another language, the AI translates the title, summary, highlights and job titles of the published W2 Profile. Names, companies, cities, numbers and skills stay as they are, and the name, email and phone never go to the AI. Recruiters see the note \"Automatic translation\" and can open the original. Candidates keep seeing their profile as they wrote it. If the profile changes, the translation is redone."
    },
    {
      "slug": "buscar-vagas",
      "titulo": "Searching jobs",
      "resumo": "How to write the search, the chips for what was understood, and the areas.",
      "areas": [
        "publico",
        "candidato"
      ],
      "telas": [
        "/vagas"
      ],
      "ordem": 6,
      "corpo": "In [Jobs](/vagas) you type the search the way you talk and press Enter or Search.\n\n## Examples\n\n- \"remote DevOps contractor 15k\"\n- \"mid-level data analyst São Paulo\"\n- \"senior React employee\"\n\n## What W2Talent understands\n\nBelow the box, chips show what was understood: skills, contract type, work model, level and pay range. Click the × on a chip to remove it.\n\nSkills look for jobs that ask for any of them. Contract type, work model, level and pay range do not hide jobs: they count in the [match](/ajuda/match).\n\n## Areas\n\nThe pills below the search (Cloud, Data, Front-end...) bring the most requested skills of each area. Selecting one writes its name in the search.\n\n## Similar jobs\n\nWhen you open a job, up to 5 similar jobs show at the end of the details.\n\n## Automatic translation\n\nJobs written in another language show translated into the site language, labeled \"Automatic translation\". Click \"Show original\" to read the text the company wrote and \"Show translation\" to go back. Technology names, numbers and contacts are not translated. A job just posted or edited may show in the original for a few minutes, until the translation is ready. See [how we use AI](/ia#traducao)."
    },
    {
      "slug": "match",
      "titulo": "How the match is calculated",
      "resumo": "The match weights, close skills and what \"missing\" means.",
      "areas": [
        "candidato",
        "recrutador"
      ],
      "telas": [
        "/vagas",
        "/candidatos",
        "/painel"
      ],
      "ordem": 7,
      "corpo": "The match is a calculation with fixed weights. It is not AI and does not use age, gender, photo or address.\n\n| Part | Weight |\n| --- | --- |\n| Skills | 40 |\n| Level | 20 |\n| Contract type, work model and pay range | 20 |\n| Updated recently | 10 |\n| Complete listing | 10 |\n\nIn job search, the last two rows look at the job: posted or renewed recently and with every field filled in. For recruiters, in Candidates, they look at the candidate's profile.\n\n## Close skills\n\nA similar skill counts half. Example: someone with OpenShift gets half a point in a job that asks for Kubernetes. The text shows \"Kubernetes: has OpenShift (close)\".\n\n## What \"missing\" means\n\nNext to the number you see the first thing missing, the one with the highest weight. A criterion the job did not ask for counts as met.\n\n## On your dashboard\n\nWith your profile published, the [dashboard](/painel) shows what it most lacks for the closest open jobs (up to 30, with a match of 40% or more): missing skills, skills where you only have a close one, and level, contract type or work model when they weigh. The salary range is left out, so nobody feels pushed to ask for less. None of this is stored.\n\n## For recruiters\n\nIn [Candidates](/candidatos), pick a job in \"For the job\" and the list is sorted by the match with it. It is the same calculation, looking from the job to the profile."
    },
    {
      "slug": "aprovar-e-enviar",
      "titulo": "Approving and sending applications",
      "resumo": "Mark jobs, check, approve and send in a batch.",
      "areas": [
        "candidato"
      ],
      "telas": [
        "/vagas",
        "/vagas/aprovar"
      ],
      "ordem": 8,
      "corpo": "On W2Talent nothing is sent without your approval, job by job.\n\n## Step by step\n\n1. In [Jobs](/vagas), mark the jobs you like. They go to your selection, in the bar at the bottom.\n2. Open [Review and approve](/vagas/aprovar). Each job shows the match with your profile and what is missing.\n3. Read and approve them one by one.\n4. Send. Only approved jobs go, with your W2 Profile.\n\nTo send, you need to sign in as a candidate and have your profile published.\n\n## Sending rules\n\n- Up to 10 jobs per send and 30 applications in 24 hours.\n- The same job is never sent twice.\n- If the company changes the job after you approved it, the approval drops and the job comes back for you to check.\n- Expired or archived jobs are not sent.\n- The company gets it by e-mail and, if it turned on the ATS integration, also in its hiring system. The content is the same, without your e-mail and phone.\n\nAfter sending, follow up in [My applications](/minhas-candidaturas)."
    },
    {
      "slug": "minhas-candidaturas",
      "titulo": "Following your applications",
      "resumo": "What each status means in My applications.",
      "areas": [
        "candidato"
      ],
      "telas": [
        "/minhas-candidaturas",
        "/painel"
      ],
      "ordem": 9,
      "corpo": "[My applications](/minhas-candidaturas) lists each job you sent, with the date.\n\n## Statuses\n\n- **Sent:** the application reached the company.\n- **Seen:** the company opened your profile or started reviewing it.\n- **Answered:** the company wants to move forward with you (interview or offer).\n- **Closed:** the company is not moving forward with this application, or it is no longer active.\n\n## Protected contact\n\nThe company talks to you through a W2Talent address. Your email and phone only show to them after you reply or when they invite you to an interview. In that case only that job's company sees your contact, and you get a notice by email.\n\nThe [dashboard](/painel) shows the same numbers in short.\n\n## Interview\n\nWhen a company invites you to an interview, you get an e-mail with a link to pick one of the times offered. Times show in your time zone. After you pick, you and the company get the calendar invite (.ics). The same link lets you change the time or cancel up to 12 hours before. The booked interview shows in [My applications](/minhas-candidaturas)."
    },
    {
      "slug": "privacidade",
      "titulo": "My data and privacy",
      "resumo": "Protected contact, how long the profile and conversations are kept and how to ask for a review.",
      "areas": [
        "publico",
        "candidato",
        "recrutador"
      ],
      "telas": [
        "/minha-ficha",
        "/renovar",
        "/ia",
        "/mercado"
      ],
      "ordem": 10,
      "corpo": "## Protected contact\n\nIn candidate search, email and phone are masked (for example, a***@e***.com). The full contact only reaches the company after you reply to it or when it invites you to an interview for a job you applied to (and you get a notice).\n\n## The company's hiring system\n\nSome companies turn on the integration with their hiring system (ATS). In that case, the application you send also goes to that system, with the same content you approved: the W2 Profile, without e-mail, phone or links. The system is also told when the company changes your application's stage, and your e-mail and phone only go there after the company invites you to an interview. There, the application follows the company's privacy rules.\n\n## Salary expectation\n\nThe salary expectation you put in your profile shows to recruiters on your W2 Profile and in candidate search. In the market numbers ([Tech job market](/mercado) and Post a job), recruiters only see aggregated ranges from **10 or more profiles**, never anyone's own expectation, and never the minimum or the maximum.\n\n## How long a profile stays in search\n\n- A published profile stays in search for 180 days.\n- Before it expires, you get email reminders with the \"I'm still looking\" button. Clicking it renews for 180 more days.\n- Without renewal, the profile is archived and leaves search.\n- After 30 days archived, it is deleted, together with its applications.\n\n## Conversations with the team\n\nConversations in [Talk to a person](/ajuda/conversa) are kept until 180 days after they are closed; then they are deleted, with all their messages. Signed in, you see them in [My conversations](/ajuda/minhas-conversas). A person on the team replies, and nothing in the conversation goes to AI.\n\n## AI and review by a person\n\nAI helps read texts and write summaries, but it decides nothing for anyone. If an automated decision affected you, ask for a review by a person at contato@w2talent.com. See [How we use AI](/ia).\n\n## When you sign out\n\nSigning out deletes the drafts and selection saved in this browser."
    },
    {
      "slug": "minha-empresa",
      "titulo": "Registering the company",
      "resumo": "Company details, verification and the \"Unverified company\" label.",
      "areas": [
        "recrutador"
      ],
      "telas": [
        "/empresa"
      ],
      "ordem": 11,
      "corpo": "Before posting jobs, recruiters register the company in [My company](/empresa).\n\n## What to fill in\n\n- Company name\n- CNPJ (Brazilian company number; its check digits are verified)\n- Website\n- Contact email\n\nEach recruiter account is linked to one company.\n\n## Verification\n\nThe W2Talent team checks the details. Meanwhile:\n\n- **Under review:** your jobs already show, with the \"Unverified company\" label.\n- **Verified:** jobs show without the label.\n- **Declined:** jobs are archived. Write to contato@w2talent.com.\n\nChanging the name or CNPJ of a verified company sends it back to \"Under review\".\n\n## ATS integration\n\nIf the company uses a hiring system (ATS), applications can arrive there too. In [My company](/empresa), the person who registered the company enters an https address and clicks \"Save and turn on\".\n\n- For each application received, W2Talent sends a JSON `POST` to that address (event `candidatura.recebida`).\n- For each stage change made on the job screen, it sends the `candidatura.etapa` event.\n- The notice carries the job, the application (date, stage, match and gaps) and the W2 Profile as the candidate approved it: **no e-mail, phone or links**. E-mail and phone are only sent after the application reaches the Interview, as on the screen.\n- Public https addresses only. Internal networks and localhost do not work.\n- \"Send test\" sends the `teste` event right away. The screen shows the latest 20 deliveries.\n- If your system does not answer, or answers with a 5xx or 429 error, we try again up to 10 times over a few hours. A 4xx error is not retried.\n- \"Turn off\" stops the sends. Nothing of the content sent is stored, only the date and the result.\n\n## Stage change\n\nThe `candidatura.etapa` event has the same body as `candidatura.recebida`, plus one field, `data.mudanca`:\n\n- `de`: the previous stage.\n- `para`: the new stage.\n- `em`: when it changed (same as `occurred_at`).\n\nStages are sent with these names: `nova`, `em_analise`, `entrevista`, `proposta`, `contratada` and `nao_seguiu`. The `data.candidatura.etapa` field shows the stage at delivery time; if someone changed it again in the meantime, rely on each notice's `para`, in `occurred_at` order. Once the application reaches the Interview (or jumps straight to Offer or Hired), `data.candidato.contato` carries `email` and `celular`; before that, it is `null`.\n\n## Paused integration\n\nEach delivery that fails (no answer, or a code outside the 2xx range) counts as one failure, retries included. A successful delivery resets the count; the test does not count. After **50 failures in a row**, the integration becomes \"Paused\": nothing else is sent and the person who registered the company gets an e-mail.\n\nTo turn it back on, check the address and your system, use \"Send test\" and click \"Turn on\". The count goes back to zero. Events from the paused period are not sent again.\n\n## Checking the signature\n\nWhen you turn it on (or with \"Generate new secret\"), the screen shows the secret **once**. Keep it in your system. Each notice carries:\n\n- `X-W2Talent-Event`: the event.\n- `X-W2Talent-Delivery`: the event id. It repeats on retries; use it to avoid saving twice.\n- `X-W2Talent-Signature`: `t=<seconds>,v1=<signature>`.\n\nTo check it, compute the hex HMAC-SHA256 of `t` + `.` + the body exactly as received, using the whole secret as the key, and compare with `v1`. Refuse notices with `t` older than 5 minutes."
    },
    {
      "slug": "publicar-vaga",
      "titulo": "Posting a job",
      "resumo": "Paste the text, check the fields, duplicate and bias warnings, and how long the job stays up.",
      "areas": [
        "recrutador"
      ],
      "telas": [
        "/publicar"
      ],
      "ordem": 12,
      "corpo": "In [Post a job](/publicar) you paste the job text and AI fills in the fields. Emails and phone numbers are removed from the text first.\n\n## Step by step\n\n1. Paste the text and click to read it.\n2. Check title, level, contract type, work model, city, skills, pay range and benefits.\n3. Publish.\n\n## Warnings\n\n- **Similar job:** if your company already has a similar active job, you see a warning with \"Update the existing one\". If it is a different job, publish anyway.\n- **Suggested pay range:** with 5 or more similar jobs, their median range shows.\n- **Market:** next to it, the [Tech job market](/mercado) numbers for the first skill, level, employment type and currency: the job range and what candidates ask. Expectations are always aggregated from 10 or more profiles; you never see anyone's own expectation here. It is for information only.\n- **Bias reviewer:** terms about age, gender, looks, origin, family, health or religion get a warning with a suggested change. It only warns and never blocks. You can ask AI for a text without those terms.\n- **Interview questions:** AI suggests questions from the skills. They are not saved.\n\n## How long the job stays up\n\nA job stays active for 14 days. To renew it, publish again and choose \"Update the existing one\". Expired jobs are archived.\n\nLimit: 30 text readings per day per account."
    },
    {
      "slug": "buscar-candidatos",
      "titulo": "Searching candidates",
      "resumo": "Search, reference job, filters and the W2 Profile on the side.",
      "areas": [
        "recrutador"
      ],
      "telas": [
        "/candidatos",
        "/candidatos/comparar"
      ],
      "ordem": 13,
      "corpo": "[Candidates](/candidatos) is only for recruiters signed in with the authenticator.\n\n## Search\n\nType what you look for, for example \"cloud analyst AWS\". Search understands synonyms: AWS and Cloud show up together.\n\n## For the job\n\nPick an active job of your company in \"For the job\". The list is then sorted by [match](/ajuda/match) with it, and each row shows what is missing.\n\n## Filters\n\nIn \"Filters\" you combine skills (the profile must have all of them), seniority, work model, contract type, monthly expected pay up to, language and level, start date and profile updated. People who did not give availability or expected pay still show up.\n\nFilters stay in the page address, so you can save or share the search.\n\n## Viewing the W2 Profile\n\nOn a computer, \"View\" opens the W2 Profile next to the list. On a phone, it opens in a window. With a job picked, the top shows \"For the X job: 87%\" and everything missing.\n\n## Compare\n\nSelect up to 10 candidates and use \"Compare\" in the bottom bar. The screen shows the candidates side by side, with the W2 Profile fields in rows and, with a job chosen, the match and what is missing. Contact details are masked, as in search. \"Remove\" takes someone out of the comparison and the selection.\n\n\"Download CSV\" and \"Download Excel\" save the table with one row per candidate; \"Print or PDF\" opens the browser's print dialog, where you can save as PDF. The files are built in your browser and carry masked contact details. W2Talent only records that an export happened, not its content.\n\n## Automatic translation\n\nWhen a W2 Profile was written in another language, the list, the profile and the comparison show the title, summary, highlights and job titles translated into the site language, with the note \"Automatic translation\". \"See original\" shows the text as the candidate wrote it. Names, companies, cities, numbers and skills are not translated. Downloaded files (CSV, Excel and PDF) always keep the original text."
    },
    {
      "slug": "instalar-app",
      "titulo": "Installing on your phone and using offline",
      "resumo": "How to install W2Talent as an app and what works offline.",
      "areas": [
        "publico",
        "candidato",
        "recrutador"
      ],
      "telas": [
        "/",
        "/offline"
      ],
      "ordem": 14,
      "corpo": "W2Talent works in the browser on computers and phones, with the same account.\n\n## Install as an app\n\nWhen the browser allows it, an \"Install app\" button shows at the top. It adds an icon to your home screen, and the site opens like an app.\n\nOn iPhone, use Safari's share button and \"Add to Home Screen\".\n\n## Without internet\n\n- Pages you already opened (Jobs, My profile, My applications) show the last copy, with its date.\n- A notice says you are offline.\n- Sending, publishing and new searches wait for the connection to come back."
    },
    {
      "slug": "ia",
      "titulo": "How W2Talent uses AI",
      "resumo": "Where AI shows up and where it decides nothing.",
      "areas": [
        "publico",
        "candidato",
        "recrutador"
      ],
      "telas": [
        "/ia"
      ],
      "ordem": 15,
      "corpo": "AI helps with text tasks. It does not approve, reject or score anyone.\n\n## Where it shows up\n\n- Reading the CV and filling in the profile.\n- Writing the summary and highlights of the W2 Profile.\n- Reading the job text and filling in the fields.\n- Rewriting the job without biased terms, when the recruiter asks.\n- Suggesting interview questions.\n- Answering questions in this help, only with what the articles say and always with the source link.\n\n## Where it does not\n\nThe [match](/ajuda/match) is a calculation with fixed weights. Search uses text and meaning to sort, but does not hide candidates.\n\nThe conversation in [Talk to a person](/ajuda/conversa) is answered by a person on the team. Nothing in it goes to AI.\n\nThe full list, with the data each task uses, is in [How we use AI](/ia)."
    },
    {
      "slug": "painel-rh",
      "titulo": "HR dashboard",
      "resumo": "Your company's jobs, the applications they received and reply numbers.",
      "areas": [
        "recrutador"
      ],
      "telas": [
        "/rh"
      ],
      "ordem": 16,
      "corpo": "The [HR dashboard](/rh) shows your company's jobs and the applications each one received.\n\n## Company numbers\n\n- **Active jobs** and the ones that **expire within 3 days** (renew them before they expire).\n- **Applications** received and how many are **in the New stage**.\n- **Time to first reply:** the average time between an application arriving and you first changing its stage.\n- **Reply rate:** how many applications have left New at least once.\n\nThe numbers cover only your company.\n\n## Jobs\n\nEach job shows its status, the total number of applications and the new ones. An active job with a pay range gets a \"below\", \"within\" or \"above market\" tag: the middle of its range against the job range for the same first skill, level, employment type and currency in the [Tech job market](/mercado). Without enough numbers for the group, no tag shows. \"Matching candidates\" searches for profiles close to the job, including people who have not applied yet.\n\n## Applications for a job\n\n\"See applications\" lists the people who applied, from best to lowest match with the job.\n\n**Adjusted order:** after 30 decisions, the order takes into account who your company moves to Interview (or later) and who it marks as Not moving forward. Only the order changes: the match % is still the same calculation, and age, gender, photo, marital status or address never count. Above the list you see \"Order adjusted to what your company picks\"; \"See default order\" goes back to ordering by match %. The same applies in Candidates when a reference job is chosen. Details in [How we use AI](/ia#ranking).\n\n- **Stage:** New, Reviewing, Interview, Offer, Hired or Not moving forward. Change it with one click; there is no form.\n- **What the candidate sees:** \"Seen\" when you open the profile or move it to Reviewing, \"Answered\" from Interview on, and \"Closed\" for Not moving forward. Internal stages are not shown to them.\n- **Contact:** when you move someone to Interview (or later), their email and phone show in the list, only for your company, and they get a notice by email. Once released, it stays released.\n- **Book an interview:** once the contact is released, offer 3 to 8 times (30, 45 or 60 minutes) and, if you want, the meeting link. The candidate picks one through the e-mail link and both get the calendar invite (.ics). They can change or cancel up to 12 hours before. Changing the times cancels the previous offer.\n- **Compare:** tick up to 10 people to compare them side by side and export."
    },
    {
      "slug": "mercado",
      "titulo": "Tech job market",
      "resumo": "Salary ranges in jobs, candidate expectations and trending skills, no sign-in needed.",
      "areas": [
        "publico",
        "candidato",
        "recrutador"
      ],
      "telas": [
        "/mercado",
        "/painel",
        "/publicar",
        "/rh"
      ],
      "ordem": 17,
      "corpo": "The [Tech job market](/mercado) page shows numbers taken from the jobs and profiles published on W2Talent. It's open to everyone, no sign-in needed.\n\n## Where the numbers come from\n\n- Only from W2Talent's own active jobs and active profiles. No AI and no outside data.\n- The calculation runs once a day; the page shows the week of the numbers.\n- Example jobs and profiles are left out.\n\n## How to read the tables\n\n- **Salary range in jobs:** the posted \"from\" and \"up to\", by level and employment type, as a monthly amount. The **median** is the middle value; the **25%–75%** column shows where half of the jobs fall.\n- **Candidate salary expectations:** the monthly minimum asked in profiles, by level and employment type. Profiles don't split expectations by work model.\n- **Most requested:** skills with the most active jobs, how many profiles have each one and how many jobs there are per profile.\n- **Trending:** jobs posted in the last 30 days versus the previous 30, only for skills with 5 or more recent jobs.\n- **Time to first reply:** from the application until the company first changes its stage, across the site, in the last 90 days.\n\nPick a skill and, if you like, the work model (remote, hybrid or on-site) to see only its numbers.\n\n## \"Not enough data yet\"\n\nSo that no one can be identified, a group only gets numbers with **10 or more** jobs or profiles and, when it comes from jobs, from **3 or more companies**. Below that the table says how many are missing, for example \"4 more jobs needed\". We never show the minimum or the maximum.\n\n## Inside W2Talent\n\nThe same numbers show up in three screens, always under the rule above. The \"job range\" goes from the median \"from\" to the median \"up to\" of the group's jobs (same skill, level, employment type and currency).\n\n- **On your [dashboard](/painel) (candidate):** \"Your salary expectation and the market\" compares the monthly expectation in your published profile with the job range for your first skill that already has numbers, at your level and employment type, and says whether it is below, within or above. It also lists up to 5 trending skills, marking the ones you already have.\n- **In [Post a job](/publicar):** next to the suggested range, the job range and the candidates' expectations for the job's first skill, level, employment type and currency. Expectations are always aggregated from 10 or more profiles, never anyone's own. It is for information only.\n- **On the [HR dashboard](/rh):** each active job with a pay range gets a \"below\", \"within\" or \"above market\" tag, comparing the middle of its range with the job range of the same group. With no numbers for the group, nothing shows."
    }
  ],
  "es": [
    {
      "slug": "o-que-e",
      "titulo": "Qué es W2Talent",
      "resumo": "Para qué sirve el sitio, para candidatos y para reclutadores.",
      "areas": [
        "publico",
        "candidato",
        "recrutador"
      ],
      "telas": [
        "/",
        "/ajuda/minhas-conversas"
      ],
      "ordem": 1,
      "corpo": "W2Talent conecta candidatos de tecnología con vacantes. El candidato encuentra vacantes, revisa cada una y envía en lote solo las que aprobó. El reclutador recibe la Ficha W2, un resumen estándar del candidato con el match explicado.\n\n## Para candidatos\n\n- Usar W2Talent es gratis.\n- Armas tu ficha a partir del CV en [Mi ficha](/minha-ficha).\n- Buscas vacantes escribiendo como hablas, por ejemplo \"DevOps remoto 15k\".\n- Solo llega a la empresa lo que aprobaste.\n\n## Para reclutadores\n\n- Registras la empresa en [Mi empresa](/empresa).\n- Publicas la vacante pegando el texto, y la IA organiza los campos.\n- Buscas candidatos y los ordenas por match con una vacante tuya.\n\n## Hablar con una persona\n\n¿No encontraste la respuesta en la Ayuda? En [Hablar con una persona](/ajuda/conversa), escribes al equipo de W2Talent, con o sin sesión.\n\n- Sin sesión, indicas un e-mail. Con sesión, usamos el e-mail de la cuenta.\n- La respuesta aparece en la conversación y te avisamos por e-mail, con el enlace.\n- Guarda el enlace: es como vuelves a la conversación. Quien tenga el enlace ve la conversación.\n- Con sesión, tus conversaciones están en [Mis conversaciones](/ajuda/minhas-conversas), en el menú de tu cuenta, y abres cada una sin el enlace.\n- Responde una persona. Nada de la conversación va a la IA.\n- El equipo solo ve lo que escribiste, la pantalla de donde viniste y, con sesión, si la cuenta es de candidato o de reclutador.\n- Límites: 3 conversaciones nuevas por día y 30 mensajes por conversación por día, hasta 2.000 caracteres cada uno.\n- La conversación se borra 180 días después de cerrada, con todos los mensajes.\n\nEsta es la versión de pruebas. El sitio cambia a menudo."
    },
    {
      "slug": "entrar-e-perfil",
      "titulo": "Iniciar sesión y elegir el perfil",
      "resumo": "Inicio de sesión con Google o Microsoft y la elección entre candidato y reclutador.",
      "areas": [
        "publico",
        "candidato",
        "recrutador"
      ],
      "telas": [
        "/entrar",
        "/entrar/perfil"
      ],
      "ordem": 2,
      "corpo": "Inicias sesión con una cuenta de Google o Microsoft (personal o de empresa). Por ahora W2Talent no tiene contraseña propia.\n\n## Ver vacantes no requiere iniciar sesión\n\nCualquiera ve y busca las vacantes. El inicio de sesión se pide para marcar una vacante, publicar tu ficha, enviar postulaciones o buscar candidatos.\n\n## Candidato o reclutador\n\nEn el primer acceso eliges el perfil de la cuenta, una sola vez:\n\n- **Candidato:** arma la ficha, aprueba y envía postulaciones. Al elegirlo, aceptas los términos de uso y de datos.\n- **Reclutador:** registra la empresa, publica vacantes y busca candidatos. Necesita el [autenticador](/ajuda/autenticador).\n\nUna cuenta es candidato o reclutador, no las dos cosas. Para usar los dos lados, usa otra cuenta de Google o Microsoft.\n\nSi entras con Google y luego con Microsoft con el mismo correo, las dos se vuelven la misma cuenta."
    },
    {
      "slug": "autenticador",
      "titulo": "Autenticador y códigos de recuperación",
      "resumo": "Cómo activar el código de la app autenticadora y qué hacer si pierdes el celular.",
      "areas": [
        "candidato",
        "recrutador"
      ],
      "telas": [
        "/conta/seguranca",
        "/entrar/codigo"
      ],
      "ordem": 3,
      "corpo": "El autenticador es el segundo paso del inicio de sesión: además de Google o Microsoft, escribes un código de 6 dígitos de una app en el celular.\n\n- **Reclutador:** es obligatorio. Sin él, las pantallas de reclutador quedan bloqueadas, y no se puede desactivar.\n- **Candidato:** es opcional, pero recomendado.\n\n## Cómo activarlo\n\n1. Abre [Seguridad de la cuenta](/conta/seguranca).\n2. Escanea el código QR con una app autenticadora (Google Authenticator, Microsoft Authenticator u otra).\n3. Escribe el código que aparece en la app.\n4. Guarda los 10 códigos de recuperación en un lugar seguro. Cada uno funciona una vez.\n\n## En el día a día\n\nDespués de escribir el código, este dispositivo queda recordado por 30 días. En otro dispositivo, o después de ese plazo, se pide el código de nuevo.\n\n## Perdí el celular\n\nUsa uno de los códigos de recuperación en lugar del código de la app. Después, activa el autenticador de nuevo en el celular nuevo."
    },
    {
      "slug": "minha-ficha",
      "titulo": "Armar mi ficha a partir del CV",
      "resumo": "Los tres pasos de Mi ficha: CV, revisar los campos y generar la Ficha W2.",
      "areas": [
        "candidato"
      ],
      "telas": [
        "/minha-ficha",
        "/painel"
      ],
      "ordem": 4,
      "corpo": "En [Mi ficha](/minha-ficha) conviertes el CV en una ficha que las empresas leen en segundos.\n\n## Los tres pasos\n\n1. **Enviar el CV** en PDF o Word (.docx), hasta 5 MB, o pegar el texto. La IA lee el texto y llena los campos. Tu correo y teléfono se leen por reglas y se quitan del texto antes de ir a la IA.\n2. **Revisar los campos.** Corrige lo que la lectura hizo mal. La ficha necesita los campos obligatorios; el [panel](/painel) muestra lo que falta.\n3. **Generar la Ficha W2.** La IA escribe un resumen corto y hasta 3 puntos destacados. Después publicas la ficha con tu cuenta de candidato.\n\n## Pretensión salarial\n\nMarca los regímenes que aceptas (empleado, contratista, pasantía...) e informa el **mínimo** que aceptas en cada uno.\n\n## Límites\n\n- Hasta 10 lecturas de CV y 20 Fichas W2 por día.\n- El borrador queda guardado en este navegador hasta que publiques."
    },
    {
      "slug": "ficha-w2",
      "titulo": "Qué es la Ficha W2",
      "resumo": "El resumen estándar del candidato que lee el reclutador.",
      "areas": [
        "candidato",
        "recrutador"
      ],
      "telas": [
        "/minha-ficha",
        "/candidatos"
      ],
      "ordem": 5,
      "corpo": "La Ficha W2 es una tarjeta estándar del candidato. Todos los candidatos aparecen en el mismo formato, así el reclutador compara rápido.\n\n## Qué tiene la ficha\n\n- **Encabezado:** primer nombre, cargo, años de experiencia, ciudad y modalidad, régimen y pretensión, y cuándo puede empezar.\n- **Resumen:** hasta 3 frases escritas por la IA a partir de la ficha.\n- **Destacados:** hasta 3 puntos fuertes, también escritos por la IA.\n- **Competencias e idiomas:** vienen de la ficha que el candidato revisó.\n\n## Qué no tiene\n\nLa IA no recibe ni escribe el nombre completo, el correo ni el teléfono. El contacto queda protegido (mira [Mis datos y privacidad](/ajuda/privacidade)).\n\nEl candidato puede generar la Ficha W2 de nuevo después de cambiar la ficha. Más en [Cómo usamos la IA](/ia#ficha-w2).\n\n## Aviso de dato sensible\n\nLas mismas reglas del revisor de sesgo de las vacantes revisan el cargo, el objetivo, el resumen y los destacados. Si el texto cuenta tu edad, estado civil, hijos, religión, salud, apariencia u origen (por ejemplo \"joven\", \"casado\", \"buena presencia\", \"inglés nativo\"), aparece un aviso al lado, con \"Quitar\" o \"Cambiar por\" cuando hay un buen cambio. Esos datos no ayudan en la vacante y pueden perjudicarte. Es solo un aviso: tú decides, y la ficha se guarda y se publica igual. Las reglas corren en tu navegador, sin IA. Mira [Cómo usamos IA](/ia#revisor-vies).\n\n## Traducción automática\n\nPara los reclutadores que usan el sitio en otro idioma, la IA traduce el título, el resumen, los destacados y los cargos de la Ficha W2 publicada. Nombre, empresas, ciudades, números y competencias quedan como están, y el nombre, el correo y el teléfono no van a la IA. El reclutador ve el aviso \"Traducción automática\" y puede abrir el original. El candidato sigue viendo su ficha como la escribió. Si la ficha cambia, la traducción se rehace."
    },
    {
      "slug": "buscar-vagas",
      "titulo": "Buscar vacantes",
      "resumo": "Cómo escribir la búsqueda, los chips de lo que se entendió y las áreas.",
      "areas": [
        "publico",
        "candidato"
      ],
      "telas": [
        "/vagas"
      ],
      "ordem": 6,
      "corpo": "En [Empleos](/vagas) escribes la búsqueda como hablas y presionas Enter o Buscar.\n\n## Ejemplos\n\n- \"DevOps remoto 15k\"\n- \"analista de datos semi senior São Paulo\"\n- \"React senior empleado\"\n\n## Qué entiende W2Talent\n\nDebajo de la caja aparecen chips con lo que se entendió: competencias, régimen, modalidad, nivel y rango salarial. Haz clic en la × de un chip para quitarlo.\n\nLas competencias buscan vacantes que pidan cualquiera de ellas. Régimen, modalidad, nivel y rango no ocultan vacantes: cuentan en el [match](/ajuda/match).\n\n## Áreas\n\nLas píldoras debajo de la búsqueda (Cloud, Datos, Front-end...) traen las competencias más pedidas de cada área. Marcar una escribe su nombre en la búsqueda.\n\n## Vacantes similares\n\nAl abrir una vacante, aparecen hasta 5 vacantes similares al final del detalle.\n\n## Traducción automática\n\nLas vacantes escritas en otro idioma aparecen traducidas al idioma del sitio, con el aviso \"Traducción automática\". Haz clic en \"Ver original\" para leer el texto que escribió la empresa y en \"Ver traducción\" para volver. Los nombres de tecnología, los números y los contactos no se traducen. Una vacante recién publicada o editada puede aparecer en el original por algunos minutos, hasta que la traducción esté lista. Mira [cómo usamos IA](/ia#traducao)."
    },
    {
      "slug": "match",
      "titulo": "Cómo se calcula el match",
      "resumo": "Los pesos del match, las competencias cercanas y qué quiere decir \"falta\".",
      "areas": [
        "candidato",
        "recrutador"
      ],
      "telas": [
        "/vagas",
        "/candidatos",
        "/painel"
      ],
      "ordem": 7,
      "corpo": "El match es una cuenta con pesos fijos. No es IA y no usa edad, género, foto ni dirección.\n\n| Parte | Peso |\n| --- | --- |\n| Competencias | 40 |\n| Nivel | 20 |\n| Régimen, modalidad y rango salarial | 20 |\n| Actualizada hace poco | 10 |\n| Registro completo | 10 |\n\nEn la búsqueda de empleos, las dos últimas filas miran la vacante: vacante publicada o renovada hace poco y con todos los campos llenos. Para el reclutador, en Candidatos, miran la ficha del candidato.\n\n## Competencias cercanas\n\nUna competencia parecida cuenta la mitad. Ejemplo: quien tiene OpenShift suma medio punto en una vacante que pide Kubernetes. El texto muestra \"Kubernetes: tiene OpenShift (cercana)\".\n\n## Qué quiere decir \"falta\"\n\nJunto al número aparece lo primero que faltó, lo de mayor peso. Un criterio que la vacante no pidió cuenta como cumplido.\n\n## En tu panel\n\nCon la ficha publicada, el [panel](/painel) muestra lo que más le falta para las vacantes abiertas más parecidas (hasta 30, con match de 40% o más): las competencias que faltan, las que solo tienes parecidas, y nivel, régimen o modalidad cuando pesan. El rango salarial no entra, para que nadie se sienta empujado a pedir menos. Nada de esto se guarda.\n\n## Para el reclutador\n\nEn [Candidatos](/candidatos), elige una vacante en \"Para la vacante\" y la lista se ordena por el match con ella. Es la misma cuenta, mirando de la vacante a la ficha."
    },
    {
      "slug": "aprovar-e-enviar",
      "titulo": "Aprobar y enviar postulaciones",
      "resumo": "Marcar vacantes, revisar, aprobar y enviar en lote.",
      "areas": [
        "candidato"
      ],
      "telas": [
        "/vagas",
        "/vagas/aprovar"
      ],
      "ordem": 8,
      "corpo": "En W2Talent no se envía nada sin tu aprobación, vacante por vacante.\n\n## Paso a paso\n\n1. En [Empleos](/vagas), marca las vacantes que te interesan. Van a la selección, en la barra de abajo.\n2. Abre [Revisar y aprobar](/vagas/aprovar). Cada vacante muestra el match con tu ficha y lo que falta.\n3. Lee y aprueba una por una.\n4. Envía. Van solo las aprobadas, con tu Ficha W2.\n\nPara enviar necesitas iniciar sesión como candidato y tener la ficha publicada.\n\n## Reglas del envío\n\n- Hasta 10 vacantes por envío y 30 postulaciones en 24 horas.\n- La misma vacante nunca se envía dos veces.\n- Si la empresa cambia la vacante después de tu aprobación, la aprobación se cae y la vacante vuelve para que la revises.\n- Las vacantes vencidas o archivadas no se envían.\n- La empresa la recibe por e-mail y, si activó la integración con ATS, también en su sistema de selección. El contenido es el mismo, sin tu e-mail ni teléfono.\n\nDespués del envío, sigue todo en [Mis postulaciones](/minhas-candidaturas)."
    },
    {
      "slug": "minhas-candidaturas",
      "titulo": "Seguir las postulaciones",
      "resumo": "Qué quiere decir cada estado en Mis postulaciones.",
      "areas": [
        "candidato"
      ],
      "telas": [
        "/minhas-candidaturas",
        "/painel"
      ],
      "ordem": 9,
      "corpo": "En [Mis postulaciones](/minhas-candidaturas) aparece cada vacante enviada, con la fecha.\n\n## Estados\n\n- **Enviada:** la postulación llegó a la empresa.\n- **Vista:** la empresa abrió tu ficha o empezó a analizarla.\n- **Respondida:** la empresa quiere seguir contigo (entrevista u oferta).\n- **Cerrada:** la empresa no seguirá con esta postulación, o salió de circulación.\n\n## Contacto protegido\n\nLa empresa habla contigo por una dirección de W2Talent. Tu correo y teléfono solo le aparecen después de que respondes o cuando te llama a una entrevista. En ese caso, solo la empresa de esa vacante ve tu contacto, y recibes un aviso por correo.\n\nEl [panel](/painel) muestra los mismos números de forma resumida.\n\n## Entrevista\n\nCuando una empresa te llama a una entrevista, llega un e-mail con un enlace para elegir uno de los horarios ofrecidos. Los horarios aparecen en tu zona horaria. Después de elegir, tú y la empresa reciben la invitación para el calendario (.ics). Con el mismo enlace puedes cambiar el horario o cancelar hasta 12 horas antes. La entrevista agendada aparece en [Mis postulaciones](/minhas-candidaturas)."
    },
    {
      "slug": "privacidade",
      "titulo": "Mis datos y privacidad",
      "resumo": "Contacto protegido, cuánto tiempo se guardan el perfil y las conversaciones y cómo pedir revisión.",
      "areas": [
        "publico",
        "candidato",
        "recrutador"
      ],
      "telas": [
        "/minha-ficha",
        "/renovar",
        "/ia",
        "/mercado"
      ],
      "ordem": 10,
      "corpo": "## Contacto protegido\n\nEn la búsqueda de candidatos, el correo y el teléfono aparecen enmascarados (por ejemplo, a***@e***.com). El contacto completo solo llega a la empresa después de que le respondes o cuando te llama a una entrevista en una vacante a la que te postulaste (y recibes un aviso).\n\n## Sistema de selección de la empresa\n\nAlgunas empresas activan la integración con su sistema de selección (ATS). En ese caso, la postulación que envíes también va a ese sistema, con el mismo contenido que aprobaste: la Ficha W2, sin e-mail, teléfono ni enlaces. El sistema también se entera cuando la empresa cambia la etapa de tu postulación, y tu e-mail y teléfono solo van allí después de que te llama a entrevista. Allí, la postulación sigue las reglas de privacidad de la empresa.\n\n## Pretensión salarial\n\nLa pretensión que pones en tu ficha aparece para los reclutadores en tu Ficha W2 y en la búsqueda de candidatos. En los números de mercado ([Mercado de TI](/mercado) y Publicar vacante), los reclutadores ven solo rangos agregados de **10 o más fichas**, nunca la pretensión de alguien, y nunca el mínimo ni el máximo.\n\n## Cuánto tiempo queda el perfil en la búsqueda\n\n- El perfil publicado queda en la búsqueda por 180 días.\n- Antes de vencer, recibes recordatorios por correo con el botón \"Sigo buscando\". Al hacer clic se renueva por 180 días más.\n- Sin renovación, el perfil se archiva y sale de la búsqueda.\n- Después de 30 días archivado, se borra, junto con las postulaciones.\n\n## Conversaciones con el equipo\n\nLas conversaciones en [Hablar con una persona](/ajuda/conversa) se guardan hasta 180 días después de cerradas; luego se borran, con todos los mensajes. Con sesión, las ves en [Mis conversaciones](/ajuda/minhas-conversas). Responde una persona del equipo, y nada de la conversación va a la IA.\n\n## IA y revisión por una persona\n\nLa IA ayuda a leer textos y a escribir resúmenes, pero no decide por nadie. Si una decisión automática te afectó, pide la revisión de una persona en contato@w2talent.com. Mira [Cómo usamos la IA](/ia).\n\n## Al cerrar sesión\n\nCerrar sesión borra de este navegador los borradores y la selección guardados."
    },
    {
      "slug": "minha-empresa",
      "titulo": "Registrar la empresa",
      "resumo": "Datos de la empresa, verificación y la etiqueta \"Empresa no verificada\".",
      "areas": [
        "recrutador"
      ],
      "telas": [
        "/empresa"
      ],
      "ordem": 11,
      "corpo": "Antes de publicar vacantes, el reclutador registra la empresa en [Mi empresa](/empresa).\n\n## Qué informar\n\n- Nombre de la empresa\n- CNPJ (número de empresa de Brasil; se revisan los dígitos verificadores)\n- Sitio web\n- Correo de contacto\n\nCada cuenta de reclutador queda vinculada a una empresa.\n\n## Verificación\n\nEl equipo de W2Talent revisa los datos. Mientras tanto:\n\n- **En revisión:** tus vacantes ya aparecen, con la etiqueta \"Empresa no verificada\".\n- **Verificada:** las vacantes aparecen sin etiqueta.\n- **Rechazada:** las vacantes se archivan. Escribe a contato@w2talent.com.\n\nCambiar el nombre o el CNPJ de una empresa verificada la devuelve a \"En revisión\".\n\n## Integración con ATS\n\nSi la empresa usa un sistema de selección (ATS), las postulaciones pueden llegar allí también. En [Mi empresa](/empresa), quien registró la empresa indica una dirección https y hace clic en \"Guardar y activar\".\n\n- Con cada postulación recibida, W2Talent envía un `POST` con JSON a esa dirección (evento `candidatura.recebida`).\n- Con cada cambio de etapa hecho en la pantalla de la vacante, envía el evento `candidatura.etapa`.\n- El aviso lleva la vacante, la postulación (fecha, etapa, match y brechas) y la Ficha W2 como el candidato la aprobó: **sin e-mail, teléfono ni enlaces**. El e-mail y el teléfono solo van después de que la postulación pasa por la Entrevista, como en la pantalla.\n- Solo direcciones https públicas. Red interna y localhost no funcionan.\n- \"Enviar prueba\" envía el evento `teste` en el momento. La pantalla muestra las últimas 20 entregas.\n- Si tu sistema no responde, o responde con error 5xx o 429, intentamos de nuevo hasta 10 veces durante algunas horas. Un error 4xx no se repite.\n- \"Desactivar\" detiene los envíos. No se guarda nada del contenido enviado, solo la fecha y el resultado.\n\n## Cambio de etapa\n\nEl evento `candidatura.etapa` tiene el mismo cuerpo que `candidatura.recebida`, con un campo más, `data.mudanca`:\n\n- `de`: la etapa anterior.\n- `para`: la etapa nueva.\n- `em`: cuándo cambió (igual a `occurred_at`).\n\nLas etapas van con estos nombres: `nova`, `em_analise`, `entrevista`, `proposta`, `contratada` y `nao_seguiu`. El campo `data.candidatura.etapa` muestra la etapa en el momento de la entrega; si alguien la cambió de nuevo mientras tanto, vale el `para` de cada aviso, en el orden de `occurred_at`. Cuando la postulación pasa por la Entrevista (o salta directo a Propuesta o Contratada), `data.candidato.contato` trae `email` y `celular`; antes de eso, viene `null`.\n\n## Integración pausada\n\nCada entrega que falla (sin respuesta o con un código fuera del rango 2xx) cuenta una falla, incluidos los nuevos intentos. Una entrega exitosa pone la cuenta en cero; la prueba no cuenta. Con **50 fallas seguidas**, la integración queda \"Pausada\": no se envía nada más y quien registró la empresa recibe un e-mail.\n\nPara reactivarla, revisa la dirección y tu sistema, usa \"Enviar prueba\" y haz clic en \"Activar\". La cuenta vuelve a cero. Lo que pasó durante la pausa no se reenvía.\n\n## Comprobar la firma\n\nAl activar (o en \"Generar nuevo secreto\"), la pantalla muestra el secreto **una vez**. Guárdalo en tu sistema. Cada aviso trae:\n\n- `X-W2Talent-Event`: el evento.\n- `X-W2Talent-Delivery`: el id del evento. Se repite en los nuevos intentos; úsalo para no guardar dos veces.\n- `X-W2Talent-Signature`: `t=<segundos>,v1=<firma>`.\n\nPara comprobarla, calcula el HMAC-SHA256 en hexadecimal de `t` + `.` + el cuerpo exactamente como llegó, usando el secreto entero como clave, y compáralo con `v1`. Rechaza avisos con `t` de hace más de 5 minutos."
    },
    {
      "slug": "publicar-vaga",
      "titulo": "Publicar una vacante",
      "resumo": "Pegar el texto, revisar los campos, avisos de vacante repetida y de sesgo, y cuánto tiempo queda publicada.",
      "areas": [
        "recrutador"
      ],
      "telas": [
        "/publicar"
      ],
      "ordem": 12,
      "corpo": "En [Publicar vacante](/publicar) pegas el texto de la vacante y la IA llena los campos. Los correos y teléfonos se quitan del texto antes.\n\n## Paso a paso\n\n1. Pega el texto y haz clic para leerlo.\n2. Revisa título, nivel, régimen, modalidad, ciudad, competencias, rango y beneficios.\n3. Publica.\n\n## Avisos\n\n- **Vacante parecida:** si tu empresa ya tiene una vacante activa parecida, aparece el aviso con \"Actualizar la existente\". Si es otra vacante, publícala igual.\n- **Rango sugerido:** con 5 o más vacantes parecidas, aparece el rango mediano de ellas.\n- **Mercado:** al lado, los números del [Mercado de TI](/mercado) para la primera competencia, el nivel, el tipo de contrato y la moneda: el rango de las vacantes y lo que piden los candidatos. La pretensión siempre es agregada, de 10 o más fichas; aquí nunca ves la pretensión de alguien. Es solo informativo.\n- **Revisor de sesgo:** los términos sobre edad, género, apariencia, origen, familia, salud o religión reciben un aviso con sugerencia de cambio. Solo avisa y no bloquea. Puedes pedir a la IA un texto sin esos términos.\n- **Preguntas de entrevista:** la IA sugiere preguntas a partir de las competencias. No se guardan.\n\n## Cuánto tiempo queda publicada\n\nLa vacante queda activa por 14 días. Para renovarla, publica de nuevo y elige \"Actualizar la existente\". La vacante vencida se archiva.\n\nLímite: 30 lecturas de texto por día por cuenta."
    },
    {
      "slug": "buscar-candidatos",
      "titulo": "Buscar candidatos",
      "resumo": "Búsqueda, vacante de referencia, filtros y la Ficha W2 al lado.",
      "areas": [
        "recrutador"
      ],
      "telas": [
        "/candidatos",
        "/candidatos/comparar"
      ],
      "ordem": 13,
      "corpo": "[Candidatos](/candidatos) es solo para reclutadores con sesión iniciada y autenticador.\n\n## Buscar\n\nEscribe lo que buscas, por ejemplo \"analista cloud AWS\". La búsqueda entiende sinónimos: AWS y Cloud aparecen juntos.\n\n## Para la vacante\n\nElige una vacante activa de tu empresa en \"Para la vacante\". La lista se ordena por el [match](/ajuda/match) con ella, y cada fila muestra lo que falta.\n\n## Filtros\n\nEn \"Filtros\" combinas competencias (la ficha debe tenerlas todas), seniority, modalidad, régimen, pretensión mensual hasta, idioma y nivel, cuándo puede empezar y ficha actualizada. Quien no informó disponibilidad o pretensión sigue apareciendo.\n\nLos filtros quedan en la dirección de la página, así puedes guardar o compartir la búsqueda.\n\n## Ver la Ficha W2\n\nEn la computadora, \"Ver\" abre la Ficha W2 al lado de la lista. En el celular, se abre en una ventana. Con una vacante elegida, arriba aparece \"Para la vacante X: 87%\" y todo lo que falta.\n\n## Comparar\n\nMarca hasta 10 candidatos y usa \"Comparar\" en la barra de abajo. La pantalla muestra los candidatos lado a lado, con los campos de la Ficha W2 en filas y, con una vacante elegida, el match y lo que falta. El contacto aparece enmascarado, como en la búsqueda. \"Quitar\" saca a alguien de la comparación y de la selección.\n\n\"Descargar CSV\" y \"Descargar Excel\" guardan la tabla con una fila por candidato; \"Imprimir o PDF\" abre la impresión del navegador, donde puedes guardar en PDF. Los archivos se arman en tu navegador y llevan el contacto enmascarado. W2Talent solo guarda que hubo una exportación, sin el contenido.\n\n## Traducción automática\n\nCuando la Ficha W2 se escribió en otro idioma, la lista, la ficha y la comparación muestran el título, el resumen, los destacados y los cargos traducidos al idioma del sitio, con el aviso \"Traducción automática\". \"Ver original\" muestra el texto como lo escribió el candidato. Nombre, empresas, ciudades, números y competencias no se traducen. Los archivos descargados (CSV, Excel y PDF) siempre mantienen el texto original."
    },
    {
      "slug": "instalar-app",
      "titulo": "Instalar en el celular y usar sin internet",
      "resumo": "Cómo instalar W2Talent como app y qué funciona sin conexión.",
      "areas": [
        "publico",
        "candidato",
        "recrutador"
      ],
      "telas": [
        "/",
        "/offline"
      ],
      "ordem": 14,
      "corpo": "W2Talent funciona en el navegador de la computadora y del celular, con la misma cuenta.\n\n## Instalar como app\n\nCuando el navegador lo permite, aparece el botón \"Instalar app\" arriba. Crea un ícono en la pantalla de inicio, y el sitio se abre como una app.\n\nEn iPhone, usa el botón de compartir de Safari y \"Agregar a inicio\".\n\n## Sin internet\n\n- Las pantallas que ya abriste (Empleos, Mi ficha, Mis postulaciones) muestran la última copia, con la fecha.\n- Aparece un aviso de que estás sin internet.\n- Enviar, publicar y buscar de nuevo esperan a que vuelva la conexión."
    },
    {
      "slug": "ia",
      "titulo": "Cómo W2Talent usa la IA",
      "resumo": "Dónde aparece la IA y dónde no decide nada.",
      "areas": [
        "publico",
        "candidato",
        "recrutador"
      ],
      "telas": [
        "/ia"
      ],
      "ordem": 15,
      "corpo": "La IA ayuda en tareas de texto. No aprueba, no rechaza y no le pone nota a nadie.\n\n## Dónde aparece\n\n- Leer el CV y llenar la ficha.\n- Escribir el resumen y los destacados de la Ficha W2.\n- Leer el texto de la vacante y llenar los campos.\n- Reescribir la vacante sin términos de sesgo, cuando el reclutador lo pide.\n- Sugerir preguntas de entrevista.\n- Responder preguntas en esta ayuda, solo con lo que dicen los artículos y siempre con el enlace de la fuente.\n\n## Dónde no entra\n\nEl [match](/ajuda/match) es una cuenta con pesos fijos. La búsqueda usa texto y significado para ordenar, pero no oculta candidatos.\n\nLa conversación en [Hablar con una persona](/ajuda/conversa) la responde una persona del equipo. Nada de ella va a la IA.\n\nLa lista completa, con los datos que usa cada tarea, está en [Cómo usamos la IA](/ia)."
    },
    {
      "slug": "painel-rh",
      "titulo": "Panel de RR. HH.",
      "resumo": "Las vacantes de la empresa, las postulaciones recibidas y los números de respuesta.",
      "areas": [
        "recrutador"
      ],
      "telas": [
        "/rh"
      ],
      "ordem": 16,
      "corpo": "El [panel de RR. HH.](/rh) muestra las vacantes de tu empresa y las postulaciones que recibió cada una.\n\n## Números de la empresa\n\n- **Vacantes activas** y las que **vencen en hasta 3 días** (renuévalas antes de que venzan).\n- **Postulaciones** recibidas y cuántas están **en la etapa Nueva**.\n- **Tiempo hasta la primera respuesta:** el promedio entre la llegada de la postulación y el primer cambio de etapa que haces.\n- **Tasa de respuesta:** cuántas postulaciones ya salieron de Nueva alguna vez.\n\nLos números son solo de tu empresa.\n\n## Vacantes\n\nCada vacante muestra su estado, el total de postulaciones y las nuevas. Una vacante activa con rango recibe la etiqueta \"por debajo\", \"dentro\" o \"por encima del mercado\": el medio de su rango frente al rango de las vacantes de la misma primera competencia, nivel, tipo de contrato y moneda en el [Mercado de TI](/mercado). Sin números suficientes para el grupo, no aparece etiqueta. En \"Candidatos compatibles\" buscas perfiles parecidos a la vacante, incluso de quienes aún no se postularon.\n\n## Postulaciones de una vacante\n\nEn \"Ver postulaciones\" aparecen las personas que se postularon, de mayor a menor compatibilidad con la vacante.\n\n**Orden ajustado:** después de 30 decisiones, el orden tiene en cuenta a quién tu empresa pasa a Entrevista (o después) y a quién marca como No siguió. Solo cambia el orden: el % de compatibilidad sigue siendo el mismo cálculo, y nunca cuentan edad, género, foto, estado civil ni dirección. Arriba de la lista aparece \"Orden ajustado según lo que elige tu empresa\"; en \"Ver en el orden estándar\" vuelves al orden por % de compatibilidad. Lo mismo vale en Candidatos cuando hay una vacante de referencia. Detalles en [Cómo usamos la IA](/ia#ranking).\n\n- **Etapa:** Nueva, En análisis, Entrevista, Oferta, Contratada o No siguió. Cámbiala con un clic; no hay formulario.\n- **Lo que ve el candidato:** \"Vista\" cuando abres la ficha o la pasas a En análisis, \"Respondida\" desde Entrevista y \"Cerrada\" en No siguió. Las etapas internas no se le muestran.\n- **Contacto:** al pasar a Entrevista (o después), el correo y el teléfono del candidato aparecen en la lista, solo para tu empresa, y recibe un aviso por correo. Liberado una vez, queda liberado.\n- **Agendar entrevista:** con el contacto liberado, ofrece de 3 a 8 horarios (30, 45 o 60 minutos) y, si quieres, el enlace de la reunión. El candidato elige uno con el enlace del e-mail y ambos reciben la invitación para el calendario (.ics). Puede cambiar o cancelar hasta 12 horas antes. Cambiar los horarios cancela la oferta anterior.\n- **Comparar:** marca hasta 10 personas para compararlas lado a lado y exportar."
    },
    {
      "slug": "mercado",
      "titulo": "Mercado de TI",
      "resumo": "Rango salarial de las vacantes, pretensión de los candidatos y competencias en alza, sin iniciar sesión.",
      "areas": [
        "publico",
        "candidato",
        "recrutador"
      ],
      "telas": [
        "/mercado",
        "/painel",
        "/publicar",
        "/rh"
      ],
      "ordem": 17,
      "corpo": "La página [Mercado de TI](/mercado) muestra números sacados de las vacantes y fichas publicadas en W2Talent. Está abierta a todos, sin iniciar sesión.\n\n## De dónde salen los números\n\n- Solo de las vacantes activas y las fichas activas de W2Talent. Sin IA y sin datos de fuera.\n- El cálculo corre una vez por día; la página indica la semana de los números.\n- Las vacantes y fichas de ejemplo quedan fuera.\n\n## Cómo leer las tablas\n\n- **Rango salarial de las vacantes:** el \"desde\" y el \"hasta\" publicados, por nivel y tipo de contrato, en valor mensual. La **mediana** es el valor del medio; la columna **25%–75%** muestra dónde está la mitad de las vacantes.\n- **Pretensión de los candidatos:** el mínimo mensual pedido en las fichas, por nivel y tipo de contrato. Las fichas no separan la pretensión por modalidad.\n- **Más pedidas:** competencias con más vacantes activas, cuántas fichas tiene cada una y cuántas vacantes hay por ficha.\n- **En alza:** vacantes publicadas en los últimos 30 días frente a los 30 anteriores, solo para competencias con 5 o más vacantes recientes.\n- **Tiempo hasta la primera respuesta:** desde la postulación hasta que la empresa cambia la etapa por primera vez, en todo el sitio, en los últimos 90 días.\n\nElige una competencia y, si quieres, la modalidad (remoto, híbrido o presencial) para ver solo sus números.\n\n## \"Todavía pocos datos\"\n\nPara que nadie pueda ser identificado, un grupo solo recibe números con **10 o más** vacantes o fichas y, cuando sale de vacantes, de **3 o más empresas**. Por debajo, la tabla indica cuánto falta, por ejemplo \"faltan 4 vacantes\". Nunca mostramos el mínimo ni el máximo.\n\n## Dentro de W2Talent\n\nLos mismos números aparecen en tres pantallas, siempre con la regla de arriba. El \"rango de las vacantes\" va del \"desde\" mediano al \"hasta\" mediano de las vacantes del grupo (misma competencia, nivel, tipo de contrato y moneda).\n\n- **En tu [panel](/painel) (candidato):** \"Tu pretensión y el mercado\" compara la pretensión mensual de tu ficha publicada con el rango de las vacantes de tu primera competencia que ya tiene números, en tu nivel y tipo de contrato, y dice si está por debajo, dentro o por encima. También muestra hasta 5 competencias en alza, marcando las que ya tienes.\n- **En [Publicar vacante](/publicar):** junto al rango sugerido, el rango de las vacantes y la pretensión de los candidatos para la primera competencia, el nivel, el tipo de contrato y la moneda de la vacante. La pretensión siempre es agregada, de 10 o más fichas, nunca la de alguien. Es solo informativo.\n- **En el [Panel RH](/rh):** cada vacante activa con rango recibe la etiqueta \"por debajo\", \"dentro\" o \"por encima del mercado\", comparando el medio de su rango con el rango de las vacantes del mismo grupo. Sin números para el grupo, no aparece nada."
    }
  ]
};
