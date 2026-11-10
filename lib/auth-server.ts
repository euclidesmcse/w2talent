/**
 * Login (1.5.5) — Better Auth no servidor.
 *
 * - Entrar com Google ou Microsoft (contas pessoais e de empresa: tenant "common", decisão 5).
 *   E-mail e senha ficam para um PR seguinte (decisão 1).
 * - Autenticador (TOTP) com 10 códigos de recuperação. O plugin do Better Auth só pede o código
 *   no login por senha; no login social quem pede somos nós: a sessão nasce com `mfaPendente`
 *   quando a conta tem autenticador e o aparelho não é de confiança (lib/aparelho.ts), e as rotas
 *   (lib/sessao.ts) recusam a sessão até o código ser digitado (/api/conta/mfa).
 * - Turnstile no início do login (cadastro), só quando TURNSTILE_SECRET_KEY existe.
 * - Provedores só entram quando os segredos existem; sem eles a tela de entrar avisa.
 *
 * Segredos (Worker Secrets, nunca no repositório): BETTER_AUTH_SECRET, GOOGLE_CLIENT_ID/SECRET,
 * MICROSOFT_CLIENT_ID/SECRET, TURNSTILE_SECRET_KEY. Var: TURNSTILE_SITE_KEY (pública).
 */
import { betterAuth } from "better-auth/minimal";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { twoFactor } from "better-auth/plugins/two-factor";
import { captcha } from "better-auth/plugins/captcha";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { prisma } from "@/lib/prisma";
import { APARELHO_COOKIE, aparelhoConfiavel, lerCookie } from "@/lib/aparelho";

export const PERFIS = ["candidato", "recrutador"] as const;
export type Perfil = (typeof PERFIS)[number];

export function segredoDoLogin(): string {
  const s = process.env.BETTER_AUTH_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NEXT_PHASE === "phase-production-build" || process.env.CI || process.env.NODE_ENV === "test") {
    return "build-dummy-w2talent-login-nao-usar-em-producao";
  }
  if (process.env.NODE_ENV === "production") throw new Error("BETTER_AUTH_SECRET ausente ou curto (mínimo 32 caracteres)");
  return "dev-w2talent-login-segredo-local-1234567890";
}

export function provedoresConfigurados(): { google: boolean; microsoft: boolean } {
  return {
    google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    microsoft: !!(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET),
  };
}

function origensConfiaveis(): string[] {
  const o = [process.env.APP_URL, process.env.BETTER_AUTH_URL, "https://w2talent.euclidespns.workers.dev", "https://*-w2talent.euclidespns.workers.dev"];
  if (process.env.NODE_ENV !== "production") o.push("http://localhost:3000", "http://localhost:3999");
  return o.filter((x): x is string => !!x);
}

// Enquanto falta o código do autenticador, a sessão só pode ler a si mesma, sair e digitar o código.
// Todo o resto do Better Auth (inclusive tokens do Google/Microsoft) é recusado por padrão.
const LIBERADAS_COM_MFA_PENDENTE = new Set(["/get-session", "/sign-out", "/two-factor/verify-totp", "/two-factor/verify-backup-code"]);
// Começo do login: ainda não há sessão para conferir.
const INICIO_DO_LOGIN = ["/sign-in/", "/callback/", "/oauth2/callback/", "/ok", "/error"];

let instancia: ReturnType<typeof criar> | null = null;

function criar() {
  const p = provedoresConfigurados();
  const segredo = segredoDoLogin();
  // Só liga com as duas chaves: sem a pública a tela não mostra o desafio e ninguém entraria.
  const turnstile = process.env.TURNSTILE_SITE_KEY ? process.env.TURNSTILE_SECRET_KEY : undefined;
  return betterAuth({
    appName: "W2Talent",
    secret: segredo,
    baseURL: process.env.BETTER_AUTH_URL || undefined,
    basePath: "/api/auth",
    trustedOrigins: origensConfiaveis(),
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    socialProviders: {
      ...(p.google ? { google: { clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET!, prompt: "select_account" as const } } : {}),
      ...(p.microsoft
        ? { microsoft: { clientId: process.env.MICROSOFT_CLIENT_ID!, clientSecret: process.env.MICROSOFT_CLIENT_SECRET!, tenantId: "common", prompt: "select_account" as const } }
        : {}),
    },
    // A mesma pessoa pode entrar pelo Google e pela Microsoft com o mesmo e-mail: vira uma conta só.
    account: { accountLinking: { enabled: true, trustedProviders: ["google", "microsoft"] } },
    user: { additionalFields: { perfil: { type: "string", required: false, input: false } } },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      additionalFields: { mfaPendente: { type: "boolean", required: false, defaultValue: false, input: false } },
    },
    advanced: { ipAddress: { ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"] } },
    plugins: [
      // allowPasswordless: as contas são só Google/Microsoft (sem senha) e precisam ligar o autenticador.
      twoFactor({ issuer: "W2Talent", allowPasswordless: true }),
      ...(turnstile ? [captcha({ provider: "cloudflare-turnstile", secretKey: turnstile, endpoints: ["/sign-in/social"] })] : []),
    ],
    databaseHooks: {
      session: {
        create: {
          before: async (session, ctx) => {
            const conta = await prisma.user.findUnique({ where: { id: session.userId }, select: { twoFactorEnabled: true } });
            const caminho = ctx?.path ?? "";
            // Quem acabou de digitar o código (ligar/confirmar/desligar o autenticador) já provou.
            const acabouDeProvar = caminho.startsWith("/two-factor/");
            let pendente = !!conta?.twoFactorEnabled && !acabouDeProvar;
            if (pendente) {
              const cookie = lerCookie(ctx?.headers ?? ctx?.request?.headers ?? null, APARELHO_COOKIE);
              if (cookie && (await aparelhoConfiavel(cookie, session.userId, segredo))) pendente = false;
            }
            return { data: { ...session, mfaPendente: pendente } };
          },
        },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        const caminho = ctx.path ?? "";
        if (LIBERADAS_COM_MFA_PENDENTE.has(caminho) || INICIO_DO_LOGIN.some((s) => caminho === s || caminho.startsWith(s))) return;
        const s = await getSessionFromCtx(ctx).catch(() => null);
        if (!s) return;
        const sess = s.session as typeof s.session & { mfaPendente?: boolean | null };
        const user = s.user as typeof s.user & { perfil?: string | null };
        if (sess.mfaPendente) {
          throw new APIError("FORBIDDEN", { message: "Digite o código do autenticador primeiro.", code: "MFA_PENDENTE" });
        }
        // Decisão 2: para recrutador o autenticador é obrigatório.
        if (caminho === "/two-factor/disable" && user.perfil === "recrutador") {
          throw new APIError("FORBIDDEN", { message: "Para recrutador o autenticador é obrigatório.", code: "MFA_OBRIGATORIO" });
        }
      }),
    },
  });
}

export function getAuth() {
  if (!instancia) instancia = criar();
  return instancia;
}
