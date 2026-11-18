/** 3.4a Integração com ATS: assinatura, endereço, corpo sem contato e o consumidor da fila (sem banco). */
import { createHmac } from "crypto";
import { assinar, cabecalhosAssinados, dadosDaCandidatura, deveRepetir, gerarSegredo, validarUrlWebhook } from "../lib/webhook";
import { atrasoWebhook, ehWebhook, processarFila, type MensagemWebhook, type QueueMessage, type ResultadoEntrega } from "../lib/fila";
import type { EmailMessage } from "../lib/email";

describe("assinatura", () => {
  it("HMAC-SHA256 em hex de `${t}.${corpo}` (vetor conhecido)", async () => {
    // printf '%s' '1700000000.{"event":"teste"}' | openssl dgst -sha256 -hmac 'whsec_test'
    expect(await assinar("whsec_test", 1700000000, '{"event":"teste"}')).toBe("455af880d3c1cc8ac30923d9382497082b4314e302b1bccd9907309c40148d02");
  });

  it("cabeçalhos com evento, id e assinatura t=,v1= que o receptor confere", async () => {
    const segredo = gerarSegredo();
    expect(segredo).toMatch(/^whsec_[0-9a-f]{64}$/);
    expect(gerarSegredo()).not.toBe(segredo);
    const corpo = JSON.stringify({ event: "candidatura.recebida", id: "evt_1" });
    const h = await cabecalhosAssinados(segredo, "candidatura.recebida", "evt_1", corpo, new Date("2026-11-18T12:00:00Z"));
    expect(h["x-w2talent-event"]).toBe("candidatura.recebida");
    expect(h["x-w2talent-delivery"]).toBe("evt_1");
    expect(h["content-type"]).toBe("application/json");
    const m = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(h["x-w2talent-signature"]);
    expect(m).not.toBeNull();
    expect(m![1]).toBe(String(Date.UTC(2026, 10, 18, 12) / 1000));
    expect(m![2]).toBe(createHmac("sha256", segredo).update(`${m![1]}.${corpo}`).digest("hex"));
  });
});

describe("endereço do webhook", () => {
  it("aceita https público", () => {
    expect(validarUrlWebhook(" https://ats.empresa.com.br/w2?x=1#frag ")).toEqual({ ok: true, url: "https://ats.empresa.com.br/w2?x=1" });
    expect(validarUrlWebhook("https://8.8.8.8/hook")).toMatchObject({ ok: true });
    expect(validarUrlWebhook("https://ats.empresa.com:443/a")).toMatchObject({ ok: true });
  });

  it.each([
    ["", "vazia"],
    ["não é url", "invalida"],
    ["http://ats.empresa.com/hook", "https"],
    ["ftp://ats.empresa.com/hook", "https"],
    ["https://user:senha@ats.empresa.com/hook", "credenciais"],
    ["https://ats.empresa.com:8443/hook", "porta"],
    ["https://localhost/hook", "host_privado"],
    ["https://api.localhost/hook", "host_privado"],
    ["https://intranet/hook", "host_privado"],
    ["https://servidor.local/hook", "host_privado"],
    ["https://servidor.internal/hook", "host_privado"],
    ["https://127.0.0.1/hook", "host_privado"],
    ["https://2130706433/hook", "host_privado"], // 127.0.0.1 em decimal
    ["https://0x7f.1/hook", "host_privado"],
    ["https://10.1.2.3/hook", "host_privado"],
    ["https://172.16.0.1/hook", "host_privado"],
    ["https://172.31.255.255/hook", "host_privado"],
    ["https://192.168.0.10/hook", "host_privado"],
    ["https://169.254.169.254/latest/meta-data", "host_privado"],
    ["https://100.64.0.1/hook", "host_privado"],
    ["https://0.0.0.0/hook", "host_privado"],
    ["https://[::1]/hook", "host_privado"],
    ["https://[fd00::1]/hook", "host_privado"],
    ["https://[::ffff:127.0.0.1]/hook", "host_privado"],
    [`https://a.com/${"x".repeat(500)}`, "longa"],
  ])("recusa %s (%s)", (url, motivo) => {
    expect(validarUrlWebhook(url)).toEqual({ ok: false, motivo });
  });

  it("172.32.x e 11.x são públicos", () => {
    expect(validarUrlWebhook("https://172.32.0.1/")).toMatchObject({ ok: true });
    expect(validarUrlWebhook("https://11.0.0.1/")).toMatchObject({ ok: true });
  });
});

