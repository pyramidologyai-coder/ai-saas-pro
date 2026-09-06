/**
 * The customer portal API. No account — a short-lived code sent to the contact
 * already on their record, exchanged for a session token.
 *
 * Note that requesting a code always reports success, whether or not the
 * contact is known. Saying "no such customer" would let anyone use this to
 * find out who is a patient at a clinic.
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const COOKIE = "automology_portal";

export async function POST(req: NextRequest) {
  try {
    const { slug, action, contact, code } = await req.json();
    if (!slug) return NextResponse.json({ ok: false, reason: "bad_request" }, { status: 400 });

    const db = supabaseAdmin();

    if (action === "request") {
      const { data, error } = await db.rpc("portal_request", {
        p_slug: slug, p_contact: contact ?? "",
      });
      if (error) throw new Error(error.message);
      return NextResponse.json(data);
    }

    if (action === "verify") {
      const { data, error } = await db.rpc("portal_verify", {
        p_slug: slug, p_contact: contact ?? "", p_code: code ?? "",
      });
      if (error) throw new Error(error.message);
      const r = data as any;
      if (!r?.ok) return NextResponse.json(r, { status: 401 });

      const res = NextResponse.json({ ok: true });
      res.cookies.set(`${COOKIE}_${slug}`, r.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
      return res;
    }

    if (action === "signout") {
      const res = NextResponse.json({ ok: true });
      res.cookies.set(`${COOKIE}_${slug}`, "", { path: "/", maxAge: 0 });
      return res;
    }

    return NextResponse.json({ ok: false, reason: "unknown_action" }, { status: 400 });
  } catch (e: any) {
    console.error("portal POST failed:", e?.message ?? e);
    return NextResponse.json({ ok: false, reason: "unavailable" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ ok: false, reason: "bad_request" }, { status: 400 });

  const token = req.cookies.get(`${COOKIE}_${slug}`)?.value;
  if (!token) return NextResponse.json({ ok: false, reason: "signed_out" });

  try {
    const db = supabaseAdmin();
    const { data, error } = await db.rpc("portal_data", { p_token: token });
    if (error) throw new Error(error.message);
    return NextResponse.json(data);
  } catch (e: any) {
    console.error("portal GET failed:", e?.message ?? e);
    return NextResponse.json({ ok: false, reason: "unavailable" }, { status: 500 });
  }
}
