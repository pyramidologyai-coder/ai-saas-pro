-- ============================================================================
-- 0039_accounts.sql — one person, one login, many businesses.
-- Run AFTER 0038. Safe to re-run.
--
-- WHY
-- Today a business is a shared access code. The code is the identity: whoever
-- holds it is the owner, there is no person behind it, and one human running
-- two clinics carries two codes and picks the right one by memory. There is
-- also no verification anywhere — /start will make a business for any address
-- typed into it, which is how two tenants called "test" got here.
--
-- This adds the layer underneath real accounts: a person (auth.users, via
-- Supabase Auth, so Google and email-plus-password both work and verification
-- is Supabase's problem rather than ours) linked to any number of businesses,
-- each link carrying its own role.
--
-- WHAT THIS FILE DOES NOT DO
-- It does not switch anything over. The access-code path keeps working exactly
-- as it does now, and nothing in the app reads these tables yet. Cutting the
-- routes across is the next change, deliberately separate, because a half-
-- migrated auth system locks everybody out of everything.
--
-- profiles.tenant_id stays where it is. It holds one tenant per person, which
-- is the limitation being removed, but something may still read it. It can be
-- dropped once the routes are across.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1 · Who belongs to what
--
-- The role lives on the link, not the person: the same human can be owner of
-- their clinic and viewer of a friend's salon. Same four roles the access-code
-- path already uses, so role_can() keeps working unchanged.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists memberships (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  tenant_id  uuid not null references tenants(id)    on delete cascade,
  role       text not null default 'owner',
  created_at timestamptz not null default now(),
  unique (user_id, tenant_id)
);

do $$ begin
  alter table memberships
    add constraint memberships_role_chk
    check (role in ('owner','manager','staff','viewer'));
exception when duplicate_object then null; end $$;

create index if not exists memberships_user_idx   on memberships(user_id);
create index if not exists memberships_tenant_idx on memberships(tenant_id);

alter table memberships enable row level security;
alter table memberships force row level security;

-- Read your own rows and nobody else's. Writes go through the functions below,
-- which are security definer, so no write policy is wanted here.
drop policy if exists memberships_own on memberships;
create policy memberships_own on memberships
  for select using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- 2 · What a signed-in person can see
--
-- Returns the businesses this user holds, newest first, with the role on each.
-- The shape matches what the dashboard's business picker will need.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function my_businesses(p_user uuid default auth.uid())
returns json
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(json_agg(json_build_object(
      'slug',   t.slug,
      'name',   t.name,
      'role',   m.role,
      'plan',   t.plan,
      'status', t.status,
      'color',  coalesce(t.brand_color, '#1D6A8C')
    ) order by m.created_at desc), '[]'::json)
    from memberships m
    join tenants t on t.id = m.tenant_id
   where m.user_id = p_user;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3 · What this person may do in that business
--
-- Null when there is no link at all, which callers must treat as "no access"
-- rather than defaulting to something. A check that fails quiet and defaults to
-- viewer is the bug this project has already shipped twice.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function membership_role(p_user uuid, p_slug text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select m.role
    from memberships m
    join tenants t on t.id = m.tenant_id
   where m.user_id = p_user and t.slug = p_slug;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4 · Linking a person to a business
--
-- Called when somebody signs up a new business while logged in, and when an
-- invited colleague first signs in. Idempotent: signing in twice must not
-- create two links, and must not quietly downgrade a role either.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function grant_membership(p_user uuid, p_slug text, p_role text default 'owner')
returns json
language plpgsql
security definer
set search_path = public
as $$
declare v_tenant uuid; v_existing text;
begin
  select id into v_tenant from tenants where slug = p_slug;
  if v_tenant is null then
    return json_build_object('ok', false, 'reason', 'no_such_business');
  end if;
  if p_role not in ('owner','manager','staff','viewer') then
    return json_build_object('ok', false, 'reason', 'bad_role');
  end if;

  select role into v_existing
    from memberships where user_id = p_user and tenant_id = v_tenant;

  if v_existing is not null then
    return json_build_object('ok', true, 'slug', p_slug, 'role', v_existing,
                             'note', 'already linked, role left alone');
  end if;

  insert into memberships (user_id, tenant_id, role)
  values (p_user, v_tenant, p_role);

  return json_build_object('ok', true, 'slug', p_slug, 'role', p_role);
end; $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5 · Adopting what already exists
--
-- Run when somebody signs in. Two ways an existing business becomes theirs:
--
--   tenants.email  — the address given at signup. That person is the owner.
--   staff.email    — somebody invited to a business, with the role they were
--                    given.
--
-- Matching is on a lowercased, trimmed address. This is the only place the
-- old world and the new one meet, so it is deliberately narrow: it links what
-- already names this address and invents nothing.
--
-- It cannot run before the address is verified. Supabase only calls a user
-- confirmed once they have clicked through, or once Google has vouched for
-- them, so the caller must pass a confirmed address and nothing else.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function claim_memberships(p_user uuid, p_email text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare v_email text := lower(trim(p_email)); v_added int := 0; v_row record;
begin
  if v_email is null or v_email = '' or v_email not like '%@%' then
    return json_build_object('ok', false, 'reason', 'no_email');
  end if;

  -- businesses that named this address at signup
  for v_row in
    select t.id, t.slug from tenants t
     where lower(trim(t.email)) = v_email
       and not exists (select 1 from memberships m
                        where m.user_id = p_user and m.tenant_id = t.id)
  loop
    insert into memberships (user_id, tenant_id, role)
    values (p_user, v_row.id, 'owner');
    v_added := v_added + 1;
  end loop;

  -- businesses that invited this address as staff
  for v_row in
    select s.tenant_id as id, s.role from staff s
     where lower(trim(s.email)) = v_email
       and s.status = 'active'
       and s.tenant_id is not null
       and not exists (select 1 from memberships m
                        where m.user_id = p_user and m.tenant_id = s.tenant_id)
  loop
    insert into memberships (user_id, tenant_id, role)
    values (p_user, v_row.id, v_row.role);
    v_added := v_added + 1;
  end loop;

  return json_build_object('ok', true, 'linked', v_added,
                           'businesses', my_businesses(p_user));
end; $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6 · Grants
--
-- The server calls these with the service role. anon and authenticated get
-- nothing: a signed-in browser must not be able to grant itself a membership.
-- Revoke first — Postgres grants EXECUTE to PUBLIC by default, and a later
-- grant does not take that away. That mistake is what 0036 had to clean up.
-- ─────────────────────────────────────────────────────────────────────────────
revoke execute on function my_businesses(uuid)          from public, anon, authenticated;
revoke execute on function membership_role(uuid, text)  from public, anon, authenticated;
revoke execute on function grant_membership(uuid, text, text) from public, anon, authenticated;
revoke execute on function claim_memberships(uuid, text) from public, anon, authenticated;

grant execute on function my_businesses(uuid)           to service_role;
grant execute on function membership_role(uuid, text)   to service_role;
grant execute on function grant_membership(uuid, text, text) to service_role;
grant execute on function claim_memberships(uuid, text) to service_role;

-- ============================================================================
-- CHECK
--   Nothing in the app reads this yet, so the app must behave exactly as it did
--   before. Confirm that first:
--     select smoke_test();
--
--   Then, with a real auth user id:
--     select claim_memberships('<uuid from auth.users>', '<their email>');
--     select my_businesses('<same uuid>');
--
--   The advisor should report no new anon-executable functions:
--     Supabase → Advisors → Security
-- ============================================================================
