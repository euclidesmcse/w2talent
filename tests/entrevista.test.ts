/** 2.5a Agenda: regras sem banco. */
import { emailsDoEvento, statusVisivel, validarOferta } from "../lib/entrevista";
import { fusoValido, quandoEmail, renderAgendaEmail } from "../lib/email-templates";

const NOW = new Date("2026-11-20T12:00:00Z");
const h = (horas: number) => new Date(NOW.getTime() + horas * 3600_000).toISOString();

describe("validarOferta", () => {
  it("aceita de 3 a 8 horários futuros sem sobreposição e ordena", () => {
    const r = validarOferta({ duracaoMin: 45, horarios: [h(30), h(26), h(28)], linkReuniao: " https://meet.example.com/x " }, NOW);
    expect(r).toMatchObject({ ok: true, duracaoMin: 45, linkReuniao: "https://meet.example.com/x" });
    if (r.ok) expect(r.horarios.map((d) => d.toISOString())).toEqual([h(26), h(28), h(30)]);
  });
  it.each([
    [{ duracaoMin: 20, horarios: [h(26), h(28), h(30)] }, "duracao"],
    [{ duracaoMin: 30, horarios: [h(26), h(28)] }, "horarios_qtd"],
    [{ duracaoMin: 30, horarios: Array.from({ length: 9 }, (_, i) => h(26 + i)) }, "horarios_qtd"],
    [{ duracaoMin: 30, horarios: [h(26), h(28), "amanhã"] }, "horario_invalido"],
    [{ duracaoMin: 30, horarios: [h(26), h(28), new Date(NOW.getTime() + 26 * 3600_000 + 7 * 60_000).toISOString()] }, "horario_invalido"],
    [{ duracaoMin: 30, horarios: [h(0.5), h(28), h(30)] }, "horario_passado"],
    [{ duracaoMin: 30, horarios: [h(26), h(28), h(24 * 61)] }, "horario_longe"],
    [{ duracaoMin: 60, horarios: [h(26), h(26.5), h(30)] }, "horarios_sobrepostos"],
    [{ duracaoMin: 30, horarios: [h(26), h(28), h(30)], linkReuniao: "http://meet.example.com" }, "link_invalido"],
    [{ duracaoMin: 30, horarios: [h(26), h(28), h(30)], linkReuniao: "javascript:alert(1)" }, "link_invalido"],
  ])("recusa %#", (x, erro) => {
    expect(validarOferta(x as any, NOW)).toEqual({ ok: false, erro });
  });
});

describe("statusVisivel", () => {
  it("oferta aberta com todos os horários passados vira expirada", () => {
    expect(statusVisivel({ status: "aberta", horarios: [new Date(h(-2)), new Date(h(-1))] }, NOW)).toBe("expirada");
    expect(statusVisivel({ status: "aberta", horarios: [new Date(h(-2)), new Date(h(1))] }, NOW)).toBe("aberta");
    expect(statusVisivel({ status: "marcada", horarios: [new Date(h(-2))] }, NOW)).toBe("marcada");
  });
});

describe("e-mails da agenda", () => {
  const ctx = {
    entrevistaId: "e1",
    vacancyId: "v1",
    empresa: "Acme <RH>",
    vaga: "Dev & Cloud",
    candidato: { nome: "Ana Souza", email: "ana@exemplo.com", locale: "pt-BR" as const },
    recrutador: { nome: "Rita", email: "rita@acme.com", locale: "en" as const, fuso: "America/New_York" },
    fusoCandidato: "America/Sao_Paulo",
    duracaoMin: 45,
    linkReuniao: null,
    appUrl: "https://w2.test/",
  };
  const inicio = new Date("2026-12-01T13:00:00Z");

  it("convite só para o candidato, com o link de escolher", () => {
    const ms = emailsDoEvento(ctx, { tipo: "convite", urlEscolher: "https://w2.test/agendar?c=XYZ" }, NOW);
    expect(ms).toHaveLength(1);
    expect(ms[0]).toMatchObject({ to: "ana@exemplo.com", idempotencyKey: "entrevista:e1:convite:0:c" });
    expect(ms[0].text).toContain("https://w2.test/agendar?c=XYZ");
    expect(ms[0].html).toContain("Acme &lt;RH&gt;");
    expect(ms[0].attachments).toBeUndefined();
  });

  it("marcada vai para os dois, cada um no seu fuso e idioma, com .ics", () => {
    const ms = emailsDoEvento(ctx, { tipo: "marcada", inicio, sequencia: 0, urlCandidato: "https://w2.test/agendar?c=XYZ" }, NOW);
    expect(ms.map((m) => m.to)).toEqual(["ana@exemplo.com", "rita@acme.com"]);
    expect(ms[0].subject).toContain("10:00"); // 13:00 UTC em São Paulo
    expect(ms[1].subject).toMatch(/08:00|8:00/); // 13:00 UTC em Nova York, em inglês
    expect(ms[1].subject).toContain("Interview booked");
    expect(ms[1].text).toContain("https://w2.test/rh/vagas/v1");
    const ics = Buffer.from(ms[0].attachments![0].content, "base64").toString("utf8");
    expect(ics).toContain("METHOD:REQUEST");
    expect(ics).toContain("UID:entrevista-e1@w2talent.com");
  });

  it("cancelada pelo candidato avisa o recrutador; com horário marcado, .ics de cancelamento para os dois", () => {
    const semHorario = emailsDoEvento(ctx, { tipo: "cancelada", inicio: null, sequencia: 1, porCandidato: true }, NOW);
    expect(semHorario.map((m) => m.to)).toEqual(["rita@acme.com"]);
    const comHorario = emailsDoEvento(ctx, { tipo: "cancelada", inicio, sequencia: 2, porCandidato: true }, NOW);
    expect(comHorario.map((m) => m.to)).toEqual(["ana@exemplo.com", "rita@acme.com"]);
    expect(Buffer.from(comHorario[1].attachments![0].content, "base64").toString("utf8")).toContain("METHOD:CANCEL");
    const peloRh = emailsDoEvento(ctx, { tipo: "cancelada", inicio: null, sequencia: 1, porCandidato: false }, NOW);
    expect(peloRh.map((m) => m.to)).toEqual(["ana@exemplo.com"]);
    expect(peloRh[0].text).toContain("pela empresa");
  });

  it("fuso inválido cai em UTC", () => {
    expect(fusoValido("America/Sao_Paulo")).toBe(true);
    expect(fusoValido("Lua/Base")).toBe(false);
    expect(quandoEmail(inicio, "en", "Lua/Base")).toContain("UTC");
    expect(renderAgendaEmail({ tipo: "marcada", locale: "es", empresa: "A", vagaTitulo: "V", com: "A", duracaoMin: 30, inicio, url: "x" }).subject).toContain("Entrevista agendada");
  });
});

describe("minimoAgendavel", () => {
  it("agora + 65 min, arredondado para cima no múltiplo de 5", async () => {
    const { minimoAgendavel } = await import("../components/agenda-entrevista");
    expect(minimoAgendavel(Date.parse("2026-11-20T12:02:31Z")).toISOString()).toBe("2026-11-20T13:10:00.000Z");
    expect(minimoAgendavel(Date.parse("2026-11-20T12:00:00Z")).toISOString()).toBe("2026-11-20T13:05:00.000Z");
  });
});
