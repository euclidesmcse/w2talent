// 2.6a-1 — artigos de ajuda: mesmos artigos nos 3 idiomas, módulo gerado em dia, Markdown e links seguros.
import * as fs from "fs";
import * as path from "path";
import { ARTIGOS } from "../lib/ajuda-conteudo";
import { artigo, falaDaTela, hrefSeguro, lerMarkdown, lerTrechos, organizarAjuda, telaDeOrigem } from "../lib/ajuda";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { gerar, SAIDA } = require("../scripts/ajuda-gerar.js");

const IDIOMAS = ["pt-BR", "en", "es"] as const;
const AREAS = ["publico", "candidato", "recrutador"];

/** Caminhos que existem no app (pastas com page.tsx), para conferir os links dos artigos. */
function rotasDoApp(): string[] {
  const raiz = path.join(__dirname, "..", "app");
  const out: string[] = [];
  const andar = (dir: string, rota: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!e.isDirectory() || e.name === "api") continue;
      const nome = e.name.startsWith("(") ? "" : `/${e.name}`;
      const sub = path.join(dir, e.name);
      if (fs.existsSync(path.join(sub, "page.tsx"))) out.push(rota + nome || "/");
      andar(sub, rota + nome);
    }
  };
  out.push("/");
  andar(raiz, "");
  return out;
}

describe("conteúdo da ajuda", () => {
  it("lib/ajuda-conteudo.ts está em dia com content/ajuda", () => {
    expect(fs.readFileSync(SAIDA, "utf-8")).toBe(gerar());
  });

  it("os três idiomas têm os mesmos artigos, com as mesmas áreas, telas e ordem", () => {
    const base = ARTIGOS["pt-BR"].map((a) => [a.slug, a.areas.join(), a.telas.join(), a.ordem]);
    expect(base.length).toBeGreaterThanOrEqual(10);
    for (const l of IDIOMAS) expect(ARTIGOS[l].map((a) => [a.slug, a.areas.join(), a.telas.join(), a.ordem])).toEqual(base);
  });

  it("cada artigo tem título, resumo, áreas conhecidas e corpo", () => {
    for (const l of IDIOMAS)
      for (const a of ARTIGOS[l]) {
        expect(a.titulo.length).toBeGreaterThan(3);
        expect(a.resumo.length).toBeGreaterThan(10);
        expect(a.areas.every((x) => AREAS.includes(x))).toBe(true);
        expect(a.corpo.length).toBeGreaterThan(200);
      }
  });

  it("todo link de artigo leva a uma tela que existe ou a outro artigo", () => {
    const rotas = rotasDoApp();
    const slugs = new Set(ARTIGOS["pt-BR"].map((a) => a.slug));
    for (const l of IDIOMAS)
      for (const a of ARTIGOS[l]) {
        for (const m of a.corpo.matchAll(/\]\(([^)]+)\)/g)) {
          const href = m[1];
          expect(hrefSeguro(href)).toBe(href);
          const caminho = href.split("#")[0];
          // /ajuda/<slug> é artigo; /ajuda/conversa (2.6b-1) é tela.
          if (caminho.startsWith("/ajuda/") && !rotas.includes(caminho)) expect(slugs.has(caminho.slice(7))).toBe(true);
          else expect(rotas).toContain(caminho);
        }
        for (const t of a.telas) expect(rotas).toContain(t);
      }
  });

  it("o artigo de IA conta que a ajuda responde perguntas (2.6a-2)", () => {
    const frase = { "pt-BR": /nesta ajuda/, en: /in this help/, es: /en esta ayuda/ } as const;
    for (const l of IDIOMAS) expect(ARTIGOS[l].find((a) => a.slug === "ia")?.corpo).toMatch(frase[l]);
  });
});

describe("leitura do Markdown", () => {
  it("títulos, parágrafos, listas e tabela", () => {
    const b = lerMarkdown("Intro **forte** e [link](/vagas).\n\n## Título\n\n- um\n- dois\n\n1. a\n2. b\n\n| A | B |\n| --- | --- |\n| 1 | 2 |");
    expect(b.map((x) => x.t)).toEqual(["p", "h2", "ul", "ol", "table"]);
    expect(b[0]).toEqual({ t: "p", trechos: [{ t: "txt", v: "Intro " }, { t: "b", v: "forte" }, { t: "txt", v: " e " }, { t: "a", v: "link", href: "/vagas" }, { t: "txt", v: "." }] });
    expect(b[4]).toMatchObject({ t: "table", linhas: [[[{ t: "txt", v: "1" }], [{ t: "txt", v: "2" }]]] });
  });

  it("link para fora do site ou javascript: vira texto", () => {
    expect(lerTrechos("[x](https://mal.example)")).toEqual([{ t: "txt", v: "x" }]);
    expect(lerTrechos("[x](javascript:alert(1))")).toEqual([{ t: "txt", v: "x" }, { t: "txt", v: ")" }]);
    expect(lerTrechos("[x](//mal.example)")).toEqual([{ t: "txt", v: "x" }]);
  });
});

describe("ordem da lista", () => {
  it("?de=/candidatos põe primeiro os artigos daquela tela", () => {
    const g = organizarAjuda("pt-BR", "/candidatos");
    expect(g.tela).toBe("/candidatos");
    expect(g.destaque.map((a) => a.slug)).toEqual(expect.arrayContaining(["buscar-candidatos", "match"]));
    const resto = [...g.comecar, ...g.candidato, ...g.recrutador].map((a) => a.slug);
    for (const a of g.destaque) expect(resto).not.toContain(a.slug);
  });

  it("sem ?de=, nenhum artigo aparece em dois grupos", () => {
    for (const l of IDIOMAS) {
      const g = organizarAjuda(l, null);
      const slugs = [...g.comecar, ...g.candidato, ...g.recrutador].map((a) => a.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
      expect(slugs.length).toBe(ARTIGOS[l].length);
    }
  });

  it("o match explica que, na busca de vagas, atualização e completude são da vaga", () => {
    expect(artigo("pt-BR", "match")?.corpo).toMatch(/olham para a vaga/);
    expect(artigo("en", "match")?.corpo).toMatch(/look at the job/);
    expect(artigo("es", "match")?.corpo).toMatch(/miran la vacante/);
  });

  it("subtela conta como a tela; o início só vale para /", () => {
    const aprovar = artigo("pt-BR", "aprovar-e-enviar")!;
    expect(falaDaTela(aprovar, "/vagas/aprovar")).toBe(true);
    expect(falaDaTela(artigo("pt-BR", "o-que-e")!, "/vagas")).toBe(false);
  });

  it("origem estranha é ignorada; idioma desconhecido cai no pt-BR", () => {
    expect(telaDeOrigem("https://mal.example")).toBeNull();
    expect(telaDeOrigem("/vagas?q=x")).toBe("/vagas");
    expect(organizarAjuda("fr", null).destaque).toEqual([]);
    expect(artigo("fr", "match")?.titulo).toBe(artigo("pt-BR", "match")?.titulo);
  });
});
