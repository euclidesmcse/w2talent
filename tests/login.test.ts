/** Login (1.5.5): regras de acesso, aparelho de confiança, volta segura e o código do autenticador. */
import { NextRequest } from "next/server";
import { APARELHO_DIAS, aparelhoConfiavel, assinarAparelho, lerCookie } from "../lib/aparelho";
import { regrasDaConta, type Conta } from "../lib/sessao";
import { destinoDoEstado, voltaSegura, CHAVES_LOCAIS } from "../lib/conta-client";
import { cookieDeTeste } from "./helpers/sessao-mock";
import { areaDoMenu } from "../components/nav-area";

jest.mock("../lib/sessao", () => require("./helpers/sessao-mock").sessaoMock());

const verifyTOTP = jest.fn();
const verifyBackupCode = jest.fn();
jest.mock("../lib/auth-server", () => ({
  getAuth: () => ({ api: { verifyTOTP, verifyBackupCode } }),
  segredoDoLogin: () => "segredo-de-teste-com-mais-de-32-caracteres",
  provedoresConfigurados: () => ({ google: true, microsoft: false }),
}));
const sessionUpdate = jest.fn(async () => ({}));
jest.mock("../lib/prisma", () => ({ prisma: { session: { update: (...a: unknown[]) => sessionUpdate(...(a as [])) } } }));

const SEGREDO = "segredo-de-teste-com-mais-de-32-caracteres";
const conta = (c: Partial<Conta> = {}): Conta => ({ id: "u1", nome: "Ana", email: "ana@exemplo.com", perfil: "candidato", mfaLigado: false, mfaPendente: false, sessaoId: "s1", ...c });
const status = (r: ReturnType<typeof regrasDaConta>) => ("erro" in r ? r.erro.status : 200);
const erro = async (r: ReturnType<typeof regrasDaConta>) => ("erro" in r ? (await r.erro.json()).error : "ok");

describe("regras de acesso", () => {
  it("sem login, código pendente, sem perfil, perfil errado e recrutador sem autenticador", async () => {
    expect(status(regrasDaConta(null))).toBe(401);
    expect(await erro(regrasDaConta(conta({ mfaPendente: true })))).toBe("mfa");
    expect(await erro(regrasDaConta(conta({ perfil: null }), { perfil: "candidato" }))).toBe("sem_perfil");
    expect(await erro(regrasDaConta(conta(), { perfil: "recrutador" }))).toBe("perfil");
    expect(await erro(regrasDaConta(conta({ perfil: "recrutador" }), { perfil: "recrutador" }))).toBe("mfa_obrigatorio");
    expect(status(regrasDaConta(conta({ perfil: "recrutador", mfaLigado: true }), { perfil: "recrutador" }))).toBe(200);
    expect(status(regrasDaConta(conta(), { perfil: "candidato" }))).toBe(200);
  });
});

describe("lembrar este aparelho", () => {
  const agora = Date.UTC(2026, 10, 10);
  it("vale para a mesma conta por 30 dias e não aceita alteração", async () => {
    const v = await assinarAparelho("u1", SEGREDO, agora);
    expect(await aparelhoConfiavel(v, "u1", SEGREDO, agora + 1000)).toBe(true);
    expect(await aparelhoConfiavel(v, "u2", SEGREDO, agora)).toBe(false);
    expect(await aparelhoConfiavel(v, "u1", SEGREDO, agora + (APARELHO_DIAS + 1) * 86_400_000)).toBe(false);
    expect(await aparelhoConfiavel(v, "u1", "outro-segredo-com-mais-de-32-caracteres", agora)).toBe(false);
    const [id, , ass] = v.split(".");
    expect(await aparelhoConfiavel(`${id}.${agora + 999 * 86_400_000}.${ass}`, "u1", SEGREDO, agora)).toBe(false);
    expect(await aparelhoConfiavel("lixo", "u1", SEGREDO, agora)).toBe(false);
  });
  it("lê o cookie pelo nome", () => {
    const h = new Headers({ cookie: "a=1; w2_aparelho=x.y.z; b=2" });
    expect(lerCookie(h, "w2_aparelho")).toBe("x.y.z");
    expect(lerCookie(h, "c")).toBeNull();
    expect(lerCookie(null, "a")).toBeNull();
  });
});

describe("volta e próximo passo", () => {
  it("só aceita caminhos internos", () => {
    expect(voltaSegura("/vagas?q=aws")).toBe("/vagas?q=aws");
    expect(voltaSegura("//mal.example")).toBe("/");
    expect(voltaSegura("https://mal.example")).toBe("/");
    expect(voltaSegura("/\\mal.example")).toBe("/");
    expect(voltaSegura(null, "/vagas")).toBe("/vagas");
  });
  it("leva para o código, o perfil, o autenticador ou a volta", () => {
    expect(destinoDoEstado("mfa", "/vagas")).toBe("/entrar/codigo?volta=%2Fvagas");
    expect(destinoDoEstado("sem_perfil", "/vagas")).toBe("/entrar/perfil?volta=%2Fvagas");
    expect(destinoDoEstado("mfa_obrigatorio", "/candidatos")).toBe("/conta/seguranca?volta=%2Fcandidatos");
    expect(destinoDoEstado("ok", "/vagas")).toBe("/vagas");
    expect(destinoDoEstado("anonimo", "/vagas")).toBeNull();
  });
  it("com login o menu é o do perfil da conta; sem login, o da tela; o admin fica no dele", () => {
    expect(areaDoMenu("candidato", "ok", "recrutador")).toBe("recrutador");
    expect(areaDoMenu("recrutador", "ok", "candidato")).toBe("candidato");
    expect(areaDoMenu("recrutador", "mfa_obrigatorio", "recrutador")).toBe("recrutador");
    expect(areaDoMenu("candidato", "anonimo", undefined)).toBe("candidato");
    expect(areaDoMenu("candidato", "mfa", undefined)).toBe("candidato");
    expect(areaDoMenu("admin", "ok", "candidato")).toBe("admin");
  });
  it("o Sair apaga tudo o que fica no navegador", () => {
    expect(CHAVES_LOCAIS).toEqual(
      expect.arrayContaining(["w2talent:ultima-busca", "w2talent:candidaturas-copia", "w2talent:ficha", "w2talent:selection", "w2talent:selectionLabels", "w2talent:loteId"]),
    );
  });
});

