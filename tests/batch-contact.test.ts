// Step 1 TDD — deve FALHAR antes da implementação (depois PASS) — Task 8
import * as fs from "fs";
import * as path from "path";
import { NextRequest } from "next/server";

// Os webhooks exigem o segredo também nos testes (sem atalho por NODE_ENV).
const WEBHOOK_TEST_SECRET = "test-webhook-secret";
process.env.CRON_SECRET = WEBHOOK_TEST_SECRET;

describe("Contato RH em Lote — Task 8 (1 Template + Preview)", () => {
  // logContactConsent grava em background; espera terminar antes do Jest encerrar
  afterAll(async () => {
    await require("../lib/proxy").flushContactConsentWrites?.();
  });
  const rhId = "rh_test_001";
  const companyId = "comp_test_001";
  let mod: any;
  let routeMod: any;

  beforeEach(() => {
    jest.resetModules();
    try { const p = require("../lib/proxy"); p.clearAllForTests?.(); } catch {}
    mod = require("../lib/proxy");
    try { routeMod = require("../app/api/contacts/batch/route"); } catch { routeMod = null; }
  });

  function seedCandidates(n = 5) {
    for (let i = 1; i <= n; i++) {
      mod.seedCandidate({
        userId: `cand_${i}`,
        nome: `Candidato ${i}`,
        titulo: `Eng Cloud ${i}`,
        email: `cand${i}@example.com`,
        celular: `+55119990000${String(i).padStart(2, "0")}`,
        objetivoCrescimento: "Crescer para sênior",
        stack: [{ skillId: "aws" }],
      });
    }
    // also ensure vacancy mock not needed
  }

  async function postContacts(body: any) {
    if (!routeMod) return { res: { status: 500 } as any, json: { error: "route not loaded" }, status: 500 };
    const req = new NextRequest("http://localhost/api/contacts/batch", {
      method: "POST",
      headers: { "content-type": "application/json", "x-rh-id": rhId, "x-company-id": companyId },
      body: JSON.stringify({ companyId, rhId, ...body }),
    });
    const POST = routeMod.POST ?? routeMod.handleBatchPOST ?? routeMod.default;
    const res = await POST(req);
    const json = await res.json().catch(() => ({} as any));
    return { res, json, status: res.status };
  }

  describe("1. RH seleciona 5 CVs, 1 subject/body cria 5 threads proxy separadas (mock Resend 5 chamadas)", () => {
    it("5 candidatos com 1 template cria 5 threads únicas e 5 e-mails via proxy", async () => {
      seedCandidates(5);
      expect(routeMod).toBeTruthy();
      expect(typeof routeMod.POST).toBe("function");
      const ids = ["cand_1","cand_2","cand_3","cand_4","cand_5"];
      const { status, json } = await postContacts({ candidateIds: ids, subject: "Oportunidade Cloud Remota", body: "Olá, temos vaga Cloud Sr remota 12k CLT..." });
      expect([200,201,207].includes(status)).toBe(true);
      expect(json.results).toBeDefined();
      expect(json.results.length).toBe(5);
      const ok = json.results.filter((r: any) => r.status === "enviado" || r.status === "sent");
      expect(ok.length).toBe(5);
      for (const r of ok) {
        expect(r.proxyThreadId).toBeTruthy();
        expect(r.proxyThreadId).toMatch(/thr_/);
      }
      const threads = ok.map((r: any) => r.proxyThreadId);
      expect(new Set(threads).size).toBe(5);
      // diferencia de batch-apply: origem contatoLote, sem vacancyId
      for (const r of ok) {
        expect(r.candidateId).toBeTruthy();
      }
      // mock Resend 5 chamadas
      expect(mod.sentEmails.length).toBe(5);
      for (const e of mod.sentEmails) {
        expect(e.from).toMatch(/@via\./);
        expect(e.proxyThreadId).toMatch(/thr_/);
        // contact e-mail tem subject/body do template
        expect(e.subject).toBeTruthy();
        expect(e.body).toBeTruthy();
      }
      // threads armazenadas
      expect(mod.applicationStore.size >= 5 || mod.contactStore?.size >= 5 || mod.applicationByThread.size >= 5).toBe(true);
    });

    it("cada thread tem origem contatoLote e companyId do RH", async () => {
      seedCandidates(3);
      const ids = ["cand_1","cand_2","cand_3"];
      const { json } = await postContacts({ candidateIds: ids, subject: "Subj", body: "Body" });
      const ok = json.results.filter((r: any) => r.status === "enviado");
      expect(ok.length).toBe(3);
      // verifica store: proxyThreadId -> app com origem contatoLote
      for (const r of ok) {
        const app = mod.applicationByThread.get(r.proxyThreadId) ?? mod.contactByThread?.get(r.proxyThreadId);
        expect(app).toBeTruthy();
        if (app) {
          expect(app.origem).toBe("contatoLote");
          expect(app.companyId).toBe(companyId);
        }
      }
    });
  });

  describe("2. IA sugere subject/body se não informado", () => {
    it("sem subject/body, IA sugere valores não vazios e envia mesmo assim", async () => {
      seedCandidates(2);
      // sujeito/body vazios -> IA gera
      const ids = ["cand_1","cand_2"];
      const { status, json } = await postContacts({ candidateIds: ids, subject: "", body: "" });
      expect([200,201,207].includes(status)).toBe(true);
      expect(json.results.length).toBe(2);
      const ok = json.results.filter((r: any) => r.status === "enviado");
      expect(ok.length).toBe(2);
      // cada e-mail deve ter subject/body sugeridos (não vazio)
      expect(mod.sentEmails.length).toBe(2);
      for (const e of mod.sentEmails) {
        expect(e.subject.length).toBeGreaterThan(5);
        expect(e.body.length).toBeGreaterThan(10);
      }
      // subject/body sugeridos também retornados no result?
      // ao menos e-mails têm conteúdo IA
      expect(mod.sentEmails[0].subject.toLowerCase()).toMatch(/oportunidade|vaga|convite|cloud|engenheir/i);
    });

    it("lib/proxy expõe suggestContactContent e route usa quando vazio", async () => {
      expect(typeof mod.suggestContactContent).toBe("function");
      const cand = { userId: "cand_x", nome: "João", titulo: "Eng Cloud", email: "j@x.com", celular: "+5511999999999", stack:[{skillId:"aws"}] };
      const sug = mod.suggestContactContent(cand, companyId);
      expect(sug).toBeTruthy();
      expect(typeof sug.subject).toBe("string");
      expect(sug.subject.length).toBeGreaterThan(3);
      expect(typeof sug.body).toBe("string");
      expect(sug.body.length).toBeGreaterThan(10);
      // route file contém chamada LLM/geração quando vazio
      const routeSrc = fs.readFileSync(path.join(__dirname, "../app/api/contacts/batch/route.ts"), "utf-8");
      expect(routeSrc.toLowerCase()).toMatch(/suggest|ia|llm|subject.*body|generate/);
    });

    it("se informar só subject, IA completa body e vice-versa", async () => {
      seedCandidates(1);
      mod.clearAllForTests?.();
      seedCandidates(1);
      const r1 = await postContacts({ candidateIds: ["cand_1"], subject: "Assunto custom", body: "" });
      expect(r1.json.results[0].status).toBe("enviado");
      expect(mod.sentEmails[0].subject).toBe("Assunto custom");
      // IA completa body quando só subject informado
      expect(mod.sentEmails[0].body.length).toBeGreaterThan(20);
      expect(mod.sentEmails[0].body.toLowerCase()).toMatch(/olá|oportunidade|perfil/);

      mod.clearAllForTests?.();
      seedCandidates(1);
      const r2 = await postContacts({ candidateIds: ["cand_1"], subject: "", body: "Corpo custom suficiente longo" });
      expect(r2.json.results[0].status).toBe("enviado");
      expect(mod.sentEmails[0].body).toMatch(/Corpo custom suficiente longo/);
      expect(mod.sentEmails[0].subject.length).toBeGreaterThan(5);
    });
  });

  describe("3. limite 10/lote 30/dia RH; mascarado até envio", () => {
    it("11 candidatos no mesmo lote -> 400 limite 10", async () => {
      seedCandidates(11);
      const ids = Array.from({ length: 11 }, (_, i) => `cand_${i + 1}`);
      // seed extra candidates beyond 5
      for (let i = 6; i <= 11; i++) mod.seedCandidate({ userId: `cand_${i}`, nome:`C ${i}`, titulo:"Eng", email:`c${i}@x.com`, celular:`+5511999000${i}` });
      const { status, json } = await postContacts({ candidateIds: ids, subject:"S", body:"B corpo longo suficiente" });
      expect(status).toBe(400);
      expect((json.error ?? "").toLowerCase()).toMatch(/limite.*10|10.*lote/);
    });

    it("31º contato no dia -> 429", async () => {
      // cria 30 candidatos
      for (let i = 1; i <= 32; i++) mod.seedCandidate({ userId: `cand_d${i}`, nome:`D${i}`, titulo:"Eng", email:`d${i}@x.com`, celular:`+5511999000${String(i).padStart(2,"0")}` });
      // 3 lotes de 10 = 30
      for (let batch = 0; batch < 3; batch++) {
        const ids = Array.from({ length: 10 }, (_, j) => `cand_d${1 + batch*10 + j}`);
        const r = await postContacts({ candidateIds: ids, subject:"S", body:"B longo suficiente para enviar" });
        expect([200,201].includes(r.status)).toBe(true);
      }
      expect(mod.getDailyCount(companyId) === 30 || mod.getDailyCount(rhId) === 30 || mod.sentEmails.length === 30).toBe(true);
      const blocked = await postContacts({ candidateIds: ["cand_d31"], subject:"S", body:"B longo" });
      expect(blocked.status).toBe(429);
      expect((blocked.json.error ?? "").toLowerCase()).toMatch(/limite diário|30\/dia|30|diário/);
    });

    it("mascarado até envio: search maskEmail/maskPhone e contact sem resposta mantém mascarado", async () => {
      // search mask helpers existem
      const search = require("../lib/search");
      expect(typeof search.maskEmail).toBe("function");
      expect(typeof search.maskPhone).toBe("function");
      expect(search.maskEmail("cand@example.com")).toMatch(/\*\*\*.*🔒/);
      expect(search.maskPhone("+5511999999999")).toMatch(/\*\*\*.*🔒/);

      seedCandidates(1);
      mod.clearAllForTests?.();
      seedCandidates(1);
      const { json } = await postContacts({ candidateIds: ["cand_1"], subject:"S", body:"B longo suficiente" });
      const thread = json.results[0].proxyThreadId;
      const app = mod.applicationByThread.get(thread);
      expect(app.status).toBe("enviado");
      // antes de responder, contato direto deve estar mascarado (helper)
      if (typeof mod.isContactMasked === "function") {
        expect(mod.isContactMasked(thread)).toBe(true);
      }
      if (typeof mod.getDirectContact === "function") {
        const masked = mod.getDirectContact("cand_1", companyId, thread);
        // se ainda mascarado, email contém ***
        expect(typeof masked).toBe("object");
        if (masked.masked) expect(masked.email).toMatch(/\*\*\*/);
      }
      // lista API deve retornar masked flag enquanto não respondido
      expect(json.results[0].masked ?? true).not.toBe(false); // default masked
      // verifica route src menciona mascarado/cadeado/LGPD
      const routeSrc = fs.readFileSync(path.join(__dirname, "../app/api/contacts/batch/route.ts"), "utf-8");
      expect(routeSrc.toLowerCase()).toMatch(/mascar|mask|🔒|lgpd|proxy/);
    });
  });

  describe("4. resposta do candidato no proxy libera contato direto (B) e loga consentimento", () => {
    it("PATCH reply libera contato direto e loga consentimento", async () => {
      seedCandidates(1);
      mod.clearAllForTests?.();
      seedCandidates(1);
      const { json } = await postContacts({ candidateIds: ["cand_1"], subject:"S", body:"B longo suficiente" });
      const thread = json.results[0].proxyThreadId;
      expect(thread).toBeTruthy();
      // antes: mascarado
      expect(mod.applicationByThread.get(thread).status).toBe("enviado");
      // simula resposta do candidato via proxy (reply event)
      // webhook PATCH /api/contacts/batch {proxyThreadId, event:"reply"} ou "respondido"
      const PATCH = routeMod.PATCH;
      expect(typeof PATCH).toBe("function");
      const reqReply = new NextRequest("http://localhost/api/contacts/batch", {
        method: "PATCH",
        headers: { "content-type":"application/json", "x-webhook-secret": WEBHOOK_TEST_SECRET },
        body: JSON.stringify({ proxyThreadId: thread, event: "reply" }),
      });
      const resReply = await PATCH(reqReply);
      expect(resReply.status).toBe(200);
      const jsonReply: any = await resReply.json();
      expect(jsonReply.status).toBe("respondido");
      expect(mod.applicationByThread.get(thread).status).toBe("respondido");
      // agora contato direto liberado
      if (typeof mod.isContactMasked === "function") {
        expect(mod.isContactMasked(thread)).toBe(false);
      }
      if (typeof mod.getDirectContact === "function") {
        const direct = mod.getDirectContact("cand_1", companyId, thread);
        expect(direct.masked).toBe(false);
        expect(direct.email).toBe("cand1@example.com");
        expect(direct.celular).toBeTruthy();
      }
      // consent logado
      // proxy deve ter logado consentimento contatoProxy
      if (Array.isArray(mod.consentLogs)) {
        const found = mod.consentLogs.find((c: any) => c.tipo === "contatoProxy" || c.tipo.includes("contato"));
        // pode ser por thread; pelo menos um log existe após reply
        expect(mod.consentLogs.length).toBeGreaterThan(0);
      } else if (typeof mod.getConsentLogs === "function") {
        const logs = mod.getConsentLogs();
        expect(logs.length).toBeGreaterThan(0);
      } else {
        // fallback: route src deve mencionar consent log
        const proxySrc = fs.readFileSync(path.join(__dirname, "../lib/proxy.ts"), "utf-8");
        expect(proxySrc.toLowerCase()).toMatch(/consent|contatoproxy|baselegal|consentlog/);
      }
      // helper direto handleProxyWebhook com respondido também libera
      // testa segundo candidato com handleProxyWebhook
      seedCandidates(1);
      mod.clearAllForTests?.();
      // after clear, need fresh contact
      mod.seedCandidate({ userId:"cand_2", nome:"C2", titulo:"Eng", email:"c2@x.com", celular:"+5511999999998" });
      const r2 = await postContacts({ candidateIds:["cand_2"], subject:"S", body:"B longo suficiente" });
      const thr2 = r2.json.results[0].proxyThreadId;
      const viaHelper = mod.handleProxyWebhook(thr2, "respondido");
      expect(viaHelper.status).toBe("respondido");
    });

    it("arquivos existem e contêm contrato esperado", () => {
      expect(fs.existsSync(path.join(__dirname, "../lib/proxy.ts"))).toBe(true);
      expect(fs.existsSync(path.join(__dirname, "../app/api/contacts/batch/route.ts"))).toBe(true);
      expect(fs.existsSync(path.join(__dirname, "../components/contact-batch-modal.tsx"))).toBe(true);
      const modalSrc = fs.readFileSync(path.join(__dirname, "../components/contact-batch-modal.tsx"), "utf-8");
      expect(modalSrc).toMatch(/subject|Subject|template/i);
      expect(modalSrc).toMatch(/preview|Preview|expansível|expand/i);
      expect(modalSrc).toMatch(/personaliza|personaliz/i);
      expect(modalSrc).toMatch(/lote|batch|contatar/i);
      const batchSrc = fs.readFileSync(path.join(__dirname, "../app/api/contacts/batch/route.ts"), "utf-8");
      expect(batchSrc).toMatch(/candidateIds/);
      expect(batchSrc).toMatch(/BATCH_LIMIT|10/);
      expect(batchSrc).toMatch(/DAILY_LIMIT|30/);
      expect(batchSrc).toMatch(/proxyThreadId|PROXY_DOMAIN|via\./);
      const proxySrc = fs.readFileSync(path.join(__dirname, "../lib/proxy.ts"), "utf-8");
      expect(proxySrc).toMatch(/contatoLote/);
      expect(proxySrc).toMatch(/suggestContactContent|suggest/i);
    });
  });
});
