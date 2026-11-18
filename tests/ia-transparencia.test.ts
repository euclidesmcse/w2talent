// 2.0 Transparência: a página /ia cobre cada uso de IA nos três idiomas.
import * as fs from "fs";
import * as path from "path";
import { CAMPOS_LINHA, EMAIL_REVISAO, LINHAS_IA, hrefIa } from "@/lib/ia-transparencia";
import { isTaskName } from "@/lib/ai/tasks";

const IDIOMAS = ["pt-BR", "en", "es"];
const msgs = (l: string) => JSON.parse(fs.readFileSync(path.join(__dirname, `../messages/${l}.json`), "utf-8")).ia;

describe("2.0 Transparência — /ia", () => {
  it("cada linha tem os quatro textos nos três idiomas", () => {
    for (const l of IDIOMAS) {
      const ia = msgs(l);
      for (const linha of LINHAS_IA) for (const c of CAMPOS_LINHA) expect(ia[`${linha.id}${c}`]).toBeTruthy();
      for (const c of CAMPOS_LINHA) expect(ia[`col${c}`]).toBeTruthy();
    }
  });

  it("âncoras únicas e tarefas que existem no roteador", () => {
    expect(new Set(LINHAS_IA.map((l) => l.ancora)).size).toBe(LINHAS_IA.length);
    for (const l of LINHAS_IA) for (const t of l.tarefas) expect(isTaskName(t)).toBe(true);
    expect(hrefIa("ficha-w2")).toBe("/ia#ficha-w2");
  });

  it("as tarefas de IA usadas nas telas estão documentadas", () => {
    const usadas = new Set(LINHAS_IA.flatMap((l) => l.tarefas));
    for (const t of ["extract_cv", "ficha_w2", "extract_vacancy", "embed"]) expect(usadas.has(t as never)).toBe(true);
  });

  it("o texto de revisão leva o e-mail em todos os idiomas", () => {
    expect(EMAIL_REVISAO).toMatch(/@/);
    for (const l of IDIOMAS) expect(msgs(l).revisao1).toContain("<email></email>");
  });

  it("os selos apontam para âncoras que existem", () => {
    const ancoras = new Set(LINHAS_IA.map((l) => l.ancora));
    for (const arq of ["components/ficha-w2-card.tsx", "components/vagas-parecidas.tsx"]) {
      const src = fs.readFileSync(path.join(__dirname, "..", arq), "utf-8");
      const m = [...src.matchAll(/IaLink ancora="([^"]+)"/g)].map((x) => x[1]);
      expect(m.length).toBeGreaterThan(0);
      for (const a of m) expect(ancoras.has(a)).toBe(true);
    }
  });
});
