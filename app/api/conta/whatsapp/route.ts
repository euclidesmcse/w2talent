/**
 * 3.5a Avisos pelo WhatsApp em Minha conta (só candidato).
 * GET: estado. POST { acao: "codigo", numero } pede o código de 6 dígitos;
 * { acao: "confirmar", codigo, aceite: true } confere e liga (grava o consentimento);
 * { acao: "desligar" } desliga na hora.
 */
import { NextRequest, NextResponse } from "next/server";
import { exigirConta, NO_STORE } from "@/lib/sessao";
import { mesmaOrigem } from "@/lib/empresa";

export const dynamic = "force-dynamic";

const STATUS: Record<string, number> = {
  sem_ficha: 409,
  limite: 429,
  envio: 502,
  vazio: 422,
  invalido: 422,
  fixo: 422,
  sem_pedido: 409,
  expirado: 410,
  tentativas: 429,
  codigo: 422,
  consentimento: 422,
};

export async function GET(req: NextRequest) {
  const r = await exigirConta(req, { perfil: "candidato" });
  if ("erro" in r) return r.erro;
  try {
    const [{ prisma }, { estadoWhatsapp }] = await Promise.all([import("@/lib/prisma"), import("@/lib/whatsapp-db")]);
    return NextResponse.json(await estadoWhatsapp(prisma, r.conta.id), { headers: NO_STORE });
  } catch (e) {
    console.error("[conta/whatsapp] leitura falhou:", e instanceof Error ? e.name : e);
    return NextResponse.json({ error: "erro" }, { status: 500, headers: NO_STORE });
  }
}

export async function POST(req: NextRequest) {
  const r = await exigirConta(req, { perfil: "candidato" });
  if ("erro" in r) return r.erro;
  if (!mesmaOrigem(req)) return NextResponse.json({ error: "origem_invalida" }, { status: 403, headers: NO_STORE });
  const body = (await req.json().catch(() => ({}))) as { acao?: unknown; numero?: unknown; codigo?: unknown; aceite?: unknown };
  const idioma = req.headers.get("x-locale");
  try {
    const [{ prisma }, w] = await Promise.all([import("@/lib/prisma"), import("@/lib/whatsapp-db")]);
    if (body.acao === "codigo") {
      const res = await w.pedirCodigo(prisma, r.conta.id, body.numero, idioma);
      if (!res.ok) return NextResponse.json({ error: res.erro }, { status: STATUS[res.erro] ?? 400, headers: NO_STORE });
      return NextResponse.json(res, { headers: NO_STORE });
    }
    if (body.acao === "confirmar") {
      const res = await w.confirmarCodigo(prisma, r.conta.id, body.codigo, body.aceite, idioma);
      if (!res.ok) return NextResponse.json({ error: res.erro }, { status: STATUS[res.erro] ?? 400, headers: NO_STORE });
      return NextResponse.json({ ok: true, estado: await w.estadoWhatsapp(prisma, r.conta.id) }, { headers: NO_STORE });
    }
    if (body.acao === "desligar") {
      await w.desligarWhatsapp(prisma, { userId: r.conta.id });
      return NextResponse.json({ ok: true, estado: await w.estadoWhatsapp(prisma, r.conta.id) }, { headers: NO_STORE });
    }
    return NextResponse.json({ error: "acao" }, { status: 422, headers: NO_STORE });
  } catch (e) {
    console.error("[conta/whatsapp] falhou:", e instanceof Error ? e.name : e);
    return NextResponse.json({ error: "erro" }, { status: 500, headers: NO_STORE });
  }
}
