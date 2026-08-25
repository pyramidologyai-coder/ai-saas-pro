import { createClient } from "@supabase/supabase-js";

/**
 * Server-side client. Uses the service role key, so RLS does not apply —
 * which is exactly why tenant_id must be resolved from the slug lookup and
 * never taken from the request body.
 *
 * Never import this into a client component.
 */
export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

/** Browser client. RLS applies. Use this everywhere in the dashboard. */
export function supabaseBrowser() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
