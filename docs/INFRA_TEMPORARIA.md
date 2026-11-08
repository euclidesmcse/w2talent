# Infra Temporária — Remover ao Final do Projeto

> **Registrado em:** 2026-11-06 — a pedido do Euclides
> **Regra:** Este arquivo lista tudo que é temporário e deve ser removido quando o projeto for para produção definitiva. Não esquecer.

## Docker Local (manter por enquanto, remover no final)

| Item | Onde está | Como remover |
|------|-----------|--------------|
| Container `w2talent-db` | `docker ps --filter name=w2talent-db` | `docker rm -f w2talent-db` ou `./scripts/db.sh down` + remover volume se houver |
| Imagem `pgvector/pgvector:pg16` | `docker images` | `docker rmi pgvector/pgvector:pg16` (após remover container) |
| Volume (se criado) | `docker volume ls` | `docker volume rm <volume>` |
| Script `scripts/db.sh` | repo | Remover arquivo + atualizar README quando migrar para Neon/Supabase com pgvector em produção |
| Porta `5437` | `docker ps` | Liberada ao remover container |
| `.env` / `DATABASE_URL` local | `postgresql://w2talent:w2talent@localhost:5437/w2talent` | Trocar por `DATABASE_URL` de produção (Neon/Supabase) nas variáveis do Cloudflare Pages |

## Checklist de Migração para Produção

> O `w2talent-db` local continua útil para desenvolvimento no servidor da LAN; a remoção fica para o final do projeto, por decisão do Euclides.

- [x] Criar Postgres com pgvector em produção — Neon (sa-east-1) + Hyperdrive, 2026-11-08 (PR #5)
- [x] Rodar `prisma migrate deploy` + `seed-w2talent` na produção — workflow `migrate-neon.yml`, 2026-11-08
- [ ] Remover `w2talent-db` local (`./scripts/db.sh down` + `docker rm -f w2talent-db`)
- [ ] Atualizar README para remover referência a `localhost:5437`
- [ ] Revogar/remover este arquivo ou marcar como ✅ concluído

## Regra Operacional (válida para todo o projeto)

- **SEMPRE** atualizar status de cada etapa no GitHub (README, `docs/superpowers/plans/*`, Issues)
- **SEMPRE** sincronizar tudo no GitHub (`git push origin main`) após cada etapa — nunca deixar só local
- Ponto centralizador é o **GitHub** (`euclidesmcse/w2talent`), outras pessoas vão colaborar por lá
