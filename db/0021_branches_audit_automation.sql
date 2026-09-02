-- ============================================================================
-- 0021_branches_audit_automation.sql
-- Run AFTER 0020. Safe to re-run.
--
--   BRANCHES    one business, several locations, one owner across them
--   AUDIT       every action recorded — including yours
--   AUTOMATION  reminders, win-backs, broadcasts
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1 · ORGANISATIONS
--
-- A branch is a tenant. That is deliberate: each location has its own hours,
-- address, phone, diary and staff, and its own page. What they share is an
-- organisation — one owner, one bill, one place to look at all of them.
--
-- Services, knowledge and branding can be inherited from the parent so a chain
-- doesn't retype everything per branch.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists organisations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  owner_email text,
  access_code text unique,
  plan        text not null default 'trial',
  created_at  timestamptz not null default now()
);

alter table tenants
  add column if not exists organisation_id uuid references organisations(id) on delete set null,
  add column if not exists branch_label    text,
  add column if not exists inherits_menu   boolean not null default false;

create index if not exists tenants_org_idx on tenants(organisation_id);

-- staff can be scoped to one branch (tenant_id) or the whole group (organisation_id)
alter table staff
  add column if not exists organisation_id uuid references organisations(id) on delete cascade;

alter table staff alter column tenant_id drop not null;

create or replace function create_organisation(p_payload json)
returns json language plpgsql security definer set search_path = public as $$
declare v_name text := trim(p_payload->>'name'); v_slug text; v_base text;
        v_n int := 1; v_id uuid; v_code text;
begin
  if v_name is null or length(v_name) < 2 then
    return json_build_object('ok', false, 'reason', 'name_required');
  end if;

  v_base := slugify(v_name); if v_base = '' then v_base := 'group'; end if;
  v_slug := v_base;
  while exists (select 1 from organisations where slug = v_slug) loop
    v_n := v_n + 1; v_slug := v_base || '-' || v_n;
  end loop;

  v_code := upper(v_base || '-GRP-' ||
    substr(translate(encode(gen_random_bytes(6),'base64'),'+/=OI01l','XYZWABCD'),1,5));

  insert into organisations (name, slug, owner_email, access_code)
  values (v_name, v_slug, nullif(trim(p_payload->>'email'),''), v_code)
  returning id into v_id;

  insert into staff (organisation_id, name, role, access_code)
  values (v_id, 'Group owner', 'owner', v_code || '-O');

  return json_build_object('ok', true, 'id', v_id, 'slug', v_slug, 'access_code', v_code);
end; $$;

-- attach an existing business to a group, or create a new branch
create or replace function add_branch(p_org_slug text, p_role text, p_payload json)
returns json language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_parent uuid; v_res json; v_slug text; v_new uuid;
begin
  if not guard(p_role, 'settings') then
    return json_build_object('ok', false, 'reason', 'not_allowed');
  end if;

  select id into v_org from organisations where slug = p_org_slug;
  if v_org is null then return json_build_object('ok',false,'reason','unknown_org'); end if;

  -- copy the parent branch's setup unless told otherwise
  select id into v_parent from tenants
   where organisation_id = v_org order by created_at limit 1;

  v_res := create_tenant(p_payload);
  if not (v_res->>'ok')::boolean then return v_res; end if;
  v_slug := v_res->>'slug';

  update tenants set
    organisation_id = v_org,
    branch_label = coalesce(nullif(trim(p_payload->>'branch_label'),''), name),
    inherits_menu = coalesce((p_payload->>'inherit')::boolean, true)
  where slug = v_slug
  returning id into v_new;

  -- inherit services and knowledge from the first branch
  if v_parent is not null and coalesce((p_payload->>'inherit')::boolean, true) then
    insert into items (tenant_id, name, description, price_local, currency_code,
                       duration_minutes, is_bookable)
    select v_new, name, description, price_local, currency_code, duration_minutes, is_bookable
    from items where tenant_id = v_parent and is_active
      and not exists (select 1 from items x where x.tenant_id = v_new and x.name = items.name);

    insert into knowledge (tenant_id, title, body)
    select v_new, title, body from knowledge where tenant_id = v_parent and is_active;

    update tenants t set
      brand_color = p.brand_color, brand_greeting = p.brand_greeting,
      brand_suggestions = p.brand_suggestions, logo_url = p.logo_url, tagline = p.tagline
    from tenants p where p.id = v_parent and t.id = v_new;

    perform rebuild_prompt(v_slug);
  end if;

  return json_build_object('ok', true, 'slug', v_slug,
                           'access_code', v_res->>'access_code');
