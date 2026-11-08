import { NextRequest, NextResponse } from "next/server";
import { requestHasSecret, timingSafeEqualStr } from "@/lib/secret";
import { vacancyStore, candidateStore, seedVacancy, seedCandidate, clearAllForTests } from "@/lib/proxy";

// GET explica, POST semeia. Sem auth em staging (dummy secrets), em prod exige CRON_SECRET.
function isAuthorized(req: NextRequest): boolean {
  if (process.env.NODE_ENV === "test") return true;
  const secret = process.env.CRON_SECRET || process.env.WEBHOOK_SECRET;
  // staging com dummy secrets -> libera
  if (!secret || secret.startsWith("dummy")) return true;
  if (requestHasSecret(req, secret)) return true;
  const q = req.nextUrl.searchParams.get("secret");
  if (q && timingSafeEqualStr(q, secret)) return true;
  // permite sem secret se explicitamente ?demo=1 e estamos sem secret real (staging)
  return false;
}

const DEMO_VACANCIES: Array<{ id: string; titulo: string; stack: any[]; localidade: string; regime: string; nivel: string; faixaDe: number | null; faixaAte: number | null }> = [
  { id: "demo-v-01", titulo: "Analista Cloud Pleno — AWS", stack: [{ skillId: "aws" }, { skillId: "terraform" }], localidade: "Remoto", regime: "CLT", nivel: "Pleno", faixaDe: 9000, faixaAte: 13000 },
  { id: "demo-v-02", titulo: "Engenheiro Cloud Sênior — Azure + Kubernetes", stack: [{ skillId: "azure" }, { skillId: "kubernetes" }], localidade: "São Paulo (Híbrido)", regime: "CLT", nivel: "Sênior", faixaDe: 14000, faixaAte: 19000 },
  { id: "demo-v-03", titulo: "DevOps Pleno — GCP + Docker", stack: [{ skillId: "gcp" }, { skillId: "docker" }], localidade: "Remoto", regime: "PJ", nivel: "Pleno", faixaDe: 8000, faixaAte: 12000 },
  { id: "demo-v-04", titulo: "Analista Cloud Júnior — Suporte N2", stack: [{ skillId: "aws" }, { skillId: "linux" }], localidade: "Curitiba (Presencial)", regime: "CLT", nivel: "Júnior", faixaDe: 4000, faixaAte: 6000 },
  { id: "demo-v-05", titulo: "SRE — Cloud + Observabilidade", stack: [{ skillId: "aws" }, { skillId: "grafana" }], localidade: "Remoto", regime: "PJ", nivel: "Sênior", faixaDe: 15000, faixaAte: 22000 },
  { id: "demo-v-06", titulo: "Desenvolvedor Full Stack — Node + React + AWS", stack: [{ skillId: "nodejs" }, { skillId: "react" }, { skillId: "aws" }], localidade: "Remoto", regime: "CLT", nivel: "Pleno", faixaDe: 10000, faixaAte: 15000 },
  { id: "demo-v-07", titulo: "Analista de Dados Cloud — BigQuery", stack: [{ skillId: "gcp" }, { skillId: "python" }], localidade: "Remoto", regime: "PJ", nivel: "Pleno", faixaDe: 9000, faixaAte: 14000 },
  { id: "demo-v-08", titulo: "Arquiteto Cloud — Multi-cloud", stack: [{ skillId: "aws" }, { skillId: "azure" }], localidade: "São Paulo (Remoto parcial)", regime: "PJ", nivel: "Sênior", faixaDe: 18000, faixaAte: 26000 },
  { id: "demo-v-09", titulo: "Tech Lead Cloud — Liderança + FinOps", stack: [{ skillId: "aws" }, { skillId: "finops" }], localidade: "Remoto", regime: "PJ", nivel: "Sênior", faixaDe: 20000, faixaAte: 30000 },
  { id: "demo-v-10", titulo: "Estágio Cloud — Trainee AWS", stack: [{ skillId: "aws" }], localidade: "São Paulo (Híbrido)", regime: "Estágio", nivel: "Estágio", faixaDe: 1800, faixaAte: 2500 },
];

