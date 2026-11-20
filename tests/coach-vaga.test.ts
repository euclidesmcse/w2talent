/** Coach IA por vaga: trava contra invenção, lacunas, proposta e o que vai ao aprovar. */
import {
  anosNoCargo,
  avisosIdioma,
  competenciasParaVaga,
  cvBaseDaFicha,
  cvDaTela,
  idiomaCoach,
  lerCv,
  porQueRegra,
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
import { adaptacaoDoRascunho, cvDoRascunho, periodoCargo, pontosDoTexto, rascunhoDaProposta, rascunhoDe, rascunhoManual, w2ComRascunho } from "@/lib/coach-rascunho";
import { trechoDoCargo } from "@/lib/cv-cargo";
import { mensagemCandidatura } from "@/lib/envio";
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
    // decimal com vírgula é um número só
    const com10e5 = { skills: q.skills, numeros: new Set(["10", "5"]) };
    expect(motivoInvencao("Reduziu custos com EC2 em 10,5%.", com10e5)).toBe("10.5");
    expect(motivoInvencao("Reduziu custos com EC2 em 10,5%.", { skills: q.skills, numeros: new Set(["10.5"]) })).toBeNull();
  });
  it("nome com barra conta inteiro (PL/SQL não passa por SQL)", () => {
    const f = ficha();
    f.stack.push({ skillId: id("SQL"), anos: 4 });
    const q = permitidosDaFicha(f, w2, null, NOW);
    expect(motivoInvencao("Domina SQL.", q)).toBeNull();
    expect(motivoInvencao("Domina PL/SQL.", q)).toBe("PL/SQL");
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
    expect(adaptacaoDoRascunho(r)).toEqual({ resumo: "R", destaques: ["d1"], carta: "C", ia: true, porQue: "", cv: null });
    expect(adaptacaoDoRascunho({ ...r, enviarCarta: false })).toEqual({ resumo: "R", destaques: ["d1"], carta: "", ia: true, porQue: "", cv: null });
    expect(adaptacaoDoRascunho({ ...r, usarVersao: false })).toEqual({ resumo: "", destaques: [], carta: "C", ia: true, porQue: "", cv: null });
    expect(adaptacaoDoRascunho({ ...r, usarVersao: false, enviarCarta: false })).toBeNull();
  });
  it("do meu jeito começa da W2 sem IA; prévia troca resumo e destaques", () => {
    const m = rascunhoManual(w2);
    expect(m.ia).toBe(false);
    expect(m.destaques).toHaveLength(3);
    expect(w2ComRascunho(w2, { ...m, resumo: "Novo" }).resumo).toBe("Novo");
    expect(w2ComRascunho(w2, null)).toBe(w2);
    expect(rascunhoDe(null)).toBeNull();
    expect(rascunhoDe({ resumo: "", destaques: [], carta: "C", ia: false, vacancyHash: "h", criadaEm: "", cv: null, porQue: "" })?.enviarCarta).toBe(true);
  });
});

// ── CV reescrito por vaga (plano 2026-11-20 "CV por vaga") ──────────────

function fichaCv(): Ficha {
  const f = ficha();
  f.experiencias = [
    { ...experienciaVazia(), cargo: "Engenheira Cloud", empresa: "Acme", inicio: "2019-03", atual: true, funcoes: ["Migrou 40 sistemas para a nuvem"], skills: [id("AWS")] },
    { ...experienciaVazia(), cargo: "Analista de Infra", empresa: "Beta", inicio: "2012-01", fim: "2019-02", funcoes: ["Cuidou de 1200 servidores"], skills: [id("Docker")] },
  ];
  f.formacao = [{ curso: "Redes", instituicao: "Fatec", ano: "2011" }];
  f.idiomas = [{ idioma: "Inglês", nivel: "basico" }, { idioma: "Espanhol", nivel: "avancado" }];
  return f;
}
const CV = "Acme - Engenheira Cloud\nReduziu o custo de R$700 mil para R$123 mil.\nBeta - Analista de Infra\nCuidou de 1200 servidores Linux.";

