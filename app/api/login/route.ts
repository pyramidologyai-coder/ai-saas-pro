import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, tokenFor, safeEqual } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected) {
    return NextResponse.json({ ok: false, reason: "not_configured" }, { status: 503 });
  }

  const { password } = await req.json().catch(() => ({ password: "" }));
  if (typeof password !== "string" || !safeEqual(password, expected)) {
    // Slow down guessing a little without holding a serverless function open.
    await new Promise(r => setTimeout(r, 400));
    return NextResponse.json({ ok: false, reason: "wrong_password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, await tokenFor(expected), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,          // 12 hours: long enough for a working day
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