describe("POST /api/conta/mfa", () => {
  const post = (body: unknown, c?: Parameters<typeof cookieDeTeste>[0]) =>
    new NextRequest("https://w2.test/api/conta/mfa", { method: "POST", headers: { "content-type": "application/json", ...(c ? { cookie: cookieDeTeste(c) } : {}) }, body: JSON.stringify(body) });
  beforeEach(() => { verifyTOTP.mockReset(); verifyBackupCode.mockReset(); sessionUpdate.mockClear(); });

  it("sem login → 401; sem código pendente → ok sem conferir", async () => {
    const { POST } = await import("../app/api/conta/mfa/route");
    expect((await POST(post({ codigo: "123456" }))).status).toBe(401);
    expect((await POST(post({ codigo: "123456" }, { id: "u1" }))).status).toBe(200);
    expect(verifyTOTP).not.toHaveBeenCalled();
  });

  it("código errado não libera a sessão", async () => {
    const { POST } = await import("../app/api/conta/mfa/route");
    verifyTOTP.mockRejectedValue(new Error("invalid"));
    const r = await POST(post({ codigo: "000000" }, { id: "u1", mfaPendente: true }));
    expect(r.status).toBe(400);
    expect(sessionUpdate).not.toHaveBeenCalled();
  });

  it("código certo libera a sessão e, se pedido, lembra o aparelho", async () => {
    const { POST } = await import("../app/api/conta/mfa/route");
    verifyTOTP.mockResolvedValue({ ok: true });
    const r = await POST(post({ codigo: "123 456", confiar: true }, { id: "u1", mfaPendente: true }));
    expect(r.status).toBe(200);
    expect(verifyTOTP).toHaveBeenCalledWith(expect.objectContaining({ body: { code: "123456" } }));
    expect(sessionUpdate).toHaveBeenCalledWith({ where: { id: "s-u1" }, data: { mfaPendente: false } });
    const cookie = r.cookies.get("w2_aparelho");
    expect(cookie?.httpOnly).toBe(true);
    expect(await aparelhoConfiavel(cookie!.value, "u1", SEGREDO)).toBe(true);
  });

  it("código de recuperação usa a outra conferência", async () => {
    const { POST } = await import("../app/api/conta/mfa/route");
    verifyBackupCode.mockResolvedValue({ ok: true });
    const r = await POST(post({ codigo: "abcde-12345", recuperacao: true }, { id: "u1", mfaPendente: true }));
    expect(r.status).toBe(200);
    expect(verifyBackupCode).toHaveBeenCalled();
    expect(verifyTOTP).not.toHaveBeenCalled();
    expect(r.cookies.get("w2_aparelho")).toBeUndefined();
  });
});

describe("rotas protegidas", () => {
  it("busca de candidatos: só recrutador com autenticador", async () => {
    const { GET } = await import("../app/api/search/candidates/route");
    const get = (c?: Parameters<typeof cookieDeTeste>[0]) => GET(new NextRequest("https://w2.test/api/search/candidates?q=aws", { headers: c ? { cookie: cookieDeTeste(c) } : {} }));
    expect((await get()).status).toBe(401);
    expect((await get({ id: "c1" })).status).toBe(403);
    expect((await get({ id: "r1", perfil: "recrutador" })).status).toBe(403);
  });
  it("publicar pelo id antigo: só o próprio candidato", async () => {
    const { PUT } = await import("../app/api/candidates/[id]/route");
    const put = (c?: Parameters<typeof cookieDeTeste>[0]) =>
      PUT(new NextRequest("https://w2.test/api/candidates/c2", { method: "PUT", headers: c ? { cookie: cookieDeTeste(c) } : {}, body: "{}" }), { params: Promise.resolve({ id: "c2" }) });
    expect((await put()).status).toBe(401);
    expect((await put({ id: "c1" })).status).toBe(403);
  });
  it("ler CV pela rota antiga: só candidato logado", async () => {
    const { POST } = await import("../app/api/candidates/route");
    expect((await POST(new NextRequest("https://w2.test/api/candidates", { method: "POST", body: "{}" }))).status).toBe(401);
  });
  it("o estado do login não mostra e-mail com o código pendente", async () => {
    const { GET } = await import("../app/api/conta/route");
    const j = await (await GET(new NextRequest("https://w2.test/api/conta", { headers: { cookie: cookieDeTeste({ id: "u1", mfaPendente: true }) } }))).json();
    expect(j.estado).toBe("mfa");
    expect(j.conta).toEqual({ nome: "u1" });
    const anon = await (await GET(new NextRequest("https://w2.test/api/conta"))).json();
    expect(anon).toMatchObject({ estado: "anonimo", config: { provedores: { google: true, microsoft: false }, turnstileSiteKey: null } });
  });
});
