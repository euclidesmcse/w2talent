/**
 * Segredo do login (BETTER_AUTH_SECRET), separado de lib/auth-server.ts para quem só precisa da chave
 * (3.6a: recibo e dono dos exemplos de treino) não carregar o Better Auth (ESM, fora do Jest).
 */
export function segredoDoLogin(): string {
  const s = process.env.BETTER_AUTH_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NEXT_PHASE === "phase-production-build" || process.env.CI || process.env.NODE_ENV === "test") {
    return "build-dummy-w2talent-login-nao-usar-em-producao";
  }
  if (process.env.NODE_ENV === "production") throw new Error("BETTER_AUTH_SECRET ausente ou curto (mínimo 32 caracteres)");
  return "dev-w2talent-login-segredo-local-1234567890";
}
