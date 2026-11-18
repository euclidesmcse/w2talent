// B1 "O que falta para as vagas" (plano B1, aprovado em 2026-11-18): conta pura sobre o match do candidato.
import * as fs from "fs";
import * as path from "path";
import { LACUNAS_MAX_SKILLS, LACUNAS_MAX_VAGAS, LACUNAS_MIN_PCT, lacunasDasVagas } from "../lib/painel-lacunas";
import { matchCandidato } from "../lib/match-candidato";

const ROOT = path.join(__dirname, "..");
const NOW = Date.parse("2026-11-18T12:00:00Z");

const perfil = {
  nome: "Ana Silva",
  email: "ana@example.com",
  titulo: "Engenheira DevOps",
  senioridade: "pleno",
  stack: [{ skillId: "aws", anos: 5 }, { skillId: "terraform", anos: 3 }, { skillId: "openshift", anos: 2 }],
  experiencias: [{ cargo: "DevOps", empresa: "Acme", inicio: "2020-01", fim: "", atual: true }],
  localidade: "São Paulo",
  modo: "remoto",
  regimes: ["PJ"],
  pretensoes: [{ regime: "PJ", valor: 30000, unidade: "mes", moeda: "BRL" }],
  idiomas: [{ idioma: "Inglês", nivel: "avancado" }],
  disponibilidade: "30d",
  updatedAt: new Date(NOW).toISOString(),
};

let seq = 0;
function vaga(stack: string[], extra: Record<string, unknown> = {}) {
  return { id: `v${++seq}`, stack: stack.map((skillId) => ({ skillId })), nivel: "Pleno", regime: "PJ", localidade: "Remoto", descricaoBullets: ["x"], updatedAt: new Date(NOW), createdAt: new Date(NOW), ...extra };
}

