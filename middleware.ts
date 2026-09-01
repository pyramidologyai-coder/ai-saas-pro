/**
 * Guards the dashboard. Everything a customer touches stays public: the
 * landing page, signup, the tenant pages, and the chat API.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_COOKIE, TENANT_COOKIE, tokenFor, safeEqual, slugFromTenantCookie,
} from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const master = process.env.DASHBOARD_PASSWORD;

  // Master session: full access.
  const auth = req.cookies.get(AUTH_COOKIE)?.value ?? "";
  if (master && auth && safeEqual(auth, await tokenFor(master))) {
    return NextResponse.next();
  }

  // Tenant session: only that business's own dashboard.
  const tenantCookie = req.cookies.get(TENANT_COOKIE)?.value;
  const ownSlug = slugFromTenantCookie(tenantCookie);
  if (ownSlug) {
    const wanted =
      path.startsWith("/dashboard/") ? path.split("/")[2] :
      req.nextUrl.searchParams.get("slug");

    // The index lists every business, so a tenant session goes to its own page.
    if (path === "/dashboard") {
      return NextResponse.redirect(new URL(`/dashboard/${ownSlug}`, req.url));
    }
    if (wanted === ownSlug) return NextResponse.next();
    if (path.startsWith("/api/dashboard") && !wanted) {
      return NextResponse.json({ ok: false, reason: "unauthorised" }, { status: 401 });
    }
    if (wanted && wanted !== ownSlug) {
      return NextResponse.redirect(new URL(`/dashboard/${ownSlug}`, req.url));
    }
  }

  if (path.startsWith("/api/")) {
    return NextResponse.json({ ok: false, reason: "unauthorised" }, { status: 401 });
  }

  const to = new URL("/login", req.url);
  to.searchParams.set("next", path);
  return NextResponse.redirect(to);
}

export const config = {
  matcher: ["/dashboard", "/dashboard/:path*", "/api/dashboard/:path*", "/api/dashboard"],
};
