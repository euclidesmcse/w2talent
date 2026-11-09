// Demo estático — aparece em staging sem Postgres (Workers isolates perdem Map em memória)
// Quando o worker sobe frio, vacancyStore está vazio; o fallback estático garante lista navegável.
import type { VacancyMock, CandidateMock } from "./proxy";

const now = new Date();
const future = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

export const DEMO_VACANCIES: any[] = [
  { id: "demo-v-01", companyId: "demo-company", titulo: "Analista Cloud Pleno — AWS", status: "ativa", expiresAt: future, stack: [{ skillId: "aws" }, { skillId: "terraform" }], localidade: "Remoto", regime: "CLT", nivel: "Pleno", faixaDe: 9000, faixaAte: 13000, descricaoBullets: ["AWS + Terraform", "Remoto"], createdAt: now, updatedAt: now },
  { id: "demo-v-02", companyId: "demo-company", titulo: "Engenheiro Cloud Sênior — Azure + Kubernetes", status: "ativa", expiresAt: future, stack: [{ skillId: "azure" }, { skillId: "kubernetes" }], localidade: "São Paulo (Híbrido)", regime: "CLT", nivel: "Sênior", faixaDe: 14000, faixaAte: 19000, descricaoBullets: ["Azure, Kubernetes", "Híbrido SP"], createdAt: now, updatedAt: now },
  { id: "demo-v-03", companyId: "demo-company", titulo: "DevOps Pleno — GCP + Docker", status: "ativa", expiresAt: future, stack: [{ skillId: "gcp" }, { skillId: "docker" }], localidade: "Remoto", regime: "PJ", nivel: "Pleno", faixaDe: 8000, faixaAte: 12000, descricaoBullets: ["GCP, Docker"], createdAt: now, updatedAt: now },
  { id: "demo-v-04", companyId: "demo-company", titulo: "Analista Cloud Júnior — Suporte N2", status: "ativa", expiresAt: future, stack: [{ skillId: "aws" }, { skillId: "linux" }], localidade: "Curitiba (Presencial)", regime: "CLT", nivel: "Júnior", faixaDe: 4000, faixaAte: 6000, descricaoBullets: ["Suporte N2 AWS"], createdAt: now, updatedAt: now },
  { id: "demo-v-05", companyId: "demo-company", titulo: "SRE — Cloud + Observabilidade", status: "ativa", expiresAt: future, stack: [{ skillId: "aws" }, { skillId: "grafana" }], localidade: "Remoto", regime: "PJ", nivel: "Sênior", faixaDe: 15000, faixaAte: 22000, descricaoBullets: ["Grafana, Prometheus"], createdAt: now, updatedAt: now },
  { id: "demo-v-06", companyId: "demo-company", titulo: "Desenvolvedor Full Stack — Node + React + AWS", status: "ativa", expiresAt: future, stack: [{ skillId: "nodejs" }, { skillId: "react" }, { skillId: "aws" }], localidade: "Remoto", regime: "CLT", nivel: "Pleno", faixaDe: 10000, faixaAte: 15000, descricaoBullets: ["Node, React, AWS"], createdAt: now, updatedAt: now },
  { id: "demo-v-07", companyId: "demo-company", titulo: "Analista de Dados Cloud — BigQuery", status: "ativa", expiresAt: future, stack: [{ skillId: "gcp" }, { skillId: "python" }], localidade: "Remoto", regime: "PJ", nivel: "Pleno", faixaDe: 9000, faixaAte: 14000, descricaoBullets: ["BigQuery, Python"], createdAt: now, updatedAt: now },
  { id: "demo-v-08", companyId: "demo-company", titulo: "Arquiteto Cloud — Multi-cloud", status: "ativa", expiresAt: future, stack: [{ skillId: "aws" }, { skillId: "azure" }], localidade: "São Paulo (Remoto parcial)", regime: "PJ", nivel: "Sênior", faixaDe: 18000, faixaAte: 26000, descricaoBullets: ["Multi-cloud"], createdAt: now, updatedAt: now },
  { id: "demo-v-09", companyId: "demo-company", titulo: "Tech Lead Cloud — Liderança + FinOps", status: "ativa", expiresAt: future, stack: [{ skillId: "aws" }, { skillId: "finops" }], localidade: "Remoto", regime: "PJ", nivel: "Sênior", faixaDe: 20000, faixaAte: 30000, descricaoBullets: ["FinOps, Liderança"], createdAt: now, updatedAt: now },
  { id: "demo-v-10", companyId: "demo-company", titulo: "Estágio Cloud — Trainee AWS", status: "ativa", expiresAt: future, stack: [{ skillId: "aws" }], localidade: "São Paulo (Híbrido)", regime: "Estágio", nivel: "Estágio", faixaDe: 1800, faixaAte: 2500, descricaoBullets: ["Trainee AWS"], createdAt: now, updatedAt: now },
];

