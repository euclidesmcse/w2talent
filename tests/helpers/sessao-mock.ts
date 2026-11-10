/**
 * Sessão de teste (1.5.5): o Better Auth é ESM e não roda no Jest. Os testes trocam
 * contaDoPedido por um cookie "w2-teste=<json>" com a conta.
 *   jest.mock("../lib/sessao", () => require("./helpers/sessao-mock").sessaoMock());
 */
export type ContaTeste = {
  id: string;
  perfil?: "candidato" | "recrutador" | null;
  mfaLigado?: boolean;
  mfaPendente?: boolean;
  email?: string;
};

export function cookieDeTeste(c: ContaTeste): string {
  return `w2-teste=${encodeURIComponent(JSON.stringify(c))}`;
}

export function sessaoMock() {
  const real = jest.requireActual("../../lib/sessao");
  const contaDoPedido = async (req: Request) => {
    const m = /w2-teste=([^;]+)/.exec(req.headers.get("cookie") ?? "");
    if (!m) return null;
    const c = JSON.parse(decodeURIComponent(m[1])) as ContaTeste;
    return {
      id: c.id,
      nome: c.id,
      email: c.email ?? `${c.id}@exemplo.com`,
      perfil: c.perfil === undefined ? "candidato" : c.perfil,
      mfaLigado: !!c.mfaLigado,
      mfaPendente: !!c.mfaPendente,
      sessaoId: `s-${c.id}`,
    };
  };
  return {
    ...real,
    contaDoPedido,
    exigirConta: async (req: Request, exige = {}) =>
      real.regrasDaConta(await contaDoPedido(req), exige),
  };
}
