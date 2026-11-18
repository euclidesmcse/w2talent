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
- El aviso lleva la vacante, la postulación (fecha, etapa, match y brechas) y la Ficha W2 como el candidato la aprobó: **sin e-mail, teléfono ni enlaces**.
- Solo direcciones https públicas. Red interna y localhost no funcionan.
- "Enviar prueba" envía el evento `teste` en el momento. La pantalla muestra las últimas 20 entregas.
- Si tu sistema no responde, o responde con error 5xx o 429, intentamos de nuevo hasta 10 veces durante algunas horas. Un error 4xx no se repite.
- "Desactivar" detiene los envíos. No se guarda nada del contenido enviado, solo la fecha y el resultado.

## Comprobar la firma

Al activar (o en "Generar nuevo secreto"), la pantalla muestra el secreto **una vez**. Guárdalo en tu sistema. Cada aviso trae:

- `X-W2Talent-Event`: el evento.
- `X-W2Talent-Delivery`: el id del evento. Se repite en los nuevos intentos; úsalo para no guardar dos veces.
- `X-W2Talent-Signature`: `t=<segundos>,v1=<firma>`.

Para comprobarla, calcula el HMAC-SHA256 en hexadecimal de `t` + `.` + el cuerpo exactamente como llegó, usando el secreto entero como clave, y compáralo con `v1`. Rechaza avisos con `t` de hace más de 5 minutos.
