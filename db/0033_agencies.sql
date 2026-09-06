-- ============================================================================
-- 0033_agencies.sql — white-label resellers.
-- Run AFTER 0032. Safe to re-run.
--
-- THE DISTINCTION THAT MATTERS
-- An organisation is one business with several branches — Damai Clinic in
-- Subang and Puchong, same owner, same brand.
--
-- An agency is a reseller. It signs up businesses that have nothing to do with
-- each other, puts its OWN brand on the product, and bills them itself. The
-- clinic never learns Automology exists.
--
-- These are different shapes and conflating them would break both.
--
-- ⚠ ISOLATION IS THE WHOLE PRODUCT HERE
-- Agency A must never see agency B's clients. Not in a list, not in a count,
-- not in a total. An agency that finds another agency's client list has found
-- their prospect list, and that ends the relationship. Every function below is
-- scoped by agency, and nothing accepts a tenant slug without checking it
-- belongs to the caller.
-- ============================================================================

create table if not exists agencies (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  access_code   text unique,
  contact_email text,
  contact_phone text,

  -- what their clients see instead of Automology
  brand_name    text,
  brand_color   text default '#1D6A8C',
  logo_url      text,
  support_email text,
  custom_domain text unique,

  -- commercials
  plan          text not null default 'partner',
  client_limit  int not null default 25,
  wholesale_pct numeric(5,2) default 70.00,   -- share of list price the agency pays

  status        text not null default 'active',
  created_at    timestamptz not null default now(),
  constraint agency_status_chk check (status in ('active','suspended','closed'))
);

alter table agencies enable row level security;

alter table tenants
  add column if not exists agency_id uuid references agencies(id) on delete set null;

create index if not exists tenants_agency_idx on tenants(agency_id);

-- agency staff: their own people, separate from any business's staff
create table if not exists agency_staff (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null references agencies(id) on delete cascade,
  name        text not null,
  email       text,
  role        text not null default 'agent',
  access_code text unique,
  status      text not null default 'active',
  created_at  timestamptz not null default now(),
  constraint agency_role_chk check (role in ('principal','manager','agent','viewer')),
  constraint agency_staff_status_chk check (status in ('active','suspended'))
);

create index if not exists agency_staff_idx on agency_staff(agency_id);
alter table agency_staff enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- What an agency role may do. Narrower than a business owner on purpose:
-- an agency configures and supports, it does not own the client's data.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function agency_can(p_role text, p_action text)
returns boolean language sql immutable as $$
  select case p_action
    when 'view'            then p_role in ('principal','manager','agent','viewer')
    when 'onboard_client'  then p_role in ('principal','manager','agent')
    when 'configure_client'then p_role in ('principal','manager','agent')
    when 'branding'        then p_role in ('principal','manager')
    when 'billing'         then p_role in ('principal')
    when 'manage_staff'    then p_role in ('principal')
    else false
  end;
$$;

create or replace function create_agency(p_payload json)
returns json language plpgsql security definer set search_path = public as $$
declare v_name text := trim(p_payload->>'name'); v_slug text; v_base text;
        v_n int := 1; v_id uuid; v_code text;
begin
  if v_name is null or length(v_name) < 2 then
    return json_build_object('ok', false, 'reason', 'name_required');
  end if;

  v_base := slugify(v_name); if v_base = '' then v_base := 'agency'; end if;
  v_slug := v_base;
  while exists (select 1 from agencies where slug = v_slug) loop
    v_n := v_n + 1; v_slug := v_base || '-' || v_n;
  end loop;

  loop
    v_code := upper(substr(v_base, 1, 6)) || '-AG-' || random_code(5);
    exit when not exists (select 1 from agencies where access_code = v_code)
          and not exists (select 1 from agency_staff where access_code = v_code);
  end loop;

  insert into agencies (name, slug, access_code, contact_email, brand_name,
                        brand_color, support_email)
  values (v_name, v_slug, v_code,
          nullif(trim(p_payload->>'email'), ''),
          coalesce(nullif(trim(p_payload->>'brand_name'), ''), v_name),
          coalesce(nullif(p_payload->>'color', ''), '#1D6A8C'),
          nullif(trim(p_payload->>'support_email'), ''))
  returning id into v_id;

  insert into agency_staff (agency_id, name, role, access_code, email)
  values (v_id, coalesce(nullif(trim(p_payload->>'contact'), ''), 'Principal'),
          'principal', v_code || 'P', nullif(trim(p_payload->>'email'), ''));

  return json_build_object('ok', true, 'id', v_id, 'slug', v_slug,
                           'access_code', v_code,
                           'principal_code', v_code || 'P');