end; $$;

create or replace function organisation_data(p_org_slug text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'ok', true,
    'organisation', (select json_build_object('name',o.name,'slug',o.slug,'plan',o.plan)
                       from organisations o where o.slug = p_org_slug),
    'branches', (select coalesce(json_agg(b order by b.name),'[]'::json) from (
        select t.name, t.slug, coalesce(t.branch_label, t.name) as label,
               coalesce(t.brand_color,'#1D6A8C') as color, t.address, t.phone,
               (select persona_name from ai_employees e
                 where e.tenant_id = t.id and e.status='active'
                 order by is_primary desc limit 1) as agent,
               (select count(*) from conversations c where c.tenant_id = t.id) as conversations,
               (select count(*) from bookings bk where bk.tenant_id = t.id
                  and bk.status in ('pending','confirmed')) as bookings,
               (select count(*) from escalations es where es.tenant_id = t.id
                  and es.status='open') as needs_you,
               (select coalesce(sum(amount) filter (where status='paid'),0)
                  from invoices i where i.tenant_id = t.id) as revenue
        from tenants t
        join organisations o on o.id = t.organisation_id
        where o.slug = p_org_slug) b),
    'totals', (select json_build_object(
        'branches', count(*),
        'conversations', coalesce(sum((select count(*) from conversations c where c.tenant_id = t.id)),0),
        'bookings', coalesce(sum((select count(*) from bookings bk where bk.tenant_id = t.id
                                   and bk.status in ('pending','confirmed'))),0),
        'needs_you', coalesce(sum((select count(*) from escalations es where es.tenant_id = t.id
                                    and es.status='open')),0))
      from tenants t join organisations o on o.id = t.organisation_id
      where o.slug = p_org_slug)
  );
$$;

-- a group key resolves to the group, a branch key to that branch
create or replace function resolve_key(p_code text)
returns json language plpgsql stable security definer set search_path = public as $$
declare v_code text := upper(trim(coalesce(p_code,''))); v_row record;
begin
  if v_code = '' then return json_build_object('ok', false); end if;

  -- group-level staff
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

  -- branch staff
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
  select t.slug, t.name into v_row from tenants t where upper(t.access_code) = v_code limit 1;
  if found then
    return json_build_object('ok', true, 'scope', 'tenant', 'slug', v_row.slug,
      'role', 'owner', 'name', 'Owner', 'business', v_row.business);
  end if;

  return json_build_object('ok', false);
end; $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2 · AUDIT
--
-- Every action, with who did it. This is what makes "can Automology read my
-- customers' messages?" answerable with something other than "trust us".
-- Platform access is recorded the same as anyone else's.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists audit_log (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid references tenants(id) on delete cascade,
  actor      text not null,           -- 'owner', 'staff:Aina', 'platform'
  actor_role text,
  action     text not null,
  target     text,
  detail     jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_tenant_idx on audit_log(tenant_id, created_at desc);
alter table audit_log enable row level security;

create or replace function audit(
  p_slug text, p_actor text, p_role text, p_action text,
  p_target text default null, p_detail jsonb default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_tenant uuid;
begin
  select id into v_tenant from tenants where slug = p_slug;
  insert into audit_log (tenant_id, actor, actor_role, action, target, detail)
  values (v_tenant, p_actor, p_role, p_action, p_target, p_detail);
exception when others then null;   -- auditing must never block the action
end; $$;

create or replace function audit_trail(p_slug text, p_limit int default 60)
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(a order by a.created_at desc),'[]'::json) from (
    select actor, actor_role, action, target, created_at
    from audit_log al join tenants t on t.id = al.tenant_id
    where t.slug = p_slug order by al.created_at desc limit p_limit) a;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3 · AUTOMATIONS
