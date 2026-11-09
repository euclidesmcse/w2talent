/*
 * W2Talent — service worker (1.5.14, PWA). Escrito à mão, sem biblioteca (D1).
 *
 * O que guarda (D3): só o "esqueleto" das telas que abrem sem internet, arquivos
 * estáticos e ícones. NUNCA guarda respostas da API (/api) nem nada do /admin:
 * dado pessoal continua só onde já estava (o navegador da pessoa).
 *
 * Como responde:
 * - arquivos de /_next/static e fontes do Google: cache primeiro (nomes com hash, não mudam);
 * - ícones, manifest e CSS de fontes: devolve o guardado e atualiza por trás;
 * - telas da lista TELAS_OFFLINE: rede primeiro; sem rede, a última cópia; sem cópia, /offline;
 * - outras páginas: rede; sem rede, /offline;
 * - o resto (API, POST, /admin, outros sites): o service worker não mexe.
 *
 * Versão nova (D5): entra sozinha (skipWaiting + clients.claim). As telas sempre tentam a
 * rede primeiro, então ninguém fica preso numa versão velha.
 */

/* eslint-disable no-restricted-globals */
var VERSAO = "w2-1";
var CACHE_ESTATICO = VERSAO + "-estatico";
var CACHE_TELAS = VERSAO + "-telas";
var MAX_ESTATICOS = 400;

var OFFLINE = "/offline";
// D2: telas que abrem sem internet com o que está salvo no aparelho.
var TELAS_OFFLINE = ["/", "/vagas", "/vagas/aprovar", "/minha-ficha", "/minhas-candidaturas", OFFLINE];
var PRECACHE = [OFFLINE, "/manifest.json", "/icons/icon.svg", "/icons/icon-192.png", "/icons/apple-touch-icon.png"];
var FONTES = ["fonts.googleapis.com", "fonts.gstatic.com"];

/** Decide o que fazer com um pedido. Função pura (testada em tests/sw.test.ts). */
function rota(href, method, mode, origem) {
  if (method !== "GET") return "ignorar";
  var u;
  try { u = new URL(href); } catch (e) { return "ignorar"; }
  if (u.origin !== origem) {
    if (u.hostname === "fonts.gstatic.com") return "imutavel";
    if (u.hostname === "fonts.googleapis.com") return "recurso";
    return "ignorar";
  }
  var p = u.pathname;
  if (p === "/api" || p.indexOf("/api/") === 0) return "ignorar";
  if (p === "/admin" || p.indexOf("/admin/") === 0) return "ignorar";
  if (p === "/sw.js") return "ignorar";
  if (p.indexOf("/_next/static/") === 0) return "imutavel";
  if (p === "/manifest.json" || p.indexOf("/icons/") === 0) return "recurso";
  if (mode === "navigate") return telaOffline(p) ? "tela" : "navegacao";
  return "ignorar";
}

function telaOffline(pathname) {
  var p = pathname.length > 1 && pathname.charAt(pathname.length - 1) === "/" ? pathname.slice(0, -1) : pathname;
  return TELAS_OFFLINE.indexOf(p) >= 0;
}

