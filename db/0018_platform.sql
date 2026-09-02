-- ============================================================================
-- 0018_platform.sql — one platform, not one chatbot.
-- Run AFTER 0017. Safe to re-run.
--
-- Adds the four modules a business actually runs on:
--   TEAM      staff with roles, so not everyone can change prices
--   MARKETING social accounts, posts, campaigns
--   FINANCE   invoices off the back of bookings, revenue
--   SETTINGS  branding and custom domain
--
-- ⚠ HONEST NOTE ON SOCIAL POSTING
-- This creates the data model and the queue. Actually publishing to TikTok,
-- Meta or Instagram needs a developer account per platform, OAuth credentials,
-- and app review by each of them — weeks of approval, not code. Posts here are
-- created, scheduled and tracked; the publish step stays 'queued' until those
-- credentials exist. Nothing pretends to have posted when it hasn't.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- TEAM
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists staff (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  name         text not null,
  email        text,
  role         text not null default 'staff',
  access_code  text unique,
  status       text not null default 'active',
  last_seen_at timestamptz,
  created_at   timestamptz not null default now(),
  constraint staff_role_chk   check (role   in ('owner','manager','staff','viewer')),
  constraint staff_status_chk check (status in ('active','suspended'))
);

create index if not exists staff_tenant_idx on staff(tenant_id);
alter table staff enable row level security;

-- What each role may do. Kept in one place so the UI and the API agree.
create or replace function role_can(p_role text, p_action text)
returns boolean language sql immutable as $$
  select case p_action
    when 'view'            then p_role in ('owner','manager','staff','viewer')
    when 'handle_chats'    then p_role in ('owner','manager','staff')
    when 'manage_bookings' then p_role in ('owner','manager','staff')
    when 'edit_prices'     then p_role in ('owner','manager')
    when 'marketing'       then p_role in ('owner','manager')
    when 'finance'         then p_role in ('owner','manager')
    when 'manage_team'     then p_role in ('owner')
    when 'settings'        then p_role in ('owner')
    else false
  end;
$$;

create or replace function add_staff(p_tenant_slug text, p_payload json)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_tenant uuid; v_code text; v_role text := coalesce(p_payload->>'role','staff');
  v_name text := nullif(trim(p_payload->>'name'),'');
begin
  if v_name is null then return json_build_object('ok',false,'reason','name_required'); end if;
  if v_role not in ('owner','manager','staff','viewer') then
    return json_build_object('ok',false,'reason','bad_role');
  end if;

  select id into v_tenant from tenants where slug = p_tenant_slug;
  if v_tenant is null then return json_build_object('ok',false,'reason','unknown_tenant'); end if;

  v_code := upper(substr(regexp_replace(v_name,'[^a-zA-Z]','','g'),1,4) || '-' ||
    substr(translate(encode(gen_random_bytes(6),'base64'),'+/=OI01l','XYZWABCD'),1,5));

  insert into staff (tenant_id, name, email, role, access_code)
  values (v_tenant, v_name, nullif(trim(p_payload->>'email'),''), v_role, v_code);

  return json_build_object('ok',true,'access_code',v_code,'role',v_role);
end; $$;

create or replace function set_staff(p_id uuid, p_role text, p_status text)
returns json language plpgsql security definer set search_path = public as $$
begin
  update staff set
    role   = coalesce(nullif(p_role,''), role),
    status = coalesce(nullif(p_status,''), status)
  where id = p_id;
  if not found then return json_build_object('ok',false,'reason','unknown_staff'); end if;
  return json_build_object('ok',true);
end; $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- MARKETING
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists social_accounts (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  platform     text not null,
  handle       text,
  status       text not null default 'disconnected',
  connected_at timestamptz,
  followers    int,
  created_at   timestamptz not null default now(),
  constraint social_platform_chk check (platform in
    ('instagram','facebook','tiktok','google_business','whatsapp','x','linkedin')),
  constraint social_status_chk check (status in ('disconnected','pending','connected','error')),
  unique (tenant_id, platform)
);

create table if not exists campaigns (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  name        text not null,
  objective   text,
  status      text not null default 'draft',
  budget      numeric(10,2),
  currency    text default 'MYR',
  starts_on   date,
  ends_on     date,
  created_at  timestamptz not null default now(),
  constraint campaign_status_chk check (status in ('draft','scheduled','running','paused','done'))
);

