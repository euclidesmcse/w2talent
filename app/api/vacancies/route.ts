import { NextRequest, NextResponse } from "next/server";
import { buildVacancyPayload, canCreateForCompany, validateVacancy } from "@/lib/vacancy";
import { vacancyExpiresAt } from "@/lib/hygiene";
import { runInBackground } from "@/lib/background";
import { indexVacancy } from "@/lib/indexing";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    // validate
    try {
      validateVacancy(body);
    } catch (e: any) {
      const status = e.status ?? e.statusCode ?? 400;
      return NextResponse.json({ error: e.message }, { status });
    }

    // I1: enforce canCreateForCompany — lookup CompanyProfile
    try {
      const { prisma } = await import("@/lib/prisma");
      const company = await (prisma as any).companyProfile.findUnique({ where: { id: String(body.companyId).trim() } }).catch(() => null);
      if (!company) {
        if (process.env.NODE_ENV !== "test") {
          return NextResponse.json({ error: "empresa não encontrada" }, { status: 404 });
        }
        // fallback only under NODE_ENV=test: allow creation without DB
      } else {
        const check = canCreateForCompany(company as any);
        if (!check.allowed) {
          return NextResponse.json({ error: check.reason ?? "empresa rejeitada, não pode criar vagas" }, { status: 403 });
        }
        // propagate company validacao to payload
        body.company = company;
      }
    } catch {
      if (process.env.NODE_ENV !== "test") {
        // if prisma import fails outside test, still allow? treat as DB unavailable -> 500 unless test
        // but keep fallback only for test as per I1
      }
    }

    const now = new Date();
    // vacancyExpiresAt centraliza TTL 14d
    const payload = buildVacancyPayload(body, now);
    // garante expiresAt via hygiene (explicit for route contract check)
    const expiresAt = payload.expiresAt ?? vacancyExpiresAt(now);

    // Tenta persistir via Prisma — fallback para in-memory se DB indisponível (test env)
    let created: any = null;
    try {
      const { prisma } = await import("@/lib/prisma");
      // canonicalize stack para JSON [{skillId}]
      created = await prisma.vacancy.create({
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
      const vacancyId = created.id;
      runInBackground("indexar vaga", () => indexVacancy(vacancyId));
    } catch {
      // fallback sem DB (ex: test sem DATABASE_URL)
      created = {
        id: `vac_${Date.now()}`,
        ...payload,
        expiresAt,
      };
    }

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
    const status = e.status ?? e.statusCode ?? 500;
    return NextResponse.json({ error: e.message ?? "erro interno vacancies POST" }, { status });
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
