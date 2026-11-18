// 2.8 Sinais de aprendizado: formato do que vai para o banco.
import { dadosDoSinal, registrarSinal } from "@/lib/sinais";

describe("2.8 Sinais", () => {
  it("limita o match entre 0 e 100 e não manda campos vazios", () => {
    expect(dadosDoSinal({ tipo: "candidatura_enviada", ator: "candidato", candidateId: "c1", matchPct: 104.6 })).toEqual({
      tipo: "candidatura_enviada", ator: "candidato", candidateId: "c1", vacancyId: null, applicationId: null, matchPct: 100,
    });
    expect(dadosDoSinal({ tipo: "vaga_aprovada", ator: "candidato", matchPct: Number.NaN }).matchPct).toBeNull();
  });

  it("um erro ao gravar não quebra a ação da pessoa", async () => {
    const erro = jest.spyOn(console, "error").mockImplementation(() => {});
    const db = { feedbackSignal: { createMany: async () => { throw new Error("fora do ar"); } } } as never;
    await expect(registrarSinal(db, { tipo: "vaga_aprovada", ator: "candidato" })).resolves.toBeUndefined();
    expect(erro).toHaveBeenCalled();
    erro.mockRestore();
  });
});
