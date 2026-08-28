/**
 * Guards the dashboard. The chat widget and its API stay public — customers
 * use those without logging in.
 */
import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, tokenFor, safeEqual } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const expected = process.env.DASHBOARD_PASSWORD;

  // Fail closed. An unset password locks the dashboard rather than opening it.
  if (!expected) {
    return NextResponse.redirect(new URL("/login?setup=1", req.url));
  }

  const cookie = req.cookies.get(AUTH_COOKIE)?.value ?? "";
  if (cookie && safeEqual(cookie, await tokenFor(expected))) {
    return NextResponse.next();
  }

  // API calls get a 401; page loads get sent to the login screen.
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ ok: false, reason: "unauthorised" }, { status: 401 });
  }

  const to = new URL("/login", req.url);
  to.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(to);
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/dashboard/:path*", "/api/dashboard"],
};