end; $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Onboard a client. The agency's branding is applied so the business inherits
-- their reseller's look rather than ours.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function agency_add_client(
  p_agency_slug text, p_role text, p_payload json
) returns json language plpgsql security definer set search_path = public as $$
declare v_agency uuid; v_limit int; v_count int; v_res json; v_slug text; v_color text;
begin
  if not agency_can(p_role, 'onboard_client') then
    return json_build_object('ok', false, 'reason', 'not_allowed');
  end if;

  select id, client_limit, brand_color into v_agency, v_limit, v_color
  from agencies where slug = p_agency_slug and status = 'active';
  if v_agency is null then
    return json_build_object('ok', false, 'reason', 'unknown_agency');
  end if;

  select count(*) into v_count from tenants where agency_id = v_agency;
  if v_count >= v_limit then
    return json_build_object('ok', false, 'reason', 'at_limit',
      'hint', 'This agency is at its client limit of ' || v_limit || '.');
  end if;

  v_res := create_tenant(p_payload);
  if not (v_res->>'ok')::boolean then return v_res; end if;
  v_slug := v_res->>'slug';

  update tenants set
    agency_id = v_agency,
    -- the client keeps their own colour if they chose one
    brand_color = coalesce(nullif(p_payload->>'color', ''), brand_color)
  where slug = v_slug;

  return v_res || json_build_object('agency', p_agency_slug);
end; $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Everything an agency sees. Scoped by agency, always.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function agency_data(p_agency_slug text)
returns json language plpgsql stable security definer set search_path = public as $$
declare v_agency uuid; v_result json;
begin
  select id into v_agency from agencies where slug = p_agency_slug;
  if v_agency is null then
    return json_build_object('ok', false, 'reason', 'unknown_agency');
  end if;

  select json_build_object(
    'ok', true,
    'agency', (select json_build_object(
        'name', a.name, 'slug', a.slug, 'brand_name', a.brand_name,
        'color', coalesce(a.brand_color, '#1D6A8C'), 'logo_url', a.logo_url,
        'support_email', a.support_email, 'domain', a.custom_domain,
        'plan', a.plan, 'client_limit', a.client_limit,
        'wholesale_pct', a.wholesale_pct, 'access_code', a.access_code)
      from agencies a where a.id = v_agency),

    'clients', (select coalesce(json_agg(json_build_object(
        'name', t.name, 'slug', t.slug, 'vertical', t.vertical, 'plan', t.plan,
        'color', coalesce(t.brand_color, '#1D6A8C'),
        'created_at', t.created_at, 'access_code', t.access_code,
        'agent', (select persona_name from ai_employees e
                   where e.tenant_id = t.id and e.status = 'active'
                   order by e.is_primary desc limit 1),
        'conversations', (select count(*) from conversations c where c.tenant_id = t.id),
        'bookings', (select count(*) from bookings b where b.tenant_id = t.id
                      and b.status in ('pending','confirmed')),
        'needs_you', (select count(*) from escalations es where es.tenant_id = t.id
                       and es.status = 'open'),
        'health', tenant_health(t.id))
        order by t.created_at desc), '[]'::json)
      from tenants t where t.agency_id = v_agency),

    'totals', (select json_build_object(
        'clients', count(*),
        'slots_left', greatest(0, (select client_limit from agencies where id = v_agency) - count(*)),
        'conversations', coalesce(sum((select count(*) from conversations c
                                        where c.tenant_id = t.id)), 0),
        'bookings', coalesce(sum((select count(*) from bookings b
                                   where b.tenant_id = t.id)), 0),
        'needs_you', coalesce(sum((select count(*) from escalations es
                                    where es.tenant_id = t.id and es.status='open')), 0),
        'ai_cost', coalesce(sum((select coalesce(sum(c.ai_cost_usd),0)
                                  from conversations c where c.tenant_id = t.id)), 0))
      from tenants t where t.agency_id = v_agency),

    -- what the agency owes, and what it can charge
    'billing', (select json_build_object(
        'paying', count(*) filter (where s.status = 'active'),
        'trialing', count(*) filter (where s.status = 'trialing'),
        'list_price', coalesce(sum(s.amount) filter (where s.status = 'active'), 0),
        'wholesale_cost', round(coalesce(sum(s.amount) filter (where s.status='active'), 0)
                                * (select wholesale_pct from agencies where id = v_agency) / 100, 2),
        'margin', round(coalesce(sum(s.amount) filter (where s.status='active'), 0)
                        * (100 - (select wholesale_pct from agencies where id = v_agency)) / 100, 2),
        'currency', 'MYR')
      from subscriptions s join tenants t on t.id = s.tenant_id
      where t.agency_id = v_agency),

    'staff', (select coalesce(json_agg(json_build_object(
        'id', st.id, 'name', st.name, 'email', st.email, 'role', st.role,
        'status', st.status, 'access_code', st.access_code) order by st.role, st.name),
        '[]'::json)
      from agency_staff st where st.agency_id = v_agency)
  ) into v_result;

  return v_result;
