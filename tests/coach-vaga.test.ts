/** Coach IA por vaga: trava contra invenção, lacunas, proposta e o que vai ao aprovar. */
import {
  idiomaCoach,
  lacunasDaVaga,
  lerAdaptacao,
  motivoInvencao,
  numerosNoTexto,
  permitidosDaFicha,
  prepararParaVaga,
  promptCoach,
  sanitizarAdaptacao,
  sanitizarProposta,
  skillsNoTexto,
  travarTexto,
} from "@/lib/coach-vaga";
import { adaptacaoDoRascunho, rascunhoDaProposta, rascunhoDe, rascunhoManual, w2ComRascunho } from "@/lib/coach-rascunho";
import { experienciaVazia, fichaVazia, type Ficha, type FichaW2 } from "@/lib/ficha";
import { normalizeSkill } from "@/lib/taxonomy";
import type { SnapshotVaga } from "@/lib/envio";

const id = (s: string) => normalizeSkill(s)!;
const NOW = new Date("2026-11-20T12:00:00Z");

function ficha(): Ficha {
  const f = fichaVazia();
  f.nome = "Maria Souza";
  f.email = "maria@exemplo.com";
  f.titulo = "Engenheira Cloud";
  f.stack = [
    { skillId: id("AWS"), anos: 5 },
    { skillId: id("Terraform"), anos: 3 },
    { skillId: id("TypeScript"), anos: 2 },
  ];
  f.experiencias = [
    { ...experienciaVazia(), cargo: "Engenheira Cloud", empresa: "Acme", inicio: "2019-03", atual: true, funcoes: ["Migrou 40 sistemas para a nuvem"], skills: [id("Docker")] },
  ];
  return f;
}
const w2: FichaW2 = { resumo: "Engenheira cloud com 7 anos em AWS.", destaques: ["Migrou 40 sistemas para a AWS"], idioma: "pt-BR", geradaEm: NOW.toISOString(), editada: false };
const vaga: SnapshotVaga = {
  titulo: "SRE",
  empresa: "Beta",
  regime: "CLT",
  faixa: { de: null, ate: null, moeda: "BRL" },
  localidade: "",
  nivel: "Sênior",
  competencias: [id("AWS"), id("Kubernetes"), id("JavaScript")],
  descricao: ["Operar Kubernetes"],
  beneficios: [],
};

describe("competências e números no texto", () => {
  it("acha rótulos da taxonomia, ignora palavras comuns", () => {
    const s = skillsNoTexto("Usou AWS e Terraform; quer ir para Kubernetes.");
    expect(s).toEqual(expect.arrayContaining([id("AWS"), id("Terraform"), id("Kubernetes")]));
    expect(skillsNoTexto("Gosta de ir rest e go embora")).toEqual([]);
  });
  it("números sem separador de milhar", () => {
    expect(numerosNoTexto("Reduziu 1.500 chamados em 30% em 2024")).toEqual(["1500", "30", "2024"]);
  });
});

describe("trava (D3)", () => {
  const p = permitidosDaFicha(ficha(), w2, "Certificação CKA em Kubernetes", NOW);
  it("deixa o que está na ficha, na W2 ou no CV completo", () => {
    expect(motivoInvencao("Trabalha com AWS e Docker.", p)).toBeNull();
    expect(motivoInvencao("Migrou 40 sistemas.", p)).toBeNull();
    expect(motivoInvencao("Tem Kubernetes no CV.", p)).toBeNull();
    // TypeScript cobre JavaScript por inteiro (2.2)
    expect(motivoInvencao("Escreve JavaScript.", p)).toBeNull();
  });
  it("dígitos do nome de uma competência aceita não contam como número (EC2, Route 53)", () => {
    const f = ficha();
    f.stack.push({ skillId: "ec2", anos: 4 }, { skillId: "route53", anos: 2 });
    const q = permitidosDaFicha(f, w2, null, NOW);
    expect(motivoInvencao("Administra EC2 e Route 53.", q)).toBeNull();
    expect(motivoInvencao("Administra EC2 há 9 anos.", q)).toBe("9");
    // o 2 de EC2 não libera outro 2 na frase
    const sem2 = { skills: q.skills, numeros: new Set([...q.numeros].filter((n) => n !== "2")) };
    expect(motivoInvencao("Administra EC2.", sem2)).toBeNull();
    expect(motivoInvencao("Administra EC2 há 2 anos.", sem2)).toBe("2");
  });
  it("tira competência ou número que não aparecem", () => {
    expect(motivoInvencao("Domina Python.", p)).toBe("Python");
    expect(motivoInvencao("Liderou 12 pessoas.", p)).toBe("12");
    const r = travarTexto("Trabalha com AWS. Domina Python. Migrou 40 sistemas.", p);
    expect(r.texto).toBe("Trabalha com AWS. Migrou 40 sistemas.");
    expect(r.removidas).toEqual(["Domina Python."]);
  });
});

describe("lacunas (D5)", () => {
  it("lista o que falta e a próxima da pessoa; cobertura total não é lacuna", () => {
    const l = lacunasDaVaga(ficha(), vaga.competencias);
    expect(l.map((x) => x.skillId)).toEqual([id("Kubernetes")]);
    expect(l[0].nome).toBe("Kubernetes");
  });
});

