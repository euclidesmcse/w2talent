// 1.5.3 — segredo dos webhooks em tempo constante e IDOR nas candidaturas em lote.
import { NextRequest } from "next/server";

const SECRET = "segredo-de-teste-1234567890";

describe("timingSafeEqualStr / requestHasSecret", () => {
  const { timingSafeEqualStr, requestHasSecret } = require("../lib/secret");

  it("compara igual só quando os textos são idênticos", () => {
    expect(timingSafeEqualStr(SECRET, SECRET)).toBe(true);
    expect(timingSafeEqualStr(SECRET + "x", SECRET)).toBe(false);
    expect(timingSafeEqualStr(SECRET.slice(0, -1), SECRET)).toBe(false);
    expect(timingSafeEqualStr("", SECRET)).toBe(false);
    expect(timingSafeEqualStr("", "")).toBe(false); // segredo vazio nunca autoriza
    expect(timingSafeEqualStr("ção", "ção")).toBe(true);
  });

  it("aceita o segredo nos lugares combinados e recusa o resto", () => {
    const url = "http://localhost/api/x";
    const mk = (headers: Record<string, string>, q = "") => new NextRequest(url + q, { headers });
    expect(requestHasSecret(mk({ authorization: `Bearer ${SECRET}` }), SECRET)).toBe(true);
    expect(requestHasSecret(mk({ authorization: SECRET }), SECRET)).toBe(true);
    expect(requestHasSecret(mk({ "x-cron-secret": SECRET }), SECRET)).toBe(true);
    expect(requestHasSecret(mk({ "x-webhook-secret": SECRET }), SECRET)).toBe(true);
    expect(requestHasSecret(mk({}, `?cron_secret=${SECRET}`), SECRET)).toBe(true);
    expect(requestHasSecret(mk({ authorization: "Bearer errado" }), SECRET)).toBe(false);
    expect(requestHasSecret(mk({}), SECRET)).toBe(false);
    expect(requestHasSecret(mk({ authorization: "Bearer " }), undefined)).toBe(false);
  });
});

describe("webhooks exigem o segredo (sem atalho em teste)", () => {
  const env = { ...process.env };
  beforeEach(() => {
    jest.resetModules();
    process.env.CRON_SECRET = SECRET;
  });
  afterAll(() => {
    process.env = env;
  });

  for (const path of ["applications", "contacts"]) {
    it(`PATCH /api/${path}/batch sem segredo ou com segredo errado → 401`, async () => {
      const { PATCH } = require(`../app/api/${path}/batch/route`);
      const body = JSON.stringify({ proxyThreadId: "thr-x", event: "visualizado" });
      const semSegredo = await PATCH(new NextRequest(`http://localhost/api/${path}/batch`, { method: "PATCH", body }));
      expect(semSegredo.status).toBe(401);
      const errado = await PATCH(
        new NextRequest(`http://localhost/api/${path}/batch`, { method: "PATCH", body, headers: { authorization: "Bearer nao-e-esse" } })
      );
      expect(errado.status).toBe(401);
      const certo = await PATCH(
        new NextRequest(`http://localhost/api/${path}/batch`, { method: "PATCH", body, headers: { authorization: `Bearer ${SECRET}` } })
      );
      expect(certo.status).not.toBe(401); // passa da autenticação (a thread não existe, então 4xx de negócio)
    });
  }
});

describe("IDOR em /api/applications/batch (como em produção)", () => {
  const env = { ...process.env };
  let proxy: any;
  let route: any;
  let auth: any;
  const future = () => new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);

  beforeEach(() => {
    jest.resetModules();
    (process.env as any).NODE_ENV = "production";
    process.env.JWT_SECRET = "jwt-de-teste";
    proxy = require("../lib/proxy");
    proxy.clearAllForTests?.();
    route = require("../app/api/applications/batch/route");
    auth = require("../lib/auth");
    proxy.seedVacancy({ id: "vac-a", companyId: "comp-1", titulo: "A", status: "ativa", expiresAt: future() });
    proxy.seedVacancy({ id: "vac-b", companyId: "comp-1", titulo: "B", status: "ativa", expiresAt: future() });
    proxy.seedCandidate({ userId: "ana", nome: "Ana", titulo: "Cloud", email: "ana@t.com", celular: "+5511999990001" });
    proxy.seedCandidate({ userId: "bruno", nome: "Bruno", titulo: "SRE", email: "bruno@t.com", celular: "+5511999990002" });
  });
  afterEach(() => {
    process.env = { ...env };
  });

  const bearer = (userId: string) => ({ authorization: `Bearer ${auth.signJwt({ userId, celular: "+5511999990000" })}` });

  it("POST sem login, mesmo com candidateId no corpo, é recusado", async () => {
    const res = await route.POST(
      new NextRequest("http://localhost/api/applications/batch", {
        method: "POST",
        headers: { "content-type": "application/json", "x-candidate-id": "ana" },
        body: JSON.stringify({ vacancyIds: ["vac-a"], candidateId: "ana" }),
      })
    );
    expect(res.status).toBe(401);
    expect(proxy.applicationStore.size).toBe(0);
  });

  it("POST logado como Bruno com candidateId=ana no corpo cria a candidatura do Bruno", async () => {
    const res = await route.POST(
      new NextRequest("http://localhost/api/applications/batch", {
        method: "POST",
        headers: { "content-type": "application/json", ...bearer("bruno") },
        body: JSON.stringify({ vacancyIds: ["vac-a"], candidateId: "ana" }),
      })
    );
    expect([200, 201]).toContain(res.status);
    const apps = [...proxy.applicationStore.values()];
    expect(apps.map((a: any) => a.candidateId)).toEqual(["bruno"]);
  });

  it("GET sem login com ?candidateId= é recusado", async () => {
    const res = await route.GET(new NextRequest("http://localhost/api/applications/batch?candidateId=ana"));
    expect(res.status).toBe(401);
  });

  it("GET logado como Bruno com ?candidateId=ana só devolve as do Bruno", async () => {
    await route.POST(
      new NextRequest("http://localhost/api/applications/batch", {
        method: "POST",
        headers: { "content-type": "application/json", ...bearer("ana") },
        body: JSON.stringify({ vacancyIds: ["vac-a"] }),
      })
    );
    await route.POST(
      new NextRequest("http://localhost/api/applications/batch", {
        method: "POST",
        headers: { "content-type": "application/json", ...bearer("bruno") },
        body: JSON.stringify({ vacancyIds: ["vac-b"] }),
      })
    );
    const res = await route.GET(
      new NextRequest("http://localhost/api/applications/batch?candidateId=ana", { headers: bearer("bruno") })
    );
    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.applications.length).toBe(1);
    expect(json.applications[0].candidateId).toBe("bruno");
  });
});