/** Ficha W2 de exemplo (1.5.11) para os candidatos de demonstração. Usada no fallback, no seed e em /api/seed/demo. */
const W2 = (resumo: string, destaques: string[]) => ({ resumo, destaques, idioma: "pt-BR", geradaEm: "2026-11-09T12:00:00.000Z", modelo: "exemplo", editada: true });
export const DEMO_FICHAS: Record<string, Record<string, unknown>> = {
  "demo-c-01": {
    senioridade: "pleno", regimePreferido: ["CLT"], pretensaoDe: 9000, pretensaoAte: 12000, pretensaoMoeda: "BRL", disponibilidade: "30d", mudanca: false,
    stack: [{ skillId: "aws", anos: 4 }, { skillId: "terraform", anos: 3 }, { skillId: "linux", anos: 5 }],
    experiencias: [{ cargo: "Analista Cloud", empresa: "Fintech exemplo", inicio: "2022-03", fim: "", atual: true }, { cargo: "Analista de Infraestrutura", empresa: "Varejo exemplo", inicio: "2020-01", fim: "2022-02", atual: false }],
    idiomas: [{ idioma: "Inglês", nivel: "avancado" }],
    fichaW2: W2("Analista cloud com 5 anos em infraestrutura, os últimos 3 em AWS. Automatiza ambientes com Terraform e cuida de custos e segurança em contas de produção.", ["Migrou 40 servidores locais para AWS sem parada de serviço", "Mantém módulos Terraform usados por 6 times", "Certificação AWS Solutions Architect Associate"]),
  },
  "demo-c-02": {
    senioridade: "senior", regimePreferido: ["CLT", "PJ"], pretensaoDe: 16000, pretensaoAte: 20000, pretensaoMoeda: "BRL", disponibilidade: "60d", mudanca: true,
    stack: [{ skillId: "azure", anos: 6 }, { skillId: "kubernetes", anos: 4 }, { skillId: "docker", anos: 6 }],
    experiencias: [{ cargo: "Engenheiro Cloud", empresa: "Seguradora exemplo", inicio: "2019-05", fim: "", atual: true }, { cargo: "Analista de Sistemas", empresa: "Consultoria exemplo", inicio: "2016-02", fim: "2019-04", atual: false }],
    idiomas: [{ idioma: "Inglês", nivel: "fluente" }, { idioma: "Espanhol", nivel: "intermediario" }],
    fichaW2: W2("Engenheiro cloud sênior com 9 anos de experiência, 6 deles em Azure. Opera clusters Kubernetes de produção e lidera a padronização de pipelines.", ["Opera 12 clusters AKS com SLA de 99,9%", "Reduziu o tempo de deploy de 40 para 8 minutos", "Mentor de 4 analistas"]),
  },
  "demo-c-03": {
    senioridade: "pleno", regimePreferido: ["PJ"], pretensaoDe: 10000, pretensaoAte: 13000, pretensaoMoeda: "BRL", disponibilidade: "imediata", mudanca: false,
    stack: [{ skillId: "gcp", anos: 3 }, { skillId: "docker", anos: 4 }, { skillId: "python", anos: 5 }],
    experiencias: [{ cargo: "DevOps", empresa: "Startup exemplo", inicio: "2021-06", fim: "", atual: true }, { cargo: "Desenvolvedora Python", empresa: "Agência exemplo", inicio: "2019-08", fim: "2021-05", atual: false }],
    idiomas: [{ idioma: "Inglês", nivel: "intermediario" }],
    fichaW2: W2("DevOps com base em desenvolvimento Python e 3 anos em GCP. Constrói pipelines de CI/CD e containeriza aplicações legadas.", ["Containerizou 15 serviços legados em Cloud Run", "Criou o pipeline de CI usado por toda a empresa"]),
  },
  "demo-c-04": {
    senioridade: "senior", regimePreferido: ["PJ"], pretensaoDe: 17000, pretensaoAte: 22000, pretensaoMoeda: "BRL", disponibilidade: "30d", mudanca: false,
    stack: [{ skillId: "aws", anos: 7 }, { skillId: "grafana", anos: 4 }, { skillId: "prometheus", anos: 4 }],
    experiencias: [{ cargo: "SRE", empresa: "E-commerce exemplo", inicio: "2018-01", fim: "", atual: true }, { cargo: "Analista de Suporte", empresa: "Telecom exemplo", inicio: "2015-03", fim: "2017-12", atual: false }],
    idiomas: [{ idioma: "Inglês", nivel: "avancado" }],
    fichaW2: W2("SRE sênior com 10 anos em operações, 7 em AWS. Responsável por observabilidade e resposta a incidentes em sistemas de alto tráfego.", ["Montou a observabilidade com Grafana e Prometheus para 80 serviços", "Reduziu incidentes graves em 60% em um ano"]),
  },
  "demo-c-05": {
    senioridade: "pleno", regimePreferido: ["CLT"], pretensaoDe: 11000, pretensaoAte: 14000, pretensaoMoeda: "BRL", disponibilidade: "15d", mudanca: true,
    stack: [{ skillId: "nodejs", anos: 5 }, { skillId: "react", anos: 4 }, { skillId: "aws", anos: 2 }],
    experiencias: [{ cargo: "Desenvolvedora Full Stack", empresa: "SaaS exemplo", inicio: "2020-09", fim: "", atual: true }, { cargo: "Desenvolvedora Front-end", empresa: "Agência exemplo", inicio: "2019-01", fim: "2020-08", atual: false }],
    idiomas: [{ idioma: "Inglês", nivel: "avancado" }],
    fichaW2: W2("Desenvolvedora full stack com 6 anos em Node.js e React, publicando em AWS. Atua do banco à interface em produtos SaaS.", ["Liderou a reescrita do painel do cliente em React", "Mantém APIs Node.js com 2 milhões de chamadas por dia"]),
  },
};

