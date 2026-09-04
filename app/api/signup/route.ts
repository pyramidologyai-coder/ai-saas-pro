/**
 * POST /api/signup — provision a new business.
 *
 * Public on purpose: this is the front door. Rate limiting and email
 * verification belong here before real traffic, but the database function does
 * the validation that matters (unique slug, required name, sector fallback).
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendEmail, welcomeEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    if (!payload?.name || String(payload.name).trim().length < 2) {
      return NextResponse.json({ ok: false, reason: "name_required" }, { status: 400 });
    }

    const db = supabaseAdmin();

    // One IP shouldn't be able to create businesses forever. The address is
    // hashed, not stored — we only need to count, not to know who.
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const ipHash = Array.from(new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`signup:${ip}`))))
      .map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 32);

    // The rate limiter arrives in migration 0022. If that hasn't been run yet,
    // signup must still work — a missing optional guard is not a reason to
    // refuse a customer.
    try {
      const { data: limit, error: limitErr } = await db.rpc("check_signup_limit", {
        p_ip_hash: ipHash, p_max: 3,
      });
      if (!limitErr && limit && (limit as any).ok === false) {
        return NextResponse.json({ ok: false, reason: "too_many" }, { status: 429 });
      }
    } catch {
      console.warn("signup rate limit unavailable — allowing");
    }

    const { data, error } = await db.rpc("create_tenant", { p_payload: payload });
    if (error) {
      // Return the database's own words. Guessing at the cause and showing a
      // friendlier message hid the real error last time.
      console.error("create_tenant failed:", error.message, error);
      return NextResponse.json({
        ok: false,
        reason: "create_failed",
        detail: error.message?.slice(0, 300) ?? "unknown database error",
      }, { status: 500 });
    }

    // A function can return ok:false without raising — pass that through too.
    if (data && (data as any).ok === false) {
      return NextResponse.json({
        ok: false,
        reason: (data as any).reason ?? "create_failed",
        detail: JSON.stringify(data).slice(0, 300),
      }, { status: 400 });
    }

    // Send them their key. Losing it is the worst first experience there is,
    // so this matters more than it looks. A failure never blocks the signup.
    const r = data as any;
    if (r?.ok && payload.email) {
      const mail = welcomeEmail({
        business: String(payload.name).trim(),
        agent: r.agent,
        slug: r.slug,
        code: r.access_code,
        color: payload.color ?? "#1D6A8C",
        origin: req.nextUrl.origin,
      });
      sendEmail({ to: payload.email, kind: "welcome", ...mail }).catch(() => {});
    }

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
