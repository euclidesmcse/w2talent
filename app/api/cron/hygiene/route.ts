import { NextRequest, NextResponse } from "next/server";
import { requestHasSecret } from "@/lib/secret";
import { runHygieneCron } from "@/lib/hygiene";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Secret not configured: deny in prod, allow only in test or explicit flag
    if (process.env.NODE_ENV === "test" || process.env.ALLOW_CRON_WITHOUT_SECRET === "true") return true;
    return false;
  }
  // Bearer <secret> | plain secret | x-cron-secret | ?cron_secret= (comparação em tempo constante)
  return requestHasSecret(req, secret);
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret && process.env.NODE_ENV !== "test" && process.env.ALLOW_CRON_WITHOUT_SECRET !== "true") {
    return NextResponse.json({ error: "cron_secret_not_configured" }, { status: 503 });
  }
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const nowParam = req.nextUrl.searchParams.get("now");
  const now = nowParam ? new Date(nowParam) : new Date();
  const summary = await runHygieneCron(now);
  return NextResponse.json({ ok: true, ...summary }, { status: 200 });
}

// n8n pode usar POST também
export async function POST(req: NextRequest) {
  return GET(req);
}

export const dynamic = "force-dynamic";
