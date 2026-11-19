/**
 * 3.5a Canal WhatsApp, sem banco: número E.164, código (hash e validade), janela das 8h às 20h de Brasília,
 * corpo dos modelos, envio pela Graph API (ok, repetir, desistir), modo teste e o consumidor da fila.
 */
import {
  CAMINHO_AVISO,
  MODELOS,
  codigoExpirado,
  configDoAmbiente,
  corpoModelo,
  dentroDaJanela,
  destinoPermitido,
  diaDoAviso,
  enviarWhatsapp,
  formatoCodigo,
  gerarCodigo6,
  hashCodigoWhatsapp,
  idiomaWhatsapp,
  limparParametro,
  mascararNumero,
  modoTeste,
  normalizarNumero,
  segundosAteJanela,
  variantesDoNumero,
} from "../lib/whatsapp";
import { ehWhatsapp, processarFila, type QueueMessage, type ResultadoEntrega } from "../lib/fila";

describe("número (E.164)", () => {
  it("Brasil sem +: DDD + celular, com ou sem 55, com máscara e com 0 na frente", () => {
    expect(normalizarNumero("(11) 98765-4321")).toEqual({ ok: true, numero: "+5511987654321" });
    expect(normalizarNumero("11987654321")).toEqual({ ok: true, numero: "+5511987654321" });
    expect(normalizarNumero("5511987654321")).toEqual({ ok: true, numero: "+5511987654321" });
    expect(normalizarNumero("011 98765 4321")).toEqual({ ok: true, numero: "+5511987654321" });
    expect(normalizarNumero("+55 21 99999-0000")).toEqual({ ok: true, numero: "+5521999990000" });
  });

  it("de fora com + ou 00", () => {
    expect(normalizarNumero("+1 (415) 555-0123")).toEqual({ ok: true, numero: "+14155550123" });
    expect(normalizarNumero("0034 612 345 678")).toEqual({ ok: true, numero: "+34612345678" });
    expect(normalizarNumero("+351 912 345 678")).toEqual({ ok: true, numero: "+351912345678" });
  });

  it("recusa vazio, letras, curto, longo, DDD inválido e fixo do Brasil", () => {
    expect(normalizarNumero("")).toEqual({ ok: false, motivo: "vazio" });
    expect(normalizarNumero(undefined)).toEqual({ ok: false, motivo: "vazio" });
    expect(normalizarNumero("11 9876-abcd")).toEqual({ ok: false, motivo: "invalido" });
    expect(normalizarNumero("12345")).toEqual({ ok: false, motivo: "invalido" });
    expect(normalizarNumero("+1234567890123456")).toEqual({ ok: false, motivo: "invalido" });
    expect(normalizarNumero("+55 01 98765-4321")).toEqual({ ok: false, motivo: "invalido" });
    expect(normalizarNumero("(11) 3333-4444")).toEqual({ ok: false, motivo: "fixo" });
    expect(normalizarNumero("+55 11 83333-4444")).toEqual({ ok: false, motivo: "fixo" });
  });

  it("máscara não mostra o número inteiro", () => {
    expect(mascararNumero("+5511987654321")).toBe("+55•••••••4321");
    expect(mascararNumero("+5511987654321")).not.toContain("98765");
    expect(mascararNumero(null)).toBe("•••");
  });

  it("variantes do `from` da Meta: com e sem o 9 no Brasil", () => {
    expect(variantesDoNumero("551187654321").sort()).toEqual(["+551187654321", "+5511987654321"].sort());
    expect(variantesDoNumero("5511987654321").sort()).toEqual(["+551187654321", "+5511987654321"].sort());
    expect(variantesDoNumero("14155550123")).toEqual(["+14155550123"]);
  });
});

describe("código de 6 dígitos", () => {
  it("gera 6 dígitos e confere o formato", () => {
    for (let i = 0; i < 50; i++) expect(gerarCodigo6()).toMatch(/^\d{6}$/);
    expect(formatoCodigo("012345")).toBe(true);
    expect(formatoCodigo("12345")).toBe(false);
    expect(formatoCodigo(123456)).toBe(false);
  });

  it("hash SHA-256 ligado ao perfil e ao número; nunca é o código", async () => {
    const h = await hashCodigoWhatsapp("perfil1", "+5511987654321", "123456");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain("123456");
    expect(await hashCodigoWhatsapp("perfil1", "+5511987654321", "123456")).toBe(h);
    expect(await hashCodigoWhatsapp("perfil2", "+5511987654321", "123456")).not.toBe(h);
    expect(await hashCodigoWhatsapp("perfil1", "+5511987654322", "123456")).not.toBe(h);
  });

  it("validade", () => {
    const now = new Date("2026-11-19T15:00:00Z");
    expect(codigoExpirado(new Date(now.getTime() + 1000), now)).toBe(false);
    expect(codigoExpirado(now, now)).toBe(true);
    expect(codigoExpirado(null, now)).toBe(true);
  });
});

