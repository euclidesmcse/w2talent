import { NextRequest, NextResponse } from "next/server";
import { handleIngestPOST } from "@/lib/cv-ingest";
import { exigirConta } from "@/lib/sessao";
// ingest via handleIngestPOST -> extractToCanonical + iaReescritaV LGPD validation 400/403 (see lib/cv-ingest.ts)

// 1.5.5: lê CV com IA só para candidato logado (a tela atual usa /api/ficha/ler).
export async function POST(req: NextRequest) {
  const acesso = await exigirConta(req, { perfil: "candidato" });
  if ("erro" in acesso) return acesso.erro;
  return handleIngestPOST(req);
}

export async function GET() {
  return NextResponse.json({ error: "use POST /api/candidates para ingest" }, { status: 405 });
}
