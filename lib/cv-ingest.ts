import { NextRequest, NextResponse } from "next/server";
import { extractToCanonical } from "./cv-extract";
import { docToText } from "./doc-to-text";

/**
 * Helper compartilhado para POST /api/candidates e /api/candidates/ingest.
 * Evita duplicação de ~120 linhas entre as duas rotas (I1).
 * Aceita JSON {linkedinText|text|raw, consent:{iaReescritaV}} ou FormData {file, linkedinText}
 * PDF/DOCX viram texto pelo toMarkdown do Workers AI (lib/doc-to-text), com fallback utf-8.
 */
export async function handleIngestPOST(req: NextRequest) {
  try {
    let rawText = "";
    let consent: any = undefined;
    let fileName: string | null = null;

    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file") as File | null;
      const linkedinText = form.get("linkedinText") as string | null;
      const consentRaw = form.get("consent") as string | null;
      const iaReescritaRaw = form.get("iaReescritaV") as string | null;

      if (consentRaw) {
        try {
          consent = JSON.parse(consentRaw);
        } catch {
          consent = { iaReescritaV: consentRaw === "true" };
        }
      } else if (iaReescritaRaw != null) {
        consent = { iaReescritaV: iaReescritaRaw === "true" || iaReescritaRaw === "1" };
      } else {
        consent = undefined;
      }
      if (linkedinText) rawText = String(linkedinText);
      if (file) {
        fileName = (file as any).name ?? "upload";
        const bytes = await file.arrayBuffer();
        let extracted = "";
        try {
          extracted = await docToText(bytes, fileName ?? "upload");
        } catch {
          extracted = new TextDecoder().decode(bytes);
        }
        if (!rawText) rawText = extracted;
        else rawText = `${rawText}\n${extracted}`;
      }
      if (!consent) {
        const v = form.get("iaReescritaV");
        if (v != null) consent = { iaReescritaV: String(v) === "true" };
      }
    } else {
      const body = await req.json().catch(() => ({} as any));
      rawText = body.linkedinText ?? body.text ?? body.raw ?? body.rawText ?? "";
      if (body.fileBase64 && !rawText) {
        try {
          rawText = Buffer.from(body.fileBase64, "base64").toString("utf-8");
        } catch {}
      }
      consent = body.consent ?? body.consentimentos ?? undefined;
      if (!consent && body.iaReescritaV !== undefined) {
        consent = { iaReescritaV: body.iaReescritaV };
      }
      if (!consent && body.iaReescrita !== undefined) {
        consent = { iaReescritaV: body.iaReescrita };
      }
    }

    if (!consent || consent.iaReescritaV !== true) {
      return NextResponse.json({ error: "consentimento iaReescritaV obrigatório para extração por IA (LGPD)" }, { status: 400 });
    }

    const result = await extractToCanonical(rawText, { consent });

    return NextResponse.json(
      {
        ...result,
        warning: result.warning ?? null,
      },
      { status: 200 }
    );
  } catch (e: any) {
    const status = e.status ?? e.statusCode ?? 500;
    return NextResponse.json({ error: e.message ?? "erro interno ingest" }, { status });
  }
}
