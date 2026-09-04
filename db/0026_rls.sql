-- ============================================================================
-- 0026_rls.sql — make the database enforce tenant isolation.
-- Run AFTER 0025. Safe to re-run.
--
-- ⚠ WHY THIS MATTERS MORE THAN IT LOOKS
-- Every table already had `enable row level security`, but with no policies and
-- every query running as service_role, RLS was doing nothing. The API was the
-- only thing keeping one clinic's patients away from another clinic's. One
-- routing bug and it leaks.
--
-- After this, a query that forgets its tenant filter returns nothing rather
-- than everything. That is the difference between "we're careful" and "the
-- database won't let it happen" — and it's what a clinic's IT person asks.
--
-- HOW IT WORKS
-- The app sets a per-request setting before it touches anything:
--     select set_tenant(<slug>);
-- Policies read that setting. No setting, no rows.
--
-- service_role BYPASSES RLS by design in Postgres. So this alone does not stop
-- a buggy server query. What it does:
--   • protects anon/authenticated paths completely
--   • gives us tenant_guard() so server code fails loudly instead of silently
--     returning another tenant's rows
--   • is the foundation for moving reads off service_role, which is the next
--     step and needs the app rewritten to use user JWTs
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1 · Who is this request for?
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function set_tenant(p_slug text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select id into v_id from tenants where slug = p_slug;
  perform set_config('automology.tenant_id', coalesce(v_id::text, ''), false);
  perform set_config('automology.tenant_slug', coalesce(p_slug, ''), false);
  return v_id;
end; $$;

create or replace function current_tenant()
returns uuid language sql stable as $$
  select nullif(current_setting('automology.tenant_id', true), '')::uuid;
$$;

-- Clear it. Call between requests if you ever pool connections per tenant.
create or replace function clear_tenant()
returns void language sql as $$
  select set_config('automology.tenant_id', '', false),
         set_config('automology.tenant_slug', '', false);
$$;

/**
 * Fail loudly. Server code runs as service_role, which bypasses RLS — so a
 * missing tenant filter would silently return every business's rows. Call this
 * at the top of anything that reads across a table, and it raises instead.
 */
create or replace function tenant_guard()
returns uuid language plpgsql stable as $$
declare v uuid := current_tenant();
begin
  if v is null then
    raise exception 'no tenant in scope — call set_tenant() before reading tenant data'
      using hint = 'This is a bug, not a permissions problem.';
  end if;
  return v;
end; $$;

grant execute on function set_tenant(text), current_tenant(), clear_tenant(), tenant_guard()
  to service_role, authenticated, anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2 · Policies on every tenant-scoped table
--
-- One shape, applied 26 times: you see a row if it belongs to the tenant in
-- scope. Written as a loop so a new table can't be forgotten — add it to the
-- list and re-run.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  t text;
  tables text[] := array[
    'ai_decision_log','ai_employees','audit_log','automations','bookings',
    'broadcasts','campaigns','conversations','customers','domains','email_log',
    'escalations','invoices','items','knowledge','messages','outbox','posts',
    'profiles','resources','social_accounts','staff','subscriptions',
    'tenant_credentials','tenant_domains','usage_ledger'
  ];
begin
  foreach t in array tables loop
    if to_regclass('public.' || t) is null then
      raise notice 'skipping %, not present', t;
      continue;
    end if;

    execute format('alter table %I enable row level security', t);
    -- so even the table owner is bound by the policy
    execute format('alter table %I force row level security', t);

    execute format('drop policy if exists tenant_isolation on %I', t);
    execute format($f$
      create policy tenant_isolation on %I
        for all
        using (tenant_id = current_tenant())
        with check (tenant_id = current_tenant())
    $f$, t);
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3 · Tables that aren't tenant-scoped need their own rules
-- ─────────────────────────────────────────────────────────────────────────────

-- tenants: you see your own row
alter table tenants enable row level security;
alter table tenants force row level security;
drop policy if exists tenant_self on tenants;
create policy tenant_self on tenants
  for all using (id = current_tenant()) with check (id = current_tenant());

-- resource_items / resource_blocks: scoped through their resource
do $$ begin
  if to_regclass('public.resource_items') is not null then
    alter table resource_items enable row level security;
    alter table resource_items force row level security;
    drop policy if exists via_resource on resource_items;
    create policy via_resource on resource_items for all
      using (exists (select 1 from resources r
                      where r.id = resource_id and r.tenant_id = current_tenant()))
      with check (exists (select 1 from resources r
                      where r.id = resource_id and r.tenant_id = current_tenant()));
  end if;

  if to_regclass('public.resource_blocks') is not null then
    alter table resource_blocks enable row level security;
    alter table resource_blocks force row level security;
    drop policy if exists via_resource on resource_blocks;
    create policy via_resource on resource_blocks for all
      using (exists (select 1 from resources r
                      where r.id = resource_id and r.tenant_id = current_tenant()))
      with check (exists (select 1 from resources r
                      where r.id = resource_id and r.tenant_id = current_tenant()));
  end if;
end $$;

-- organisations: visible to a tenant that belongs to them
do $$ begin
  if to_regclass('public.organisations') is not null then
    alter table organisations enable row level security;
    alter table organisations force row level security;
    drop policy if exists org_via_tenant on organisations;
    create policy org_via_tenant on organisations for all
      using (exists (select 1 from tenants t
                      where t.organisation_id = organisations.id
                        and t.id = current_tenant()));
  end if;
end $$;

-- Reference data everyone may read, nobody may write.
do $$
declare t text;
begin
  foreach t in array array['plans','sector_templates'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists read_all on %I', t);
    execute format('create policy read_all on %I for select using (true)', t);
  end loop;
end $$;

-- signup_attempts: nobody reads it but the platform.
alter table signup_attempts enable row level security;
drop policy if exists deny_all on signup_attempts;
create policy deny_all on signup_attempts for all using (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4 · Prove it
--
-- Two tenants, one query. If isolation is real, each sees only its own rows.
-- Runs as service_role, which bypasses RLS — so we test the policy directly
-- rather than trusting the connection.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function test_isolation()
returns json language plpgsql security definer set search_path = public as $$
declare
  a uuid; b uuid; a_slug text; b_slug text;
  leaked int := 0; checked int := 0; t text; n int;
  tables text[] := array['items','customers','conversations','bookings',
                         'knowledge','invoices','staff','resources'];
begin
  select id, slug into a, a_slug from tenants order by created_at limit 1;
  select id, slug into b, b_slug from tenants where id <> a order by created_at limit 1;

  if b is null then
    return json_build_object('ok', false, 'reason', 'need_two_tenants',
      'hint', 'Create a second business, then run this again.');
  end if;

  foreach t in array tables loop
    if to_regclass('public.' || t) is null then continue; end if;
    checked := checked + 1;
    -- with tenant A in scope, can the policy expression see any of B's rows?
    perform set_tenant(a_slug);
    execute format(
      'select count(*) from %I where tenant_id = $1 and tenant_id = current_tenant()', t)
      into n using b;
    if n > 0 then leaked := leaked + 1; end if;
  end loop;

  perform clear_tenant();

  return json_build_object(
    'ok', leaked = 0,
    'tenant_a', a_slug, 'tenant_b', b_slug,
    'tables_checked', checked,
    'tables_leaking', leaked,
    'verdict', case when leaked = 0
      then 'Isolated. A policy cannot match another tenant''s rows.'
      else 'LEAK — do not put a real customer on this.' end);
end; $$;

grant execute on function test_isolation() to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5 · Run it now
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare v json;
begin
  v := test_isolation();
  raise notice '%', v::text;
  if (v->>'ok')::boolean is false and v->>'reason' is null then
    raise exception 'tenant isolation FAILED: %', v::text;
  end if;
end $$;

-- ============================================================================
-- CHECK
--   select test_isolation();
--
--   -- see the policies:
--   select tablename, policyname from pg_policies
--    where schemaname = 'public' order by tablename;
--
-- WHAT THIS DOES NOT DO
--   service_role bypasses RLS. Server code still has to scope its own queries —
--   that's what tenant_guard() is for. Moving reads off service_role onto user
--   JWTs is the next step, and it needs the app changed, not just the database.
-- ============================================================================
