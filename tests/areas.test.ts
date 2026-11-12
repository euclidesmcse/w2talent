// Áreas da busca de vagas (ideia do portal emagine, aprovada em 2026-11-12).
import * as fs from "fs";
import * as path from "path";
import { AREAS, acrescentarNaBusca, semCriterioRepetido, skillsDaAreaNaBusca } from "../lib/areas";
import { parseQueryIntent, removeChipFromQuery } from "../lib/query-intent";
import { getSkill } from "../lib/taxonomy";

const ROOT = path.join(__dirname, "..");

describe("áreas da busca", () => {
  it("ids únicos e toda competência existe na taxonomia", () => {
    expect(new Set(AREAS.map((a) => a.id)).size).toBe(AREAS.length);
    for (const a of AREAS) {
      expect(a.skills.length).toBeGreaterThanOrEqual(5);
      for (const id of a.skills) expect([a.id, id, !!getSkill(id)]).toEqual([a.id, id, true]);
    }
  });

  it.each(AREAS.flatMap((a) => a.skills.map((id) => [a.id, id])))("%s: a busca entende %s pelo nome", (_a, id) => {
    const label = getSkill(id)!.label;
    expect(parseQueryIntent(label).skills).toEqual([id]);
    // junto com o que já estava buscado, a competência vira mais um chip
    const q = acrescentarNaBusca("remoto PJ", label);
    const it = parseQueryIntent(q);
    expect(it.skills).toContain(id);
    expect(it.modo).toBe("remoto");
    expect(it.regime).toBe("PJ");
  });

  it("marcar e desmarcar volta à busca de antes", () => {
    const q = acrescentarNaBusca("devops remoto", "Terraform");
    const chip = parseQueryIntent(q).chips.find((c) => c.kind === "skill" && c.value === "terraform")!;
    expect(removeChipFromQuery(q, chip)).toBe("devops remoto");
  });

  it("conta as competências da área que já estão na busca", () => {
    const cloud = AREAS.find((a) => a.id === "cloud")!;
    expect(skillsDaAreaNaBusca(cloud, parseQueryIntent("AWS Kubernetes React").skills)).toBe(2);
    expect(skillsDaAreaNaBusca(cloud, [])).toBe(0);
  });

  it.each(["pt-BR", "en", "es"])("%s tem o nome de toda área", (loc) => {
    const cat = JSON.parse(fs.readFileSync(path.join(ROOT, "messages", `${loc}.json`), "utf-8"));
    for (const a of AREAS) expect([loc, a.id, typeof cat.areas[a.id]]).toEqual([loc, a.id, "string"]);
  });
});

describe("critério repetido não fica escondido", () => {
  it("outro modelo, regime ou nível troca o antigo", () => {
    expect(acrescentarNaBusca("remoto", "presencial")).toBe("presencial");
    expect(acrescentarNaBusca("react remoto PJ", "CLT")).toBe("react remoto CLT");
    const it = parseQueryIntent(acrescentarNaBusca("devops remoto sênior", "pleno"));
    expect([it.modo, it.nivel]).toEqual(["remoto", "Pleno"]);
  });

  it("busca digitada com repetição fica com o primeiro, que é o que a busca entende", () => {
    expect(semCriterioRepetido("remoto presencial react")).toBe("remoto react");
    expect(semCriterioRepetido("React React")).toBe("React");
    expect(semCriterioRepetido("react node remoto")).toBe("react node remoto");
    expect(semCriterioRepetido("")).toBe("");
    // o repetido sai pela posição, sem cortar uma competência mais longa que começa igual
    expect(semCriterioRepetido("Java JavaScript Java")).toBe("Java JavaScript");
    expect(semCriterioRepetido("SQL SQL Server SQL")).toBe("SQL SQL Server");
    expect(semCriterioRepetido("remoto react presencial")).toBe("remoto react");
  });

  it("todo termo que sobra aparece como chip", () => {
    for (const q of ["remoto presencial", "PJ CLT react", "React React vue"]) {
      const limpo = semCriterioRepetido(q);
      const chips = parseQueryIntent(limpo).chips;
      expect(chips.map((c) => c.source).join(" ")).toBe(limpo);
    }
  });
});
