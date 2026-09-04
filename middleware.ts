/**
 * Two jobs:
 *   1. Serve a business's page on their own domain
 *   2. Guard the dashboard
 *
 * Domain routing runs first. A request arriving on chat.someclinic.my is
 * rewritten to that tenant's page, so the customer never sees a slug or our
 * hostname. Our own hosts fall through to normal routing.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_COOKIE, TENANT_COOKIE, tokenFor, safeEqual, slugFromTenantCookie,
} from "@/lib/auth";

/** Hosts that are ours, not a customer's. */
function isOwnHost(host: string): boolean {
  const h = host.toLowerCase().split(":")[0];
  return h === "localhost" || h.endsWith(".vercel.app") ||
         h === "automology.ai" || h.endsWith(".automology.ai");
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const host = req.headers.get("host") ?? "";

  // ── 1 · custom domains ───────────────────────────────────────────────────
  if (!isOwnHost(host) && !path.startsWith("/api/") && !path.startsWith("/_next")) {
    try {
      const res = await fetch(
        `${req.nextUrl.origin}/api/host?h=${encodeURIComponent(host)}`,
        { headers: { "x-internal": "1" } },
      );
      const j = await res.json();
      if (j?.ok && j.slug) {
        // their domain serves their page at the root
        const url = req.nextUrl.clone();
        url.pathname = path === "/" ? `/demo/${j.slug}` : path;
        return NextResponse.rewrite(url);
      }
    } catch { /* fall through to normal routing */ }
  }

  // The embed is meant to be framed by a customer's website, so it must not
  // inherit any frame-blocking headers. The chat API's origin whitelist is
  // what actually controls who may use it.
  if (path.startsWith("/embed/") || path === "/api/embed") {
    const res = NextResponse.next();
    res.headers.delete("x-frame-options");
    res.headers.set("content-security-policy", "frame-ancestors *");
    return res;
  }

  // ── 2 · dashboard gate ───────────────────────────────────────────────────
  const guarded = path.startsWith("/master") || path.startsWith("/api/master") ||
                  path.startsWith("/dashboard") || path.startsWith("/group") ||
                  path.startsWith("/api/dashboard") || path.startsWith("/api/platform") ||
                  path.startsWith("/api/group");
  if (!guarded) return NextResponse.next();

  const master = process.env.DASHBOARD_PASSWORD;

  const auth = req.cookies.get(AUTH_COOKIE)?.value ?? "";
  if (master && auth && safeEqual(auth, await tokenFor(master))) {
    return NextResponse.next();
  }

  // The platform view is master-only. A tenant session never reaches it.
  if (path.startsWith("/master") || path.startsWith("/api/master")) {
    const to = new URL("/login", req.url);
    to.searchParams.set("next", path);
    return path.startsWith("/api/")
      ? NextResponse.json({ ok: false, reason: "unauthorised" }, { status: 403 })
      : NextResponse.redirect(to);
  }

  const tenantCookie = req.cookies.get(TENANT_COOKIE)?.value;
  const ownSlug = slugFromTenantCookie(tenantCookie);
  if (ownSlug) {
    const wanted =
      path.startsWith("/dashboard/") ? path.split("/")[2] :
      path.startsWith("/group/") ? path.split("/")[2] :
      req.nextUrl.searchParams.get("slug") ?? req.nextUrl.searchParams.get("org");

    if (path === "/dashboard") {
      return NextResponse.redirect(new URL(`/dashboard/${ownSlug}`, req.url));
    }
    if (wanted === ownSlug) return NextResponse.next();
    if ((path.startsWith("/api/dashboard") || path.startsWith("/api/platform") ||
         path.startsWith("/api/group")) && !wanted) {
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