describe("CV por vaga: trecho e trava por cargo", () => {
  it("trecho do cargo vai até o próximo cargo", () => {
    const f = fichaCv();
    expect(trechoDoCargo(CV, f.experiencias, 0)).toContain("700 mil");
    expect(trechoDoCargo(CV, f.experiencias, 0)).not.toContain("1200");
    expect(trechoDoCargo(CV, f.experiencias, 1)).toContain("1200");
    expect(trechoDoCargo("", f.experiencias, 0)).toBe("");
  });
  it("ponto com número de outro cargo sai; cargo sem ponto bom fica com as funções", () => {
    const f = fichaCv();
    const p = permitidosDaFicha(f, w2, CV, NOW);
    const obj = {
      resumo: "Engenheira cloud.",
      titulo: "Engenheira Cloud AWS",
      porQue: "Reduziu custos de R$700 mil para R$123 mil na Acme.",
      cargos: [
        { i: 0, pontos: ["Reduziu custo de R$700 mil para R$123 mil", "Cuidou de 1200 servidores", "Mais de 13 anos de carreira"] },
        { i: 1, pontos: ["Usou Kubernetes em 50 clusters"] },
        { i: 9, pontos: ["Cargo que não existe"] },
      ],
    };
    const r = sanitizarProposta(obj, w2, p, { ficha: f, competenciasVaga: vaga.competencias, cvTexto: CV });
    expect(r.cv.cargos).toHaveLength(2);
    expect(r.cv.cargos[0].pontos).toEqual(["Reduziu custo de R$700 mil para R$123 mil"]);
    // 1200 é do outro cargo; 13 anos não está na ficha.
    expect(r.removidos).toEqual(expect.arrayContaining(["Cuidou de 1200 servidores", "Mais de 13 anos de carreira", "Usou Kubernetes em 50 clusters"]));
    expect(r.cv.cargos[1].pontos).toEqual(["Cuidou de 1200 servidores"]);
    expect(r.cv.titulo).toBe("Engenheira Cloud AWS");
    expect(r.porQue).toContain("R$700 mil");
    expect(r.cv.formacao[0].curso).toBe("Redes");
  });
  it("título inventado sai e volta o da ficha", () => {
    const f = fichaCv();
    const r = sanitizarProposta({ titulo: "Especialista Kubernetes" }, w2, permitidosDaFicha(f, w2, null, NOW), { ficha: f, competenciasVaga: [], cvTexto: null });
    expect(r.cv.titulo).toBe("Engenheira Cloud");
    expect(r.removidos).toContain("Especialista Kubernetes");
  });
  it("prompt leva o trecho de cada cargo sem contatos", () => {
    const f = fichaCv();
    const { entrada } = promptCoach(f, w2, vaga, "pt-BR", NOW, CV + "\nmaria@exemplo.com");
    expect(entrada).toContain("trechoCv");
    expect(entrada).toContain("1200");
    expect(entrada).not.toContain("maria@exemplo.com");
  });
  it("competências que a vaga pede vêm primeiro", () => {
    const f = fichaCv();
    expect(competenciasParaVaga(f, [id("Terraform")])[0].nome).toBe("Terraform");
  });
});

describe("CV por vaga: o que vem da tela (D5)", () => {
  it("cargo, empresa e datas saem da ficha; só título e pontos vêm da tela", () => {
    const f = fichaCv();
    const cv = cvDaTela({ titulo: "Novo título", cargos: [{ i: 1, cargo: "CEO", pontos: ["Ponto 1", "maria@exemplo.com"] }, { i: 7, pontos: ["x"] }] }, f, []);
    expect(cv?.cargos).toHaveLength(1);
    expect(cv?.cargos[0].cargo).toBe("Analista de Infra");
    expect(cv?.cargos[0].pontos[0]).toBe("Ponto 1");
    expect(cv?.cargos[0].pontos.join(" ")).not.toContain("maria@");
    expect(cv?.titulo).toBe("Novo título");
    expect(cvDaTela({ cargos: [] }, f, [])).toBeNull();
  });
  it("adaptação só com CV vale; sem ficha, o CV da tela é ignorado", () => {
    const f = fichaCv();
    const input = { cv: { titulo: "", cargos: [{ i: 0, pontos: ["A"] }] } };
    expect(sanitizarAdaptacao(input, "h", NOW, { ficha: f, competenciasVaga: [] })?.cv?.cargos[0].pontos).toEqual(["A"]);
    expect(sanitizarAdaptacao(input, "h", NOW)).toBeNull();
  });
  it("lerAdaptacao guarda o CV e lerCv recusa lixo", () => {
    const f = fichaCv();
    const a = sanitizarAdaptacao({ porQue: "Frase.", cv: { cargos: [{ i: 0, pontos: ["A"] }] } }, "h", NOW, { ficha: f, competenciasVaga: [] })!;
    const lida = lerAdaptacao(JSON.parse(JSON.stringify(a)));
    expect(lida?.cv?.cargos[0].empresa).toBe("Acme");
    expect(lida?.porQue).toBe("Frase.");
    expect(lerCv({ cargos: "x" })).toBeNull();
    expect(lerCv(null)).toBeNull();
  });
  it("rascunho: pontos um por linha, cargo fora não vai, PDF usa a base", () => {
    const f = fichaCv();
    const base = cvBaseDaFicha(f, []);
    const m = rascunhoManual(w2, base);
    expect(m.cv?.cargos).toHaveLength(2);
    const r = { ...m, cv: { ...m.cv!, cargos: m.cv!.cargos.map((c, k) => (k === 1 ? { ...c, incluir: false } : { ...c, texto: "- um\n\n• dois" })) } };
    expect(adaptacaoDoRascunho(r)?.cv).toEqual({ titulo: "Engenheira Cloud", cargos: [{ i: 0, pontos: ["um", "dois"] }] });
    expect(cvDoRascunho(r, base)?.cargos.map((c) => c.empresa)).toEqual(["Acme"]);
    expect(cvDoRascunho({ ...r, usarCv: false }, base)).toBeNull();
    expect(pontosDoTexto("a\nb\nc\nd\ne\nf")).toHaveLength(5);
    // De volta do que foi aprovado: o cargo que ficou fora aparece desmarcado.
    const de = rascunhoDe({ resumo: "", destaques: [], carta: "", ia: false, vacancyHash: "h", criadaEm: "", porQue: "", cv: cvDoRascunho(r, base) }, base);
    expect(de?.cv?.cargos.map((c) => c.incluir)).toEqual([true, false]);
    expect(de?.usarCv).toBe(true);
  });
  it("período do cargo no idioma da tela", () => {
    expect(periodoCargo({ inicio: "2019-03", fim: "", atual: true }, "pt-BR")).toBe("03/2019 – atual");
    expect(periodoCargo({ inicio: "2012-01", fim: "2019-02", atual: false }, "en")).toBe("01/2012 – 02/2019");
  });
});

