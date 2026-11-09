import { NextRequest, NextResponse } from "next/server";
import { pedidoDeEnvio, NO_STORE } from "@/lib/envio-request";
import { ENVIO_LIMITE_24H, ENVIO_LIMITE_LOTE, estadoDasVagas, fichaParaEmpresa, limparIds, usadasNas24h } from "@/lib/envio";

/** Estado de cada vaga selecionada para o candidato, o match e o que a empresa vai receber. */
export async function POST(req: NextRequest) {
  const p = await pedidoDeEnvio(req);
  if ("erro" in p) return p.erro;
  const { db, perfil, body } = p;
  try {
    const now = new Date();
    const ids = limparIds(body.vacancyIds);
    const [itens, usadas] = await Promise.all([estadoDasVagas(db, perfil, ids, now), usadasNas24h(db, perfil.id, now)]);
    return NextResponse.json(
      {
        // Sem e-mail, telefone nem links: a tela mostra só o que a empresa recebe.
        perfil: { ficha: fichaParaEmpresa(perfil.ficha, null), w2: perfil.w2 },
        itens: itens.map(({ vaga, ...it }) => ({
          ...it,
          vaga: vaga && {
            id: vaga.id,
            titulo: vaga.titulo,
            empresa: vaga.company.nome,
            temContato: !!vaga.company.emailContato,
            stack: vaga.stack,
            nivel: vaga.nivel,
            regime: vaga.regime,
            localidade: vaga.localidade,
            faixaDe: vaga.faixaDe,
            faixaAte: vaga.faixaAte,
            faixaMoeda: vaga.faixaMoeda,
            descricaoBullets: vaga.descricaoBullets,
            beneficios: vaga.beneficios,
            updatedAt: vaga.updatedAt,
          },
          paraEmpresa: vaga ? fichaParaEmpresa(perfil.ficha, vaga.regime) : null,
        })),
        limites: { lote: ENVIO_LIMITE_LOTE, dia: ENVIO_LIMITE_24H, usadas24h: usadas },
      },
      { headers: NO_STORE },
    );
  } catch (e) {
    console.error("[envio/estado] falhou:", e instanceof Error ? e.name : e);
    return NextResponse.json({ error: "erro" }, { status: 500, headers: NO_STORE });
  }
}

export const dynamic = "force-dynamic";
