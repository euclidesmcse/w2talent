---
titulo: How the match is calculated
resumo: The match weights, close skills and what "missing" means.
areas: candidato, recrutador
telas: /vagas, /candidatos
ordem: 7
---

The match is a calculation with fixed weights. It is not AI and does not use age, gender, photo or address.

| Part | Weight |
| --- | --- |
| Skills | 40 |
| Level | 20 |
| Contract type, work model and pay range | 20 |
| Updated recently | 10 |
| Complete listing | 10 |

In job search, the last two rows look at the job: posted or renewed recently and with every field filled in. For recruiters, in Candidates, they look at the candidate's profile.

## Close skills

A similar skill counts half. Example: someone with OpenShift gets half a point in a job that asks for Kubernetes. The text shows "Kubernetes: has OpenShift (close)".

## What "missing" means

Next to the number you see the first thing missing, the one with the highest weight. A criterion the job did not ask for counts as met.

## For recruiters

In [Candidates](/candidatos), pick a job in "For the job" and the list is sorted by the match with it. It is the same calculation, looking from the job to the profile.
