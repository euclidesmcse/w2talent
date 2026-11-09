import { NextRequest, NextResponse } from "next/server";
import { clearCookieHeader } from "@/lib/admin-auth";
import { sameOrigin } from "@/lib/admin-request";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "origem_invalida" }, { status: 403 });
  const res = NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  res.headers.append("set-cookie", clearCookieHeader());
  return res;
}
