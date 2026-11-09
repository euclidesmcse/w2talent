import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { DEMO_FICHAS } from "../lib/demo-data";
// engineType = "client": todo PrismaClient precisa de driver adapter.
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  const company = await prisma.companyProfile.upsert({
    where: { id: "demo-company" },
    create: { id: "demo-company", nome: "W2Talent Demo", cnpj: "00000000000100", site: "https://w2talent.com", validacaoStatus: "validado" },
    update: {},
  });
  console.log("[seed] company", company.id);

  const now = new Date();
  const future = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const vacancies = [
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

  for (const v of vacancies) {
    await prisma.vacancy.upsert({
      where: { id: v.id },
      create: {
        id: v.id, companyId: "demo-company", titulo: v.titulo, stack: v.stack as any,
        localidade: v.localidade, regime: v.regime as any, nivel: v.nivel as any,
        faixaDe: v.faixaDe, faixaAte: v.faixaAte, faixaMoeda: "BRL",
        descricaoBullets: [v.titulo], status: "ativa", expiresAt: future, renovacoes: 0,
      },
      update: {},
    });
  }
  console.log("[seed] vacancies", vacancies.length);

  const candidates = [
    { userId: "demo-c-01", nome: "Ana Silva", titulo: "Analista Cloud Pleno", stack: [{ skillId: "aws" }, { skillId: "terraform" }, { skillId: "linux" }], localidade: "São Paulo", modo: "Remoto" },
    { userId: "demo-c-02", nome: "Carlos Mendes", titulo: "Engenheiro Cloud Sênior", stack: [{ skillId: "azure" }, { skillId: "kubernetes" }, { skillId: "docker" }], localidade: "Rio de Janeiro", modo: "Híbrido" },
    { userId: "demo-c-03", nome: "Beatriz Lima", titulo: "DevOps Pleno", stack: [{ skillId: "gcp" }, { skillId: "docker" }, { skillId: "python" }], localidade: "Curitiba", modo: "Remoto" },
    { userId: "demo-c-04", nome: "Diego Costa", titulo: "SRE Sênior", stack: [{ skillId: "aws" }, { skillId: "grafana" }, { skillId: "prometheus" }], localidade: "Porto Alegre", modo: "Remoto" },
    { userId: "demo-c-05", nome: "Fernanda Rocha", titulo: "Desenvolvedora Full Stack", stack: [{ skillId: "nodejs" }, { skillId: "react" }, { skillId: "aws" }], localidade: "Belo Horizonte", modo: "Remoto" },
  ];
  for (const c of candidates) {
    await prisma.candidateProfile.upsert({
      where: { userId: c.userId },
      create: {
        userId: c.userId, nome: c.nome, titulo: c.titulo, stack: c.stack as any,
        localidade: c.localidade, modo: c.modo as any, objetivoCrescimento: "Crescer para Sênior em Cloud",
        celular: `+5511999${c.userId.slice(-4).padStart(4,"0")}9`, email: `${c.userId}@demo.w2talent.com`,
        status: "ativo", expiresAt: new Date(Date.now()+180*24*60*60*1000),
        ...(DEMO_FICHAS[c.userId] as any),
      },
      // Ficha W2 de exemplo (1.5.11) também nos candidatos de demonstração que já existem.
      update: { ...(DEMO_FICHAS[c.userId] as any) },
    });
  }
  console.log("[seed] candidates", candidates.length);
}

main().finally(() => prisma.$disconnect());
