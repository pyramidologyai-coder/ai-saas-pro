-- ============================================================================
-- 0037_close_anon.sql — close the last three public RPC endpoints.
-- Run AFTER 0036. Safe to re-run.
--
-- WHY
-- 0036 removed the functions that were exposed by accident. These three were
-- granted to anon on purpose, by 0007, 0010 and 0015, back when the widget
-- might have talked to Supabase straight from the browser. It never did. Every
-- public route goes through the server instead:
--
--   app/api/widget-config/route.ts:13   supabaseAdmin()
--   app/api/embed/route.ts:30           supabaseAdmin()
--   app/api/chat/route.ts:35            supabaseAdmin()
--
-- So the grants buy nothing and cost something. create_booking is the one that
-- matters: it takes a tenant slug and writes an appointment, which means anyone
-- holding the anon key — it ships in every page load — can fill any clinic's
-- diary with invented bookings. Junk in the diary is not a small problem for
-- this product. It is the screen the customer actually looks at.
--
-- The other two only leak branding and agent names for an arbitrary slug. Minor
-- on their own, but there is no reason to answer a stranger's question about a
-- tenant that isn't theirs.
--
-- IF THE WIDGET EVER GOES CLIENT-SIDE
-- Re-grant the read-only pair and leave create_booking server-side:
--   grant execute on function get_widget_config(text) to anon;
--   grant execute on function public_agents(text)     to anon;
-- Bookings should keep going through the chat route, which validates the tag
-- before it writes.
-- ============================================================================

revoke execute on function create_booking(text, uuid, text, text, text, text, text, text)
  from public, anon, authenticated;

revoke execute on function get_widget_config(text)
  from public, anon, authenticated;

revoke execute on function public_agents(text)
  from public, anon, authenticated;

-- ============================================================================
-- CHECK
--   The advisor should now report zero anon-executable SECURITY DEFINER
--   functions. Supabase → Advisors → Security, or ask me to read it.
--
--   A revoke names one signature. create_booking has been redefined with three
--   different argument lists across 0009, 0010 and 0034, and `create or replace`
--   adds a new function rather than replacing the old one when the arguments
--   differ. Confirm nothing else is still sitting there with its own grant:
--
--   select p.oid::regprocedure as signature, p.prosecdef as security_definer,
--          p.proacl as grants
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public'
--      and p.proname in ('create_booking','get_widget_config','public_agents')
--    order by 1;
--
--   Anything listed with anon or authenticated in `grants` needs the same
--   revoke against its own signature.
--
-- THEN CHECK THE APP STILL WORKS
--   The three routes above are the ones this could plausibly break, and all
--   three use the service role, which ignores grants entirely. Load /demo/<slug>
--   and send one message. If it answers, nothing here touched it.
-- ============================================================================