create table if not exists posts (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  campaign_id  uuid references campaigns(id) on delete set null,
  body         text not null,
  media_url    text,
  platforms    text[] not null default '{}',
  scheduled_at timestamptz,
  status       text not null default 'draft',
  published_at timestamptz,
  reach        int,
  clicks       int,
  created_by   text,
  created_at   timestamptz not null default now(),
  constraint post_status_chk check (status in ('draft','queued','published','failed','cancelled'))
);

create index if not exists posts_tenant_idx on posts(tenant_id, scheduled_at);
alter table social_accounts enable row level security;
alter table campaigns       enable row level security;
alter table posts           enable row level security;

-- seed the platform rows so the UI has something to show
create or replace function ensure_social_rows(p_tenant uuid)
returns void language sql security definer set search_path = public as $$
  insert into social_accounts (tenant_id, platform)
  select p_tenant, p
  from unnest(array['instagram','facebook','tiktok','google_business','whatsapp']) p
  on conflict (tenant_id, platform) do nothing;
$$;

create or replace function save_post(p_tenant_slug text, p_payload json)
returns json language plpgsql security definer set search_path = public as $$
declare v_tenant uuid; v_id uuid; v_when timestamptz;
begin
  select id into v_tenant from tenants where slug = p_tenant_slug;
  if v_tenant is null then return json_build_object('ok',false,'reason','unknown_tenant'); end if;
  if nullif(trim(p_payload->>'body'),'') is null then
    return json_build_object('ok',false,'reason','body_required');
  end if;

  v_when := nullif(p_payload->>'scheduled_at','')::timestamptz;

  insert into posts (tenant_id, body, media_url, platforms, scheduled_at, status, created_by)
  values (
    v_tenant, trim(p_payload->>'body'), nullif(trim(p_payload->>'media_url'),''),
    coalesce((select array_agg(value::text) from json_array_elements_text(p_payload->'platforms')), '{}'),
    v_when,
    case when v_when is null then 'draft' else 'queued' end,
    nullif(p_payload->>'by','')
  ) returning id into v_id;

  return json_build_object('ok',true,'id',v_id,
    'status', case when v_when is null then 'draft' else 'queued' end);
end; $$;

create or replace function set_post_status(p_id uuid, p_status text)
returns json language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('draft','queued','published','failed','cancelled') then
    return json_build_object('ok',false,'reason','bad_status');
  end if;
  update posts set status = p_status,
    published_at = case when p_status='published' then now() else published_at end
  where id = p_id;
  if not found then return json_build_object('ok',false,'reason','unknown_post'); end if;
  return json_build_object('ok',true);
end; $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- FINANCE — invoices come from bookings, so the numbers are real, not typed in
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists invoices (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  booking_id  uuid references bookings(id) on delete set null,
  customer_id uuid references customers(id) on delete set null,
  number      text not null,
  amount      numeric(10,2) not null,
  currency    text not null default 'MYR',
  status      text not null default 'unpaid',
  issued_on   date not null default current_date,
  paid_at     timestamptz,
  method      text,
  note        text,
  created_at  timestamptz not null default now(),
  constraint invoice_status_chk check (status in ('unpaid','paid','void','refunded')),
  unique (tenant_id, number)
);

create index if not exists invoices_tenant_idx on invoices(tenant_id, issued_on desc);
alter table invoices enable row level security;

