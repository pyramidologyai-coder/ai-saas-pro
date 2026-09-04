/**
 * POST /api/upload — a business uploads a document; the AI learns it.
 *
 * The file itself is never stored. We extract the text, keep that, and discard
 * the original — less to leak, less to pay for, and the text is the only part
 * the agent can use anyway.
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { extractText } from "@/lib/extract";
import { AUTH_COOKIE, TENANT_COOKIE, roleFromTenantCookie } from "@/lib/auth";

export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024;   // 8 MB — generous for a policy document

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const slug = String(form.get("slug") ?? "");
    const file = form.get("file");

    if (!slug) return NextResponse.json({ ok: false, reason: "missing_slug" }, { status: 400 });
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, reason: "no_file" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({
        ok: false, reason: "too_big",
        detail: "Files up to 8 MB. If it's larger, it's probably a scan — try exporting just the text.",
      }, { status: 413 });
    }

    const role = req.cookies.get(AUTH_COOKIE)?.value
      ? "owner"
      : roleFromTenantCookie(req.cookies.get(TENANT_COOKIE)?.value) ?? "viewer";

    const buf = await file.arrayBuffer();
    const result = await extractText(buf, file.name, file.type || "");

    if (!result.ok) {
      return NextResponse.json({
        ok: false, reason: result.reason ?? "extract_failed", detail: result.hint,
      }, { status: 422 });
    }

    const db = supabaseAdmin();
    const { data, error } = await db.rpc("guarded_action", {
      p_slug: slug, p_role: role, p_action: "save_document",
      p_payload: {
        filename: file.name, mime: file.type, bytes: file.size,
        pages: result.pages ?? null, chunks: result.chunks,
      },
    });
    if (error) throw new Error(error.message);

    return NextResponse.json(data);
  } catch (e: any) {
    console.error("upload failed:", e?.message ?? e);
    return NextResponse.json({ ok: false, reason: "unavailable" }, { status: 500 });
  }
}