--
-- Rules that fire without anyone pressing anything. A separate worker sends
-- these on a schedule — this is the model and the queue.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists automations (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  kind        text not null,
  is_on       boolean not null default false,
  offset_hours int,
  body        text,
  channel     text not null default 'email',
  last_run_at timestamptz,
  sent_count  int not null default 0,
  created_at  timestamptz not null default now(),
  constraint automation_kind_chk check (kind in
    ('booking_reminder','no_show_followup','win_back','review_request','birthday','broadcast')),
  constraint automation_channel_chk check (channel in ('email','whatsapp','sms')),
  unique (tenant_id, kind)
);

alter table automations enable row level security;

create table if not exists broadcasts (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  body         text not null,
  audience     text not null default 'all',
  channel      text not null default 'email',
  scheduled_at timestamptz,
  status       text not null default 'draft',
  recipients   int,
  sent_count   int not null default 0,
  created_at   timestamptz not null default now(),
  constraint broadcast_status_chk check (status in ('draft','queued','sending','sent','cancelled')),
  constraint broadcast_audience_chk check (audience in
    ('all','recent','lapsed','booked_service','no_show'))
);

alter table broadcasts enable row level security;

-- the defaults every business gets, off until they switch them on
create or replace function ensure_automations(p_tenant uuid)
returns void language sql security definer set search_path = public as $$
  insert into automations (tenant_id, kind, offset_hours, body) values
    (p_tenant, 'booking_reminder', -24,
     'Reminder: your appointment is tomorrow. Reply here if you need to change it.'),
    (p_tenant, 'no_show_followup', 2,
     'We missed you today. Would you like to rebook?'),
    (p_tenant, 'win_back', 1440,
     'It has been a while — we would love to see you again.'),
    (p_tenant, 'review_request', 24,
     'Thanks for coming in. If you have a moment, a short review helps us a lot.')
  on conflict (tenant_id, kind) do nothing;
$$;

create or replace function set_automation(p_slug text, p_role text, p_payload json)
returns json language plpgsql security definer set search_path = public as $$
declare v_tenant uuid;
begin
  if not guard(p_role, 'marketing') then
    return json_build_object('ok', false, 'reason', 'not_allowed');
  end if;
  select id into v_tenant from tenants where slug = p_slug;
  if v_tenant is null then return json_build_object('ok',false,'reason','unknown_tenant'); end if;

  perform ensure_automations(v_tenant);

  update automations set
    is_on        = coalesce((p_payload->>'is_on')::boolean, is_on),
    offset_hours = coalesce(nullif(p_payload->>'offset_hours','')::int, offset_hours),
    body         = coalesce(nullif(trim(p_payload->>'body'),''), body),
    channel      = coalesce(nullif(p_payload->>'channel',''), channel)
  where tenant_id = v_tenant and kind = p_payload->>'kind';

  if not found then return json_build_object('ok',false,'reason','unknown_automation'); end if;
  return json_build_object('ok', true);
end; $$;

-- who a broadcast would reach, counted before it is sent
create or replace function broadcast_audience(p_slug text, p_audience text)
returns json language plpgsql stable security definer set search_path = public as $$
declare v_tenant uuid; v_count int;
begin
  select id into v_tenant from tenants where slug = p_slug;
  if v_tenant is null then return json_build_object('ok',false,'reason','unknown_tenant'); end if;

  select count(distinct c.id) into v_count
  from customers c
  where c.tenant_id = v_tenant
    and coalesce(c.opted_out, false) = false
    and case p_audience
      when 'all'    then true
      when 'recent' then exists (select 1 from bookings b where b.customer_id = c.id
                                   and b.scheduled_at > now() - interval '90 days')
      when 'lapsed' then not exists (select 1 from bookings b where b.customer_id = c.id
                                       and b.scheduled_at > now() - interval '180 days')
      when 'no_show' then exists (select 1 from bookings b where b.customer_id = c.id
                                    and b.status = 'no_show')
      else true end;

  return json_build_object('ok', true, 'count', coalesce(v_count, 0));
end; $$;

