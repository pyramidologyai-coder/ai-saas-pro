/**
 * GET  /api/dashboard?slug=xxx          → the owner's page data
 * GET  /api/dashboard?businesses=1      → every business (index page)
 * GET  /api/dashboard?thread=<uuid>     → one conversation, in full
 * POST /api/dashboard                   → an action (see below)
 *
 * Guarded by middleware.ts — the shared dashboard password.
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const db = supabaseAdmin();

  try {
    if (q.get("businesses")) {
      const { data, error } = await db.rpc("list_businesses");
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, businesses: data ?? [] });
    }

    const thread = q.get("thread");
    if (thread) {
      const { data, error } = await db.rpc("conversation_thread", {
        p_conversation_id: thread,
      });
      if (error) throw new Error(error.message);
      return NextResponse.json(data);
    }

    const slug = q.get("slug");
    if (!slug) return NextResponse.json({ ok: false, reason: "missing_slug" }, { status: 400 });

    const { data, error } = await db.rpc("dashboard_data", { p_slug: slug });
    if (error) throw new Error(error.message);
    return NextResponse.json(data);
  } catch (e: any) {
    console.error("dashboard GET failed:", e?.message ?? e);
    return NextResponse.json({ ok: false, reason: "unavailable" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const db = supabaseAdmin();

    // price change → rebuilds the agent's prompt
    if (body.action === "price" || body.itemId !== undefined) {
      const { itemId, price } = body;
      if (!itemId || typeof price !== "number") {
        return NextResponse.json({ ok: false, reason: "bad_request" }, { status: 400 });
      }
      const { data, error } = await db.rpc("update_item_price", {
        p_item_id: itemId, p_price: price,
      });
      if (error) throw new Error(error.message);
      return NextResponse.json(data);
    }

    if (body.action === "resolve_escalation") {
      const { data, error } = await db.rpc("resolve_escalation", { p_id: body.id });
      if (error) throw new Error(error.message);
      return NextResponse.json(data);
    }

    if (body.action === "booking_status") {
      const { data, error } = await db.rpc("set_booking_status", {
        p_id: body.id, p_status: body.status,
      });
      if (error) throw new Error(error.message);
      return NextResponse.json(data);
    }

    return NextResponse.json({ ok: false, reason: "unknown_action" }, { status: 400 });
  } catch (e: any) {
    console.error("dashboard POST failed:", e?.message ?? e);
    return NextResponse.json({ ok: false, reason: "unavailable" }, { status: 500 });
  }
}