describe("proposta", () => {
  const p = permitidosDaFicha(ficha(), w2, null, NOW);
  it("sem nada que sobreviva, volta para a Ficha W2", () => {
    const r = sanitizarProposta({ resumo: "Domina Python.", destaques: ["Python 10 anos"], carta: "Sei Go e Rust." }, w2, p);
    expect(r.resumo).toBe(w2.resumo);
    expect(r.destaques).toEqual(w2.destaques);
    expect(r.removidos.length).toBeGreaterThanOrEqual(2);
  });
  it("tira contatos da carta", () => {
    const r = sanitizarProposta({ resumo: "Trabalha com AWS.", destaques: [], carta: "Quero a vaga com AWS. Escreva para maria@exemplo.com." }, w2, p);
    expect(r.carta).not.toContain("maria@exemplo.com");
  });
  it("tira qualquer link da carta e do resumo", () => {
    const a = sanitizarAdaptacao({ resumo: "Portfólio em ana.dev/projetos.", destaques: [], carta: "Veja meu portfólio em https://ana.dev/contato e www.ana.com.br, com ASP.NET.", ia: false }, "h", NOW)!;
    expect(a.carta).not.toMatch(/ana\.dev|ana\.com|https?:|LINK/);
    expect(a.carta).toContain("ASP.NET");
    expect(a.resumo).not.toContain("ana.dev");
  });
  it("prompt sem nome nem e-mail e com a regra ética", () => {
    const { sistema, entrada } = promptCoach(ficha(), w2, vaga, "en", NOW);
    expect(entrada).not.toContain("Maria");
    expect(entrada).not.toContain("maria@exemplo.com");
    expect(sistema).toContain("English");
  });
  it("prepararParaVaga chama coach_candidate e trava a resposta", async () => {
    const chat = jest.fn(async () => ({ text: JSON.stringify({ resumo: "Engenheira com AWS. Sabe Python.", destaques: ["Migrou 40 sistemas"], carta: "Quero operar AWS na Beta." }), model: "m" }) as any);
    const r = await prepararParaVaga({ ficha: ficha(), w2, vaga, idioma: "pt-BR", now: NOW }, chat);
    expect((chat.mock.calls[0] as any[])[0]).toBe("coach_candidate");
    expect(r.resumo).toBe("Engenheira com AWS.");
    expect(r.removidos).toEqual(["Sabe Python."]);
    expect(r.carta).toBe("Quero operar AWS na Beta.");
  });
  it("sem JSON, falha", async () => {
    await expect(prepararParaVaga({ ficha: ficha(), w2, vaga, idioma: "pt-BR", now: NOW }, async () => ({ text: "oi" }) as any)).rejects.toThrow();
  });
  it("idioma desconhecido vira pt-BR", () => {
    expect(idiomaCoach("xx")).toBe("pt-BR");
    expect(idiomaCoach("es")).toBe("es");
  });
});

describe("adaptação aprovada (D6)", () => {
  it("limita, tira contatos e exige resumo ou carta", () => {
    const a = sanitizarAdaptacao({ resumo: "x".repeat(900), destaques: ["a", "b", "c", "d"], carta: "Ligue 11 99999-8888", ia: true }, "h1", NOW)!;
    expect(a.resumo.length).toBeLessThanOrEqual(420);
    expect(a.destaques).toHaveLength(3);
    expect(a.carta).not.toContain("99999");
    expect(a.vacancyHash).toBe("h1");
    expect(sanitizarAdaptacao({ resumo: "", carta: "" }, "h", NOW)).toBeNull();
  });
  it("lerAdaptacao guarda a data e não quebra com lixo", () => {
    expect(lerAdaptacao({ resumo: "R", destaques: [], carta: "", ia: false, vacancyHash: "h", criadaEm: "2026-11-20T00:00:00.000Z" })?.criadaEm).toBe("2026-11-20T00:00:00.000Z");
    expect(lerAdaptacao("x")).toBeNull();
    expect(lerAdaptacao({ resumo: "R", criadaEm: 5 })?.resumo).toBe("R");
  });
});

describe("rascunho da tela", () => {
  it("só vai o que está marcado", () => {
    const r = rascunhoDaProposta({ resumo: "R", destaques: ["d1"], carta: "C", removidos: [] });
    expect(adaptacaoDoRascunho(r)).toEqual({ resumo: "R", destaques: ["d1"], carta: "C", ia: true });
    expect(adaptacaoDoRascunho({ ...r, enviarCarta: false })).toEqual({ resumo: "R", destaques: ["d1"], carta: "", ia: true });
    expect(adaptacaoDoRascunho({ ...r, usarVersao: false })).toEqual({ resumo: "", destaques: [], carta: "C", ia: true });
    expect(adaptacaoDoRascunho({ ...r, usarVersao: false, enviarCarta: false })).toBeNull();
  });
  it("do meu jeito começa da W2 sem IA; prévia troca resumo e destaques", () => {
    const m = rascunhoManual(w2);
    expect(m.ia).toBe(false);
    expect(m.destaques).toHaveLength(3);
    expect(w2ComRascunho(w2, { ...m, resumo: "Novo" }).resumo).toBe("Novo");
    expect(w2ComRascunho(w2, null)).toBe(w2);
    expect(rascunhoDe(null)).toBeNull();
    expect(rascunhoDe({ resumo: "", destaques: [], carta: "C", ia: false, vacancyHash: "h", criadaEm: "" })?.enviarCarta).toBe(true);
  });
});
