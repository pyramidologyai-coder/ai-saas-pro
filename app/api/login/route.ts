import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, TENANT_COOKIE, tokenFor, safeEqual } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const { password } = await req.json().catch(() => ({ password: "" }));
  const entered = typeof password === "string" ? password.trim() : "";
  if (!entered) {
    return NextResponse.json({ ok: false, reason: "wrong_password" }, { status: 401 });
  }

  // 1 · the master password sees every business
  const master = process.env.DASHBOARD_PASSWORD;
  if (master && safeEqual(entered, master)) {
    const res = NextResponse.json({ ok: true, scope: "all", next: "/dashboard" });
    res.cookies.set(AUTH_COOKIE, await tokenFor(master), COOKIE);
    return res;
  }

  // 2 · a business's own access code sees only that business
  try {
    const db = supabaseAdmin();
    const { data } = await db.rpc("tenant_by_code", { p_code: entered.toUpperCase() });
    const r = data as any;
    if (r?.ok && r.slug) {
      const res = NextResponse.json({
        ok: true, scope: "tenant", slug: r.slug, next: `/dashboard/${r.slug}`,
      });
      res.cookies.set(TENANT_COOKIE, `${r.slug}:${await tokenFor(entered)}`, COOKIE);
      return res;
    }
  } catch (e: any) {
    console.error("login lookup failed:", e?.message ?? e);
  }

  await new Promise(r => setTimeout(r, 400));   // slow down guessing
  return NextResponse.json({ ok: false, reason: "wrong_password" }, { status: 401 });
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, "", { path: "/", maxAge: 0 });
  res.cookies.set(TENANT_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

const COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 14,
};
