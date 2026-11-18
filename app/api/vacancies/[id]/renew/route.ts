import { NextRequest } from "next/server";
import { renovar } from "@/lib/vaga-renovar";

/** Mesmo comportamento do PATCH {action:"renew"} em /api/vacancies/[id] (2.1a: só a empresa dona ou o admin). */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) { const p = await ctx.params; return renovar(req, p.id); }
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) { const p = await ctx.params; return renovar(req, p.id); }