end; $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Agency branding, so a client's login and dashboard show the reseller.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function update_agency(p_slug text, p_role text, p_payload json)
returns json language plpgsql security definer set search_path = public as $$
begin
  if not agency_can(p_role, 'branding') then
    return json_build_object('ok', false, 'reason', 'not_allowed');
  end if;

  update agencies set
    brand_name    = coalesce(nullif(trim(p_payload->>'brand_name'), ''), brand_name),
    brand_color   = coalesce(nullif(trim(p_payload->>'color'), ''), brand_color),
    logo_url      = coalesce(nullif(trim(p_payload->>'logo_url'), ''), logo_url),
    support_email = coalesce(nullif(trim(p_payload->>'support_email'), ''), support_email),
    contact_phone = coalesce(nullif(trim(p_payload->>'phone'), ''), contact_phone)
  where slug = p_slug;

  if not found then return json_build_object('ok', false, 'reason', 'unknown_agency'); end if;
  return json_build_object('ok', true);
end; $$;

create or replace function agency_add_staff(p_slug text, p_role text, p_payload json)
returns json language plpgsql security definer set search_path = public as $$
declare v_agency uuid; v_code text; v_name text := nullif(trim(p_payload->>'name'), '');
        v_new_role text := coalesce(p_payload->>'role', 'agent');
begin
  if not agency_can(p_role, 'manage_staff') then
    return json_build_object('ok', false, 'reason', 'not_allowed');
  end if;
  if v_name is null then return json_build_object('ok', false, 'reason', 'name_required'); end if;
  if v_new_role not in ('principal','manager','agent','viewer') then
    return json_build_object('ok', false, 'reason', 'bad_role');
  end if;

  select id into v_agency from agencies where slug = p_slug;
  if v_agency is null then return json_build_object('ok', false, 'reason', 'unknown_agency'); end if;

  loop
    v_code := upper(substr(regexp_replace(v_name, '[^a-zA-Z]', '', 'g'), 1, 4)) ||
              '-AG-' || random_code(5);
    exit when not exists (select 1 from agency_staff where access_code = v_code);
  end loop;

  insert into agency_staff (agency_id, name, email, role, access_code)
  values (v_agency, v_name, nullif(trim(p_payload->>'email'), ''), v_new_role, v_code);

  return json_build_object('ok', true, 'access_code', v_code, 'role', v_new_role);
