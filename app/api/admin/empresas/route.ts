/**
 * Validação das empresas (2.1a, D2). GET ?pagina=N: empresas de 50 em 50, pendentes primeiro (ordem do
 * enum no banco), com o e-mail de quem cadastrou.
 * POST {id, acao: "validar" | "rejeitar"}: rejeitar arquiva as vagas ativas da empresa.
 * Só com o cookie de admin (lib/admin-auth.ts).
 */
import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { adminGuard } from "@/lib/admin-request";
import { decidirEmpresa } from "@/lib/empresa";

const NO_STORE = { "cache-control": "no-store" };
const POR_PAGINA = 50;

export async function GET(req: NextRequest) {
  const denied = await adminGuard(req);
  if (denied) return denied;
  try {
    const pagina = Math.max(1, Math.min(10_000, parseInt(req.nextUrl.searchParams.get("pagina") ?? "1", 10) || 1));
    const rows = await getPrisma().companyProfile.findMany({
      // enum ValidationStatus: pendente < validado < rejeitado
      orderBy: [{ validacaoStatus: "asc" }, { createdAt: "desc" }, { id: "asc" }],
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA + 1,
      select: {
        id: true, nome: true, site: true, cnpj: true, validacaoStatus: true, createdAt: true,
        membros: { select: { papel: true, user: { select: { email: true } } } },
        _count: { select: { vacancies: { where: { status: "ativa" } } } },
      },
    });
    const empresas = rows
      .slice(0, POR_PAGINA)
      .map((r) => ({
        id: r.id, nome: r.nome, site: r.site, cnpj: r.cnpj, status: r.validacaoStatus, criadaEm: r.createdAt,
        membros: r.membros.map((m) => ({ email: m.user.email, papel: m.papel })),
        vagasAtivas: r._count.vacancies,
      }));
    return NextResponse.json({ empresas, pagina, temMais: rows.length > POR_PAGINA }, { headers: NO_STORE });
  } catch (err) {
    console.error("[admin/empresas] falhou: lista", (err as { code?: string })?.code ?? (err as Error)?.name);
    return NextResponse.json({ error: "erro_interno" }, { status: 500, headers: NO_STORE });
  }
}

export async function POST(req: NextRequest) {
  const denied = await adminGuard(req, { write: true });
  if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as { id?: unknown; acao?: unknown };
  const id = typeof body.id === "string" ? body.id : "";
  const acao = body.acao === "validar" || body.acao === "rejeitar" ? body.acao : null;
  if (!id || !acao) return NextResponse.json({ error: "pedido_invalido" }, { status: 400, headers: NO_STORE });
  try {
    const r = await decidirEmpresa(getPrisma(), id, acao);
    if (!r) return NextResponse.json({ error: "nao_encontrada" }, { status: 404, headers: NO_STORE });
    return NextResponse.json({ ok: true, ...r }, { headers: NO_STORE });
  } catch (err) {
    console.error("[admin/empresas] falhou: decidir", (err as { code?: string })?.code ?? (err as Error)?.name);
    return NextResponse.json({ error: "erro_interno" }, { status: 500, headers: NO_STORE });
  }
}