create or replace function invoice_for_booking(p_booking_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_tenant uuid; v_cust uuid; v_amount numeric; v_cur text; v_num text; v_id uuid; v_seq int;
begin
  select b.tenant_id, b.customer_id, coalesce(i.price_local,0), coalesce(i.currency_code,'MYR')
    into v_tenant, v_cust, v_amount, v_cur
  from bookings b left join items i on i.id = b.item_id
  where b.id = p_booking_id;

  if v_tenant is null then return json_build_object('ok',false,'reason','unknown_booking'); end if;

  select id into v_id from invoices where booking_id = p_booking_id;
  if v_id is not null then
    return json_build_object('ok',true,'id',v_id,'existing',true);
  end if;

  select count(*)+1 into v_seq from invoices where tenant_id = v_tenant;
  v_num := to_char(current_date,'YYYYMM') || '-' || lpad(v_seq::text,4,'0');

  insert into invoices (tenant_id, booking_id, customer_id, number, amount, currency)
  values (v_tenant, p_booking_id, v_cust, v_num, v_amount, v_cur)
  returning id into v_id;

  return json_build_object('ok',true,'id',v_id,'number',v_num,'amount',v_amount);
end; $$;

create or replace function set_invoice_status(p_id uuid, p_status text, p_method text default null)
returns json language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('unpaid','paid','void','refunded') then
    return json_build_object('ok',false,'reason','bad_status');
  end if;
  update invoices set status = p_status,
    paid_at = case when p_status='paid' then now() else null end,
    method  = coalesce(p_method, method)
  where id = p_id;
  if not found then return json_build_object('ok',false,'reason','unknown_invoice'); end if;
  return json_build_object('ok',true);
end; $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- SETTINGS
-- ─────────────────────────────────────────────────────────────────────────────
alter table tenants
  add column if not exists custom_domain text unique,
  add column if not exists plan          text not null default 'trial',
  add column if not exists logo_url      text;

-- ─────────────────────────────────────────────────────────────────────────────
-- platform_data(slug) — every module in one call, so the shell loads once.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function platform_data(p_slug text)
returns json language plpgsql security definer set search_path = public as $$
declare v_tenant uuid; v_result json;
begin
  select id into v_tenant from tenants where slug = p_slug;
  if v_tenant is null then return json_build_object('ok',false,'reason','unknown_tenant'); end if;

  perform ensure_social_rows(v_tenant);

  select json_build_object(
    'ok', true,
    'business', (select json_build_object(
        'name',t.name,'slug',t.slug,'color',coalesce(t.brand_color,'#1D6A8C'),
        'plan',t.plan,'wallet',t.wallet_balance_usd,'domain',t.custom_domain,
        'tagline',t.tagline,'address',t.address,'phone',t.phone,
        'greeting',t.brand_greeting,'access_code',t.access_code)
      from tenants t where t.id = v_tenant),
    'agents', list_agents(p_slug),
    'team', (select coalesce(json_agg(s order by s.role, s.name),'[]'::json) from (
        select id, name, email, role, status, access_code from staff
        where tenant_id = v_tenant order by role, name) s),
    'social', (select coalesce(json_agg(a order by a.platform),'[]'::json) from (
        select id, platform, handle, status, followers from social_accounts
        where tenant_id = v_tenant) a),
    'posts', (select coalesce(json_agg(p order by p.created_at desc),'[]'::json) from (
        select id, body, platforms, status, scheduled_at, published_at, reach, clicks
        from posts where tenant_id = v_tenant order by created_at desc limit 30) p),
    'invoices', (select coalesce(json_agg(i order by i.issued_on desc),'[]'::json) from (
        select inv.id, inv.number, inv.amount, inv.currency, inv.status, inv.issued_on,
               coalesce(c.name,'Walk-in') as customer
        from invoices inv left join customers c on c.id = inv.customer_id
        where inv.tenant_id = v_tenant order by inv.issued_on desc limit 30) i),
    'finance', (select json_build_object(
        'paid',   coalesce(sum(amount) filter (where status='paid'),0),
        'unpaid', coalesce(sum(amount) filter (where status='unpaid'),0),
        'count',  count(*))
      from invoices where tenant_id = v_tenant)
  ) into v_result;

  return v_result;
end; $$;

revoke execute on function
  add_staff(text,json), set_staff(uuid,text,text), save_post(text,json),
  set_post_status(uuid,text), invoice_for_booking(uuid),
  set_invoice_status(uuid,text,text), platform_data(text), ensure_social_rows(uuid)
  from public, anon, authenticated;

grant execute on function
  add_staff(text,json), set_staff(uuid,text,text), save_post(text,json),
  set_post_status(uuid,text), invoice_for_booking(uuid),
  set_invoice_status(uuid,text,text), platform_data(text), ensure_social_rows(uuid),
  role_can(text,text)
  to service_role;

-- give the demo tenants an owner each
insert into staff (tenant_id, name, role, access_code)
select id, 'Owner', 'owner', upper(slug) || '-OWNER' from tenants
where slug in ('damai-clinic','sunrise-hair')
  and not exists (select 1 from staff s where s.tenant_id = tenants.id);

-- ============================================================================
-- CHECK
--   select platform_data('damai-clinic');
--   select add_staff('damai-clinic', '{"name":"Aina","role":"manager"}'::json);
--   select save_post('damai-clinic', '{"body":"Flu jabs now RM85",
--          "platforms":["instagram","facebook"],"scheduled_at":"2026-09-10T09:00"}'::json);
--   select invoice_for_booking((select id from bookings limit 1));
-- ============================================================================