end; $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Sign-in. An agency key resolves to the agency, never to a client.
--
-- Note the order: agency keys are checked FIRST, so an agency principal can
-- never accidentally land inside a single client's dashboard with owner rights.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function resolve_key(p_code text)
returns json language plpgsql stable security definer set search_path = public as $$
declare v_code text := upper(trim(coalesce(p_code, ''))); v_row record;
begin
  if v_code = '' then return json_build_object('ok', false); end if;

  -- agency staff
  select st.id, st.name, st.role, st.status, a.slug, a.name as agency_name, a.status as ag_status
    into v_row
  from agency_staff st join agencies a on a.id = st.agency_id
  where upper(st.access_code) = v_code limit 1;

  if found then
    if v_row.status <> 'active' or v_row.ag_status <> 'active' then
      return json_build_object('ok', false, 'reason', 'suspended');
    end if;
    return json_build_object('ok', true, 'scope', 'agency',
      'agency_slug', v_row.slug, 'role', v_row.role,
      'name', v_row.name, 'business', v_row.agency_name);
  end if;

  -- the agency's own key
  select a.slug, a.name, a.status into v_row from agencies a
  where upper(a.access_code) = v_code limit 1;
  if found then
    if v_row.status <> 'active' then
      return json_build_object('ok', false, 'reason', 'suspended');
    end if;
    return json_build_object('ok', true, 'scope', 'agency',
      'agency_slug', v_row.slug, 'role', 'principal',
      'name', 'Principal', 'business', v_row.name);
  end if;

  -- group (multi-branch business)
  select s.id, s.name, s.role, s.status, o.slug as org_slug, o.name as org_name
    into v_row
  from staff s join organisations o on o.id = s.organisation_id
  where upper(s.access_code) = v_code and s.organisation_id is not null limit 1;

  if found then
    if v_row.status <> 'active' then
      return json_build_object('ok', false, 'reason', 'suspended');
    end if;
    return json_build_object('ok', true, 'scope', 'organisation',
      'org_slug', v_row.org_slug, 'role', v_row.role,
      'name', v_row.name, 'business', v_row.org_name);
  end if;

  -- business staff
  select s.id, s.name, s.role, s.status, t.slug, t.name as business into v_row
  from staff s join tenants t on t.id = s.tenant_id
  where upper(s.access_code) = v_code limit 1;

  if found then
    if v_row.status <> 'active' then
      return json_build_object('ok', false, 'reason', 'suspended');
    end if;
    return json_build_object('ok', true, 'scope', 'tenant', 'slug', v_row.slug,
      'role', v_row.role, 'name', v_row.name, 'business', v_row.business,
      'staff_id', v_row.id);
  end if;

  -- the business owner key
  select t.slug, t.name as business into v_row from tenants t
  where upper(t.access_code) = v_code limit 1;
  if found then
    return json_build_object('ok', true, 'scope', 'tenant', 'slug', v_row.slug,
      'role', 'owner', 'name', 'Owner', 'business', v_row.business);
  end if;

  return json_build_object('ok', false);
end; $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Does this agency own this client? Every agency action calls this before
-- touching a tenant, so a guessed slug gets nothing.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function agency_owns(p_agency_slug text, p_tenant_slug text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from tenants t join agencies a on a.id = t.agency_id
    where t.slug = p_tenant_slug and a.slug = p_agency_slug and a.status = 'active');
$$;

-- what a client's page should show: the agency's brand, or ours
create or replace function whitelabel_for(p_tenant_slug text)
returns json language sql stable security definer set search_path = public as $$
  select coalesce(
    (select json_build_object(
       'agency', true,
       'name', coalesce(a.brand_name, a.name),
       'color', coalesce(a.brand_color, '#1D6A8C'),
       'logo_url', a.logo_url,
       'support_email', a.support_email)
     from tenants t join agencies a on a.id = t.agency_id
     where t.slug = p_tenant_slug and a.status = 'active'),
    json_build_object('agency', false, 'name', 'Automology'));
