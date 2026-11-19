# Modelos de mensagem do WhatsApp (3.5)

Lista para cadastrar na Meta (WhatsApp Manager > Modelos de mensagem). O código usa estes nomes
(`MODELOS` em `lib/whatsapp.ts`) e os idiomas `pt_BR`, `en` e `es`. Cada modelo precisa ser criado e
aprovado nos três idiomas com o mesmo nome.

Regras que valem para todos (plano 3.5, D2):

- Só o nome da vaga (`{{1}}`) e o nome da empresa (`{{2}}`), quando há. Nada de contato, ficha ou salário.
- Botão de link com endereço dinâmico: `https://w2talent.com/{{1}}`. O código manda só o final do caminho
  (por exemplo `minhas-candidaturas`). Se o domínio final mudar, troque a base do botão na Meta.
- Rodapé (opcional, igual em todos): "Responda SAIR para parar" / "Reply STOP to stop" / "Responde SALIR para dejar de recibir".

## w2_codigo (Autenticação)

Categoria: **Authentication**. A Meta monta o texto; escolha "Copiar código" no botão.
Validade do código mostrada na mensagem: 10 minutos. Variável: o código de 6 dígitos (corpo e botão).

| Idioma | Texto (gerado pela Meta) |
| --- | --- |
| pt_BR | `{{1}}` é seu código de verificação. Para sua segurança, não compartilhe. Este código expira em 10 minutos. |
| en | `{{1}}` is your verification code. For your security, do not share this code. This code expires in 10 minutes. |
| es | `{{1}}` es tu código de verificación. Por tu seguridad, no lo compartas. Este código caduca en 10 minutos. |

## w2_candidatura_vista (Utilidade)

Botão "Ver no W2Talent" / "View on W2Talent" / "Ver en W2Talent" → `https://w2talent.com/{{1}}` (o código manda `minhas-candidaturas`).

| Idioma | Corpo |
| --- | --- |
| pt_BR | A empresa {{2}} viu sua candidatura para a vaga {{1}}. |
| en | {{2}} viewed your application for the {{1}} job. |
| es | La empresa {{2}} vio tu postulación a la vacante {{1}}. |

Exemplo para a Meta: {{1}} = "Desenvolvedora Backend Pleno", {{2}} = "Empresa Exemplo".

## w2_candidatura_etapa (Utilidade)

Botão igual ao anterior (`minhas-candidaturas`).

| Idioma | Corpo |
| --- | --- |
| pt_BR | Sua candidatura para a vaga {{1}} na {{2}} foi atualizada. Veja a situação no W2Talent. |
| en | Your application for the {{1}} job at {{2}} was updated. See the status on W2Talent. |
| es | Tu postulación a la vacante {{1}} en {{2}} fue actualizada. Mira el estado en W2Talent. |

## w2_entrevista (Utilidade)

Botão igual ao anterior (`minhas-candidaturas`). Sai quando a empresa oferece horários ou cancela a entrevista.
Os horários e o link da reunião vão só por e-mail e no site.

| Idioma | Corpo |
| --- | --- |
| pt_BR | Há novidade sobre sua entrevista para a vaga {{1}} na {{2}}. Veja os detalhes no seu e-mail ou no W2Talent. |
| en | There is news about your interview for the {{1}} job at {{2}}. See the details in your email or on W2Talent. |
| es | Hay novedades sobre tu entrevista para la vacante {{1}} en {{2}}. Mira los detalles en tu correo o en W2Talent. |

## w2_aprovadas_vencer (Utilidade)

Botão "Revisar e enviar" / "Review and send" / "Revisar y enviar" → `https://w2talent.com/{{1}}` (o código manda `vagas/aprovar`).
Sai uma vez por pessoa por dia, sobre a vaga aprovada (e ainda não enviada) que vence primeiro, de 24 a 48 horas antes.

| Idioma | Corpo |
| --- | --- |
| pt_BR | A vaga {{1}} na {{2}}, que você aprovou, vence em breve. Se ainda quiser, envie sua candidatura no W2Talent. |
| en | The {{1}} job at {{2}}, which you approved, expires soon. If you still want it, send your application on W2Talent. |
| es | La vacante {{1}} en {{2}}, que aprobaste, vence pronto. Si aún te interesa, envía tu postulación en W2Talent. |

## w2_atendimento (Utilidade)

Sem variáveis no corpo. Botão "Ver resposta" / "See reply" / "Ver respuesta" → `https://w2talent.com/{{1}}` (o código manda `ajuda/minhas-conversas`).
O texto da resposta nunca vai no WhatsApp.

| Idioma | Corpo |
| --- | --- |
| pt_BR | A equipe do W2Talent respondeu sua conversa. Veja a resposta no site. |
| en | The W2Talent team replied to your conversation. See the reply on the website. |
| es | El equipo de W2Talent respondió tu conversación. Mira la respuesta en el sitio. |

## Segredos e variáveis do Worker

| Nome | Para quê |
| --- | --- |
| `WHATSAPP_TOKEN` | Token permanente do usuário do sistema (Meta Business). Sem ele, modo teste: nada sai. |
| `WHATSAPP_PHONE_ID` | Id do número de telefone na Cloud API. Sem ele, modo teste. |
| `WHATSAPP_TEST_TO` | Opcional. Lista separada por vírgula; quando existe, só esses números recebem. |
