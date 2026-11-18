/**
 * Competências próximas (2.2a, plano 2.2 D1–D3, aprovado em 2026-11-18).
 * Mapa fixo, escrito à mão e revisado no PR: nada de embeddings, para dar para explicar e corrigir.
 *
 * - PROXIMAS: pares de mão dupla. Quem tem uma e a vaga pede a outra ganha metade (0,5) da competência.
 * - COBRE: [maior, menor]. Quem tem a maior atende a menor por inteiro (ter TypeScript cobre JavaScript;
 *   ter Next.js cobre React). No sentido contrário, valem como próximas (0,5).
 * - IGUAIS: dois ids da taxonomia para a mesma coisa (ex.: "abap" e "sap-abap"): contam como exata.
 */

export const PESO_PROXIMA = 0.5;

const PROXIMAS: [string, string][] = [
  // Linguagens
  ["java", "kotlin"], ["java", "scala"], ["java", "csharp"], ["csharp", "dotnet"], ["csharp", "vbnet"], ["csharp", "fsharp"],
  ["c", "cpp"], ["cpp", "rust"], ["go", "rust"], ["python", "ruby"], ["ruby", "elixir"], ["elixir", "erlang"],
  ["haskell", "ocaml"], ["ocaml", "fsharp"], ["ocaml", "reasonml"], ["elm", "purescript"], ["swift", "objective-c"],
  ["swift", "kotlin"], ["javascript", "coffeescript"], ["graphql-lang", "graphql-server"],
  // Backend
  ["express", "fastify"], ["express", "koa"], ["express", "hono"], ["express", "nestjs"], ["fastify", "hono"],
  ["django", "flask"], ["django", "fastapi"], ["flask", "fastapi"], ["spring-boot", "quarkus"], ["spring-boot", "micronaut"],
  ["quarkus", "micronaut"], ["laravel", "symfony"], ["gin", "echo-go"], ["gin", "fiber"], ["echo-go", "fiber"],
  ["aspnet", "dotnet-core"], ["actix", "rocket"], ["trpc", "graphql-server"],
  // Frontend
  ["react", "preact"], ["react", "vue"], ["vue", "svelte"], ["svelte", "solidjs"], ["react", "solidjs"],
  ["nextjs", "remix"], ["nextjs", "gatsby"], ["redux", "zustand"], ["redux", "mobx"], ["zustand", "jotai"], ["recoil", "jotai"],
  ["tailwind", "bootstrap"], ["material-ui", "chakra-ui"], ["chakra-ui", "ant-design"], ["styled-components", "emotion"],
  ["sass", "less"], ["webpack", "vite"], ["vite", "esbuild"], ["vite", "rollup"], ["webpack", "parcel"], ["webpack", "turbopack"],
  ["react", "react-native"],
  // Mobile
  ["react-native", "flutter"], ["ionic", "capacitor"], ["cordova", "capacitor"], ["xamarin", "maui"], ["electron", "tauri"],
  ["ios-native", "swiftui"], ["android-native", "jetpack-compose"], ["kotlin-multiplatform", "flutter"],
  // Cloud e contêineres
  ["aws", "azure"], ["aws", "gcp"], ["azure", "gcp"], ["kubernetes", "openshift"], ["kubernetes", "nomad"],
  ["lambda", "cloud-functions"], ["lambda", "cloudflare-workers"], ["cloud-run", "ecs"], ["ecs", "eks"], ["sqs", "sns"],
  ["s3", "cloudflare-r2"], ["cloudformation", "terraform"], ["aws-cdk", "pulumi"], ["istio", "linkerd"], ["envoy", "istio"],
  ["nginx", "apache"], ["nginx", "caddy"], ["nginx", "traefik"], ["nginx", "haproxy"], ["traefik", "envoy"],
  ["firebase", "supabase"], ["vercel", "netlify"], ["heroku", "render"], ["heroku", "railway"], ["render", "flyio"],
  ["digitalocean", "linode"], ["linode", "hetzner"], ["vmware", "proxmox"], ["kvm", "proxmox"], ["hyper-v", "vmware"],
  ["virtualbox", "vmware"],
  // DevOps
  ["terraform", "pulumi"], ["terraform", "crossplane"], ["ansible", "chef"], ["chef", "puppet"], ["ansible", "puppet"],
  ["jenkins", "gitlab-ci"], ["gitlab-ci", "github-actions"], ["github-actions", "circleci"], ["circleci", "travisci"],
  ["jenkins", "teamcity"], ["teamcity", "bamboo"], ["buildkite", "circleci"], ["argo-cd", "flux"], ["argo-cd", "spinnaker"],
  ["spinnaker", "harness"], ["helm", "kustomize"], ["prometheus", "grafana"], ["prometheus", "datadog"], ["datadog", "newrelic"],
  ["elk", "splunk"], ["pagerduty", "opsgenie"], ["n8n", "zapier"], ["zapier", "make"], ["n8n", "make"],
  ["airflow", "prefect"], ["prefect", "dagster"], ["airflow", "dagster"], ["maven", "gradle"], ["npm", "yarn"], ["yarn", "pnpm"],
  ["npm", "pnpm"],
  // Bancos de dados
  ["postgresql", "mysql"], ["mysql", "mariadb"], ["postgresql", "cockroachdb"], ["sqlserver", "oracle-db"],
  ["oracle-db", "postgresql"], ["sqlserver", "postgresql"], ["mongodb", "couchbase"], ["mongodb", "dynamodb-db"],
  ["couchdb", "couchbase"], ["neo4j", "arangodb"], ["elasticsearch", "opensearch"], ["elasticsearch", "solr"],
  ["meilisearch", "typesense"], ["elasticsearch", "meilisearch"], ["snowflake", "bigquery"], ["bigquery", "redshift"],
  ["snowflake", "redshift"], ["influxdb", "timescaledb"], ["prisma-orm", "typeorm"], ["typeorm", "sequelize"],
  ["prisma-orm", "drizzle"], ["mysql", "planetscale"],
  // Dados e IA
  ["pandas", "numpy"], ["numpy", "scipy"], ["tensorflow", "pytorch"], ["keras", "pytorch"],
  ["openai-api", "anthropic"], ["spark", "hadoop"], ["kafka", "rabbitmq"], ["kafka", "kinesis"], ["kafka", "pubsub"],
  ["kinesis", "pubsub"], ["rabbitmq", "nats"], ["rabbitmq", "sqs"], ["looker", "tableau"], ["tableau", "powerbi"],
  ["looker", "powerbi"], ["metabase", "superset"], ["mlflow", "kubeflow"], ["pinecone", "weaviate"], ["weaviate", "qdrant"],
  ["qdrant", "milvus"], ["pinecone", "qdrant"], ["pgvector-skill", "pinecone"], ["chromadb", "qdrant"], ["spacy", "nltk"],
  ["tensorrt", "onnx-runtime"],
  // Segurança
  ["oauth", "openid"], ["oauth", "jwt"], ["saml", "openid"], ["keycloak", "auth0"], ["auth0", "okta"], ["keycloak", "okta"],
  ["snyk", "trivy"], ["trivy", "grype"], ["cert-manager", "letsencrypt"], ["cosign", "notary"], ["sops", "vault-security"],
  // ERP e plataformas
  ["salesforce", "microsoft-dynamics"], ["salesforce", "hubspot"], ["outsystems", "mendix"], ["mendix", "appian"],
  ["appian", "pega"], ["apex", "salesforce"],
  // Produto
  ["scrum", "kanban"], ["jira", "linear"], ["trello", "asana"], ["confluence", "notion"], ["figma", "sketch"],
  ["sketch", "adobe-xd"], ["figma", "adobe-xd"], ["ux-design", "ui-design"], ["mixpanel", "amplitude"],
  ["amplitude", "posthog"], ["mixpanel", "posthog"],
  // QA
  ["jest", "vitest"], ["jest", "mocha"], ["cypress", "playwright"], ["selenium", "webdriverio"], ["cypress", "testcafe"],
  ["playwright", "puppeteer"], ["selenium", "playwright"], ["k6", "jmeter"], ["jmeter", "gatling"], ["k6", "gatling"],
  ["postman", "insomnia"], ["detox", "appium"],
  // Blockchain
  ["ethereum", "polygon"], ["hardhat", "foundry"], ["hardhat", "truffle"], ["ethersjs", "web3js"], ["solidity", "ethereum"],
  ["ipfs", "arweave"], ["ipfs", "filecoin"],
];