create or replace function save_broadcast(p_slug text, p_role text, p_payload json)
returns json language plpgsql security definer set search_path = public as $$
declare v_tenant uuid; v_id uuid; v_when timestamptz; v_count int;
begin
  if not guard(p_role, 'marketing') then
    return json_build_object('ok', false, 'reason', 'not_allowed');
  end if;
  if nullif(trim(p_payload->>'body'),'') is null then
    return json_build_object('ok', false, 'reason', 'body_required');
  end if;

  select id into v_tenant from tenants where slug = p_slug;
  if v_tenant is null then return json_build_object('ok',false,'reason','unknown_tenant'); end if;

  v_when := nullif(p_payload->>'scheduled_at','')::timestamptz;
  select (broadcast_audience(p_slug, coalesce(p_payload->>'audience','all'))->>'count')::int
    into v_count;

  insert into broadcasts (tenant_id, body, audience, channel, scheduled_at, status, recipients)
  values (v_tenant, trim(p_payload->>'body'),
          coalesce(p_payload->>'audience','all'),
          coalesce(p_payload->>'channel','email'),
          v_when,
          case when v_when is null then 'draft' else 'queued' end,
          v_count)
  returning id into v_id;

  return json_build_object('ok', true, 'id', v_id, 'recipients', v_count);
end; $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4 · Wire the new actions into the guard, and carry the new data
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function guarded_action(
  p_slug text, p_role text, p_action text, p_payload json
) returns json language plpgsql security definer set search_path = public as $$
declare v_need text; v_result json;
begin
  v_need := case p_action
    when 'price' then 'edit_prices'  when 'save_item' then 'edit_prices'
    when 'remove_item' then 'edit_prices'
    when 'resolve_escalation' then 'handle_chats'
    when 'booking_status' then 'manage_bookings'
    when 'save_post' then 'marketing' when 'set_post_status' then 'marketing'
    when 'set_automation' then 'marketing' when 'save_broadcast' then 'marketing'
    when 'invoice' then 'finance' when 'invoice_status' then 'finance'
    when 'add_staff' then 'manage_team' when 'set_staff' then 'manage_team'
    when 'add_agent' then 'settings' when 'branding' then 'settings'
    when 'hours' then 'settings' when 'save_knowledge' then 'settings'
    when 'remove_knowledge' then 'settings' when 'add_branch' then 'settings'
    else 'view' end;

  if not guard(p_role, v_need) then
    return json_build_object('ok',false,'reason','not_allowed',
                             'needs',v_need,'your_role',p_role);
  end if;

  v_result := case p_action
    when 'price' then update_item_price((p_payload->>'id')::uuid,(p_payload->>'price')::numeric)
    when 'save_item' then save_item(p_slug, p_role, p_payload)
    when 'remove_item' then remove_item(p_slug, p_role, (p_payload->>'id')::uuid)
    when 'resolve_escalation' then resolve_escalation((p_payload->>'id')::uuid)
    when 'booking_status' then set_booking_status((p_payload->>'id')::uuid, p_payload->>'status')
    when 'save_post' then save_post(p_slug, p_payload)
    when 'set_post_status' then set_post_status((p_payload->>'id')::uuid, p_payload->>'status')
    when 'set_automation' then set_automation(p_slug, p_role, p_payload)
    when 'save_broadcast' then save_broadcast(p_slug, p_role, p_payload)
    when 'invoice' then invoice_for_booking((p_payload->>'id')::uuid)
    when 'invoice_status' then set_invoice_status((p_payload->>'id')::uuid, p_payload->>'status', null)
    when 'add_staff' then add_staff(p_slug, p_payload)
    when 'set_staff' then set_staff((p_payload->>'id')::uuid,
                                    coalesce(p_payload->>'role',''), coalesce(p_payload->>'status',''))
    when 'add_agent' then add_agent(p_slug, p_payload)
    when 'branding' then update_branding(p_slug, p_role, p_payload)
    when 'hours' then update_hours(p_slug, p_role, (p_payload->>'hours')::jsonb)
    when 'save_knowledge' then save_knowledge(p_slug, p_role, p_payload)
    when 'remove_knowledge' then remove_knowledge(p_slug, p_role, (p_payload->>'id')::uuid)
    else json_build_object('ok',false,'reason','unknown_action')
  end;

  -- record it, whoever did it
  perform audit(p_slug, coalesce(p_payload->>'actor', p_role), p_role, p_action,
                nullif(p_payload->>'id',''), p_payload);

  return v_result;
end; $$;

revoke execute on function
  create_organisation(json), add_branch(text,text,json), organisation_data(text),
  audit(text,text,text,text,text,jsonb), audit_trail(text,int),
  set_automation(text,text,json), save_broadcast(text,text,json),
  broadcast_audience(text,text), ensure_automations(uuid)
  from public, anon, authenticated;

