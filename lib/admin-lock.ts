/**
 * Contagem de tentativas de senha do admin por IP (1.5.8), atômica no banco.
 * A tentativa é reservada ANTES de conferir a senha: pedidos em paralelo não passam do limite,
 * porque cada um recebe um número diferente do INSERT ... ON CONFLICT.
 */
import type { PrismaClient } from "@prisma/client";
import { ADMIN_LOCK_MINUTES, ADMIN_MAX_FAILS } from "./admin-auth";

export type Attempt = { permitido: true; tentativa: number } | { permitido: false; ate: Date };

/** Reserva uma tentativa para esta chave (hash do IP). Bloqueio vencido recomeça a conta. */
export async function reserveAttempt(db: PrismaClient, chave: string, now = new Date()): Promise<Attempt> {
  const rows = await db.$queryRaw<{ falhas: number; bloqueadoAte: Date | null }[]>`
    INSERT INTO "AdminLoginLock" ("chave", "falhas", "bloqueadoAte", "updatedAt")
    VALUES (${chave}, 1, NULL, ${now})
    ON CONFLICT ("chave") DO UPDATE SET
      "falhas" = CASE
        WHEN "AdminLoginLock"."bloqueadoAte" IS NOT NULL AND "AdminLoginLock"."bloqueadoAte" <= ${now} THEN 1
        ELSE "AdminLoginLock"."falhas" + 1 END,
      "bloqueadoAte" = CASE
        WHEN "AdminLoginLock"."bloqueadoAte" IS NOT NULL AND "AdminLoginLock"."bloqueadoAte" <= ${now} THEN NULL
        ELSE "AdminLoginLock"."bloqueadoAte" END,
      "updatedAt" = ${now}
    RETURNING "falhas", "bloqueadoAte"`;
  const row = rows[0];
  if (row?.bloqueadoAte && row.bloqueadoAte > now) return { permitido: false, ate: row.bloqueadoAte };
  if (!row || row.falhas > ADMIN_MAX_FAILS) return { permitido: false, ate: await lock(db, chave, now) };
  return { permitido: true, tentativa: row.falhas };
}

/** Senha errada: na última tentativa permitida, bloqueia por 15 minutos. */
export async function failedAttempt(db: PrismaClient, chave: string, tentativa: number, now = new Date()): Promise<Date | null> {
  return tentativa >= ADMIN_MAX_FAILS ? lock(db, chave, now) : null;
}

/** Senha certa: zera a conta. */
export async function clearAttempts(db: PrismaClient, chave: string): Promise<void> {
  await db.adminLoginLock.deleteMany({ where: { chave } });
}

async function lock(db: PrismaClient, chave: string, now: Date): Promise<Date> {
  const ate = new Date(now.getTime() + ADMIN_LOCK_MINUTES * 60_000);
  // Não encurta um bloqueio que já está valendo.
  await db.$executeRaw`
    UPDATE "AdminLoginLock" SET "bloqueadoAte" = ${ate}, "updatedAt" = ${now}
    WHERE "chave" = ${chave} AND ("bloqueadoAte" IS NULL OR "bloqueadoAte" < ${ate})`;
  return ate;
}
