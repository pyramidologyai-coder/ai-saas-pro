/**
 * GET /api/health — the first end-to-end test.
 * Proves: Vercel runs the app AND the app can reach Supabase.
 * Safe to expose: returns counts only, no data.
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const checks: Record<string, string | number> = {};
  let ok = true;

  try {
    const db = supabaseAdmin();
    for (const table of ["tenants", "ai_employees", "conversations", "messages"]) {
      const { count, error } = await db
        .from(table)
        .select("*", { count: "exact", head: true });
      if (error) throw new Error(`${table}: ${error.message}`);
      checks[table] = count ?? 0;
    }
    checks.database = "connected";
  } catch (e: any) {
    ok = false;
    checks.database = "FAILED";
    checks.error = String(e?.message ?? e);
  }

  checks.env_supabase_url = process.env.NEXT_PUBLIC_SUPABASE_URL ? "set" : "MISSING";
  checks.env_service_key = process.env.SUPABASE_SERVICE_ROLE_KEY ? "set" : "MISSING";
  const llm = process.env.GEMINI_API_KEY
    ? "set (gemini)"
    : process.env.ANTHROPIC_API_KEY
    ? "set (anthropic)"
    : "MISSING";
  checks.env_llm_key = llm;
  checks.dashboard_lock = process.env.DASHBOARD_PASSWORD ? "locked" : "NOT SET — dashboard unreachable";

  return NextResponse.json({ ok, ...checks }, { status: ok ? 200 : 500 });
}
