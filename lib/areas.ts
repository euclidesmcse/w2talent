/**
 * Áreas da busca de vagas (ideia trazida do portal emagine, aprovada pelo Euclides em 2026-11-12).
 * Um segundo caminho para quem não sabe o que digitar: a área abre as competências mais pedidas
 * dela, e escolher uma escreve a competência na busca, como se a pessoa tivesse digitado.
 * As competências vêm da taxonomia (lib/taxonomy.ts); o teste confere que todas existem e que a
 * busca entende cada uma.
 */
export type AreaId =
  | "cloud"
  | "devops"
  | "backend"
  | "frontend"
  | "mobile"
  | "dados"
  | "ia"
  | "bancos"
  | "seguranca"
  | "qa"
  | "erp"
  | "produto";

export type AreaBusca = {
  id: AreaId;
  /** Cor do ponto ao lado do nome. Só enfeite: o nome sempre aparece. */
  cor: string;
  skills: string[];
};

export const AREAS: AreaBusca[] = [
  { id: "cloud", cor: "#1F4FD8", skills: ["aws", "azure", "gcp", "kubernetes", "docker", "cloudflare", "openshift", "vmware"] },
  { id: "devops", cor: "#0891B2", skills: ["terraform", "ansible", "github-actions", "gitlab-ci", "jenkins", "argo-cd", "helm", "prometheus", "grafana", "linux"] },
  { id: "backend", cor: "#7C3AED", skills: ["java", "nodejs", "python", "dotnet", "go", "spring-boot", "nestjs", "django", "php", "laravel"] },
  { id: "frontend", cor: "#DB2777", skills: ["react", "nextjs", "angular", "vue", "typescript", "javascript", "tailwind"] },
  { id: "mobile", cor: "#EA580C", skills: ["react-native", "flutter", "android-native", "ios-native", "kotlin", "swift"] },
  { id: "dados", cor: "#0D9488", skills: ["spark", "databricks", "airflow", "dbt", "kafka", "powerbi", "tableau", "pandas"] },
  { id: "ia", cor: "#4F46E5", skills: ["openai-api", "langchain", "pytorch", "tensorflow", "huggingface", "anthropic"] },
  { id: "bancos", cor: "#B45309", skills: ["postgresql", "mysql", "oracle-db", "sqlserver", "mongodb", "redis", "elasticsearch"] },
  { id: "seguranca", cor: "#DC2626", skills: ["owasp", "keycloak", "okta", "snyk", "sonarqube", "burp", "crowdstrike", "oauth"] },
  { id: "qa", cor: "#16A34A", skills: ["cypress", "playwright", "selenium", "jest", "junit", "appium", "k6", "postman"] },
  { id: "erp", cor: "#9333EA", skills: ["sap", "salesforce", "hubspot", "totvs", "microsoft-dynamics", "servicenow", "outsystems"] },
  { id: "produto", cor: "#64748B", skills: ["scrum", "agile", "jira", "product-management", "ux-design", "figma", "kanban"] },
];

/** Quantas competências da área já estão na busca (a área fica marcada quando há alguma). */
export function skillsDaAreaNaBusca(area: AreaBusca, skillsDaBusca: string[]): number {
  return area.skills.filter((s) => skillsDaBusca.includes(s)).length;
}

/** Acrescenta uma competência ao texto buscado (pelo nome que a busca entende). */
export function acrescentarNaBusca(q: string, termo: string): string {
  return `${q} ${termo}`.replace(/\s+/g, " ").trim();
}
