---
titulo: Cadastrar a empresa
resumo: Dados da empresa, verificação e a etiqueta "Empresa não verificada".
areas: recrutador
telas: /empresa
ordem: 11
---

Antes de publicar vagas, o recrutador cadastra a empresa em [Minha empresa](/empresa).

## O que informar

- Nome da empresa
- CNPJ (os dígitos são conferidos)
- Site
- E-mail de contato

Cada conta de recrutador fica ligada a uma empresa.

## Verificação

A equipe do W2Talent confere os dados. Enquanto isso:

- **Em verificação:** suas vagas já aparecem, com a etiqueta "Empresa não verificada".
- **Verificada:** as vagas aparecem sem etiqueta.
- **Recusada:** as vagas são arquivadas. Fale com contato@w2talent.com.

Mudar o nome ou o CNPJ de uma empresa verificada faz ela voltar para "Em verificação".

## Integração com ATS

Se a empresa usa um sistema de seleção (ATS), as candidaturas podem chegar lá também. Em [Minha empresa](/empresa), quem cadastrou a empresa informa um endereço https e clica em "Salvar e ativar".

- A cada candidatura recebida, o W2Talent manda um `POST` com JSON para esse endereço (evento `candidatura.recebida`).
- A cada mudança de etapa feita na tela da vaga, manda o evento `candidatura.etapa`.
- O aviso leva a vaga, a candidatura (data, etapa, match e lacunas) e a Ficha W2 como o candidato aprovou: **sem e-mail, telefone nem links**. O e-mail e o telefone só vão depois que a candidatura passa pela Entrevista, como na tela.
- Só endereço https público. Rede interna e localhost não funcionam.
- "Enviar teste" manda o evento `teste` na hora. A tela mostra as últimas 20 entregas.
- Se o seu sistema não responder, ou responder com erro 5xx ou 429, tentamos de novo até 10 vezes ao longo de algumas horas. Erro 4xx não é repetido.
- "Desativar" para os envios. Nada fica guardado do conteúdo enviado, só a data e o resultado.

## Mudança de etapa

O evento `candidatura.etapa` tem o mesmo corpo do `candidatura.recebida`, com mais um campo, `data.mudanca`:

- `de`: a etapa de antes.
- `para`: a etapa nova.
- `em`: quando mudou (igual a `occurred_at`).

As etapas vão com estes nomes: `nova`, `em_analise`, `entrevista`, `proposta`, `contratada` e `nao_seguiu`. O campo `data.candidatura.etapa` mostra a etapa na hora da entrega; se alguém mudou de novo nesse meio tempo, vale o `para` de cada aviso, na ordem de `occurred_at`. Quando a candidatura passa pela Entrevista (ou pula direto para Proposta ou Contratada), `data.candidato.contato` passa a trazer `email` e `celular`; antes disso, vem `null`.

## Integração pausada

Cada entrega que não dá certo (sem resposta ou com um código fora da faixa 2xx) conta uma falha, inclusive as novas tentativas. Uma entrega que dá certo zera a contagem; o teste não conta. Com **50 falhas seguidas**, a integração fica "Pausada": nada mais é enviado e quem cadastrou a empresa recebe um e-mail.

Para voltar, confira o endereço e o seu sistema, use "Enviar teste" e clique em "Ativar". A contagem volta a zero. O que aconteceu durante a pausa não é reenviado.

## Conferir a assinatura

Ao ativar (ou em "Gerar novo segredo"), a tela mostra o segredo **uma vez**. Guarde no seu sistema. Cada aviso traz:

- `X-W2Talent-Event`: o evento.
- `X-W2Talent-Delivery`: o id do evento. Ele se repete nas novas tentativas; use para não gravar duas vezes.
- `X-W2Talent-Signature`: `t=<segundos>,v1=<assinatura>`.

Para conferir, calcule o HMAC-SHA256 em hexadecimal de `t` + `.` + o corpo exatamente como chegou, usando o segredo inteiro como chave, e compare com `v1`. Recuse avisos com `t` de mais de 5 minutos atrás.