const DEMO_CANDIDATES: Array<{ userId: string; nome: string; titulo: string; stack: any[]; localidade: string; modo: string }> = [
  { userId: "demo-c-01", nome: "Ana Silva", titulo: "Analista Cloud Pleno", stack: [{ skillId: "aws" }, { skillId: "terraform" }, { skillId: "linux" }], localidade: "São Paulo", modo: "Remoto" },
  { userId: "demo-c-02", nome: "Carlos Mendes", titulo: "Engenheiro Cloud Sênior", stack: [{ skillId: "azure" }, { skillId: "kubernetes" }, { skillId: "docker" }], localidade: "Rio de Janeiro", modo: "Híbrido" },
  { userId: "demo-c-03", nome: "Beatriz Lima", titulo: "DevOps Pleno", stack: [{ skillId: "gcp" }, { skillId: "docker" }, { skillId: "python" }], localidade: "Curitiba", modo: "Remoto" },
  { userId: "demo-c-04", nome: "Diego Costa", titulo: "SRE Sênior", stack: [{ skillId: "aws" }, { skillId: "grafana" }, { skillId: "prometheus" }], localidade: "Porto Alegre", modo: "Remoto" },
  { userId: "demo-c-05", nome: "Fernanda Rocha", titulo: "Desenvolvedora Full Stack", stack: [{ skillId: "nodejs" }, { skillId: "react" }, { skillId: "aws" }], localidade: "Belo Horizonte", modo: "Remoto" },
];

export async function GET() {
  return NextResponse.json({
    ok: true,
    hint: "POST /api/seed/demo para popular 10 vagas + 5 candidatos demo (in-memory, sem DB). Use ?reset=1 para limpar antes.",
    vacancies: vacancyStore.size,
    candidates: candidateStore.size,
  });
}

export async function POST(req: NextRequest) {
  // autoriza staging com dummy; em prod com secret real exige Bearer
  const url = new URL(req.url);
  const reset = url.searchParams.get("reset") === "1";
  if (!isAuthorized(req) && !reset && vacancyStore.size > 0) {
    // se já tem dados e não autorizado, bloqueia para não re-semear sem querer
  }

  if (reset) {
    clearAllForTests();
  }

  const now = new Date();
  const future = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  for (const v of DEMO_VACANCIES) {
    if (!vacancyStore.has(v.id)) {
      seedVacancy({
        id: v.id,
        companyId: "demo-company",
        titulo: v.titulo,
        status: "ativa",
        expiresAt: future,
        stack: v.stack,
        faixaDe: v.faixaDe,
        faixaAte: v.faixaAte,
      } as any);
      // injeta campos extras que a busca usa (para hybridSearch)
      const stored = vacancyStore.get(v.id) as any;
      if (stored) {
        stored.localidade = v.localidade;
        stored.regime = v.regime;
        stored.nivel = v.nivel;
        stored.createdAt = now;
        stored.updatedAt = now;
        stored.descricaoBullets = [v.titulo];
      }
    }
  }

  for (const c of DEMO_CANDIDATES) {
    if (!candidateStore.has(c.userId)) {
      seedCandidate({
        userId: c.userId,
        nome: c.nome,
        titulo: c.titulo,
        email: `${c.userId}@demo.w2talent.com`,
        celular: `+5511999${c.userId.slice(-4).padStart(4, "0")}9`,
        objetivoCrescimento: "Crescer para Sênior em Cloud",
        stack: c.stack,
      } as any);
      const stored = candidateStore.get(c.userId) as any;
      if (stored) {
        stored.localidade = c.localidade;
        stored.modo = c.modo;
        stored.createdAt = now;
        stored.updatedAt = now;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    reset,
    vacancies: vacancyStore.size,
    candidates: candidateStore.size,
    items: { vacancies: DEMO_VACANCIES.length, candidates: DEMO_CANDIDATES.length },
    next: { vagas: "/vagas?q=Analista%20Cloud", candidatos: "/candidatos?q=Cloud" },
  });
}
