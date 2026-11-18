/** 2.4a Painel RH: números da empresa a partir das contagens (sem banco). */
import { montarResumo, situacaoDaVaga } from "../lib/painel-rh";

const NOW = new Date("2026-11-18T12:00:00Z");
const dias = (n: number) => new Date(NOW.getTime() + n * 864e5);

describe("situacaoDaVaga", () => {
  it("separa ativa, vencendo em até 3 dias, vencida e arquivada", () => {
    expect(situacaoDaVaga({ status: "ativa", expiresAt: dias(10) }, NOW)).toBe("ativa");
    expect(situacaoDaVaga({ status: "ativa", expiresAt: dias(3) }, NOW)).toBe("vencendo");
    expect(situacaoDaVaga({ status: "ativa", expiresAt: dias(0.5) }, NOW)).toBe("vencendo");
    expect(situacaoDaVaga({ status: "ativa", expiresAt: dias(-1) }, NOW)).toBe("vencida");
    expect(situacaoDaVaga({ status: "arquivada", expiresAt: dias(10) }, NOW)).toBe("arquivada");
  });
});

describe("montarResumo", () => {
  const vagas = [
    { id: "a", titulo: "Ativa", status: "ativa" as const, expiresAt: dias(10) },
    { id: "v", titulo: "Vencida", status: "ativa" as const, expiresAt: dias(-2) },
    { id: "q", titulo: "Quase", status: "ativa" as const, expiresAt: dias(1) },
    { id: "x", titulo: "Arquivada", status: "arquivada" as const, expiresAt: dias(5) },
  ];

  it("conta por vaga e etapa, e calcula tempo médio e taxa de resposta", () => {
    const r = montarResumo(
      vagas,
      [
        { vacancyId: "a", etapa: "nova", n: 3 },
        { vacancyId: "a", etapa: "entrevista", n: 1 },
        { vacancyId: "q", etapa: "em_analise", n: 2 },
        { vacancyId: null, etapa: "nao_seguiu", n: 2 }, // vaga apagada: conta no total da empresa
      ],
      { n: 5, segundos: 5 * 3600 },
      NOW,
    );
    expect(r.metricas).toEqual({ vagasAtivas: 2, vencendo: 1, candidaturas: 8, novas: 3, respondidas: 5, tempoMedioHoras: 5, taxaResposta: 63 });
    expect(r.vagas.map((v) => v.id)).toEqual(["q", "a", "v", "x"]);
    const a = r.vagas.find((v) => v.id === "a")!;
    expect([a.total, a.novas, a.porEtapa.entrevista, a.porEtapa.proposta]).toEqual([4, 3, 1, 0]);
    expect(r.vagas.find((v) => v.id === "x")!.total).toBe(0);
  });

  it("com a lista cortada, vagas ativas e vencendo vêm da contagem da empresa toda", () => {
    const r = montarResumo(vagas, [], { n: 0, segundos: null }, NOW, { ativas: 250, vencendo: 7 });
    expect([r.metricas.vagasAtivas, r.metricas.vencendo]).toEqual([250, 7]);
  });

  it("quem voltou para Nova depois de respondida continua contando como respondida", () => {
    const r = montarResumo(vagas, [{ vacancyId: "a", etapa: "nova", n: 1 }], { n: 1, segundos: 3600 }, NOW);
    expect([r.metricas.novas, r.metricas.respondidas, r.metricas.taxaResposta, r.metricas.tempoMedioHoras]).toEqual([1, 1, 100, 1]);
  });

  it("sem candidaturas, tempo e taxa ficam sem dado", () => {
    const r = montarResumo(vagas, [], { n: 0, segundos: null }, NOW);
    expect(r.metricas.tempoMedioHoras).toBeNull();
    expect(r.metricas.taxaResposta).toBeNull();
    expect(r.metricas.candidaturas).toBe(0);
  });
});
