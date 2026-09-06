/** GET ?token=… → the visit. POST → the score. One use, no login. */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ ok: false, reason: "bad_link" }, { status: 400 });
  try {
    const db = supabaseAdmin();
    const { data, error } = await db.rpc("review_by_token", { p_token: token });
    if (error) throw new Error(error.message);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ ok: false, reason: "unavailable" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { token, score, comment } = await req.json();
    if (!token) return NextResponse.json({ ok: false, reason: "bad_link" }, { status: 400 });
    const db = supabaseAdmin();
    const { data, error } = await db.rpc("leave_review", {
      p_token: token, p_score: score, p_comment: comment ?? null,
    });
    if (error) throw new Error(error.message);
    return NextResponse.json(data);
  } catch (e: any) {
    console.error("review failed:", e?.message ?? e);
    return NextResponse.json({ ok: false, reason: "unavailable" }, { status: 500 });
  }
}
