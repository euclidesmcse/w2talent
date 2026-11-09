// Menu por área: cada tela mostra só o menu fixo da sua área (lib/nav.ts).
import * as fs from "fs";
import * as path from "path";
import { AREA_NAME, AREA_SWITCH, NAV, areaOf, type Area } from "../lib/nav";

const ROOT = path.join(__dirname, "..");
const pt = JSON.parse(fs.readFileSync(path.join(ROOT, "messages", "pt-BR.json"), "utf-8"));

// tela → endereço
const TELAS: Record<string, string> = {
  "app/page.tsx": "/",
  "app/renovar/page.tsx": "/renovar",
  "app/vagas/page.tsx": "/vagas",
  "app/minha-ficha/page.tsx": "/minha-ficha",
  "app/(app)/minhas-candidaturas/page.tsx": "/minhas-candidaturas",
  "app/candidatos/page.tsx": "/candidatos",
  "app/admin/ia/page.tsx": "/admin/ia",
};

describe("menu por área", () => {
  it("o endereço decide a área", () => {
    expect(areaOf("/")).toBe("publico");
    expect(areaOf("/renovar")).toBe("publico");
    expect(areaOf("/vagas")).toBe("candidato");
    expect(areaOf("/minha-ficha")).toBe("candidato");
    expect(areaOf("/minhas-candidaturas")).toBe("candidato");
    expect(areaOf("/candidatos")).toBe("recrutador");
    expect(areaOf("/admin/ia")).toBe("admin");
    expect(areaOf("/vagasx")).toBe("publico");
  });

  it("nenhum menu de área tem link de outra área", () => {
    for (const area of ["candidato", "recrutador", "admin"] as Area[]) {
      for (const l of NAV[area]) expect([area, l.href, areaOf(l.href)]).toEqual([area, l.href, area]);
    }
  });

  it("o admin não tem link de troca e nenhuma troca aponta para a própria área", () => {
    expect(AREA_SWITCH.admin).toBeUndefined();
    for (const [area, l] of Object.entries(AREA_SWITCH)) expect(areaOf(l!.href)).not.toBe(area);
  });

  it("todo texto do menu existe no catálogo", () => {
    const keys = [
      ...Object.values(NAV).flat().flatMap((l) => [l.key, l.shortKey]),
      ...Object.values(AREA_SWITCH).map((l) => l!.key),
      ...Object.values(AREA_NAME),
    ].filter(Boolean) as string[];
    for (const k of keys) expect([k, typeof pt.nav[k]]).toEqual([k, "string"]);
  });

  it.each(Object.entries(TELAS))("%s usa o menu da sua área, sem lista própria", (file, rota) => {
    const src = fs.readFileSync(path.join(ROOT, file), "utf-8");
    const m = src.match(/<AppHeader[^>]*?\barea="(\w+)"/);
    expect(m?.[1]).toBe(areaOf(rota));
    expect(src).not.toMatch(/<AppHeader[^>]*\bnav=/);
    const ativos = [...src.matchAll(/<AppHeader[^>]*?\bactive="([^"]+)"/g)].map((a) => a[1]);
    for (const a of ativos) expect(a).toBe(rota);
  });
});