describe("janela das 8h às 20h (Brasília)", () => {
  const d = (s: string) => new Date(s);
  it("dentro e fora", () => {
    expect(dentroDaJanela(d("2026-11-19T11:00:00Z"))).toBe(true); // 08:00
    expect(dentroDaJanela(d("2026-11-19T22:59:59Z"))).toBe(true); // 19:59:59
    expect(dentroDaJanela(d("2026-11-19T10:59:00Z"))).toBe(false); // 07:59
    expect(dentroDaJanela(d("2026-11-19T23:00:00Z"))).toBe(false); // 20:00
  });

  it("espera até as 8h, no máximo 12 horas", () => {
    expect(segundosAteJanela(d("2026-11-19T15:00:00Z"))).toBe(0);
    expect(segundosAteJanela(d("2026-11-19T10:59:00Z"))).toBe(60);
    expect(segundosAteJanela(d("2026-11-19T23:00:00Z"))).toBe(12 * 3600);
    expect(segundosAteJanela(d("2026-11-20T03:30:00Z"))).toBe(7.5 * 3600); // 00:30 → 08:00
  });

  it("dia do aviso: depois das 20h, o dia seguinte; de madrugada, o mesmo dia de Brasília", () => {
    expect(diaDoAviso(d("2026-11-19T15:00:00Z"))).toBe("2026-11-19");
    expect(diaDoAviso(d("2026-11-19T23:30:00Z"))).toBe("2026-11-20");
    expect(diaDoAviso(d("2026-11-20T02:00:00Z"))).toBe("2026-11-20"); // 23:00 do dia 19 em SP → sai dia 20
    expect(diaDoAviso(d("2026-11-20T06:00:00Z"))).toBe("2026-11-20"); // 03:00 do dia 20
  });
});

describe("modelos e envio", () => {
  it("corpo do aviso: nome da vaga e da empresa e o final do link", () => {
    const c = corpoModelo({ numero: "+5511987654321", modelo: MODELOS.vista, idioma: "pt_BR", textos: ["Dev\nBackend", "ACME"], botaoUrl: CAMINHO_AVISO.vista });
    expect(c).toEqual({
      messaging_product: "whatsapp",
      to: "5511987654321",
      type: "template",
      template: {
        name: "w2_candidatura_vista",
        language: { code: "pt_BR" },
        components: [
          { type: "body", parameters: [{ type: "text", text: "Dev Backend" }, { type: "text", text: "ACME" }] },
          { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: "minhas-candidaturas" }] },
        ],
      },
    });
  });

  it("corpo do código: o código no corpo e no botão", () => {
    const c = corpoModelo({ numero: "+14155550123", modelo: MODELOS.codigo, idioma: "en", codigo: "123456" }) as any;
    expect(c.template.name).toBe("w2_codigo");
    expect(c.template.components).toEqual([
      { type: "body", parameters: [{ type: "text", text: "123456" }] },
      { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: "123456" }] },
    ]);
  });

  it("idioma e limpeza dos parâmetros", () => {
    expect(idiomaWhatsapp("en-US")).toBe("en");
    expect(idiomaWhatsapp("es")).toBe("es");
    expect(idiomaWhatsapp(null)).toBe("pt_BR");
    expect(limparParametro("  a\t\tb     c ")).toBe("a b c");
    expect(limparParametro("")).toBe("-");
  });

  it("modo teste sem token ou sem id do número; WHATSAPP_TEST_TO limita os destinos", async () => {
    expect(modoTeste(configDoAmbiente({}))).toBe(true);
    expect(modoTeste(configDoAmbiente({ WHATSAPP_TOKEN: "t" }))).toBe(true);
    expect(modoTeste(configDoAmbiente({ WHATSAPP_TOKEN: "t", WHATSAPP_PHONE_ID: "1" }))).toBe(false);
    const cfg = configDoAmbiente({ WHATSAPP_TOKEN: "t", WHATSAPP_PHONE_ID: "1", WHATSAPP_TEST_TO: "11 98765-4321, lixo, +14155550123" });
    expect(cfg.testTo).toEqual(["+5511987654321", "+14155550123"]);
    expect(destinoPermitido(cfg, "+5511987654321")).toBe(true);
    expect(destinoPermitido(cfg, "+5521999990000")).toBe(false);
    expect(destinoPermitido({ token: "t", phoneId: "1" }, "+5521999990000")).toBe(true);
    const f = jest.fn() as unknown as typeof fetch;
    expect(await enviarWhatsapp({}, { a: 1 }, f)).toEqual({ resultado: "ok", status: null, erro: "modo_teste" });
    expect(f).not.toHaveBeenCalled();
  });

  it("Graph API: 200 ok; 429, 5xx, rede e limite da Meta repetem; o resto desiste", async () => {
    const cfg = { token: "tok-secreto", phoneId: "123" };
    const resp = (status: number, corpo?: unknown) => jest.fn(async () => new Response(corpo ? JSON.stringify(corpo) : null, { status })) as unknown as typeof fetch;
    const ok = resp(200, { messages: [{ id: "wamid.x" }] });
    expect(await enviarWhatsapp(cfg, { x: 1 }, ok)).toEqual({ resultado: "ok", status: 200 });
    const [url, init] = (ok as unknown as jest.Mock).mock.calls[0];
    expect(url).toBe("https://graph.facebook.com/v21.0/123/messages");
    expect(init.headers.authorization).toBe("Bearer tok-secreto");
    expect(init.method).toBe("POST");
    expect(await enviarWhatsapp(cfg, {}, resp(429))).toMatchObject({ resultado: "repetir", status: 429 });
    expect(await enviarWhatsapp(cfg, {}, resp(503))).toMatchObject({ resultado: "repetir", status: 503 });
    expect(await enviarWhatsapp(cfg, {}, resp(400, { error: { code: 130429 } }))).toEqual({ resultado: "repetir", status: 400, erro: "meta_130429" });
    expect(await enviarWhatsapp(cfg, {}, resp(400, { error: { code: 131026 } }))).toEqual({ resultado: "desistir", status: 400, erro: "meta_131026" });
    expect(await enviarWhatsapp(cfg, {}, resp(401))).toEqual({ resultado: "desistir", status: 401, erro: "http_401" });
    const rede = jest.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    expect(await enviarWhatsapp(cfg, {}, rede)).toEqual({ resultado: "repetir", status: null, erro: "rede" });
  });
});