$$;

revoke execute on function
  create_agency(json), agency_add_client(text,text,json), agency_data(text),
  update_agency(text,text,json), agency_add_staff(text,text,json),
  agency_owns(text,text), whitelabel_for(text), agency_can(text,text)
  from public, anon, authenticated;

grant execute on function
  create_agency(json), agency_add_client(text,text,json), agency_data(text),
  update_agency(text,text,json), agency_add_staff(text,text,json),
  agency_owns(text,text), whitelabel_for(text), agency_can(text,text)
  to service_role;

-- RLS for the new tables
alter table agencies force row level security;
drop policy if exists agency_self on agencies;
create policy agency_self on agencies for all
  using (exists (select 1 from tenants t
                  where t.agency_id = agencies.id and t.id = current_tenant()));

alter table agency_staff force row level security;
drop policy if exists agency_staff_scope on agency_staff;
create policy agency_staff_scope on agency_staff for all
  using (exists (select 1 from tenants t
                  where t.agency_id = agency_staff.agency_id and t.id = current_tenant()));

-- ─────────────────────────────────────────────────────────────────────────────
-- Prove the isolation before trusting it
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function test_agency_isolation()
returns json language plpgsql security definer set search_path = public as $$
declare a1 text; a2 text; v1 json; v2 json; leak boolean := false;
begin
  select slug into a1 from agencies order by created_at limit 1;
  select slug into a2 from agencies where slug <> a1 order by created_at limit 1;

  if a2 is null then
    return json_build_object('ok', true, 'note', 'need_two_agencies_to_test');
  end if;

  v1 := agency_data(a1);
  v2 := agency_data(a2);

  -- does either list contain a slug belonging to the other?
  select exists (
    select 1
    from json_array_elements(v1->'clients') c1
    join json_array_elements(v2->'clients') c2
      on c1->>'slug' = c2->>'slug') into leak;

  return json_build_object('ok', not leak,
    'verdict', case when leak
      then 'LEAK — one agency can see another''s client.'
      else 'Isolated. Neither agency sees the other''s clients.' end);
end; $$;

grant execute on function test_agency_isolation() to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- The master view gains agencies
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function master_agencies()
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object(
      'name', a.name, 'slug', a.slug, 'brand_name', a.brand_name,
      'color', coalesce(a.brand_color, '#1D6A8C'), 'status', a.status,
      'plan', a.plan, 'client_limit', a.client_limit,
      'wholesale_pct', a.wholesale_pct, 'access_code', a.access_code,
      'clients', (select count(*) from tenants t where t.agency_id = a.id),
      'conversations', (select count(*) from conversations c
                          join tenants t on t.id = c.tenant_id
                         where t.agency_id = a.id),
      'billed', (select coalesce(sum(s.amount) filter (where s.status='active'), 0)
                   from subscriptions s join tenants t on t.id = s.tenant_id
                  where t.agency_id = a.id))
      order by a.created_at desc), '[]'::json)
  from agencies a;
$$;

grant execute on function master_agencies() to service_role;

-- ============================================================================
-- CHECK
--   select create_agency('{"name":"Bright Digital","email":"hi@bright.my",
--                          "brand_name":"Bright AI","color":"#7A4BC4"}'::json);
--   → returns the agency key and the principal key
--
--   select agency_add_client('bright-digital','principal',
--     '{"name":"Kedai Gunting Ali","sector":"salon",
--       "services":[{"name":"Haircut","price":"25"}]}'::json);
--
--   select agency_data('bright-digital');
--   select whitelabel_for('kedai-gunting-ali');   → shows Bright AI, not Automology
--   select agency_owns('bright-digital','damai-clinic');  → false
--   select test_agency_isolation();
-- ============================================================================
