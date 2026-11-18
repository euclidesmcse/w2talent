import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { lerMercado, MIN_EMPRESAS } from "@/lib/mercado";
import { modoValido, type MercadoApi } from "@/lib/mercado-tela";
import { getSkill } from "@/lib/taxonomy";

/**
 * 3.2a Inteligência de mercado: números anônimos das vagas e fichas do W2Talent, sem login.
 * `?skill=<skillId>` (da taxonomia; desconhecida → 400) e `?modo=remoto|hibrido|presencial` (outro valor é ignorado).
 * Os agregados mudam uma vez por dia (Cron), então a resposta fica 5 min em cache. Ela não tem texto
 * de idioma (os nomes das competências são os da taxonomia), por isso não varia por x-locale.
 */
const CACHE = { "cache-control": "public, max-age=300" };
const NO_STORE = { "cache-control": "no-store" };

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const skillParam = (sp.get("skill") ?? "").trim();
  const skill = skillParam ? getSkill(skillParam) : null;
  if (skillParam && !skill) return NextResponse.json({ error: "competência desconhecida" }, { status: 400, headers: NO_STORE });
  const modo = modoValido(sp.get("modo"));

  let visao;
  let pretensoes;
  try {
    visao = await lerMercado(prisma, { skillId: skill?.id ?? null, modo });
    // As fichas não separam a pretensão por modo (lib/mercado.ts): com modo, usa a de todos os modos.
    pretensoes = modo && visao.semana ? (await lerMercado(prisma, { skillId: skill?.id ?? null })).pretensoes : visao.pretensoes;
  } catch (e) {
    console.error("[mercado] falhou:", e instanceof Error ? e.name : e);
    return NextResponse.json({ error: "Dados de mercado indisponíveis agora." }, { status: 503, headers: NO_STORE });
  }

  // Demanda da competência escolhida segue o mínimo de empresas, como as listas "mais pedidas" e "em alta".
  const d = visao.demanda;
  const demandaVisivel = d && d.empresas >= MIN_EMPRESAS ? d : null;
  const demandaFaltamEmpresas = d && !demandaVisivel ? MIN_EMPRESAS - d.empresas : 0;

  const nomes: Record<string, string> = {};
  for (const id of [skill?.id, ...visao.maisPedidas.map((x) => x.skillId), ...visao.emAlta.map((x) => x.skillId)]) {
    if (id) nomes[id] = getSkill(id)?.label ?? id;
  }

  const corpo: MercadoApi = {
    ...visao,
    pretensoes,
    modo,
    skill: skill ? { id: skill.id, label: skill.label } : null,
    demanda: demandaVisivel,
    demandaFaltamEmpresas,
    pretensoesTodosModos: !!modo,
    nomes,
  };
  return NextResponse.json(corpo, { headers: CACHE });
}

export const dynamic = "force-dynamic";