/** [maior, menor]: quem tem a maior atende a menor. */
const COBRE: [string, string][] = [
  ["typescript", "javascript"], ["nextjs", "react"], ["nuxt", "vue"], ["remix", "react"], ["gatsby", "react"],
  ["express", "nodejs"], ["nestjs", "nodejs"], ["fastify", "nodejs"], ["koa", "nodejs"],
  ["django", "python"], ["flask", "python"], ["fastapi", "python"], ["spring-boot", "spring"], ["spring-boot", "java"],
  ["quarkus", "java"], ["rails", "ruby"], ["laravel", "php"], ["symfony", "php"], ["phoenix", "elixir"],
  ["aspnet", "csharp"], ["dotnet-core", "csharp"], ["gin", "go"], ["actix", "rust"], ["ktor", "kotlin"],
  ["flutter", "dart"], ["swiftui", "swift"], ["jetpack-compose", "kotlin"], ["plsql", "sql"],
  ["eks", "kubernetes"], ["openshift", "docker"], ["kubernetes", "docker"], ["helm", "kubernetes"],
  ["ec2", "aws"], ["s3", "aws"], ["lambda", "aws"], ["eks", "aws"], ["ecs", "aws"], ["rds", "aws"],
  ["timescaledb", "postgresql"], ["supabase-db", "postgresql"], ["cockroachdb", "sql"],
  ["databricks", "spark"], ["langgraph", "langchain"], ["keras", "tensorflow"],
  ["scrum", "agile"], ["kanban", "agile"], ["power-platform", "power-apps"], ["power-platform", "power-automate"],
  ["sap-fiori", "sap"], ["sap-hana", "sap"],
];

