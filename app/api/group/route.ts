/** GET /api/group?org=xxx — every branch in a group, at a glance. */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const org = req.nextUrl.searchParams.get("org");
  if (!org) return NextResponse.json({ ok: false, reason: "missing_org" }, { status: 400 });
  try {
    const db = supabaseAdmin();
    const { data, error } = await db.rpc("organisation_data", { p_org_slug: org });
    if (error) throw new Error(error.message);
    return NextResponse.json(data);
  } catch (e: any) {
    console.error("group failed:", e?.message ?? e);
    return NextResponse.json({ ok: false, reason: "unavailable" }, { status: 500 });
  }
}
