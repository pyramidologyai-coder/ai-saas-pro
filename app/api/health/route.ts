/**
 * GET /api/health — the first end-to-end test.
 * Proves: Vercel runs the app AND the app can reach Supabase.
 * Safe to expose: returns counts only, no data.
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Reads live database state, so it must not be prerendered at build time.
export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, unknown> = {};
  let ok = true;
  const db = supabaseAdmin();

  try {
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
  checks.email = process.env.RESEND_API_KEY ? "set" : "missing (keys and confirmations won't send)";
  checks.payments = process.env.STRIPE_SECRET_KEY ? "set" : "missing (billing page will say so)";
  // Ask the database whether every migration actually landed. Cheap, and it
  // turns "the dashboard is blank" into "0022 didn't finish".
  try {
    const { data: schema } = await db.rpc("verify_schema");
    const v = schema as any;
    checks.schema = v?.ok ? "complete" : `INCOMPLETE — ${v?.next_step ?? "see verify_schema()"}`;
    if (v?.warnings?.length) checks.schema_warnings = v.warnings;
  } catch {
    checks.schema = "unknown (run 0031_verify.sql)";
  }

  checks.cron = process.env.CRON_SECRET ? "set" : "missing (reminders won't send)";
  checks.stripe_webhook = process.env.STRIPE_WEBHOOK_SECRET ? "set" : "missing (webhook rejects all)";
  checks.dashboard_lock = process.env.DASHBOARD_PASSWORD ? "locked" : "NOT SET — dashboard unreachable";

  return NextResponse.json({ ok, ...checks }, { status: ok ? 200 : 500 });
}
