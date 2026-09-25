-- ============================================================================
-- 0042_pin_search_path.sql — pin search_path on the functions that lacked it.
-- Run AFTER 0041. Safe to re-run.
--
-- WHY
-- Fifteen functions were defined without a search_path, so they ran with
-- whichever path the caller happened to have. For a SECURITY DEFINER function
-- that is a real hardening gap: a path the caller controls can shadow an
-- unqualified name with one from another schema. Supabase's advisor flags every
-- one of them (function_search_path_mutable). Several are exactly the ones that
-- must not be tricked — guard, role_can, tenant_guard, current_tenant,
-- random_code.
--
-- Newer functions in this project already set `search_path = public`. These
-- fifteen predate that habit. Pinned here to `public, extensions` — a superset
-- of plain public — so nothing that quietly resolved a helper from the
-- extensions schema (a token generator reaching for a pgcrypto function, say)
-- can break, while the path is no longer the caller's to bend.
--
-- This changes no behaviour; it only fixes where names resolve. Bodies are left
-- untouched.
-- ============================================================================

alter function public.sector_audience(text)        set search_path = public, extensions;
alter function public.guard(text, text)            set search_path = public, extensions;
alter function public.sector_spine(text, text, text) set search_path = public, extensions;
alter function public.slugify(text)                set search_path = public, extensions;
alter function public.hours_sentence(jsonb)        set search_path = public, extensions;
alter function public.new_session_token()          set search_path = public, extensions;
alter function public.role_can(text, text)         set search_path = public, extensions;
alter function public.current_tenant()             set search_path = public, extensions;
alter function public.clear_tenant()               set search_path = public, extensions;
alter function public.tenant_guard()               set search_path = public, extensions;
alter function public.random_code(integer)         set search_path = public, extensions;
alter function public.on_booking_token()           set search_path = public, extensions;
alter function public.new_manage_token()           set search_path = public, extensions;
alter function public.agency_can(text, text)       set search_path = public, extensions;
alter function public.portal_url(text, text)       set search_path = public, extensions;

-- ============================================================================
-- CHECK
--   The security advisor's function_search_path_mutable warning should now be
--   empty. Supabase → Advisors → Security.
--
--   And nothing should have changed for a caller:
--     select smoke_test();
--     select slugify('Hello World'), random_code(6);
-- ============================================================================
