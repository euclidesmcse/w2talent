/** Linha do tempo, PR c: resumo do CV completo (D4) e o cargo marcado no CV (D3). */
import type { ChatRequest } from "../lib/ai/types";
import { TASKS } from "../lib/ai/tasks";
import { hashResumo, promptResumo, resumoDoCv, sanitizarResumo } from "../lib/cv-resumo";
import { linhaDoCargo } from "../components/cv-completo-acoes";

const CARGOS = [
  { cargo: "Arquiteta Cloud", empresa: "Nuvia", inicio: "2022-03", fim: "", atual: true },
  { cargo: "Analista de Infra", empresa: "Banco Sol", inicio: "2017-01", fim: "2022-02", atual: false },
];
const TEXTO = "Bia\n[EMAIL]\n\nArquiteta Cloud — Nuvia (2022–hoje)\nMigrou 140 sistemas para o Azure.\n\nAnalista de Infra — Banco Sol\nCuidou de 300 servidores Linux.";

function fakeDb() {
  const gravados: unknown[] = [];
  return { gravados, db: { candidateCv: { updateMany: async ({ data }: { data: { resumos: unknown } }) => (gravados.push(data.resumos), { count: 1 }) } } as never };
}

describe("resumo do CV completo", () => {
  it("é tarefa de dado pessoal e o prompt segue as regras de ética, sem contatos", () => {
    expect(TASKS.summarize_cv).toMatchObject({ kind: "chat", json: true, personalData: true });
    const { sistema, entrada } = promptResumo(`${TEXTO}\nbia@exemplo.com`, CARGOS, "en");
    expect(sistema).toMatch(/never invent numbers/);
    expect(sistema).toMatch(/gender/);
    expect(sistema).toMatch(/Write in English/);
    expect(entrada).not.toContain("bia@exemplo.com");
    expect(JSON.parse(entrada).cargos).toHaveLength(2);
  });

  it("um texto por cargo, cortado e sem contatos; sem resumo geral não vale", () => {
    const s = sanitizarResumo({ geral: "Carreira em infraestrutura e nuvem, com migrações grandes.", cargos: ["Migrou 140 sistemas. Fale em bia@x.com", 7, "a mais"] }, 2);
    expect(s!.cargos).toEqual(["Migrou 140 sistemas. Fale em [EMAIL]", ""]);
    expect(sanitizarResumo({ geral: "curto", cargos: [] }, 2)).toBeNull();
    expect(sanitizarResumo(null, 2)).toBeNull();
  });

  it("gera uma vez por idioma e guarda; texto ou cargos novos geram de novo", async () => {
    const pedidos: ChatRequest[] = [];
    const chat = async (_t: "summarize_cv", req: ChatRequest) => {
      pedidos.push(req);
      return { text: JSON.stringify({ geral: "Carreira em infraestrutura e nuvem, com migrações grandes.", cargos: ["Migrou 140 sistemas.", "Cuidou de 300 servidores."] }), model: "m", inputTokens: 1, outputTokens: 1 } as never;
    };
    const { db, gravados } = fakeDb();
    const base = { profileId: "p1", texto: TEXTO, cargos: CARGOS, idioma: "pt-BR", now: new Date("2026-11-20T10:00:00Z") };
    const a = await resumoDoCv(db, { ...base, resumos: null, chat });
    expect(a.novo).toBe(true);
    expect(a.resumo!.cargos).toEqual(["Migrou 140 sistemas.", "Cuidou de 300 servidores."]);
    const guardado = gravados[0];
    // guardado: não chama a IA de novo
    const b = await resumoDoCv(db, { ...base, resumos: guardado, chat });
    expect(b).toMatchObject({ novo: false, resumo: a.resumo });
    // sem chat e sem guardado: nada
    expect(await resumoDoCv(db, { ...base, idioma: "es", resumos: guardado, chat: null })).toEqual({ resumo: null, novo: false });
    // outro idioma: gera e guarda junto
    await resumoDoCv(db, { ...base, idioma: "en", resumos: guardado, chat });
    expect(Object.keys((gravados[1] as { porIdioma: object }).porIdioma).sort()).toEqual(["en", "pt-BR"]);
    // texto novo: o guardado não vale
    expect((await resumoDoCv(db, { ...base, texto: `${TEXTO}\nAZ-305`, resumos: gravados[1], chat })).novo).toBe(true);
    expect(pedidos).toHaveLength(3);
    expect(await hashResumo(TEXTO, CARGOS)).not.toBe(await hashResumo(TEXTO, [CARGOS[0]]));
  });

  it("a IA sem resumo lança (a rota responde erro)", async () => {
    const { db } = fakeDb();
    const chat = async () => ({ text: "{}", inputTokens: 0, outputTokens: 0 }) as never;
    await expect(resumoDoCv(db, { profileId: "p", texto: TEXTO, cargos: CARGOS, idioma: "pt-BR", resumos: null, chat })).rejects.toThrow();
  });

  it("marca no CV a linha da empresa, ou do cargo, sem ligar para acento e maiúscula", () => {
    const linhas = TEXTO.split("\n");
    expect(linhaDoCargo(linhas, CARGOS[1])).toBe(6);
    expect(linhaDoCargo(["ANALISTA DE INFRA na empresa", "x"], { cargo: "Análista de infra", empresa: "Outra" })).toBe(0);
    expect(linhaDoCargo(linhas, { cargo: "", empresa: "" })).toBe(-1);
  });
});
