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
        "/"
      ],
      "ordem": 1,
      "corpo": "O W2Talent liga candidatos de tecnologia a vagas. O candidato encontra vagas, confere cada uma e envia em lote só as que aprovou. O recrutador recebe a Ficha W2, um resumo padronizado do candidato, com o match explicado.\n\n## Para candidatos\n\n- Usar o W2Talent é de graça.\n- Você monta sua ficha a partir do CV em [Minha ficha](/minha-ficha).\n- Você busca vagas escrevendo como falaria, por exemplo \"DevOps remoto PJ 15 mil\".\n- Só vai para a empresa o que você aprovou.\n\n## Para recrutadores\n\n- Você cadastra a empresa em [Minha empresa](/empresa).\n- Você publica a vaga colando o texto, e a IA organiza os campos.\n- Você busca candidatos e ordena pelo match com uma vaga sua.\n\nEsta é a versão de testes. O site muda com frequência."
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
      "corpo": "A Ficha W2 é um cartão padronizado do candidato. Todos os candidatos aparecem no mesmo formato, então o recrutador compara rápido.\n\n## O que tem na ficha\n\n- **Cabeçalho:** primeiro nome, cargo, anos de experiência, cidade e modelo de trabalho, regime e pretensão, e quando pode começar.\n- **Resumo:** até 3 frases escritas pela IA a partir da ficha.\n- **Destaques:** até 3 pontos fortes, também escritos pela IA.\n- **Competências e idiomas:** vêm da ficha que o candidato conferiu.\n\n## O que não tem\n\nA IA não recebe nem escreve nome completo, e-mail ou telefone. O contato fica protegido (veja [Meus dados e privacidade](/ajuda/privacidade)).\n\nO candidato pode gerar a Ficha W2 de novo depois de mudar a ficha. Saiba mais em [Como usamos IA](/ia#ficha-w2)."
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
      "corpo": "Em [Vagas](/vagas) você escreve a busca como falaria e aperta Enter ou Buscar.\n\n## Exemplos\n\n- \"DevOps remoto PJ 15 mil\"\n- \"analista de dados pleno São Paulo\"\n- \"React sênior CLT\"\n\n## O que o W2Talent entende\n\nAbaixo da caixa aparecem chips com o que foi entendido: competências, regime, modelo de trabalho, nível e faixa. Clique no × de um chip para tirá-lo.\n\nAs competências procuram vagas que peçam qualquer uma delas. Regime, modelo, nível e faixa não escondem vagas: eles entram no [match](/ajuda/match).\n\n## Áreas\n\nAs pílulas abaixo da busca (Cloud, Dados, Front-end...) trazem as competências mais pedidas de cada área. Marcar uma escreve o nome dela na busca.\n\n## Vagas parecidas\n\nAo abrir uma vaga, aparecem até 5 vagas parecidas no fim do detalhe."
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
      "corpo": "No W2Talent nada é enviado sem a sua aprovação, vaga por vaga.\n\n## Passo a passo\n\n1. Em [Vagas](/vagas), marque as vagas que interessam. Elas vão para a seleção, na barra de baixo.\n2. Abra [Revisar e aprovar](/vagas/aprovar). Cada vaga mostra o match com a sua ficha e o que falta.\n3. Leia e aprove uma por uma.\n4. Envie. Vão só as aprovadas, com a sua Ficha W2.\n\nPara enviar você precisa entrar como candidato e ter a ficha publicada.\n\n## Regras do envio\n\n- Até 10 vagas por envio e 30 candidaturas em 24 horas.\n- A mesma vaga nunca é enviada duas vezes.\n- Se a empresa mudar a vaga depois da sua aprovação, a aprovação cai e a vaga volta para você conferir.\n- Vaga vencida ou arquivada não é enviada.\n\nDepois do envio, acompanhe em [Minhas candidaturas](/minhas-candidaturas)."
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
      "corpo": "Em [Minhas candidaturas](/minhas-candidaturas) aparece cada vaga enviada, com a data.\n\n## Situações\n\n- **Enviada:** a candidatura chegou à empresa.\n- **Vista:** a empresa abriu a sua ficha ou começou a analisar.\n- **Respondida:** a empresa quer seguir com você (entrevista ou proposta).\n- **Encerrada:** a empresa não vai seguir com esta candidatura, ou ela saiu de circulação.\n\n## Contato protegido\n\nA empresa fala com você por um endereço do W2Talent. Seu e-mail e telefone só aparecem para ela depois que você responde.\n\nO [painel](/painel) mostra os mesmos números de forma resumida."
    },
    {
      "slug": "privacidade",
      "titulo": "Meus dados e privacidade",
      "resumo": "Contato protegido, por quanto tempo o perfil fica na busca e como pedir revisão.",
      "areas": [
        "publico",
        "candidato",
        "recrutador"
      ],
      "telas": [
        "/minha-ficha",
        "/renovar",
        "/ia"
      ],
      "ordem": 10,
      "corpo": "## Contato protegido\n\nNa busca de candidatos, e-mail e telefone aparecem mascarados (por exemplo, a***@e***.com). O contato completo só chega à empresa depois que você responde a ela.\n\n## Quanto tempo o perfil fica na busca\n\n- O perfil publicado fica na busca por 180 dias.\n- Antes de vencer, você recebe lembretes por e-mail com o botão \"Continuo procurando\". Clicar renova por mais 180 dias.\n- Sem renovação, o perfil é arquivado e sai da busca.\n- Depois de 30 dias arquivado, ele é apagado, junto com as candidaturas.\n\n## IA e revisão por uma pessoa\n\nA IA ajuda a ler textos e a escrever resumos, mas não decide por ninguém. Se uma decisão automática afetou você, peça revisão por uma pessoa em contato@w2talent.com. Veja [Como usamos IA](/ia).\n\n## Ao sair\n\nSair da conta apaga deste navegador os rascunhos e a seleção guardados."
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
      "corpo": "Antes de publicar vagas, o recrutador cadastra a empresa em [Minha empresa](/empresa).\n\n## O que informar\n\n- Nome da empresa\n- CNPJ (os dígitos são conferidos)\n- Site\n- E-mail de contato\n\nCada conta de recrutador fica ligada a uma empresa.\n\n## Verificação\n\nA equipe do W2Talent confere os dados. Enquanto isso:\n\n- **Em verificação:** suas vagas já aparecem, com a etiqueta \"Empresa não verificada\".\n- **Verificada:** as vagas aparecem sem etiqueta.\n- **Recusada:** as vagas são arquivadas. Fale com contato@w2talent.com.\n\nMudar o nome ou o CNPJ de uma empresa verificada faz ela voltar para \"Em verificação\"."
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
      "corpo": "Em [Publicar vaga](/publicar) você cola o texto da vaga e a IA preenche os campos. E-mails e telefones são tirados do texto antes.\n\n## Passo a passo\n\n1. Cole o texto e clique para ler.\n2. Confira título, nível, regime, modelo, cidade, competências, faixa e benefícios.\n3. Publique.\n\n## Avisos\n\n- **Vaga parecida:** se a sua empresa já tem uma vaga ativa parecida, aparece o aviso com \"Atualizar a existente\". Se for outra vaga, publique assim mesmo.\n- **Faixa sugerida:** com 5 ou mais vagas parecidas, aparece a faixa mediana delas.\n- **Revisor de viés:** termos sobre idade, gênero, aparência, origem, família, saúde ou religião ganham um aviso com sugestão de troca. Ele só avisa e não bloqueia. Você pode pedir à IA um texto sem esses termos.\n- **Perguntas de entrevista:** a IA sugere perguntas a partir das competências. Elas não são guardadas.\n\n## Quanto tempo a vaga fica no ar\n\nA vaga fica ativa por 14 dias. Para renovar, publique de novo e escolha \"Atualizar a existente\". Vaga vencida é arquivada.\n\nLimite: 30 leituras de texto por dia por conta."
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
      "corpo": "[Candidatos](/candidatos) é só para recrutador com login e autenticador.\n\n## Buscar\n\nEscreva o que procura, por exemplo \"analista cloud AWS\". A busca entende sinônimos: AWS e Cloud aparecem juntos.\n\n## Para a vaga\n\nEscolha uma vaga ativa da sua empresa em \"Para a vaga\". A lista passa a sair pelo [match](/ajuda/match) com ela, e cada linha mostra o que falta.\n\n## Filtros\n\nEm \"Filtros\" você combina competências (a ficha precisa ter todas), senioridade, modelo, regime, pretensão mensal até, idioma e nível, quando pode começar e ficha atualizada. Quem não informou disponibilidade ou pretensão continua aparecendo.\n\nOs filtros ficam no endereço da página, então dá para guardar ou compartilhar a busca.\n\n## Ver a Ficha W2\n\nNo computador, \"Ver\" abre a Ficha W2 ao lado da lista. No celular, abre numa janela. Com uma vaga escolhida, o topo mostra \"Para a vaga X: 87%\" e tudo o que falta.\n\n## Comparar\n\nMarque até 10 candidatos e use \"Comparar\" na barra de baixo. A tela mostra os candidatos lado a lado, com os campos da Ficha W2 em linhas e, com uma vaga escolhida, o match e o que falta. O contato aparece mascarado, como na busca. \"Tirar\" remove alguém da comparação e da seleção.\n\n\"Baixar CSV\" e \"Baixar Excel\" salvam a tabela com uma linha por candidato; \"Imprimir ou PDF\" abre a impressão do navegador, onde dá para salvar em PDF. Os arquivos são montados no seu navegador e levam o contato mascarado. O W2Talent guarda só que houve uma exportação, sem o conteúdo."
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
      "corpo": "A IA ajuda em tarefas de texto. Ela não aprova, não reprova e não dá nota a ninguém.\n\n## Onde ela aparece\n\n- Ler o CV e preencher a ficha.\n- Escrever o resumo e os destaques da Ficha W2.\n- Ler o texto da vaga e preencher os campos.\n- Reescrever a vaga sem termos de viés, quando o recrutador pede.\n- Sugerir perguntas de entrevista.\n- Responder perguntas nesta ajuda, só com o que está nos artigos e sempre com o link da fonte.\n\n## Onde ela não entra\n\nO [match](/ajuda/match) é uma conta com pesos fixos. A busca usa texto e significado para ordenar, mas não esconde candidatos.\n\nA lista completa, com os dados que cada tarefa usa, está em [Como usamos IA](/ia)."
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
      "corpo": "O [Painel RH](/rh) mostra as vagas da sua empresa e as candidaturas que chegaram a cada uma.\n\n## Números da empresa\n\n- **Vagas ativas** e as que **vencem em até 3 dias** (renove antes de vencer).\n- **Candidaturas** recebidas e quantas estão **na etapa Nova**.\n- **Tempo até a primeira resposta:** a média entre a candidatura chegar e você mudar a etapa dela pela primeira vez.\n- **Taxa de resposta:** quantas candidaturas já saíram de Nova alguma vez.\n\nOs números são só da sua empresa.\n\n## Vagas\n\nCada vaga mostra a situação, o total de candidaturas e as novas. Em \"Candidatos compatíveis\" você busca perfis parecidos com a vaga, mesmo de quem ainda não se candidatou.\n\n## Candidaturas de uma vaga\n\nEm \"Ver candidaturas\" aparecem as pessoas que se candidataram, da maior para a menor compatibilidade com a vaga.\n\n- **Etapa:** Nova, Em análise, Entrevista, Proposta, Contratada ou Não seguiu. Mude com um clique; não há formulário.\n- **O que o candidato vê:** \"Vista\" quando você abre a ficha ou move para Em análise, \"Respondida\" a partir de Entrevista e \"Encerrada\" em Não seguiu. As etapas internas não aparecem para ele.\n- **Comparar:** marque até 10 pessoas para compará-las lado a lado e exportar."
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
        "/"
      ],
      "ordem": 1,
      "corpo": "W2Talent connects tech candidates with jobs. Candidates find jobs, check each one and send in a batch only the ones they approved. Recruiters get the W2 Profile, a standard summary of the candidate with the match explained.\n\n## For candidates\n\n- Using W2Talent is free.\n- You build your profile from your CV in [My profile](/minha-ficha).\n- You search the way you talk, for example \"remote DevOps contractor 15k\".\n- Only what you approved goes to the company.\n\n## For recruiters\n\n- You register the company in [My company](/empresa).\n- You post a job by pasting its text, and AI fills in the fields.\n- You search candidates and sort them by match with one of your jobs.\n\nThis is the test version. The site changes often."
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
      "corpo": "The W2 Profile is a standard card for each candidate. Every candidate shows up in the same format, so recruiters compare quickly.\n\n## What is in it\n\n- **Header:** first name, role, years of experience, city and work model, contract type and expected pay, and when they can start.\n- **Summary:** up to 3 sentences written by AI from the profile.\n- **Highlights:** up to 3 strengths, also written by AI.\n- **Skills and languages:** taken from the profile the candidate checked.\n\n## What is not in it\n\nAI neither receives nor writes the full name, email or phone. Contact details stay protected (see [My data and privacy](/ajuda/privacidade)).\n\nCandidates can create the W2 Profile again after changing their profile. Learn more in [How we use AI](/ia#ficha-w2)."
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
      "corpo": "In [Jobs](/vagas) you type the search the way you talk and press Enter or Search.\n\n## Examples\n\n- \"remote DevOps contractor 15k\"\n- \"mid-level data analyst São Paulo\"\n- \"senior React employee\"\n\n## What W2Talent understands\n\nBelow the box, chips show what was understood: skills, contract type, work model, level and pay range. Click the × on a chip to remove it.\n\nSkills look for jobs that ask for any of them. Contract type, work model, level and pay range do not hide jobs: they count in the [match](/ajuda/match).\n\n## Areas\n\nThe pills below the search (Cloud, Data, Front-end...) bring the most requested skills of each area. Selecting one writes its name in the search.\n\n## Similar jobs\n\nWhen you open a job, up to 5 similar jobs show at the end of the details."
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
      "corpo": "On W2Talent nothing is sent without your approval, job by job.\n\n## Step by step\n\n1. In [Jobs](/vagas), mark the jobs you like. They go to your selection, in the bar at the bottom.\n2. Open [Review and approve](/vagas/aprovar). Each job shows the match with your profile and what is missing.\n3. Read and approve them one by one.\n4. Send. Only approved jobs go, with your W2 Profile.\n\nTo send, you need to sign in as a candidate and have your profile published.\n\n## Sending rules\n\n- Up to 10 jobs per send and 30 applications in 24 hours.\n- The same job is never sent twice.\n- If the company changes the job after you approved it, the approval drops and the job comes back for you to check.\n- Expired or archived jobs are not sent.\n\nAfter sending, follow up in [My applications](/minhas-candidaturas)."
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
      "corpo": "[My applications](/minhas-candidaturas) lists each job you sent, with the date.\n\n## Statuses\n\n- **Sent:** the application reached the company.\n- **Seen:** the company opened your profile or started reviewing it.\n- **Answered:** the company wants to move forward with you (interview or offer).\n- **Closed:** the company is not moving forward with this application, or it is no longer active.\n\n## Protected contact\n\nThe company talks to you through a W2Talent address. Your email and phone only show to them after you reply.\n\nThe [dashboard](/painel) shows the same numbers in short."
    },
    {
      "slug": "privacidade",
      "titulo": "My data and privacy",
      "resumo": "Protected contact, how long a profile stays in search and how to ask for a review.",
      "areas": [
        "publico",
        "candidato",
        "recrutador"
      ],
      "telas": [
        "/minha-ficha",
        "/renovar",
        "/ia"
      ],
      "ordem": 10,
      "corpo": "## Protected contact\n\nIn candidate search, email and phone are masked (for example, a***@e***.com). The full contact only reaches the company after you reply to it.\n\n## How long a profile stays in search\n\n- A published profile stays in search for 180 days.\n- Before it expires, you get email reminders with the \"I'm still looking\" button. Clicking it renews for 180 more days.\n- Without renewal, the profile is archived and leaves search.\n- After 30 days archived, it is deleted, together with its applications.\n\n## AI and review by a person\n\nAI helps read texts and write summaries, but it decides nothing for anyone. If an automated decision affected you, ask for a review by a person at contato@w2talent.com. See [How we use AI](/ia).\n\n## When you sign out\n\nSigning out deletes the drafts and selection saved in this browser."
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
      "corpo": "Before posting jobs, recruiters register the company in [My company](/empresa).\n\n## What to fill in\n\n- Company name\n- CNPJ (Brazilian company number; its check digits are verified)\n- Website\n- Contact email\n\nEach recruiter account is linked to one company.\n\n## Verification\n\nThe W2Talent team checks the details. Meanwhile:\n\n- **Under review:** your jobs already show, with the \"Unverified company\" label.\n- **Verified:** jobs show without the label.\n- **Declined:** jobs are archived. Write to contato@w2talent.com.\n\nChanging the name or CNPJ of a verified company sends it back to \"Under review\"."
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
      "corpo": "In [Post a job](/publicar) you paste the job text and AI fills in the fields. Emails and phone numbers are removed from the text first.\n\n## Step by step\n\n1. Paste the text and click to read it.\n2. Check title, level, contract type, work model, city, skills, pay range and benefits.\n3. Publish.\n\n## Warnings\n\n- **Similar job:** if your company already has a similar active job, you see a warning with \"Update the existing one\". If it is a different job, publish anyway.\n- **Suggested pay range:** with 5 or more similar jobs, their median range shows.\n- **Bias reviewer:** terms about age, gender, looks, origin, family, health or religion get a warning with a suggested change. It only warns and never blocks. You can ask AI for a text without those terms.\n- **Interview questions:** AI suggests questions from the skills. They are not saved.\n\n## How long the job stays up\n\nA job stays active for 14 days. To renew it, publish again and choose \"Update the existing one\". Expired jobs are archived.\n\nLimit: 30 text readings per day per account."
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
      "corpo": "[Candidates](/candidatos) is only for recruiters signed in with the authenticator.\n\n## Search\n\nType what you look for, for example \"cloud analyst AWS\". Search understands synonyms: AWS and Cloud show up together.\n\n## For the job\n\nPick an active job of your company in \"For the job\". The list is then sorted by [match](/ajuda/match) with it, and each row shows what is missing.\n\n## Filters\n\nIn \"Filters\" you combine skills (the profile must have all of them), seniority, work model, contract type, monthly expected pay up to, language and level, start date and profile updated. People who did not give availability or expected pay still show up.\n\nFilters stay in the page address, so you can save or share the search.\n\n## Viewing the W2 Profile\n\nOn a computer, \"View\" opens the W2 Profile next to the list. On a phone, it opens in a window. With a job picked, the top shows \"For the X job: 87%\" and everything missing.\n\n## Compare\n\nSelect up to 10 candidates and use \"Compare\" in the bottom bar. The screen shows the candidates side by side, with the W2 Profile fields in rows and, with a job chosen, the match and what is missing. Contact details are masked, as in search. \"Remove\" takes someone out of the comparison and the selection.\n\n\"Download CSV\" and \"Download Excel\" save the table with one row per candidate; \"Print or PDF\" opens the browser's print dialog, where you can save as PDF. The files are built in your browser and carry masked contact details. W2Talent only records that an export happened, not its content."
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
      "corpo": "AI helps with text tasks. It does not approve, reject or score anyone.\n\n## Where it shows up\n\n- Reading the CV and filling in the profile.\n- Writing the summary and highlights of the W2 Profile.\n- Reading the job text and filling in the fields.\n- Rewriting the job without biased terms, when the recruiter asks.\n- Suggesting interview questions.\n- Answering questions in this help, only with what the articles say and always with the source link.\n\n## Where it does not\n\nThe [match](/ajuda/match) is a calculation with fixed weights. Search uses text and meaning to sort, but does not hide candidates.\n\nThe full list, with the data each task uses, is in [How we use AI](/ia)."
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
      "corpo": "The [HR dashboard](/rh) shows your company's jobs and the applications each one received.\n\n## Company numbers\n\n- **Active jobs** and the ones that **expire within 3 days** (renew them before they expire).\n- **Applications** received and how many are **in the New stage**.\n- **Time to first reply:** the average time between an application arriving and you first changing its stage.\n- **Reply rate:** how many applications have left New at least once.\n\nThe numbers cover only your company.\n\n## Jobs\n\nEach job shows its status, the total number of applications and the new ones. \"Matching candidates\" searches for profiles close to the job, including people who have not applied yet.\n\n## Applications for a job\n\n\"See applications\" lists the people who applied, from best to lowest match with the job.\n\n- **Stage:** New, Reviewing, Interview, Offer, Hired or Not moving forward. Change it with one click; there is no form.\n- **What the candidate sees:** \"Seen\" when you open the profile or move it to Reviewing, \"Answered\" from Interview on, and \"Closed\" for Not moving forward. Internal stages are not shown to them.\n- **Compare:** tick up to 10 people to compare them side by side and export."
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
        "/"
      ],
      "ordem": 1,
      "corpo": "W2Talent conecta candidatos de tecnología con vacantes. El candidato encuentra vacantes, revisa cada una y envía en lote solo las que aprobó. El reclutador recibe la Ficha W2, un resumen estándar del candidato con el match explicado.\n\n## Para candidatos\n\n- Usar W2Talent es gratis.\n- Armas tu ficha a partir del CV en [Mi ficha](/minha-ficha).\n- Buscas vacantes escribiendo como hablas, por ejemplo \"DevOps remoto 15k\".\n- Solo llega a la empresa lo que aprobaste.\n\n## Para reclutadores\n\n- Registras la empresa en [Mi empresa](/empresa).\n- Publicas la vacante pegando el texto, y la IA organiza los campos.\n- Buscas candidatos y los ordenas por match con una vacante tuya.\n\nEsta es la versión de pruebas. El sitio cambia a menudo."
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
      "corpo": "La Ficha W2 es una tarjeta estándar del candidato. Todos los candidatos aparecen en el mismo formato, así el reclutador compara rápido.\n\n## Qué tiene la ficha\n\n- **Encabezado:** primer nombre, cargo, años de experiencia, ciudad y modalidad, régimen y pretensión, y cuándo puede empezar.\n- **Resumen:** hasta 3 frases escritas por la IA a partir de la ficha.\n- **Destacados:** hasta 3 puntos fuertes, también escritos por la IA.\n- **Competencias e idiomas:** vienen de la ficha que el candidato revisó.\n\n## Qué no tiene\n\nLa IA no recibe ni escribe el nombre completo, el correo ni el teléfono. El contacto queda protegido (mira [Mis datos y privacidad](/ajuda/privacidade)).\n\nEl candidato puede generar la Ficha W2 de nuevo después de cambiar la ficha. Más en [Cómo usamos la IA](/ia#ficha-w2)."
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
      "corpo": "En [Empleos](/vagas) escribes la búsqueda como hablas y presionas Enter o Buscar.\n\n## Ejemplos\n\n- \"DevOps remoto 15k\"\n- \"analista de datos semi senior São Paulo\"\n- \"React senior empleado\"\n\n## Qué entiende W2Talent\n\nDebajo de la caja aparecen chips con lo que se entendió: competencias, régimen, modalidad, nivel y rango salarial. Haz clic en la × de un chip para quitarlo.\n\nLas competencias buscan vacantes que pidan cualquiera de ellas. Régimen, modalidad, nivel y rango no ocultan vacantes: cuentan en el [match](/ajuda/match).\n\n## Áreas\n\nLas píldoras debajo de la búsqueda (Cloud, Datos, Front-end...) traen las competencias más pedidas de cada área. Marcar una escribe su nombre en la búsqueda.\n\n## Vacantes similares\n\nAl abrir una vacante, aparecen hasta 5 vacantes similares al final del detalle."
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
      "corpo": "En W2Talent no se envía nada sin tu aprobación, vacante por vacante.\n\n## Paso a paso\n\n1. En [Empleos](/vagas), marca las vacantes que te interesan. Van a la selección, en la barra de abajo.\n2. Abre [Revisar y aprobar](/vagas/aprovar). Cada vacante muestra el match con tu ficha y lo que falta.\n3. Lee y aprueba una por una.\n4. Envía. Van solo las aprobadas, con tu Ficha W2.\n\nPara enviar necesitas iniciar sesión como candidato y tener la ficha publicada.\n\n## Reglas del envío\n\n- Hasta 10 vacantes por envío y 30 postulaciones en 24 horas.\n- La misma vacante nunca se envía dos veces.\n- Si la empresa cambia la vacante después de tu aprobación, la aprobación se cae y la vacante vuelve para que la revises.\n- Las vacantes vencidas o archivadas no se envían.\n\nDespués del envío, sigue todo en [Mis postulaciones](/minhas-candidaturas)."
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
      "corpo": "En [Mis postulaciones](/minhas-candidaturas) aparece cada vacante enviada, con la fecha.\n\n## Estados\n\n- **Enviada:** la postulación llegó a la empresa.\n- **Vista:** la empresa abrió tu ficha o empezó a analizarla.\n- **Respondida:** la empresa quiere seguir contigo (entrevista u oferta).\n- **Cerrada:** la empresa no seguirá con esta postulación, o salió de circulación.\n\n## Contacto protegido\n\nLa empresa habla contigo por una dirección de W2Talent. Tu correo y teléfono solo le aparecen después de que respondes.\n\nEl [panel](/painel) muestra los mismos números de forma resumida."
    },
    {
      "slug": "privacidade",
      "titulo": "Mis datos y privacidad",
      "resumo": "Contacto protegido, cuánto tiempo queda el perfil en la búsqueda y cómo pedir revisión.",
      "areas": [
        "publico",
        "candidato",
        "recrutador"
      ],
      "telas": [
        "/minha-ficha",
        "/renovar",
        "/ia"
      ],
      "ordem": 10,
      "corpo": "## Contacto protegido\n\nEn la búsqueda de candidatos, el correo y el teléfono aparecen enmascarados (por ejemplo, a***@e***.com). El contacto completo solo llega a la empresa después de que le respondes.\n\n## Cuánto tiempo queda el perfil en la búsqueda\n\n- El perfil publicado queda en la búsqueda por 180 días.\n- Antes de vencer, recibes recordatorios por correo con el botón \"Sigo buscando\". Al hacer clic se renueva por 180 días más.\n- Sin renovación, el perfil se archiva y sale de la búsqueda.\n- Después de 30 días archivado, se borra, junto con las postulaciones.\n\n## IA y revisión por una persona\n\nLa IA ayuda a leer textos y a escribir resúmenes, pero no decide por nadie. Si una decisión automática te afectó, pide la revisión de una persona en contato@w2talent.com. Mira [Cómo usamos la IA](/ia).\n\n## Al cerrar sesión\n\nCerrar sesión borra de este navegador los borradores y la selección guardados."
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
      "corpo": "Antes de publicar vacantes, el reclutador registra la empresa en [Mi empresa](/empresa).\n\n## Qué informar\n\n- Nombre de la empresa\n- CNPJ (número de empresa de Brasil; se revisan los dígitos verificadores)\n- Sitio web\n- Correo de contacto\n\nCada cuenta de reclutador queda vinculada a una empresa.\n\n## Verificación\n\nEl equipo de W2Talent revisa los datos. Mientras tanto:\n\n- **En revisión:** tus vacantes ya aparecen, con la etiqueta \"Empresa no verificada\".\n- **Verificada:** las vacantes aparecen sin etiqueta.\n- **Rechazada:** las vacantes se archivan. Escribe a contato@w2talent.com.\n\nCambiar el nombre o el CNPJ de una empresa verificada la devuelve a \"En revisión\"."
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
      "corpo": "En [Publicar vacante](/publicar) pegas el texto de la vacante y la IA llena los campos. Los correos y teléfonos se quitan del texto antes.\n\n## Paso a paso\n\n1. Pega el texto y haz clic para leerlo.\n2. Revisa título, nivel, régimen, modalidad, ciudad, competencias, rango y beneficios.\n3. Publica.\n\n## Avisos\n\n- **Vacante parecida:** si tu empresa ya tiene una vacante activa parecida, aparece el aviso con \"Actualizar la existente\". Si es otra vacante, publícala igual.\n- **Rango sugerido:** con 5 o más vacantes parecidas, aparece el rango mediano de ellas.\n- **Revisor de sesgo:** los términos sobre edad, género, apariencia, origen, familia, salud o religión reciben un aviso con sugerencia de cambio. Solo avisa y no bloquea. Puedes pedir a la IA un texto sin esos términos.\n- **Preguntas de entrevista:** la IA sugiere preguntas a partir de las competencias. No se guardan.\n\n## Cuánto tiempo queda publicada\n\nLa vacante queda activa por 14 días. Para renovarla, publica de nuevo y elige \"Actualizar la existente\". La vacante vencida se archiva.\n\nLímite: 30 lecturas de texto por día por cuenta."
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
      "corpo": "[Candidatos](/candidatos) es solo para reclutadores con sesión iniciada y autenticador.\n\n## Buscar\n\nEscribe lo que buscas, por ejemplo \"analista cloud AWS\". La búsqueda entiende sinónimos: AWS y Cloud aparecen juntos.\n\n## Para la vacante\n\nElige una vacante activa de tu empresa en \"Para la vacante\". La lista se ordena por el [match](/ajuda/match) con ella, y cada fila muestra lo que falta.\n\n## Filtros\n\nEn \"Filtros\" combinas competencias (la ficha debe tenerlas todas), seniority, modalidad, régimen, pretensión mensual hasta, idioma y nivel, cuándo puede empezar y ficha actualizada. Quien no informó disponibilidad o pretensión sigue apareciendo.\n\nLos filtros quedan en la dirección de la página, así puedes guardar o compartir la búsqueda.\n\n## Ver la Ficha W2\n\nEn la computadora, \"Ver\" abre la Ficha W2 al lado de la lista. En el celular, se abre en una ventana. Con una vacante elegida, arriba aparece \"Para la vacante X: 87%\" y todo lo que falta.\n\n## Comparar\n\nMarca hasta 10 candidatos y usa \"Comparar\" en la barra de abajo. La pantalla muestra los candidatos lado a lado, con los campos de la Ficha W2 en filas y, con una vacante elegida, el match y lo que falta. El contacto aparece enmascarado, como en la búsqueda. \"Quitar\" saca a alguien de la comparación y de la selección.\n\n\"Descargar CSV\" y \"Descargar Excel\" guardan la tabla con una fila por candidato; \"Imprimir o PDF\" abre la impresión del navegador, donde puedes guardar en PDF. Los archivos se arman en tu navegador y llevan el contacto enmascarado. W2Talent solo guarda que hubo una exportación, sin el contenido."
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
      "corpo": "La IA ayuda en tareas de texto. No aprueba, no rechaza y no le pone nota a nadie.\n\n## Dónde aparece\n\n- Leer el CV y llenar la ficha.\n- Escribir el resumen y los destacados de la Ficha W2.\n- Leer el texto de la vacante y llenar los campos.\n- Reescribir la vacante sin términos de sesgo, cuando el reclutador lo pide.\n- Sugerir preguntas de entrevista.\n- Responder preguntas en esta ayuda, solo con lo que dicen los artículos y siempre con el enlace de la fuente.\n\n## Dónde no entra\n\nEl [match](/ajuda/match) es una cuenta con pesos fijos. La búsqueda usa texto y significado para ordenar, pero no oculta candidatos.\n\nLa lista completa, con los datos que usa cada tarea, está en [Cómo usamos la IA](/ia)."
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
      "corpo": "El [panel de RR. HH.](/rh) muestra las vacantes de tu empresa y las postulaciones que recibió cada una.\n\n## Números de la empresa\n\n- **Vacantes activas** y las que **vencen en hasta 3 días** (renuévalas antes de que venzan).\n- **Postulaciones** recibidas y cuántas están **en la etapa Nueva**.\n- **Tiempo hasta la primera respuesta:** el promedio entre la llegada de la postulación y el primer cambio de etapa que haces.\n- **Tasa de respuesta:** cuántas postulaciones ya salieron de Nueva alguna vez.\n\nLos números son solo de tu empresa.\n\n## Vacantes\n\nCada vacante muestra su estado, el total de postulaciones y las nuevas. En \"Candidatos compatibles\" buscas perfiles parecidos a la vacante, incluso de quienes aún no se postularon.\n\n## Postulaciones de una vacante\n\nEn \"Ver postulaciones\" aparecen las personas que se postularon, de mayor a menor compatibilidad con la vacante.\n\n- **Etapa:** Nueva, En análisis, Entrevista, Oferta, Contratada o No siguió. Cámbiala con un clic; no hay formulario.\n- **Lo que ve el candidato:** \"Vista\" cuando abres la ficha o la pasas a En análisis, \"Respondida\" desde Entrevista y \"Cerrada\" en No siguió. Las etapas internas no se le muestran.\n- **Comparar:** marca hasta 10 personas para compararlas lado a lado y exportar."
    }
  ]
};
