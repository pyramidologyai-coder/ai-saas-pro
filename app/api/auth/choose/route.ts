/**
 * POST /api/auth/choose — pick one business when a Google account has several.
 *
 * The browser sends the access token and the chosen slug. We verify the token
 * again and confirm — server-side, against the memberships table — that this
 * user really belongs to that business before signing a cookie for it. The slug
 * coming from the browser is never trusted on its own.
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
    const { access_token, slug } = await req.json().catch(() => ({}));
    if (!access_token || typeof access_token !== "string" || !slug || typeof slug !== "string") {
      return NextResponse.json({ ok: false, reason: "bad_request" }, { status: 400 });
    }

    const db = supabaseAdmin();

    const { data: userData, error } = await db.auth.getUser(access_token);
    if (error || !userData?.user) {
      return NextResponse.json({ ok: false, reason: "bad_token" }, { status: 401 });
    }

    // The role also proves membership: null means this user is not linked to
    // that business, and no cookie is issued.
    const { data: role } = await db.rpc("membership_role", {
      p_user: userData.user.id,
      p_slug: slug,
    });
    if (!role || typeof role !== "string") {
      return NextResponse.json({ ok: false, reason: "not_a_member" }, { status: 403 });
    }

    const res = NextResponse.json({ ok: true, next: `/dashboard/${slug}` });
    res.cookies.set(
      TENANT_COOKIE,
      `${slug}:${role}:${await signSession(slug, role)}`,
      COOKIE,
    );
    return res;
  } catch (e: any) {
    console.error("google choose failed:", e?.message ?? e);
    return NextResponse.json({ ok: false, reason: "unavailable" }, { status: 500 });
  }
}
