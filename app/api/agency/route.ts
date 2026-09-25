/**
 * The agency API.
 *
 * Every call is scoped to the agency in the session cookie. An agency asking
 * about a slug it doesn't own gets nothing — checked here, not assumed. That
 * matters more than usual: another agency's client list is their prospect
 * list, and leaking it would end the relationship.
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { AUTH_COOKIE, TENANT_COOKIE, slugFromTenantCookie, roleFromTenantCookie } from "@/lib/auth";

/** The agency this session belongs to, or null. Master sees any. */
function sessionAgency(req: NextRequest): { slug: string | null; role: string; master: boolean } {
  const master = Boolean(req.cookies.get(AUTH_COOKIE)?.value);
  const cookie = req.cookies.get(TENANT_COOKIE)?.value;
  return {
    slug: slugFromTenantCookie(cookie),
    role: roleFromTenantCookie(cookie) ?? "viewer",
    master,
  };
}

export async function GET(req: NextRequest) {
  const asked = req.nextUrl.searchParams.get("agency");
  const s = sessionAgency(req);

  // A session may only read its own agency. Master may read any.
  const slug = s.master ? (asked ?? s.slug) : s.slug;
  if (!slug || (!s.master && asked && asked !== s.slug)) {
    return NextResponse.json({ ok: false, reason: "unauthorised" }, { status: 403 });
  }

  try {
    const db = supabaseAdmin();
    const { data, error } = await db.rpc("agency_data", { p_agency_slug: slug });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ...(data as object), role: s.master ? "principal" : s.role });
  } catch (e: any) {
    console.error("agency GET failed:", e?.message ?? e);
    return NextResponse.json({ ok: false, reason: "unavailable" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const s = sessionAgency(req);
  try {
    const b = await req.json();
    const slug = s.master ? (b.agency ?? s.slug) : s.slug;

    if (!slug || (!s.master && b.agency && b.agency !== s.slug)) {
      return NextResponse.json({ ok: false, reason: "unauthorised" }, { status: 403 });
    }

    const db = supabaseAdmin();
    const role = s.master ? "principal" : s.role;

    if (b.action === "add_client") {
      const { data, error } = await db.rpc("agency_add_client", {
        p_agency_slug: slug, p_role: role, p_payload: b.payload ?? {},
      });
      if (error) throw new Error(error.message);
      return NextResponse.json(data);
    }

    if (b.action === "branding") {
      const { data, error } = await db.rpc("update_agency", {
        p_slug: slug, p_role: role, p_payload: b.payload ?? {},
      });
      if (error) throw new Error(error.message);
      return NextResponse.json(data);
    }

    if (b.action === "add_staff") {
      const { data, error } = await db.rpc("agency_add_staff", {
        p_slug: slug, p_role: role, p_payload: b.payload ?? {},
      });
      if (error) throw new Error(error.message);
      return NextResponse.json(data);
    }

    return NextResponse.json({ ok: false, reason: "unknown_action" }, { status: 400 });
  } catch (e: any) {
    console.error("agency POST failed:", e?.message ?? e);
    return NextResponse.json({ ok: false, reason: "unavailable" }, { status: 500 });
  }
}