describe("corpo do evento", () => {
  const candidato = {
    id: "cand-1",
    nome: "Beatriz Souza Lima",
    email: "bia@exemplo.com",
    celular: "+5511988887777",
    links: ["https://linkedin.example/bia"],
    titulo: "Analista Cloud",
    senioridade: "pleno",
    localidade: "Recife",
    modo: "remoto",
    regimePreferido: ["CLT", "PJ"],
    pretensoes: [
      { regime: "CLT", valor: 9000, unidade: "mes", moeda: "BRL" },
      { regime: "PJ", valor: 13000, unidade: "mes", moeda: "BRL" },
    ],
    stack: [{ skillId: "aws", anos: 4 }],
    fichaW2: { resumo: "Analista cloud.", destaques: ["Migrou 30 servidores"], idioma: "pt-BR", geradaEm: "2026-11-01T00:00:00Z", editada: false },
  };
  const linha = (contatoLiberadoEm: Date | null) => ({
    id: "app-1",
    proxyThreadId: "w2c_abc",
    createdAt: new Date("2026-11-18T10:00:00Z"),
    etapa: "nova",
    contatoLiberadoEm,
    vacancy: { id: "vaga-1", titulo: "Analista Cloud", nivel: "Pleno", regime: "PJ", localidade: "Remoto", faixaDe: 10000, faixaAte: 15000, faixaMoeda: "BRL", stack: [{ skillId: "aws" }, { skillId: "terraform" }], updatedAt: new Date() },
    candidate: candidato,
  });

  it("recebida: vaga, candidatura com match e Ficha W2 sem e-mail, telefone nem links", () => {
    const d = dadosDaCandidatura(linha(null) as any, Date.parse("2026-11-18T12:00:00Z"));
    const texto = JSON.stringify(d);
    expect(texto).not.toContain("bia@exemplo.com");
    expect(texto).not.toContain("98888");
    expect(texto).not.toContain("linkedin");
    expect(d).toMatchObject({
      vaga: { id: "vaga-1", titulo: "Analista Cloud", nivel: "Pleno", regime: "PJ", localidade: "Remoto", faixa: { de: 10000, ate: 15000, moeda: "BRL" } },
      candidatura: { id: "app-1", referencia: "w2c_abc", enviada_em: "2026-11-18T10:00:00.000Z", etapa: "nova" },
      candidato: { id: "cand-1", titulo: "Analista Cloud", contato: null, ficha_w2: { resumo: "Analista cloud.", destaques: ["Migrou 30 servidores"] } },
    });
    const c = d.candidato as Record<string, unknown>;
    expect(c).not.toHaveProperty("email");
    expect(c).not.toHaveProperty("celular");
    expect(c).not.toHaveProperty("links");
    // a vaga é PJ: vai só a pretensão PJ, como na tela "O que a empresa vai receber"
    expect(c.pretensoes).toEqual([{ regime: "PJ", valor: 13000, unidade: "mes", moeda: "BRL" }]);
    const m = (d.candidatura as { match: { pct: number; gaps: { kind: string; skill?: string }[] } }).match;
    expect(m.pct).toBeGreaterThan(0);
    expect(m.gaps).toContainEqual(expect.objectContaining({ kind: "skill", skill: "terraform" }));
  });

  it("contato só depois de liberado (2.4c)", () => {
    const d = dadosDaCandidatura(linha(new Date()) as any, Date.now());
    expect((d.candidato as { contato: unknown }).contato).toEqual({ email: "bia@exemplo.com", celular: "+5511988887777" });
  });
});