/** Ids diferentes da taxonomia para a mesma coisa. */
const IGUAIS: [string, string][] = [
  ["abap", "sap-abap"], ["shell", "bash-devops"], ["powershell", "powershell-devops"], ["airflow", "airflow-data"],
  ["dbt", "dbt-core"], ["snowflake", "snowflake-data"], ["dynamodb", "dynamodb-db"], ["vault", "vault-security"],
  ["playwright", "playwright-test"], ["k6", "k6-cloud"], ["onnx", "onnx-runtime"], ["supabase", "supabase-db"],
];

/** Pares usados (para os testes conferirem que todo id existe na taxonomia). */
export const PARES_PROXIMAS = { PROXIMAS, COBRE, IGUAIS } as const;

const chave = (a: string, b: string) => `${a}\u0000${b}`;
const PESO = new Map<string, number>();
for (const [a, b] of PROXIMAS) {
  PESO.set(chave(a, b), PESO_PROXIMA);
  PESO.set(chave(b, a), PESO_PROXIMA);
}
for (const [maior, menor] of COBRE) {
  PESO.set(chave(maior, menor), 1);
  if (!PESO.has(chave(menor, maior))) PESO.set(chave(menor, maior), PESO_PROXIMA);
}
for (const [a, b] of IGUAIS) {
  PESO.set(chave(a, b), 1);
  PESO.set(chave(b, a), 1);
}

/**
 * Quanto a competência que a pessoa tem atende a que é pedida: 1 (a mesma, igual ou cobre),
 * 0,5 (próxima) ou 0. "Pessoa" é sempre o lado do candidato, mesmo quando é ele quem busca.
 */
export function pesoCompetencia(daPessoa: string, pedida: string): number {
  if (daPessoa === pedida) return 1;
  return PESO.get(chave(daPessoa, pedida)) ?? 0;
}

/** Melhor competência da pessoa para uma pedida: a exata, a que cobre, ou a próxima. */
export function melhorCompetencia(daPessoa: Iterable<string>, pedida: string): { skill: string; peso: number } | null {
  let melhor: { skill: string; peso: number } | null = null;
  for (const s of daPessoa) {
    const peso = pesoCompetencia(s, pedida);
    if (peso > (melhor?.peso ?? 0)) melhor = { skill: s, peso };
    if (peso === 1) break;
  }
  return melhor;
}

/** Competências que valem alguma coisa para quem tem `id` (ela mesma primeiro, depois as que cobre e as próximas). */
export function vizinhasDe(id: string): string[] {
  const out = [id];
  for (const k of PESO.keys()) {
    const [a, b] = k.split("\u0000");
    if (a === id && b !== id && !out.includes(b)) out.push(b);
  }
  return out;
}
