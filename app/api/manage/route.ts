/**
 * The customer-facing booking API. No login — the token in the link is the
 * credential, so every call re-checks it and every response is scoped to that
 * one booking.
 *
 * GET  ?token=…            → the booking
 * GET  ?token=…&date=…     → free slots that day
 * POST { token, action }   → cancel or reschedule
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const date = req.nextUrl.searchParams.get("date");
  if (!token) return NextResponse.json({ ok: false, reason: "bad_link" }, { status: 400 });

  try {
    const db = supabaseAdmin();
    if (date) {
      const { data, error } = await db.rpc("open_slots", { p_token: token, p_date: date });
      if (error) throw new Error(error.message);
      return NextResponse.json(data);
    }
    const { data, error } = await db.rpc("booking_by_token", { p_token: token });
    if (error) throw new Error(error.message);
    return NextResponse.json(data);
  } catch (e: any) {
    console.error("manage GET failed:", e?.message ?? e);
    return NextResponse.json({ ok: false, reason: "unavailable" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { token, action, reason, when } = await req.json();
    if (!token) return NextResponse.json({ ok: false, reason: "bad_link" }, { status: 400 });

    const db = supabaseAdmin();

    if (action === "cancel") {
      const { data, error } = await db.rpc("cancel_by_token", {
        p_token: token, p_reason: reason ?? null,
      });
      if (error) throw new Error(error.message);
      return NextResponse.json(data);
    }

    if (action === "reschedule") {
      if (!when) return NextResponse.json({ ok: false, reason: "no_time" }, { status: 400 });
      const { data, error } = await db.rpc("reschedule_by_token", {
        p_token: token, p_new_local: when,
      });
      if (error) throw new Error(error.message);
      return NextResponse.json(data);
    }

    return NextResponse.json({ ok: false, reason: "unknown_action" }, { status: 400 });
  } catch (e: any) {
    console.error("manage POST failed:", e?.message ?? e);
    return NextResponse.json({ ok: false, reason: "unavailable" }, { status: 500 });
  }
}
