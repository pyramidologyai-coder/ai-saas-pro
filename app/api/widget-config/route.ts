/**
 * GET /api/widget-config?slug=xxx
 * Public branding for the widget. No customer data, no prompt, no costs.
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "missing_slug" }, { status: 400 });

  try {
    const db = supabaseAdmin();
    const { data, error } = await db.rpc("get_widget_config", { p_slug: slug });
    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json(data);
  } catch (e: any) {
    console.error("widget-config failed:", e?.message ?? e);
    return NextResponse.json({ error: "unavailable" }, { status: 500 });
  }
}