describe("aviso de idioma e por que se destaca (por regra)", () => {
  const idiomas = fichaCv().idiomas;
  it("vaga pede inglês fluente e a ficha diz básico", () => {
    const a = avisosIdioma(["Inglês fluente para reuniões com o time global"], idiomas);
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ pede: "fluente", tem: "basico" });
  });
  it("entende inglês, C1, e ignora desejável e nível já atendido", () => {
    expect(avisosIdioma(["Fluent English (C1)"], idiomas)[0]?.pede).toBe("fluente");
    expect(avisosIdioma(["Inglês avançado será um diferencial"], idiomas)).toEqual([]);
    expect(avisosIdioma(["Espanhol avançado"], idiomas)).toEqual([]);
    expect(avisosIdioma(["Inglês"], idiomas)).toEqual([]);
  });
  it("cada idioma da linha fica com o seu nível", () => {
    const a = avisosIdioma(["Inglês intermediário e francês fluente"], idiomas);
    expect(a.map((x) => [x.pede, x.tem])).toEqual([
      ["intermediario", "basico"],
      ["fluente", null],
    ]);
  });
  it("por que: competências cobertas e o cargo mais perto", () => {
    const f = fichaCv();
    const q = porQueRegra(f, [id("AWS"), id("Kubernetes")], NOW);
    expect(q).toMatchObject({ bate: 1, total: 2, cargo: "Engenheira Cloud", empresa: "Acme", anos: 7 });
    expect(anosNoCargo(f.experiencias[1], NOW)).toBe(7);
    expect(porQueRegra(fichaVazia(), [id("Kubernetes")], NOW)).toBeNull();
  });
});

describe("e-mail da empresa com o CV da vaga", () => {
  it("leva por que e experiência, sem contatos", () => {
    const f = fichaCv();
    const a = sanitizarAdaptacao({ porQue: "Frase do porquê.", cv: { cargos: [{ i: 0, pontos: ["Ponto da Acme"] }] } }, "h", NOW, { ficha: f, competenciasVaga: [] });
    const perfil = { id: "p", idioma: "pt-BR", ficha: f, w2 } as never;
    const vagaRow = { id: "v", titulo: "SRE", regime: "CLT", company: { nome: "Beta", emailContato: "rh@beta.com" } } as never;
    const m = mensagemCandidatura(perfil, { referencia: "ref", vaga: vagaRow, match: { pct: 80, gaps: [] } as never, adaptacao: a });
    expect(m?.text).toContain("Frase do porquê.");
    expect(m?.text).toContain("Engenheira Cloud · Acme · 03/2019 – atual");
    expect(m?.text).toContain("- Ponto da Acme");
    expect(m?.text).not.toContain("maria@exemplo.com");
    expect(m?.html).toContain("Ponto da Acme");
  });
});
