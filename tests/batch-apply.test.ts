// Step 1 TDD — deve FALHAR antes da implementação (depois PASS)
import * as fs from "fs";
import * as path from "path";
import { NextRequest } from "next/server";

describe("Candidatura em Lote 1-clique — Task 7", () => {
  // webhook "respondido" grava consentimento em background; espera terminar antes do Jest encerrar
  afterAll(async () => {
    await require("../lib/proxy").flushContactConsentWrites?.();
  });
  const candidateId = "cand_test_001";
  let mod: any;
  let routeMod: any;

  beforeEach(() => {
    jest.resetModules();
    // clear proxy state
    try {
      const proxy = require("../lib/proxy");
      proxy.clearAllForTests?.();
    } catch {}
    mod = require("../lib/proxy");
    routeMod = require("../app/api/applications/batch/route");
  });

  function seedVacancies() {
    const now = new Date();
    const future = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
    const expired = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
    mod.seedVacancy({ id: "vac-1", companyId: "comp-1", titulo: "Eng Cloud 1", status: "ativa", expiresAt: future });
    mod.seedVacancy({ id: "vac-2", companyId: "comp-1", titulo: "Eng Cloud 2", status: "ativa", expiresAt: future });
    mod.seedVacancy({ id: "vac-3", companyId: "comp-2", titulo: "Eng Cloud 3", status: "ativa", expiresAt: future });
    mod.seedVacancy({ id: "vac-exp", companyId: "comp-1", titulo: "Vaga expirada", status: "ativa", expiresAt: expired });
    mod.seedCandidate({ userId: candidateId, nome: "Ana Teste", titulo: "Engenheira Cloud", email: "ana@test.com", celular: "+5511999999999" });
  }

  async function postBatch(vacancyIds: string[], extra?: any) {
    const body: any = { vacancyIds, candidateId, ...extra };
    const req = new NextRequest("http://localhost/api/applications/batch", {
      method: "POST",
      headers: { "content-type": "application/json", "x-candidate-id": candidateId },
      body: JSON.stringify(body),
    });
    const POST = routeMod.POST ?? routeMod.handleBatchPOST ?? routeMod.default;
    const res = await POST(req);
    const json = await res.json().catch(() => ({}));
    return { res, json, status: res.status };
  }

  describe("1. lote 3 vagas cria 3 Applications + proxyThreadId + e-mail via Resend com CV canônico anexado (mock)", () => {
    it("cria 3 applications com proxyThreadId e envia 3 e-mails com PDF canônico", async () => {
      seedVacancies();
      const { status, json } = await postBatch(["vac-1", "vac-2", "vac-3"]);
      expect([200, 201, 207].includes(status)).toBe(true);
      expect(json.results).toBeDefined();
      expect(json.results.length).toBe(3);
      for (const r of json.results) {
        expect(r.status).toBe("enviado");
        expect(r.proxyThreadId).toBeTruthy();
        expect(r.applicationId ?? r.id).toBeTruthy();
        // proxy thread via format id@via.*
        expect(r.proxyThreadId).toMatch(/thr_/);
      }
      // proxyThreadId único
      const threads = json.results.map((r: any) => r.proxyThreadId);
      expect(new Set(threads).size).toBe(3);
      // e-mails via Resend mock
      expect(mod.sentEmails.length).toBe(3);
      for (const email of mod.sentEmails) {
        expect(email.from).toMatch(/@via\./);
        expect(email.attachments.length).toBeGreaterThan(0);
        expect(email.attachments[0].filename).toMatch(/cv-.*\.pdf/);
        const content = email.attachments[0].content as Buffer;
        expect(content.toString()).toMatch(/%PDF|CV CANONICO/);
      }
      // applications armazenadas
      expect(mod.applicationStore.size).toBe(3);
    });
  });

  describe("2. duplicada mesma vaga -> 409 já se candidatou", () => {
    it("segunda candidatura mesma vaga bloqueia com 409", async () => {
      seedVacancies();
      const first = await postBatch(["vac-1"]);
      expect(first.json.results[0].status).toBe("enviado");
      const dup = await postBatch(["vac-1"]);
      // lote com 1 item duplicado deve retornar erro 409 dentro do results ou status 409
      const is409 = dup.status === 409 || dup.json.results?.[0]?.code === 409 || dup.json.results?.[0]?.error?.toLowerCase().includes("já se candidatou");
      expect(is409).toBe(true);
      const errMsg = dup.json.results?.[0]?.error ?? dup.json.error ?? "";
      expect(errMsg.toLowerCase()).toMatch(/já se candidatou/);
      // não criou duplicata
      expect(mod.applicationStore.size).toBe(1);
    });

    it("duplicada no mesmo lote também bloqueia o segundo item", async () => {
      seedVacancies();
      // primeiro cria vac-1, vac-2
      await postBatch(["vac-1", "vac-2"]);
      expect(mod.applicationStore.size).toBe(2);
      // tenta novamente vac-2 + vac-3: vac-2 deve falhar, vac-3 ok => 207 parcial
      const second = await postBatch(["vac-2", "vac-3"]);
      expect(second.status).toBe(207);
      const byVac: any = Object.fromEntries(second.json.results.map((r: any) => [r.vacancyId, r]));
      expect(byVac["vac-2"].error.toLowerCase()).toMatch(/já se candidatou/);
      expect(byVac["vac-2"].code).toBe(409);
      expect(byVac["vac-3"].status).toBe("enviado");
    });
  });

  describe("3. lote com 1 vaga expirada -> 207 parcial 2 ok + 1 error vaga expirada (Review Focus)", () => {
    it("207 parcial: 2 ok + 1 vaga expirada sem rollback total", async () => {
      seedVacancies();
      const { status, json } = await postBatch(["vac-1", "vac-exp", "vac-2"]);
      expect(status).toBe(207);
      expect(json.results.length).toBe(3);
      const successes = json.results.filter((r: any) => r.status === "enviado");
      const errors = json.results.filter((r: any) => r.status === "error");
      expect(successes.length).toBe(2);
      expect(errors.length).toBe(1);
      expect(errors[0].vacancyId).toBe("vac-exp");
      expect(errors[0].error.toLowerCase()).toMatch(/expirada/);
      expect(errors[0].code).toBe(410);
      // sem rollback total: 2 applications criadas
      expect(mod.applicationStore.size).toBe(2);
      expect(mod.sentEmails.length).toBe(2);
    });
  });

  describe("4. limite 10/lote -> 400, 31º do dia -> 429", () => {
    it("11 vagas no mesmo lote -> 400 limite 10", async () => {
      seedVacancies();
      const now = new Date();
      const future = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
      for (let i = 10; i < 22; i++) mod.seedVacancy({ id: `vac-${i}`, companyId: "comp-1", titulo: `Vaga ${i}`, status: "ativa", expiresAt: future });
      const ids = Array.from({ length: 11 }, (_, i) => `vac-${10 + i}`);
      const { status, json } = await postBatch(ids);
      expect(status).toBe(400);
      expect(json.error.toLowerCase()).toMatch(/limite.*10|10.*lote/);
    });

    it("31º candidatura no dia -> 429", async () => {
      seedVacancies();
      const now = new Date();
      const future = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
      // cria 30 vagas extras para atingir 30 no dia
      for (let i = 10; i < 42; i++) mod.seedVacancy({ id: `vac-daily-${i}`, companyId: "comp-1", titulo: `Vaga daily ${i}`, status: "ativa", expiresAt: future });
      // envia 3 lotes de 10 = 30 ok
      for (let batch = 0; batch < 3; batch++) {
        const ids = Array.from({ length: 10 }, (_, j) => `vac-daily-${10 + batch * 10 + j}`);
        const r = await postBatch(ids);
        expect([200, 201].includes(r.status)).toBe(true);
      }
      expect(mod.getDailyCount(candidateId)).toBe(30);
      // 31ª deve bloquear 429
      mod.seedVacancy({ id: "vac-extra-31", companyId: "comp-1", titulo: "Extra 31", status: "ativa", expiresAt: future });
      const blocked = await postBatch(["vac-extra-31"]);
      expect(blocked.status).toBe(429);
      expect((blocked.json.error ?? "").toLowerCase()).toMatch(/limite diário|30\/dia|30/);
      // lote de 2 quando já tem 30 também bloqueia
      mod.seedVacancy({ id: "vac-extra-32", companyId: "comp-1", titulo: "Extra 32", status: "ativa", expiresAt: future });
      const blocked2 = await postBatch(["vac-extra-31", "vac-extra-32"]);
      // como já está no limite, mesmo lote de 2 deve dar 429 antes de criar
      // mas se a implementação bloquear lote inteiro, status 429; se permitir parcial com check pre, também 429
      expect([429, 207].includes(blocked2.status)).toBe(true);
      if (blocked2.status === 429) expect(mod.applicationStore.size).toBe(30);
    });
  });

  describe("5. status visualizado/respondido atualizam via webhook proxy", () => {
    it("PATCH webhook muda enviado->visualizado->respondido, transição inválida bloqueia", async () => {
      seedVacancies();
      const { json } = await postBatch(["vac-1"]);
      const threadId = json.results[0].proxyThreadId as string;
      expect(threadId).toBeTruthy();
      // estado inicial enviado
      const app0 = mod.applicationByThread.get(threadId);
      expect(app0.status).toBe("enviado");

      // webhook visualizado
      const PATCH = routeMod.PATCH;
      expect(typeof PATCH).toBe("function");
      const reqVis = new NextRequest("http://localhost/api/applications/batch", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ proxyThreadId: threadId, event: "visualizado" }),
      });
      const resVis = await PATCH(reqVis);
      expect(resVis.status).toBe(200);
      const jsonVis: any = await resVis.json();
      expect(jsonVis.status).toBe("visualizado");
      expect(mod.applicationByThread.get(threadId).status).toBe("visualizado");

      // webhook respondido
      const reqResp = new NextRequest("http://localhost/api/applications/batch", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ proxyThreadId: threadId, event: "respondido" }),
      });
      const resResp = await PATCH(reqResp);
      expect(resResp.status).toBe(200);
      const jsonResp: any = await resResp.json();
      expect(jsonResp.status).toBe("respondido");
      expect(mod.applicationByThread.get(threadId).status).toBe("respondido");

      // helper direto handleProxyWebhook também funciona com sinonimos
      seedVacancies();
      mod.clearAllForTests();
      // recreate to test synonym events
      const now = new Date();
      const future = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
      mod.seedVacancy({ id: "vac-2", companyId: "comp-1", titulo: "V2", status: "ativa", expiresAt: future });
      mod.seedCandidate({ userId: candidateId, nome: "Ana", titulo: "Cloud", email: "a@b.com", celular: "+5511999999999" });
      const r2 = await postBatch(["vac-2"]);
      const thr2 = r2.json.results[0].proxyThreadId;
      const viaHelper = mod.handleProxyWebhook(thr2, "open");
      expect(viaHelper.status).toBe("visualizado");
      const viaHelper2 = mod.handleProxyWebhook(thr2, "reply");
      expect(viaHelper2.status).toBe("respondido");
    });

    it("lib/proxy expõe transição e page minhas-candidaturas existe com estados", () => {
      expect(fs.existsSync(path.join(__dirname, "../lib/proxy.ts"))).toBe(true);
      const hasGrouped = fs.existsSync(path.join(__dirname, "../app/(app)/minhas-candidaturas/page.tsx"));
      const hasLegacy = fs.existsSync(path.join(__dirname, "../app/minhas-candidaturas/page.tsx"));
      expect(hasGrouped || hasLegacy).toBe(true);
      expect(fs.existsSync(path.join(__dirname, "../app/api/applications/batch/route.ts"))).toBe(true);
      const proxySrc = fs.readFileSync(path.join(__dirname, "../lib/proxy.ts"), "utf-8");
      expect(proxySrc).toMatch(/visualizado.*respondido|respondido.*visualizado/);
      expect(proxySrc).toMatch(/proxyThreadId|PROXY_DOMAIN|via\./);
      expect(proxySrc).toMatch(/Resend|sendProxyEmail/);
      const batchSrc = fs.readFileSync(path.join(__dirname, "../app/api/applications/batch/route.ts"), "utf-8");
      expect(batchSrc).toMatch(/BATCH_LIMIT|10/);
      expect(batchSrc).toMatch(/DAILY_LIMIT|30.*dia|30/);
      expect(batchSrc).toMatch(/207/);
      const pagePath = hasGrouped
        ? path.join(__dirname, "../app/(app)/minhas-candidaturas/page.tsx")
        : path.join(__dirname, "../app/minhas-candidaturas/page.tsx");
      const pageSrc = fs.readFileSync(pagePath, "utf-8");
      expect(pageSrc).toMatch(/enviado.*visualizado.*respondido|visualizado.*respondido/);
      expect(pageSrc).toMatch(/minhas-candidaturas|Minhas candidaturas/i);
    });
  });
});
