// 1.5.14 — regras do service worker (public/sw.js): o que vai para o cache e o que nunca vai.
import * as fs from "fs";
import * as path from "path";
import { ehIosSafari } from "../lib/pwa-client";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const sw = require("../public/sw.js") as {
  rota: (href: string, method: string, mode: string, origem: string) => string;
  telaOffline: (p: string) => boolean;
  estaticosDoHtml: (html: string) => string[];
  TELAS_OFFLINE: string[];
};

const O = "https://w2talent.euclidespns.workers.dev";
const ROOT = path.join(__dirname, "..");

describe("service worker: rotas", () => {
  it("API, /admin e POST nunca passam pelo cache (dado pessoal fica fora — D3)", () => {
    expect(sw.rota(`${O}/api/envio/enviadas`, "POST", "cors", O)).toBe("ignorar");
    expect(sw.rota(`${O}/api/search/vacancies?q=devops`, "GET", "cors", O)).toBe("ignorar");
    expect(sw.rota(`${O}/api`, "GET", "navigate", O)).toBe("ignorar");
    expect(sw.rota(`${O}/admin/ia`, "GET", "navigate", O)).toBe("ignorar");
    expect(sw.rota(`${O}/admin`, "GET", "navigate", O)).toBe("ignorar");
    expect(sw.rota(`${O}/vagas`, "POST", "navigate", O)).toBe("ignorar");
    expect(sw.rota(`${O}/sw.js`, "GET", "no-cors", O)).toBe("ignorar");
  });

  it("as quatro telas do D2 (e a inicial) abrem sem internet; outras páginas caem na offline", () => {
    for (const p of ["/vagas", "/vagas/aprovar", "/minha-ficha", "/minhas-candidaturas", "/", "/offline"]) {
      expect([p, sw.rota(`${O}${p}`, "GET", "navigate", O)]).toEqual([p, "tela"]);
    }
    expect(sw.rota(`${O}/vagas/?q=devops`, "GET", "navigate", O)).toBe("tela");
    expect(sw.rota(`${O}/candidatos`, "GET", "navigate", O)).toBe("navegacao");
    expect(sw.rota(`${O}/renovar?t=abc`, "GET", "navigate", O)).toBe("navegacao");
    expect(sw.telaOffline("/vagasx")).toBe(false);
  });

  it("estáticos: /_next/static e fontes guardados; ícones e manifest atualizam por trás", () => {
    expect(sw.rota(`${O}/_next/static/chunks/app-abc123.js`, "GET", "no-cors", O)).toBe("imutavel");
    expect(sw.rota("https://fonts.gstatic.com/s/inter/v13/x.woff2", "GET", "cors", O)).toBe("imutavel");
    expect(sw.rota("https://fonts.googleapis.com/css2?family=Inter", "GET", "no-cors", O)).toBe("recurso");
    expect(sw.rota(`${O}/icons/icon-192.png`, "GET", "no-cors", O)).toBe("recurso");
    expect(sw.rota(`${O}/manifest.json`, "GET", "cors", O)).toBe("recurso");
  });

  it("outros sites e pedidos de dados do Next (RSC) ficam com o navegador", () => {
    expect(sw.rota("https://gateway.ai.cloudflare.com/v1/x", "GET", "cors", O)).toBe("ignorar");
    expect(sw.rota(`${O}/vagas?_rsc=1x2y`, "GET", "cors", O)).toBe("ignorar");
    expect(sw.rota("não é url", "GET", "navigate", O)).toBe("ignorar");
  });

  it("acha o CSS e o JS citados no HTML da página offline", () => {
    const html = `<link rel="stylesheet" href="/_next/static/css/a1.css"/><script src="/_next/static/chunks/main-9.js" async></script><script>self.__next_f.push([1,"/_next/static/chunks/app/offline/page-7.js"])</script><a href="/vagas">x</a>`;
    expect(sw.estaticosDoHtml(html).sort()).toEqual(["/_next/static/chunks/app/offline/page-7.js", "/_next/static/chunks/main-9.js", "/_next/static/css/a1.css"]);
  });

  it("toda tela da lista offline existe no app", () => {
    const arquivo: Record<string, string> = {
      "/": "app/page.tsx",
      "/vagas": "app/vagas/page.tsx",
      "/vagas/aprovar": "app/vagas/aprovar/page.tsx",
      "/minha-ficha": "app/minha-ficha/page.tsx",
      "/minhas-candidaturas": "app/(app)/minhas-candidaturas/page.tsx",
      "/offline": "app/offline/page.tsx",
    };
    expect([...sw.TELAS_OFFLINE].sort()).toEqual(Object.keys(arquivo).sort());
    for (const f of Object.values(arquivo)) expect([f, fs.existsSync(path.join(ROOT, f))]).toEqual([f, true]);
  });
});

describe("manifest e instalação", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "public", "manifest.json"), "utf-8"));

  it("manifest instalável: id, standalone, ícones 192/512/maskable que existem, atalhos para telas offline", () => {
    expect(manifest.id).toBe("/");
    expect(manifest.display).toBe("standalone");
    const tamanhos = manifest.icons.map((i: any) => `${i.sizes}:${i.purpose}`);
    expect(tamanhos).toEqual(expect.arrayContaining(["192x192:any", "512x512:any", "512x512:maskable"]));
    for (const i of manifest.icons) expect([i.src, fs.existsSync(path.join(ROOT, "public", i.src))]).toEqual([i.src, true]);
    for (const s of manifest.shortcuts) expect(sw.telaOffline(s.url)).toBe(true);
  });

  it("o service worker e o manifest não ficam presos no cache do navegador", () => {
    const h = fs.readFileSync(path.join(ROOT, "public", "_headers"), "utf-8");
    expect(h).toMatch(/\/sw\.js\s*\n\s*Cache-Control: no-cache/);
  });

  it("iPhone/iPad no Safari recebem a ajuda de instalar; Chrome no iPhone e Android não", () => {
    const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
    const ipad = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
    const chromeIos = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1";
    const android = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";
    expect(ehIosSafari(iphone, 5)).toBe(true);
    expect(ehIosSafari(ipad, 5)).toBe(true);
    expect(ehIosSafari(ipad, 0)).toBe(false); // Mac de verdade
    expect(ehIosSafari(chromeIos, 5)).toBe(false);
    expect(ehIosSafari(android, 5)).toBe(false);
  });
});
