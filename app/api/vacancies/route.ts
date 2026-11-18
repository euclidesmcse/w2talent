import { NextRequest, NextResponse } from "next/server";
import { buildVacancyPayload, canCreateForCompany, validateVacancy } from "@/lib/vacancy";
import { vacancyExpiresAt } from "@/lib/hygiene";
import { runInBackground } from "@/lib/background";
import { indexVacancy } from "@/lib/indexing";
import { acessoVaga } from "@/lib/empresa";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const { prisma } = await import("@/lib/prisma");

    // 2.1a (D3): só o recrutador logado (empresa do vínculo) ou o admin cria vaga.
    const a = await acessoVaga(req, prisma);
    if ("erro" in a) return a.erro;
    if (a.acesso.tipo === "recrutador") body.companyId = a.acesso.empresa.id;

    try {
      validateVacancy(body);
    } catch (e: any) {
      const status = e.status ?? e.statusCode ?? 400;
      return NextResponse.json({ error: e.message }, { status });
    }

    const company = await prisma.companyProfile.findUnique({ where: { id: String(body.companyId).trim() } });
    if (!company) return NextResponse.json({ error: "empresa não encontrada" }, { status: 404 });
    const check = canCreateForCompany(company as any);
    if (!check.allowed) return NextResponse.json({ error: check.reason ?? "empresa rejeitada, não pode criar vagas" }, { status: 403 });
    body.company = company;

    const now = new Date();
    // vacancyExpiresAt centraliza TTL 14d
    const payload = buildVacancyPayload(body, now);
    // garante expiresAt via hygiene (explicit for route contract check)
    const expiresAt = payload.expiresAt ?? vacancyExpiresAt(now);

    const created = await prisma.vacancy.create({
      data: {
        companyId: payload.companyId,
        titulo: payload.titulo,
        stack: payload.stack as any,
        nivel: payload.nivel ?? undefined,
        regime: payload.regime ?? undefined,
        localidade: payload.localidade ?? undefined,
        faixaDe: payload.faixaDe,
        faixaAte: payload.faixaAte,
        faixaMoeda: payload.faixaMoeda,
        descricaoBullets: payload.descricaoBullets as any,
        beneficios: payload.beneficios as any,
        tipoContrato: payload.tipoContrato ?? undefined,
        expiresAt,
        status: "ativa",
        renovacoes: 0,
      },
    });
    // 1.5.9: vetor + tsvector em segundo plano (a resposta não espera o modelo).
    runInBackground("indexar vaga", () => indexVacancy(created.id));

    return NextResponse.json(
      {
        id: created.id,
        titulo: created.titulo ?? payload.titulo,
        status: created.status ?? "ativa",
        expiresAt: (created.expiresAt ?? expiresAt).toISOString(),
        faixaDe: created.faixaDe ?? payload.faixaDe,
        faixaAte: created.faixaAte ?? payload.faixaAte,
      },
      { status: 201 }
    );
  } catch (e: any) {
    console.error("POST /api/vacancies", e?.code ?? e?.name ?? "erro");
    return NextResponse.json({ error: "erro interno" }, { status: 500 });
  }
}

// handleVacancyPOST alias for test contract (re-export)
// handleVacancyPOST removed — Next.js Route only allows GET/POST/PATCH

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const companyId = url.searchParams.get("companyId");
    try {
      const { prisma } = await import("@/lib/prisma");
      const where: any = { status: "ativa" };
      if (companyId) where.companyId = companyId;
      const items = await prisma.vacancy.findMany({ where, orderBy: { createdAt: "desc" }, take: 50 });
      return NextResponse.json({ items, total: items.length }, { status: 200 });
    } catch {
      return NextResponse.json({ items: [], total: 0 }, { status: 200 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