describe("fila: tipo whatsapp", () => {
  const msg = (body: unknown, attempts = 1) => ({ id: "m", body, attempts, ack: jest.fn(), retry: jest.fn() }) as unknown as QueueMessage & { ack: jest.Mock; retry: jest.Mock };
  const wa = { tipo: "whatsapp", avisoId: "aviso1", aviso: "vista" };
  const emailEnv = {};

  it("reconhece só a mensagem com id do aviso", () => {
    expect(ehWhatsapp(wa)).toBe(true);
    expect(ehWhatsapp({ tipo: "whatsapp" })).toBe(false);
    expect(ehWhatsapp({ ...wa, avisoId: "" })).toBe(false);
  });

  it("ok faz ack; repetir volta com espera (ou a da entrega); desistir faz ack; na 10ª desiste", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    const respostas: ResultadoEntrega[] = [
      { resultado: "ok" },
      { resultado: "repetir", status: 500 },
      { resultado: "repetir", erro: "fora_do_horario", atrasoSeg: 3600 },
      { resultado: "desistir", erro: "desligado" },
      { resultado: "repetir", status: 500 },
    ];
    const entregar = jest.fn(async () => respostas.shift()!);
    const [a, b, c, d, e] = [msg(wa), msg(wa, 2), msg(wa), msg(wa), msg(wa, 10)];
    await processarFila({ queue: "notificacoes", messages: [a, b, c, d, e] }, { emailEnv, entregarWebhook: jest.fn(), entregarWhatsapp: entregar, pausa: async () => undefined });
    expect(entregar.mock.calls.map((x: unknown[]) => x[1])).toEqual([1, 2, 1, 1, 10]);
    expect(a.ack).toHaveBeenCalled();
    expect(b.retry).toHaveBeenCalledWith({ delaySeconds: 120 });
    expect(c.retry).toHaveBeenCalledWith({ delaySeconds: 3600 });
    expect(d.ack).toHaveBeenCalled();
    expect(e.ack).toHaveBeenCalled();
    expect(e.retry).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });

  it("erro da rota interna conta como repetir; sem entrega configurada, descarta", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    const quebra = msg(wa);
    await processarFila({ queue: "notificacoes", messages: [quebra] }, { emailEnv, entregarWebhook: jest.fn(), entregarWhatsapp: async () => { throw new Error("x"); } });
    expect(quebra.retry).toHaveBeenCalledWith({ delaySeconds: 60 });
    const sem = msg(wa);
    await processarFila({ queue: "notificacoes", messages: [sem] }, { emailEnv, entregarWebhook: jest.fn() });
    expect(sem.ack).toHaveBeenCalled();
    jest.restoreAllMocks();
  });
});
