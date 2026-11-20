---
titulo: Registrar la empresa
resumo: Datos de la empresa, verificación y la etiqueta "Empresa no verificada".
areas: recrutador
telas: /empresa
ordem: 11
---

Antes de publicar vacantes, el reclutador registra la empresa en [Mi empresa](/empresa).

## Qué informar

- Nombre de la empresa
- CNPJ (número de empresa de Brasil; se revisan los dígitos verificadores)
- Sitio web
- Correo de contacto

Cada cuenta de reclutador queda vinculada a una empresa.

## Verificación

El equipo de W2Talent revisa los datos. Mientras tanto:

- **En revisión:** tus vacantes ya aparecen, con la etiqueta "Empresa no verificada".
- **Verificada:** las vacantes aparecen sin etiqueta.
- **Rechazada:** las vacantes se archivan. Escribe a contato@w2talent.com.

Cambiar el nombre o el CNPJ de una empresa verificada la devuelve a "En revisión".

## Integración con ATS

Si la empresa usa un sistema de selección (ATS), las postulaciones pueden llegar allí también. En [Mi empresa](/empresa), quien registró la empresa indica una dirección https y hace clic en "Guardar y activar".

- Con cada postulación recibida, W2Talent envía un `POST` con JSON a esa dirección (evento `candidatura.recebida`).
- Con cada cambio de etapa hecho en la pantalla de la vacante, envía el evento `candidatura.etapa`.
- Si el candidato preparó una versión para la vacante, `data.candidatura.adaptacao` trae `resumo`, `destaques`, `carta` (su mensaje), `por_que` (la frase de por qué destaca), `cv` (título, puestos con `pontos`, competencias, formación e idiomas, sin contactos; `null` sin CV) y `feita_com_ia`. Sin versión, viene `null`.
- El aviso lleva la vacante, la postulación (fecha, etapa, match y brechas) y la Ficha W2 como el candidato la aprobó: **sin e-mail, teléfono ni enlaces**. El e-mail y el teléfono solo van después de que la postulación pasa por la Entrevista, como en la pantalla.
- Solo direcciones https públicas. Red interna y localhost no funcionan.
- "Enviar prueba" envía el evento `teste` en el momento. La pantalla muestra las últimas 20 entregas.
- Si tu sistema no responde, o responde con error 5xx o 429, intentamos de nuevo hasta 10 veces durante algunas horas. Un error 4xx no se repite.
- "Desactivar" detiene los envíos. No se guarda nada del contenido enviado, solo la fecha y el resultado.

## Cambio de etapa

El evento `candidatura.etapa` tiene el mismo cuerpo que `candidatura.recebida`, con un campo más, `data.mudanca`:

- `de`: la etapa anterior.
- `para`: la etapa nueva.
- `em`: cuándo cambió (igual a `occurred_at`).

Las etapas van con estos nombres: `nova`, `em_analise`, `entrevista`, `proposta`, `contratada` y `nao_seguiu`. El campo `data.candidatura.etapa` muestra la etapa en el momento de la entrega; si alguien la cambió de nuevo mientras tanto, vale el `para` de cada aviso, en el orden de `occurred_at`. Cuando la postulación pasa por la Entrevista (o salta directo a Propuesta o Contratada), `data.candidato.contato` trae `email` y `celular`; antes de eso, viene `null`.

## Integración pausada

Cada entrega que falla (sin respuesta o con un código fuera del rango 2xx) cuenta una falla, incluidos los nuevos intentos. Una entrega exitosa pone la cuenta en cero; la prueba no cuenta. Con **50 fallas seguidas**, la integración queda "Pausada": no se envía nada más y quien registró la empresa recibe un e-mail.

Para reactivarla, revisa la dirección y tu sistema, usa "Enviar prueba" y haz clic en "Activar". La cuenta vuelve a cero. Lo que pasó durante la pausa no se reenvía.

## Comprobar la firma

Al activar (o en "Generar nuevo secreto"), la pantalla muestra el secreto **una vez**. Guárdalo en tu sistema. Cada aviso trae:

- `X-W2Talent-Event`: el evento.
- `X-W2Talent-Delivery`: el id del evento. Se repite en los nuevos intentos; úsalo para no guardar dos veces.
- `X-W2Talent-Signature`: `t=<segundos>,v1=<firma>`.

Para comprobarla, calcula el HMAC-SHA256 en hexadecimal de `t` + `.` + el cuerpo exactamente como llegó, usando el secreto entero como clave, y compáralo con `v1`. Rechaza avisos con `t` de hace más de 5 minutos.
