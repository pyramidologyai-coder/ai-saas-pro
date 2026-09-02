/**
 * GET  /api/platform?slug=xxx  → every module in one call
 * POST /api/platform           → an action, named in `action`
 *
 * Behind the dashboard gate (middleware).
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { AUTH_COOKIE, TENANT_COOKIE, roleFromTenantCookie } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ ok: false, reason: "missing_slug" }, { status: 400 });
  try {
    const db = supabaseAdmin();
    const [{ data, error }, { data: extras }, { data: stats }] = await Promise.all([
      db.rpc("platform_data", { p_slug: slug }),
      db.rpc("platform_extras", { p_slug: slug }),
      db.rpc("analytics", { p_slug: slug, p_days: 30 }),
    ]);
    if (error) throw new Error(error.message);
    return NextResponse.json({
      ...(data as object),
      ...(extras as object ?? {}),
      analytics: stats ?? null,
    });
  } catch (e: any) {
    console.error("platform GET failed:", e?.message ?? e);
    return NextResponse.json({ ok: false, reason: "unavailable" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const db = supabaseAdmin();

    // The master session is the owner of whatever it's looking at. A tenant
    // session carries the role its key was issued with.
    const role = req.cookies.get(AUTH_COOKIE)?.value
      ? "owner"
      : roleFromTenantCookie(req.cookies.get(TENANT_COOKIE)?.value) ?? "viewer";

    // Who is doing this. Platform access is labelled as such, so it shows up
    // in the business's Activity list rather than looking like their own staff.
    const isPlatform = Boolean(req.cookies.get(AUTH_COOKIE)?.value);
    const payload = { ...(b.payload ?? {}), actor: isPlatform ? "platform" : role };

    const { data, error } = await db.rpc("guarded_action", {
      p_slug: b.slug,
      p_role: role,
      p_action: b.action,
      p_payload: payload,
    });
    if (error) throw new Error(error.message);
    return NextResponse.json(data);
  } catch (e: any) {
    console.error("platform POST failed:", e?.message ?? e);
    return NextResponse.json({ ok: false, reason: "unavailable" }, { status: 500 });
  }
}

/** So the UI can hide what this person can't do. */
export async function OPTIONS(req: NextRequest) {
  const role = req.cookies.get(AUTH_COOKIE)?.value
    ? "owner"
    : roleFromTenantCookie(req.cookies.get(TENANT_COOKIE)?.value) ?? "viewer";
  return NextResponse.json({ ok: true, role });
}
