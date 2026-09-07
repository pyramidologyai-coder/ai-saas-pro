/**
 * GET  /api/platform?slug=xxx  → every module in one call
 * POST /api/platform           → an action, named in `action`
 *
 * Behind the dashboard gate (middleware).
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { AUTH_COOKIE, TENANT_COOKIE, roleFromTenantCookie,
         sessionScope, mayTouch } from "@/lib/auth";

/** Who is this request, and therefore what may they do. */
function roleOf(req: NextRequest): string {
  return req.cookies.get(AUTH_COOKIE)?.value
    ? "owner"
    : roleFromTenantCookie(req.cookies.get(TENANT_COOKIE)?.value) ?? "viewer";
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!mayTouch(sessionScope(req), slug)) {
    return NextResponse.json({ ok: false, reason: "unauthorised" }, { status: 403 });
  }
  if (!slug) return NextResponse.json({ ok: false, reason: "missing_slug" }, { status: 400 });
  try {
    const db = supabaseAdmin();
    const [{ data, error }, { data: extras }, { data: stats }, { data: docs }] =
      await Promise.all([
      db.rpc("platform_data", { p_slug: slug }),
      db.rpc("platform_extras", { p_slug: slug }),
      db.rpc("analytics", { p_slug: slug, p_days: 30 }),
      db.rpc("platform_documents", { p_slug: slug }),
    ]);
    if (error) throw new Error(error.message);
    return NextResponse.json({
      ...(data as object),
      ...(extras as object ?? {}),
      analytics: stats ?? null,
      ...(docs as object ?? {}),
      // Sent with the data on purpose. Asking for it separately meant one
      // failed request left the whole dashboard read-only, which is exactly
      // what happened.
      role: roleOf(req),
    });
  } catch (e: any) {
    console.error("platform GET failed:", e?.message ?? e);
    return NextResponse.json({ ok: false, reason: "unavailable" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json();

    // Middleware could not see this slug — it was in the body. Check it here,
    // or a tenant session could name any business it liked.
    const scope = sessionScope(req);
    if (!mayTouch(scope, b.slug)) {
      return NextResponse.json({ ok: false, reason: "unauthorised" }, { status: 403 });
    }

    const db = supabaseAdmin();

    // The master session is the owner of whatever it's looking at. A tenant
    // session carries the role its key was issued with.
    const role = scope.role;

    // Who is doing this. Platform access is labelled as such, so it shows up
    // in the business's Activity list rather than looking like their own staff.
    const payload = { ...(b.payload ?? {}), actor: scope.master ? "platform" : scope.role };

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
