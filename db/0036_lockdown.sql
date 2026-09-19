-- ============================================================================
-- 0036_lockdown.sql — take the internal functions off the public API.
-- Run AFTER 0035. Safe to re-run.
--
-- WHY
-- Postgres grants EXECUTE on every new function to PUBLIC by default. Granting
-- it to service_role afterwards does not take that away — the two grants sit
-- side by side. Every earlier file in this project revoked first and granted
-- second (0003, 0005, 0011, 0014 all show the pattern). 0033 and 0035 granted
-- without revoking, so the functions they added are reachable through PostgREST
-- by anyone holding the anon key, which ships to every browser that loads the
-- site.
--
-- The one that matters is master_agencies(). It returns each agency's
-- access_code, which is the key to that reseller's dashboard, alongside its
-- plan, wholesale percentage and billed totals. There are no agencies yet, so
-- nothing has leaked; it becomes a live credential leak the day the first one
-- is created.
--
-- Nothing in the app calls Supabase with the anon key. supabaseBrowser() in
-- lib/supabase.ts is defined but imported nowhere — every route goes through
-- supabaseAdmin() with the service role. So revoking anon and authenticated
-- here costs the running app nothing.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1 · Functions that should never have been callable from the internet
-- ─────────────────────────────────────────────────────────────────────────────

-- Agency reporting. Leaks access_code. This is the urgent one.
revoke execute on function master_agencies()
  from public, anon, authenticated;

-- Diagnostics. They disclose the shape of the schema and, in smoke_test's case,
-- run the live paths of whichever tenant happens to be oldest.
revoke execute on function verify_schema()          from public, anon, authenticated;
revoke execute on function smoke_test()             from public, anon, authenticated;
revoke execute on function test_isolation()         from public, anon, authenticated;
revoke execute on function test_agency_isolation()  from public, anon, authenticated;

-- Hands out the manage token for a booking given its id, which is enough to
-- cancel or reschedule someone else's appointment.
revoke execute on function booking_manage_url(uuid, text)
  from public, anon, authenticated;

revoke execute on function auth_tenant_id()
  from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2 · The tenant switch
--
-- 0026 granted set_tenant() to anon on purpose, and its own header claims the
-- anon path is "protected completely". Those two statements are in tension: the
-- policies read current_tenant(), and set_tenant() is what sets it. Whether an
-- anon caller can actually chain an RPC call to a table read depends on whether
-- PostgREST hands both the same pooled connection, which is not something to
-- rely on either way.
--
-- Nothing uses these from the browser, so the tension is cheaper to remove than
-- to test.
-- ─────────────────────────────────────────────────────────────────────────────
revoke execute on function set_tenant(text)  from public, anon, authenticated;
revoke execute on function current_tenant()  from public, anon, authenticated;
revoke execute on function clear_tenant()    from public, anon, authenticated;
revoke execute on function tenant_guard()    from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3 · Trigger functions
--
-- A trigger function is invoked by the trigger, not by a caller. It never needs
-- EXECUTE granted to anybody, and exposing one as an RPC endpoint only offers a
-- stranger a way to make it throw.
-- ─────────────────────────────────────────────────────────────────────────────
revoke execute on function bump_conversation_counters()     from public, anon, authenticated;
revoke execute on function on_booking_created()             from public, anon, authenticated;
revoke execute on function on_booking_cancelled()           from public, anon, authenticated;
revoke execute on function on_booking_resolves_attempt()    from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4 · portal_codes and portal_sessions
--
-- 0035 enabled RLS on both and wrote no policies. That is the safe state, not a
-- gap: enabled with no policy denies everyone, and the portal reads these
-- server-side with the service role, which bypasses RLS. Forcing it here only
-- makes them consistent with the tables 0026 touched, and records that the
-- deny-all is deliberate so the next reader doesn't "fix" it by adding a
-- permissive policy.
-- ─────────────────────────────────────────────────────────────────────────────
alter table portal_codes    force row level security;
alter table portal_sessions force row level security;

comment on table portal_codes is
  'Sign-in codes for the customer portal. Deny-all by design: read server-side with the service role only.';
comment on table portal_sessions is
  'Portal sessions. Deny-all by design: read server-side with the service role only.';

-- ============================================================================
-- CHECK
--   select master_agencies();          -- still works here, you are the owner
--
--   -- A revoke names one signature, and create_booking has been redefined with
--   -- different argument lists by 0009, 0010 and 0034. `create or replace` makes
--   -- a new function when the arguments differ rather than replacing the old
--   -- one, so the earlier overloads may still be sitting there with their own
--   -- grants. List what actually exists before trusting any single revoke:
--   select p.oid::regprocedure, p.prosecdef, p.proacl
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.proname = 'create_booking';
--
-- Then from a browser console on the live site, with the anon key:
--   fetch(URL + '/rest/v1/rpc/master_agencies', {method:'POST',
--     headers:{apikey:ANON, 'Content-Type':'application/json'}, body:'{}'})
--   → must come back 401 or 404, not a JSON array
--
-- STILL OPEN, and a decision rather than a bug
--   get_widget_config(text), public_agents(text) and create_booking(...) are
--   granted to anon deliberately, by 0007, 0015 and 0010. Nothing uses them
--   from the browser today, so create_booking in particular is an open door for
--   writing junk appointments into any tenant by slug. If the widget is staying
--   server-side, add:
--
--     revoke execute on function create_booking(text, uuid, text, text, text, text, text, text)
--       from public, anon, authenticated;
--     revoke execute on function public_agents(text)     from public, anon, authenticated;
--     revoke execute on function get_widget_config(text) from public, anon, authenticated;
-- ============================================================================