grant execute on function
  create_organisation(json), add_branch(text,text,json), organisation_data(text),
  audit(text,text,text,text,text,jsonb), audit_trail(text,int),
  set_automation(text,text,json), save_broadcast(text,text,json),
  broadcast_audience(text,text), ensure_automations(uuid)
  to service_role;

-- platform_data gains the new modules
create or replace function platform_data(p_slug text)
returns json language plpgsql security definer set search_path = public as $$
declare v_tenant uuid; v_result json;
begin
  select id into v_tenant from tenants where slug = p_slug;
  if v_tenant is null then return json_build_object('ok',false,'reason','unknown_tenant'); end if;

  perform ensure_social_rows(v_tenant);
  perform ensure_subscription(v_tenant);
  perform ensure_automations(v_tenant);

  select json_build_object(
    'ok', true,
    'business', (select json_build_object(
        'name',t.name,'slug',t.slug,'color',coalesce(t.brand_color,'#1D6A8C'),
        'plan',t.plan,'wallet',t.wallet_balance_usd,'domain',t.custom_domain,
        'tagline',t.tagline,'address',t.address,'phone',t.phone,'map_url',t.map_url,
        'greeting',t.brand_greeting,'suggestions',t.brand_suggestions,
        'hours',t.opening_hours,'logo_url',t.logo_url,'access_code',t.access_code,
        'email',t.email,'branch_label',t.branch_label,
        'organisation',(select o.slug from organisations o where o.id = t.organisation_id))
      from tenants t where t.id = v_tenant),
    'items', (select coalesce(json_agg(i order by i.price nulls last),'[]'::json) from (
        select id, name, description, price_local as price, currency_code as currency,
               duration_minutes as minutes
        from items where tenant_id = v_tenant and is_active order by price_local nulls last) i),
    'knowledge', (select coalesce(json_agg(k order by k.created_at),'[]'::json) from (
        select id, title, body, agent_slug, created_at from knowledge
        where tenant_id = v_tenant and is_active order by created_at) k),
    'knowledge_size', knowledge_size(v_tenant),
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
    'automations', (select coalesce(json_agg(a order by a.kind),'[]'::json) from (
        select id, kind, is_on, offset_hours, body, channel, sent_count
        from automations where tenant_id = v_tenant) a),
    'broadcasts', (select coalesce(json_agg(b order by b.created_at desc),'[]'::json) from (
        select id, body, audience, channel, status, scheduled_at, recipients, sent_count
        from broadcasts where tenant_id = v_tenant order by created_at desc limit 20) b),
    'audit', audit_trail(p_slug, 40),
    'invoices', (select coalesce(json_agg(i order by i.issued_on desc),'[]'::json) from (
        select inv.id, inv.number, inv.amount, inv.currency, inv.status, inv.issued_on,
               coalesce(c.name,'Walk-in') as customer
        from invoices inv left join customers c on c.id = inv.customer_id
        where inv.tenant_id = v_tenant order by inv.issued_on desc limit 30) i),
    'finance', (select json_build_object(
        'paid',coalesce(sum(amount) filter (where status='paid'),0),
        'unpaid',coalesce(sum(amount) filter (where status='unpaid'),0),
        'count',count(*)) from invoices where tenant_id = v_tenant),
    'billing', billing_state(p_slug),
    'stats', (select json_build_object(
        'conversations',(select count(*) from conversations where tenant_id = v_tenant),
        'bookings',(select count(*) from bookings where tenant_id = v_tenant
                     and status in ('pending','confirmed')),
        'needs_you',(select count(*) from escalations where tenant_id = v_tenant
                      and status='open'),
        'customers',(select count(*) from customers where tenant_id = v_tenant)))
  ) into v_result;

  return v_result;
end; $$;

-- ============================================================================
-- CHECK
--   select create_organisation('{"name":"Damai Group"}'::json);
--   update tenants set organisation_id =
--     (select id from organisations where slug='damai-group') where slug='damai-clinic';
--   select add_branch('damai-group','owner',
--     '{"name":"Damai Puchong","sector":"clinic","branch_label":"Puchong","inherit":true}'::json);
--   select organisation_data('damai-group');   → two branches, shared services
--   select audit_trail('damai-clinic');
--   select broadcast_audience('damai-clinic','lapsed');
-- ============================================================================