export const DEMO_CANDIDATES: any[] = [
  { userId: "demo-c-01", nome: "Ana Silva", titulo: "Analista Cloud Pleno", status: "ativo", stack: [{ skillId: "aws" }, { skillId: "terraform" }, { skillId: "linux" }], localidade: "São Paulo", modo: "Remoto", objetivoCrescimento: "Crescer para Sênior em Cloud", celular: "+551199910001", email: "ana@demo.w2talent.com", createdAt: now, updatedAt: now, ...DEMO_FICHAS["demo-c-01"] },
  { userId: "demo-c-02", nome: "Carlos Mendes", titulo: "Engenheiro Cloud Sênior", status: "ativo", stack: [{ skillId: "azure" }, { skillId: "kubernetes" }, { skillId: "docker" }], localidade: "Rio de Janeiro", modo: "Híbrido", objetivoCrescimento: "Arquiteto Cloud", celular: "+551199910002", email: "carlos@demo.w2talent.com", createdAt: now, updatedAt: now, ...DEMO_FICHAS["demo-c-02"] },
  { userId: "demo-c-03", nome: "Beatriz Lima", titulo: "DevOps Pleno", status: "ativo", stack: [{ skillId: "gcp" }, { skillId: "docker" }, { skillId: "python" }], localidade: "Curitiba", modo: "Remoto", objetivoCrescimento: "SRE", celular: "+551199910003", email: "beatriz@demo.w2talent.com", createdAt: now, updatedAt: now, ...DEMO_FICHAS["demo-c-03"] },
  { userId: "demo-c-04", nome: "Diego Costa", titulo: "SRE Sênior", status: "ativo", stack: [{ skillId: "aws" }, { skillId: "grafana" }, { skillId: "prometheus" }], localidade: "Porto Alegre", modo: "Remoto", objetivoCrescimento: "Tech Lead", celular: "+551199910004", email: "diego@demo.w2talent.com", createdAt: now, updatedAt: now, ...DEMO_FICHAS["demo-c-04"] },
  { userId: "demo-c-05", nome: "Fernanda Rocha", titulo: "Desenvolvedora Full Stack", status: "ativo", stack: [{ skillId: "nodejs" }, { skillId: "react" }, { skillId: "aws" }], localidade: "Belo Horizonte", modo: "Remoto", objetivoCrescimento: "Staff Engineer", celular: "+551199910005", email: "fernanda@demo.w2talent.com", createdAt: now, updatedAt: now, ...DEMO_FICHAS["demo-c-05"] },
];
