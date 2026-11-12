/**
 * Áreas da busca de vagas (ideia trazida do portal emagine, aprovada pelo Euclides em 2026-11-12).
 * Um segundo caminho para quem não sabe o que digitar: a área abre as competências mais pedidas
 * dela, e escolher uma escreve a competência na busca, como se a pessoa tivesse digitado.
 * As competências vêm da taxonomia (lib/taxonomy.ts); o teste confere que todas existem e que a
 * busca entende cada uma.
 */
import { parseQueryIntent, removeChipFromQuery, type IntentChip } from "@/lib/query-intent";

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

/** Critérios de um valor só: a busca entende o primeiro e ignora os outros. */
const UNICOS = new Set<IntentChip["kind"]>(["regime", "modo", "nivel", "faixa"]);
const mesmoCriterio = (a: IntentChip, b: IntentChip) => a.kind === b.kind && (UNICOS.has(a.kind) || (a.kind === "skill" && a.value === b.value));

/**
 * Tira da busca o que a busca ignoraria por repetir um critério ("remoto presencial", "React React").
 * Sem isso o termo repetido ficava escondido: não vira chip e o campo fica vazio quando há chips.
 */
export function semCriterioRepetido(q: string): string {
  let atual = q.trim().replace(/\s+/g, " ");
  for (let volta = 0; volta < 20; volta++) {
    const chips = parseQueryIntent(atual).chips.filter((c) => c.kind !== "texto" && c.kind !== "idioma");
    let mudou = false;
    for (const c of chips) {
      // Tira o chip visível pelo trecho exato e guarda onde ficou a emenda, para achar o repetido
      // pela posição (nunca por busca de texto: "Java" não pode cortar "JavaScript").
      const esq = atual.slice(0, c.start).trimEnd();
      const dir = atual.slice(c.end).trimStart();
      const sep = esq && dir ? 1 : 0;
      const sem = esq + (sep ? " " : "") + dir;
      const repetido = parseQueryIntent(sem).chips.find((d) => mesmoCriterio(c, d));
      if (!repetido) continue;
      const iniDir = esq.length + sep;
      const paraAtual = (p: number) => (p >= iniDir ? p - iniDir + (atual.length - dir.length) : p);
      // trecho que atravessa a emenda não existe no texto original
      if (repetido.start < iniDir && repetido.end > esq.length) continue;
      const ini = paraAtual(repetido.start);
      const fim = paraAtual(repetido.end);
      if (atual.slice(ini, fim) !== repetido.source) continue;
      atual = (atual.slice(0, ini) + " " + atual.slice(fim)).replace(/\s+/g, " ").trim();
      mudou = true;
      break;
    }
    if (!mudou) break;
  }
  return atual;
}

/**
 * Acrescenta um termo ao texto buscado (pelo nome que a busca entende). Se o termo novo troca um
 * critério de um valor só (outro modelo, regime, nível ou faixa), o novo vale e o antigo sai.
 */
export function acrescentarNaBusca(q: string, termo: string): string {
  let base = q;
  for (const novo of parseQueryIntent(termo).chips) {
    if (!UNICOS.has(novo.kind)) continue;
    const antigo = parseQueryIntent(base).chips.find((c) => c.kind === novo.kind);
    if (antigo) base = removeChipFromQuery(base, antigo);
  }
  return semCriterioRepetido(`${base} ${termo}`);
}
