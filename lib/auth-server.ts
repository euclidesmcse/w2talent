/**
 * Login (1.5.5) — Better Auth no servidor.
 *
 * - Entrar com Google ou Microsoft (contas pessoais e de empresa: tenant "common", decisão 5).
 * - Entrar com e-mail e senha (plano de 2026-11-19, D1–D8): só com RESEND_API_KEY (D2); e-mail
 *   confirmado antes de entrar (D1); senha em PBKDF2 pelo Web Crypto (D3, lib/senha.ts); mínimo de
 *   10 caracteres e recusa de senhas vazadas (D4); limite de tentativas no banco e trava depois de
 *   10 senhas erradas (D6, lib/login-email.ts); respostas iguais para quem tem ou não conta (D7);
 *   trocar ou redefinir a senha encerra as outras sessões e avisa por e-mail (D8).
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
import { haveIBeenPwned } from "better-auth/plugins/haveibeenpwned";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { prisma } from "@/lib/prisma";
import { APARELHO_COOKIE, aparelhoConfiavel, lerCookie } from "@/lib/aparelho";
import { segredoDoLogin } from "@/lib/segredo-login";
import { hashSenha, verificarSenha, SENHA_MAX, SENHA_MIN } from "@/lib/senha";
import { contaTravada, enviarEmailDeLogin, marcarSenhaErrada, origemDoSite, senhaDisponivel, zerarSenhaErrada } from "@/lib/login-email";

export const PERFIS = ["candidato", "recrutador"] as const;
export type Perfil = (typeof PERFIS)[number];

// 3.6a: a regra mora em lib/segredo-login.ts (sem o Better Auth), para quem só precisa da chave.
export { segredoDoLogin };

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

// D6: limite por IP, guardado no banco (a memória de cada Worker não é compartilhada).
const LIMITES = {
  "/sign-in/email": { window: 60, max: 5 },
  "/sign-up/email": { window: 60, max: 5 },
  "/request-password-reset": { window: 60, max: 5 },
  "/send-verification-email": { window: 60, max: 5 },
  "/reset-password": { window: 60, max: 10 },
  "/change-password": { window: 60, max: 5 },
  // Lida a cada tela: não precisa gastar uma escrita no banco por leitura.
  "/get-session": false as const,
};

function emailDoCorpo(body: unknown): string | null {
  const e = (body as { email?: unknown } | null)?.email;
  return typeof e === "string" && e.trim() ? e : null;
}

function ehErro(x: unknown): x is APIError {
  return x instanceof APIError || (!!x && typeof x === "object" && "statusCode" in x && "status" in x);
}

let instancia: ReturnType<typeof criar> | null = null;

function criar() {
  const p = provedoresConfigurados();
  const segredo = segredoDoLogin();
  // Só liga com as duas chaves: sem a pública a tela não mostra o desafio e ninguém entraria.
  const turnstile = process.env.TURNSTILE_SITE_KEY ? process.env.TURNSTILE_SECRET_KEY : undefined;
  const senha = senhaDisponivel();
  return betterAuth({
    appName: "W2Talent",
    secret: segredo,
    baseURL: process.env.BETTER_AUTH_URL || undefined,
    basePath: "/api/auth",
    trustedOrigins: origensConfiaveis(),
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    rateLimit: { enabled: true, storage: "database", window: 60, max: 100, customRules: LIMITES },
    emailAndPassword: {
      enabled: senha,
      requireEmailVerification: true,
      autoSignIn: false,
      minPasswordLength: SENHA_MIN,
      maxPasswordLength: SENHA_MAX,
      password: { hash: hashSenha, verify: verificarSenha },
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }, request) => {
        await enviarEmailDeLogin(prisma, { tipo: "redefinir", email: user.email, nome: user.name, url, req: request });
      },
      onPasswordReset: async ({ user }, request) => {
        await zerarSenhaErrada(prisma, user.email).catch(() => {});
        await enviarEmailDeLogin(prisma, { tipo: "senha_trocada", email: user.email, nome: user.name, url: `${origemDoSite(request)}/entrar/esqueci`, req: request });
      },
      onExistingUserSignUp: async ({ user }, request) => {
        await enviarEmailDeLogin(prisma, { tipo: "ja_tem_conta", email: user.email, nome: user.name, url: `${origemDoSite(request)}/entrar`, req: request });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60,
      sendVerificationEmail: async ({ user, url }, request) => {
        // Só para quem ainda não confirmou (o Better Auth também reenvia a quem pede de novo).
        if (user.emailVerified) return;
        await enviarEmailDeLogin(prisma, { tipo: "confirmar", email: user.email, nome: user.name, url, req: request });
      },
    },
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
      // allowPasswordless: quem entra só pelo Google/Microsoft não tem senha e liga o autenticador sem ela.
      // Quem tem senha precisa digitá-la para ligar ou desligar (regra do próprio plugin).
      twoFactor({ issuer: "W2Talent", allowPasswordless: true }),
      haveIBeenPwned({ customPasswordCompromisedMessage: "Essa senha apareceu em vazamentos de dados. Escolha outra." }),
      ...(turnstile
        ? [captcha({ provider: "cloudflare-turnstile", secretKey: turnstile, endpoints: ["/sign-in/social", "/sign-in/email", "/sign-up/email", "/request-password-reset"] })]
        : []),
    ],
    databaseHooks: {
      session: {
        create: {
          before: async (session, ctx) => {
            const conta = await prisma.user.findUnique({ where: { id: session.userId }, select: { twoFactorEnabled: true } });
            const caminho = ctx?.path ?? "";
            // Quem acabou de digitar o código (ligar/confirmar/desligar o autenticador) já provou.
            // No login por senha quem pede o código é o plugin two-factor: ele apaga esta sessão e só
            // cria outra depois do código (ou a mantém se o aparelho já é de confiança dele).
            const acabouDeProvar = caminho.startsWith("/two-factor/") || caminho === "/sign-in/email";
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
      after: createAuthMiddleware(async (ctx) => {
        const caminho = ctx.path ?? "";
        const r = ctx.context.returned;
        if (caminho === "/sign-in/email") {
          const email = emailDoCorpo(ctx.body);
          if (!email) return;
          // Conta para qualquer e-mail (com ou sem conta): a trava não pode revelar quem tem conta (D7).
          if (ehErro(r) && r.statusCode === 401) await marcarSenhaErrada(prisma, email).catch(() => {});
          else if (!ehErro(r)) await zerarSenhaErrada(prisma, email).catch(() => {});
          return;
        }
        if (caminho === "/change-password" && r && !ehErro(r)) {
          const s = ctx.context.session ?? (await getSessionFromCtx(ctx).catch(() => null));
          const u = (r as { user?: { email?: string; name?: string } }).user ?? s?.user;
          if (u?.email) {
            await zerarSenhaErrada(prisma, u.email).catch(() => {});
            await enviarEmailDeLogin(prisma, { tipo: "senha_trocada", email: u.email, nome: u.name, url: `${origemDoSite(ctx.request)}/entrar/esqueci`, req: ctx.request });
          }
        }
      }),
      before: createAuthMiddleware(async (ctx) => {
        const caminho = ctx.path ?? "";
        // D6: depois de 10 senhas erradas seguidas, só com uma senha nova (link de Esqueci a senha).
        if (caminho === "/sign-in/email") {
          const email = emailDoCorpo(ctx.body);
          if (email && (await contaTravada(prisma, email))) {
            throw new APIError("FORBIDDEN", { message: "Muitas senhas erradas. Use Esqueci a senha para entrar.", code: "CONTA_BLOQUEADA" });
          }
        }
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