/** Endereços de /_next/static citados num HTML (CSS e JS da página offline). */
function estaticosDoHtml(html) {
  var achados = {};
  var re = /\/_next\/static\/[^"'\s)<>]+/g;
  var m;
  while ((m = re.exec(html))) achados[m[0].replace(/\\u0026/g, "&")] = true;
  return Object.keys(achados);
}

function podeGuardar(res) {
  return !!res && res.ok && res.status === 200 && !res.redirected && (res.type === "basic" || res.type === "cors");
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { rota: rota, telaOffline: telaOffline, estaticosDoHtml: estaticosDoHtml, podeGuardar: podeGuardar, TELAS_OFFLINE: TELAS_OFFLINE, VERSAO: VERSAO };
}

if (typeof self !== "undefined" && typeof self.addEventListener === "function" && typeof caches !== "undefined") {
  self.addEventListener("install", function (event) {
    event.waitUntil(
      (async function () {
        var cache = await caches.open(CACHE_ESTATICO);
        await Promise.all(PRECACHE.filter(function (u) { return u !== OFFLINE; }).map(function (u) {
          return cache.add(new Request(u, { cache: "reload" })).catch(function () {});
        }));
        // Todas as telas offline (e o CSS/JS de cada uma) já na instalação: quem navega pelo menu
        // (navegação do Next, que não é "navigate") também encontra a tela guardada depois.
        var telas = await caches.open(CACHE_TELAS);
        await Promise.all(TELAS_OFFLINE.map(function (tela) { return guardarTela(tela, telas, cache); }));
        await self.skipWaiting();
      })()
    );
  });

  self.addEventListener("activate", function (event) {
    event.waitUntil(
      (async function () {
        var nomes = await caches.keys();
        await Promise.all(nomes.filter(function (n) { return n.indexOf(VERSAO + "-") !== 0; }).map(function (n) { return caches.delete(n); }));
        await self.clients.claim();
      })()
    );
  });

  self.addEventListener("fetch", function (event) {
    var req = event.request;
    var tipo = rota(req.url, req.method, req.mode, self.location.origin);
    if (tipo === "ignorar") return;
    if (tipo === "imutavel") event.respondWith(cachePrimeiro(req));
    else if (tipo === "recurso") event.respondWith(guardadoEAtualiza(req, event));
    else if (tipo === "tela") event.respondWith(redePrimeiro(req));
    else if (tipo === "navegacao") event.respondWith(redeOuOffline(req));
  });
}

async function guardarTela(tela, telas, estatico) {
  try {
    var res = await fetch(new Request(tela, { cache: "reload", credentials: "same-origin" }));
    var tipo = res.headers.get("content-type") || "";
    if (!podeGuardar(res) || tipo.indexOf("text/html") < 0) return;
    var html = await res.clone().text();
    await telas.put(new URL(tela, self.location.origin).href, res);
    await Promise.all(estaticosDoHtml(html).map(function (u) { return estatico.add(u).catch(function () {}); }));
  } catch (e) { /* sem rede na instalação: a tela entra no cache na próxima visita */ }
}

async function cachePrimeiro(req) {
  var cache = await caches.open(CACHE_ESTATICO);
  var achado = await cache.match(req);
  if (achado) return achado;
  var res = await fetch(req);
  if (podeGuardar(res)) { await cache.put(req, res.clone()); aparar(cache); }
  return res;
}

async function guardadoEAtualiza(req, event) {
  var cache = await caches.open(CACHE_ESTATICO);
  var achado = await cache.match(req);
  var rede = fetch(req).then(function (res) {
    if (podeGuardar(res)) return cache.put(req, res.clone()).then(function () { return res; });
    return res;
  });
  if (achado) { event.waitUntil(rede.catch(function () {})); return achado; }
  return rede;
}

// A chave da tela é só o caminho (/vagas?q=devops usa a mesma cópia de /vagas).
function chaveDaTela(req) {
  var u = new URL(req.url);
  var p = u.pathname.length > 1 && u.pathname.charAt(u.pathname.length - 1) === "/" ? u.pathname.slice(0, -1) : u.pathname;
  return u.origin + p;
}

async function redePrimeiro(req) {
  var cache = await caches.open(CACHE_TELAS);
  try {
    var res = await fetch(req);
    var tipo = res.headers.get("content-type") || "";
    if (podeGuardar(res) && tipo.indexOf("text/html") >= 0) await cache.put(chaveDaTela(req), res.clone());
    return res;
  } catch (e) {
    var copia = await cache.match(chaveDaTela(req));
    return copia || paginaOffline();
  }
}

async function redeOuOffline(req) {
  try {
    return await fetch(req);
  } catch (e) {
    return paginaOffline();
  }
}

async function paginaOffline() {
  var copia = await caches.match(OFFLINE);
  return copia || new Response("Sem conexão / Offline", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
}

async function aparar(cache) {
  var chaves = await cache.keys();
  var sobra = chaves.length - MAX_ESTATICOS;
  for (var i = 0; i < sobra; i++) await cache.delete(chaves[i]);
}