describe("lacunasDasVagas", () => {
  it("conta a competência que falta em mais vagas primeiro e para em 5", () => {
    const vagas = [
      vaga(["aws", "react"]),
      vaga(["aws", "react", "python"]),
      vaga(["aws", "react", "python"]),
      vaga(["aws", "ansible"]),
      vaga(["aws", "go"]),
      vaga(["aws", "linux"]),
      vaga(["aws", "grafana"]),
    ];
    const r = lacunasDasVagas(perfil, vagas, { now: NOW });
    expect(r.estado).toBe("ok");
    if (r.estado !== "ok") return;
    expect(r.vagas).toBe(7);
    expect(r.faltam[0]).toMatchObject({ skill: "react", n: 3 });
    expect(r.faltam[1]).toMatchObject({ skill: "python", n: 2 });
    expect(r.faltam).toHaveLength(LACUNAS_MAX_SKILLS);
    // Empate por nome: ansible antes de go.
    expect(r.faltam.slice(2).map((s) => s.skill)).toEqual(["ansible", "go", "grafana"]);
  });

  it("competência próxima vai à parte, nunca como falta", () => {
    expect(matchCandidato(perfil, vaga(["kubernetes"]), NOW).gaps).toContainEqual({ kind: "skill", skill: "kubernetes", proxima: "openshift" });
    const r = lacunasDasVagas(perfil, [vaga(["aws", "kubernetes"]), vaga(["aws", "kubernetes"]), vaga(["aws", "react"])], { now: NOW, rotulo: (s) => s.toUpperCase() });
    if (r.estado !== "ok") throw new Error(r.estado);
    expect(r.faltam.map((s) => s.skill)).toEqual(["react"]);
    expect(r.proximas).toEqual([{ skill: "kubernetes", label: "KUBERNETES", tem: "openshift", temLabel: "OPENSHIFT", n: 2 }]);
  });

  it("vaga que repete a competência no stack conta uma vez", () => {
    const r = lacunasDasVagas(perfil, [vaga(["aws", "react", "react"]), vaga(["aws"]), vaga(["aws"])], { now: NOW });
    if (r.estado !== "ok") throw new Error(r.estado);
    expect(r.faltam).toEqual([{ skill: "react", label: "react", n: 1 }]);
  });

  it("menos de 3 vagas próximas: sem contagens", () => {
    expect(lacunasDasVagas(perfil, [vaga(["aws"]), vaga(["aws"])], { now: NOW })).toEqual({ estado: "poucas", vagas: 2 });
  });

  it("vagas abaixo de 40% de match não contam", () => {
    const longe = vaga(["java", "spring", "oracle"], { nivel: "Sênior", regime: "CLT", localidade: "Curitiba (Presencial)" });
    expect(matchCandidato(perfil, longe, NOW).pct).toBeLessThan(LACUNAS_MIN_PCT);
    const r = lacunasDasVagas(perfil, [longe, longe, longe, vaga(["aws"]), vaga(["aws"])], { now: NOW });
    expect(r).toEqual({ estado: "poucas", vagas: 2 });
  });

  it("usa no máximo as 30 vagas de maior match", () => {
    const perto = Array.from({ length: LACUNAS_MAX_VAGAS }, () => vaga(["aws", "terraform"]));
    const menos = Array.from({ length: 10 }, () => vaga(["aws", "rust", "go"]));
    const r = lacunasDasVagas(perfil, [...menos, ...perto], { now: NOW });
    if (r.estado !== "ok") throw new Error(r.estado);
    expect(r.vagas).toBe(LACUNAS_MAX_VAGAS);
    expect(r.faltam).toEqual([]);
  });

  it("nível, regime e modo aparecem quando pesam; faixa salarial nunca", () => {
    const vagas = [
      vaga(["aws"], { nivel: "Sênior", regime: "CLT", faixaAte: 10000 }),
      vaga(["aws"], { nivel: "Senior", regime: "clt", faixaAte: 10000 }),
      vaga(["aws"], { nivel: "Sr", faixaAte: 10000 }),
      vaga(["aws"], { localidade: "São Paulo (Híbrido)" }),
      vaga(["aws"]),
      vaga(["aws"]),
      vaga(["aws"]),
      vaga(["aws"]),
      vaga(["aws"]),
      vaga(["aws"]),
    ];
    // Vaga PJ que paga abaixo da pretensão (30 mil): o match vê a faixa, o B1 não.
    vagas[9] = vaga(["aws"], { faixaAte: 10000 });
    expect(matchCandidato(perfil, vagas[9], NOW).gaps.some((g) => g.kind === "faixa")).toBe(true);
    const r = lacunasDasVagas(perfil, vagas, { now: NOW });
    if (r.estado !== "ok") throw new Error(r.estado);
    expect(r.condicoes).toEqual([
      { kind: "nivel", want: "senior", have: "pleno", n: 3 },
      { kind: "regime", want: "CLT", have: ["PJ"], n: 2 },
    ]);
    // Modo híbrido em 1 de 10 não pesa.
    expect(JSON.stringify(r)).not.toMatch(/faixa/);
  });
});

describe("rota e tela do B1", () => {
  const rota = fs.readFileSync(path.join(ROOT, "app/api/painel/lacunas/route.ts"), "utf8");
  const tela = fs.readFileSync(path.join(ROOT, "app/painel/page.tsx"), "utf8");

  it("a rota exige candidato logado e lê a ficha publicada da conta", () => {
    expect(rota).toMatch(/exigirConta\(req, \{ perfil: "candidato" \}\)/);
    expect(rota).toMatch(/where: \{ userId: r\.conta\.id \}/);
    expect(rota).toMatch(/estado: "sem_ficha"/);
    expect(rota).not.toMatch(/feedbackSignal|registrarSinal/i);
  });

  it("o quadro só aparece para o candidato logado", () => {
    expect(tela).toMatch(/\{candidato \? <PainelLacunas \/> : null\}/);
  });

  it("textos nos três idiomas", () => {
    for (const l of ["pt-BR", "en", "es"]) {
      const m = JSON.parse(fs.readFileSync(path.join(ROOT, `messages/${l}.json`), "utf8"));
      for (const k of ["vagasTitle", "vagasSemFicha", "vagasPoucas", "vagasLead", "vagasFalta", "vagasProxima", "vagasNivel", "vagasRegime", "vagasModo", "vagasRodape"]) {
        expect(typeof m.painel[k]).toBe("string");
      }
    }
  });
});
