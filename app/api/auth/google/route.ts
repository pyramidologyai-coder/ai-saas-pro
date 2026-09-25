/**
 * POST /api/auth/google — turn a verified Google (Supabase) session into one of
 * this app's own signed dashboard cookies.
 *
 * The browser signs in with Supabase, gets a session, and sends us its access
 * token. We verify the token server-side, adopt whatever businesses that email
 * already owns or was invited to (claim_memberships), and then:
 *   - none  → send them to /start to create their first business
 *   - one   → set the signed tenant cookie and open its dashboard
 *   - many  → return the list so the browser can ask which one
 *
 * The cookie is the same signed slug:role:sig the password login issues, so the
 * rest of the app — middleware, verifiedScope — treats a Google session exactly
 * like a key sign-in. This route is the only new way to obtain that cookie, and
 * it never sets one without a verified token and a real membership.
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { TENANT_COOKIE, signSession } from "@/lib/auth";

const COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 14,
};

export async function POST(req: NextRequest) {
  try {
    const { access_token } = await req.json().catch(() => ({ access_token: "" }));
    if (!access_token || typeof access_token !== "string") {
      return NextResponse.json({ ok: false, reason: "no_token" }, { status: 400 });
    }

    const db = supabaseAdmin();

    // Verify the token against Supabase Auth — this is what stops a made-up
    // token buying a session.
    const { data: userData, error } = await db.auth.getUser(access_token);
    if (error || !userData?.user) {
      return NextResponse.json({ ok: false, reason: "bad_token" }, { status: 401 });
    }
    const user = userData.user;
    if (!user.email || !user.email_confirmed_at) {
      return NextResponse.json({ ok: false, reason: "unverified_email" }, { status: 403 });
    }

    // Adopt existing businesses for this address (owner rows and staff invites).
    const { data: claim } = await db.rpc("claim_memberships", {
      p_user: user.id,
      p_email: user.email,
    });
    const businesses = ((claim as any)?.businesses as any[]) ?? [];

    if (businesses.length === 0) {
      return NextResponse.json({ ok: true, businesses: [], next: "/start" });
    }

    if (businesses.length === 1) {
      const b = businesses[0];
      const res = NextResponse.json({ ok: true, next: `/dashboard/${b.slug}` });
      res.cookies.set(
        TENANT_COOKIE,
        `${b.slug}:${b.role}:${await signSession(b.slug, b.role)}`,
        COOKIE,
      );
      return res;
    }

    // More than one — let the browser choose, then /api/auth/choose sets the
    // cookie for the one they pick.
    return NextResponse.json({ ok: true, businesses });
  } catch (e: any) {
    console.error("google auth failed:", e?.message ?? e);
    return NextResponse.json({ ok: false, reason: "unavailable" }, { status: 500 });
  }
}
