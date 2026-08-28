/**
 * GET  /api/dashboard?slug=xxx        → everything the owner's page shows
 * POST /api/dashboard  { itemId, price } → edit a price, rebuild the prompt
 *
 * NOTE FOR GATE 3: there is no login yet. Anyone with the slug can read this
 * and change prices. Fine for a demo you drive yourself; must be behind auth
 * before a real customer touches it.
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "missing_slug" }, { status: 400 });

  try {
    const db = supabaseAdmin();
    const { data, error } = await db.rpc("dashboard_data", { p_slug: slug });
    if (error) throw new Error(error.message);
    return NextResponse.json(data);
  } catch (e: any) {
    console.error("dashboard failed:", e?.message ?? e);
    return NextResponse.json({ ok: false, reason: "unavailable" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { itemId, price } = await req.json();
    if (!itemId || typeof price !== "number") {
      return NextResponse.json({ ok: false, reason: "bad_request" }, { status: 400 });
    }

    const db = supabaseAdmin();
    const { data, error } = await db.rpc("update_item_price", {
      p_item_id: itemId,
      p_price: price,
    });
    if (error) throw new Error(error.message);
    return NextResponse.json(data);
  } catch (e: any) {
    console.error("price update failed:", e?.message ?? e);
    return NextResponse.json({ ok: false, reason: "unavailable" }, { status: 500 });
  }
}
