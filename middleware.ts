/**
 * middleware — idioma da interface (1.5.6)
 * - mesmo endereço nos três idiomas (pt-BR, en, es); sem prefixo na URL
 * - idioma: cookie NEXT_LOCALE (escolha salva) → Accept-Language → pt-BR
 * - links antigos /en/... e /es/... salvam o idioma no cookie e redirecionam para o endereço sem prefixo
 * - ?lang= numa página faz o mesmo (salva e tira da URL), para o seletor continuar valendo depois;
 *   nas APIs, ?lang= só vale para aquela chamada
 * - repassa o idioma ao servidor pelo cabeçalho x-next-intl-locale (e x-locale para as APIs)
 */
import { NextRequest, NextResponse } from "next/server";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, normalizeLocale, resolveLocale } from "./lib/locale";

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;

  // /en/vagas → /vagas com o idioma salvo
  const seg = pathname.split("/").filter(Boolean)[0];
  const prefixed = seg === "en" || seg === "es" || seg === "pt-BR" ? normalizeLocale(seg) : null;
  if (prefixed) {
    const url = req.nextUrl.clone();
    url.pathname = "/" + pathname.split("/").filter(Boolean).slice(1).join("/");
    const res = NextResponse.redirect(url);
    res.cookies.set(LOCALE_COOKIE, prefixed, { path: "/", maxAge: LOCALE_COOKIE_MAX_AGE, sameSite: "lax" });
    return res;
  }

  const lang = normalizeLocale(req.nextUrl.searchParams.get("lang"));
  if (lang && !pathname.startsWith("/api/")) {
    const url = req.nextUrl.clone();
    url.searchParams.delete("lang");
    const res = NextResponse.redirect(url);
    res.cookies.set(LOCALE_COOKIE, lang, { path: "/", maxAge: LOCALE_COOKIE_MAX_AGE, sameSite: "lax" });
    return res;
  }
  const locale = lang ?? resolveLocale(req.cookies.get(LOCALE_COOKIE)?.value, req.headers.get("accept-language"));

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-next-intl-locale", locale);
  requestHeaders.set("x-locale", locale);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("x-locale", locale);
  return res;
}

export const config = {
  // páginas e APIs; fora arquivos estáticos e _next
  matcher: ["/((?!_next|.*\\..*).*)"],
};
