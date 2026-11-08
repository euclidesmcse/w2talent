/** @jest-environment node */
import { NextRequest } from "next/server";
import { middleware } from "../middleware";

const req = (url: string, cookie?: string) =>
  new NextRequest(new URL(url, "http://localhost"), { headers: cookie ? { cookie } : {} });

describe("middleware de idioma", () => {
  it("?lang= numa página salva o idioma e tira o parâmetro da URL", () => {
    const res = middleware(req("/vagas?lang=en&q=aws", "NEXT_LOCALE=es"));
    expect(res.status).toBe(307);
    const to = new URL(res.headers.get("location")!);
    expect(to.pathname).toBe("/vagas");
    expect(to.searchParams.get("lang")).toBeNull();
    expect(to.searchParams.get("q")).toBe("aws");
    expect(res.cookies.get("NEXT_LOCALE")?.value).toBe("en");
  });

  it("depois disso o cookie (seletor) manda na página", () => {
    const res = middleware(req("/vagas", "NEXT_LOCALE=es"));
    expect(res.headers.get("x-locale")).toBe("es");
  });

  it("nas APIs ?lang= vale só para a chamada, sem redirecionar", () => {
    const res = middleware(req("/api/vacancies/search?lang=en", "NEXT_LOCALE=es"));
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-locale")).toBe("en");
  });

  it("/en/vagas redireciona para /vagas e salva o idioma", () => {
    const res = middleware(req("/en/vagas"));
    expect(new URL(res.headers.get("location")!).pathname).toBe("/vagas");
    expect(res.cookies.get("NEXT_LOCALE")?.value).toBe("en");
  });
});