describe("consumidor da fila", () => {
  const msg = (body: unknown, attempts = 1) => {
    const m = { id: `m${Math.random()}`, body, attempts, ack: jest.fn(), retry: jest.fn() };
    return m as QueueMessage & { ack: jest.Mock; retry: jest.Mock };
  };
  const webhook: MensagemWebhook = { tipo: "webhook", evento: "candidatura.recebida", id: "evt_1", companyId: "c1", applicationId: "a1", occurredAt: "2026-11-18T12:00:00Z" };
  const email: EmailMessage & { tipo: "email" } = { tipo: "email", to: "rh@x.example", subject: "Oi", html: "<p>Oi</p>", text: "Oi", idempotencyKey: "k1" };

  function deps(entregas: ResultadoEntrega[], resend: Response[] = []) {
    const fetch = jest.fn(async () => resend.shift() ?? new Response("{}", { status: 200 }));
    const entregar = jest.fn(async () => entregas.shift() ?? { resultado: "ok" as const });
    return { fetch, entregar, deps: { emailEnv: { apiKey: "re_x", mode: "real", fetch: fetch as unknown as typeof globalThis.fetch }, entregarWebhook: entregar, pausa: async () => {} } };
  }

  it("reconhece a mensagem de webhook", () => {
    expect(ehWebhook(webhook)).toBe(true);
    expect(ehWebhook({ ...webhook, evento: "outro" })).toBe(false);
    expect(ehWebhook(email)).toBe(false);
  });

  it("e-mail continua indo pelo Resend, com nova tentativa em 5xx e ack no sucesso", async () => {
    const { fetch, entregar, deps: d } = deps([], [new Response("{}", { status: 200 }), new Response("{}", { status: 500 })]);
    const ok = msg(email);
    const falha = msg(email);
    await processarFila({ queue: "notificacoes", messages: [ok, falha] }, d);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(String((fetch.mock.calls[0] as unknown[])[0])).toContain("api.resend.com");
    expect(entregar).not.toHaveBeenCalled();
    expect(ok.ack).toHaveBeenCalled();
    expect(falha.retry).toHaveBeenCalledWith({ delaySeconds: 300 });
  });

  it("webhook: ok faz ack; repetir volta com espera crescente; desistir faz ack", async () => {
    const { fetch, entregar, deps: d } = deps([{ resultado: "ok", status: 200 }, { resultado: "repetir", status: 500 }, { resultado: "desistir", status: 404 }, { resultado: "repetir", status: 429, atrasoSeg: 120 }]);
    const a = msg(webhook);
    const b = msg(webhook, 3);
    const c = msg(webhook);
    const e = msg(webhook, 2);
    await processarFila({ queue: "notificacoes", messages: [a, b, c, e] }, d);
    expect(fetch).not.toHaveBeenCalled();
    expect(entregar.mock.calls.map((x: unknown[]) => x[1])).toEqual([1, 3, 1, 2]);
    expect(entregar.mock.calls[0]).toEqual([webhook, 1]);
    expect(a.ack).toHaveBeenCalled();
    expect(b.retry).toHaveBeenCalledWith({ delaySeconds: 240 });
    expect(b.ack).not.toHaveBeenCalled();
    expect(c.ack).toHaveBeenCalled();
    expect(c.retry).not.toHaveBeenCalled();
    expect(e.retry).toHaveBeenCalledWith({ delaySeconds: 120 });
  });

  it("webhook: na 10ª tentativa desiste; erro da rota interna conta como repetir", async () => {
    const { deps: d } = deps([{ resultado: "repetir", status: 503 }]);
    const ultima = msg(webhook, 10);
    await processarFila({ queue: "notificacoes", messages: [ultima] }, d);
    expect(ultima.ack).toHaveBeenCalled();
    expect(ultima.retry).not.toHaveBeenCalled();

    const quebra = msg(webhook);
    await processarFila({ queue: "notificacoes", messages: [quebra] }, { ...d, entregarWebhook: async () => { throw new Error("x"); } });
    expect(quebra.retry).toHaveBeenCalledWith({ delaySeconds: 60 });
  });

  it("formato desconhecido é descartado", async () => {
    const { deps: d } = deps([]);
    const m = msg({ tipo: "outro" });
    await processarFila({ queue: "notificacoes", messages: [m] }, d);
    expect(m.ack).toHaveBeenCalled();
  });

  it("espera: 1, 2, 4... minutos, no máximo 1 hora; repete só rede, 5xx e 429", () => {
    expect([1, 2, 3, 6, 7, 10].map(atrasoWebhook)).toEqual([60, 120, 240, 1920, 3600, 3600]);
    expect([null, 500, 502, 429].every(deveRepetir)).toBe(true);
    expect([200, 301, 400, 401, 404, 410].some(deveRepetir)).toBe(false);
  });
});
