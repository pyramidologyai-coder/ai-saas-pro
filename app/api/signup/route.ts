/**
 * POST /api/signup — provision a new business.
 *
 * Public on purpose: this is the front door. Rate limiting and email
 * verification belong here before real traffic, but the database function does
 * the validation that matters (unique slug, required name, sector fallback).
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    if (!payload?.name || String(payload.name).trim().length < 2) {
      return NextResponse.json({ ok: false, reason: "name_required" }, { status: 400 });
    }

    const db = supabaseAdmin();
    const { data, error } = await db.rpc("create_tenant", { p_payload: payload });
    if (error) throw new Error(error.message);

    return NextResponse.json(data);
  } catch (e: any) {
    console.error("signup failed:", e?.message ?? e);
    return NextResponse.json({ ok: false, reason: "unavailable" }, { status: 500 });
  }
}

export async function GET() {
  // The sector list, so the form can offer real options.
  try {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("sector_templates")
      .select("sector_id,label,agent_default")
      .order("label");
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, sectors: data ?? [] });
  } catch {
    return NextResponse.json({
      ok: true,
      sectors: [
        { sector_id: "clinic", label: "Clinic or medical practice", agent_default: "Nadia" },
        { sector_id: "salon", label: "Salon, spa or barber", agent_default: "Aisha" },
        { sector_id: "restaurant", label: "Restaurant or cafe", agent_default: "Sofia" },
        { sector_id: "fitness", label: "Gym or studio", agent_default: "Alex" },
        { sector_id: "general", label: "Something else", agent_default: "Sam" },
      ],
    });
  }
}
