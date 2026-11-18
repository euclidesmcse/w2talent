---
titulo: Registering the company
resumo: Company details, verification and the "Unverified company" label.
areas: recrutador
telas: /empresa
ordem: 11
---

Before posting jobs, recruiters register the company in [My company](/empresa).

## What to fill in

- Company name
- CNPJ (Brazilian company number; its check digits are verified)
- Website
- Contact email

Each recruiter account is linked to one company.

## Verification

The W2Talent team checks the details. Meanwhile:

- **Under review:** your jobs already show, with the "Unverified company" label.
- **Verified:** jobs show without the label.
- **Declined:** jobs are archived. Write to contato@w2talent.com.

Changing the name or CNPJ of a verified company sends it back to "Under review".

## ATS integration

If the company uses a hiring system (ATS), applications can arrive there too. In [My company](/empresa), the person who registered the company enters an https address and clicks "Save and turn on".

- For each application received, W2Talent sends a JSON `POST` to that address (event `candidatura.recebida`).
- The notice carries the job, the application (date, stage, match and gaps) and the W2 Profile as the candidate approved it: **no e-mail, phone or links**.
- Public https addresses only. Internal networks and localhost do not work.
- "Send test" sends the `teste` event right away. The screen shows the latest 20 deliveries.
- If your system does not answer, or answers with a 5xx or 429 error, we try again up to 10 times over a few hours. A 4xx error is not retried.
- "Turn off" stops the sends. Nothing of the content sent is stored, only the date and the result.

## Checking the signature

When you turn it on (or with "Generate new secret"), the screen shows the secret **once**. Keep it in your system. Each notice carries:

- `X-W2Talent-Event`: the event.
- `X-W2Talent-Delivery`: the event id. It repeats on retries; use it to avoid saving twice.
- `X-W2Talent-Signature`: `t=<seconds>,v1=<signature>`.

To check it, compute the hex HMAC-SHA256 of `t` + `.` + the body exactly as received, using the whole secret as the key, and compare with `v1`. Refuse notices with `t` older than 5 minutes.
