/**
 * GET /api/host?h=... — which tenant owns this hostname.
 * Called by the middleware; also marks a pending domain live on first hit.
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const h = req.nextUrl.searchParams.get("h");
  if (!h) return NextResponse.json({ ok: false });
  try {
    const db = supabaseAdmin();
    const { data } = await db.rpc("tenant_for_host", { p_host: h });
    return NextResponse.json(data ?? { ok: false });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
