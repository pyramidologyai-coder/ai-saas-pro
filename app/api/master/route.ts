/**
 * GET /api/master — the platform view. Master password only.
 *
 * A tenant key must never reach this. It carries every business's revenue,
 * costs and health — a tenant seeing it would be a serious leak, not a
 * cosmetic one. So the check is explicit here as well as in the middleware:
 * two locks on the same door, because one of them will eventually be edited
 * by someone who doesn't know about the other.
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { AUTH_COOKIE, tokenFor, safeEqual } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const master = process.env.DASHBOARD_PASSWORD;
  const cookie = req.cookies.get(AUTH_COOKIE)?.value ?? "";

  if (!master || !cookie || !safeEqual(cookie, await tokenFor(master))) {
    return NextResponse.json({ ok: false, reason: "unauthorised" }, { status: 403 });
  }

  const view = req.nextUrl.searchParams.get("view") ?? "overview";

  try {
    const db = supabaseAdmin();

    if (view === "shareholder") {
      const { data, error } = await db.rpc("shareholder_report");
      if (error) throw new Error(error.message);
      return NextResponse.json(data);
    }

    const [{ data: overview, error }, { data: businesses }, { data: health }] =
      await Promise.all([
        db.rpc("master_overview"),
        db.rpc("master_businesses"),
        db.rpc("master_health"),
      ]);
    if (error) throw new Error(error.message);

    return NextResponse.json({
      ...(overview as object),
      list: businesses ?? [],
      health: health ?? null,
    });
  } catch (e: any) {
    console.error("master failed:", e?.message ?? e);
    return NextResponse.json({ ok: false, reason: "unavailable" }, { status: 500 });
  }
}
