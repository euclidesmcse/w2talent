/** 2.5a convite .ics (RFC 5545). */
import { base64Utf8, dobrar, gerarIcs, textoIcs } from "../lib/ics";

const base = {
  uid: "entrevista-abc@w2talent.com",
  sequencia: 2,
  inicio: new Date("2026-12-01T13:00:00Z"),
  fim: new Date("2026-12-01T13:45:00Z"),
  titulo: "Entrevista: Dev, Cloud; Sênior (Acme)",
  link: "https://meet.example.com/abc",
  organizador: { nome: 'Rita "RH"', email: "rita@acme.com" },
  convidado: { nome: "Ana Souza", email: "ana@exemplo.com" },
  agora: new Date("2026-11-20T10:00:00Z"),
};

describe("gerarIcs", () => {
  it("REQUEST com horários em UTC, alarme de 1 hora e texto escapado", () => {
    const s = gerarIcs({ ...base, metodo: "REQUEST" });
    expect(s.endsWith("\r\n")).toBe(true);
    expect(s).toContain("METHOD:REQUEST\r\n");
    expect(s).toContain("DTSTART:20261201T130000Z\r\n");
    expect(s).toContain("DTEND:20261201T134500Z\r\n");
    expect(s).toContain("SEQUENCE:2\r\n");
    expect(s).toContain("SUMMARY:Entrevista: Dev\\, Cloud\\; Sênior (Acme)\r\n");
    expect(s).toContain("TRIGGER:-PT1H");
    expect(s).toContain('ORGANIZER;CN="Rita  RH":mailto:rita@acme.com');
    expect(s).toContain("STATUS:CONFIRMED");
    expect(s.split("\r\n").filter(Boolean).every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
  });

  it("CANCEL sem alarme e com status cancelado", () => {
    const s = gerarIcs({ ...base, metodo: "CANCEL" });
    expect(s).toContain("METHOD:CANCEL");
    expect(s).toContain("STATUS:CANCELLED");
    expect(s).not.toContain("VALARM");
  });

  it("dobra linhas longas sem quebrar caractere", () => {
    const longa = "DESCRIPTION:" + "ção".repeat(60);
    const d = dobrar(longa);
    const partes = d.split("\r\n");
    expect(partes.length).toBeGreaterThan(1);
    expect(partes.every((p) => new TextEncoder().encode(p).length <= 75)).toBe(true);
    expect(partes.map((p, i) => (i ? p.slice(1) : p)).join("")).toBe(longa);
  });

  it("escapa e codifica em base64 UTF-8", () => {
    expect(textoIcs("a\\b;c,d\ne")).toBe("a\\\\b\\;c\\,d\\ne");
    expect(Buffer.from(base64Utf8("Sênior ✓"), "base64").toString("utf8")).toBe("Sênior ✓");
  });
});
