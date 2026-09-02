-- ============================================================================
-- 0023_resources_notify_credentials.sql
-- Run AFTER 0022. Safe to re-run.
--
--   RESOURCES    the people (or rooms, or chairs) a booking is actually against
--   NOTIFY       the owner hears about a booking
--   CREDENTIALS  a business plugs in their own WhatsApp / Google / social keys
--
-- ⚠ THE BUG THIS FIXES
-- Until now the unique index was (tenant_id, scheduled_at), so a clinic with
-- three doctors could hold ONE appointment at 3pm. Bookings now belong to a
-- resource, and the constraint is per resource. Three doctors, three 3pm slots.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1 · RESOURCES
--
-- A resource is whatever a booking consumes: a doctor, a stylist, a treatment
-- room, a table. Same shape for all of them, so a clinic and a restaurant use
-- one mechanism.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists resources (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  staff_id    uuid references staff(id) on delete set null,
  name        text not null,
  title       text,                     -- "Family physician", "Senior stylist"
  bio         text,                     -- shown on the public page
  photo_url   text,
  kind        text not null default 'person',
  hours       jsonb,                    -- null = follows the business hours
  capacity    int not null default 1,   -- >1 for a room or a class
  is_active   boolean not null default true,
  sort        int not null default 0,
  created_at  timestamptz not null default now(),
  constraint resource_kind_chk check (kind in ('person','room','equipment','table'))
);

create index if not exists resources_tenant_idx on resources(tenant_id) where is_active;
alter table resources enable row level security;

-- which resources can do which services
create table if not exists resource_items (
  resource_id uuid not null references resources(id) on delete cascade,
  item_id     uuid not null references items(id) on delete cascade,
  primary key (resource_id, item_id)
);

alter table resource_items enable row level security;

-- time off: holidays, training, a half day
create table if not exists resource_blocks (
  id          uuid primary key default gen_random_uuid(),
  resource_id uuid not null references resources(id) on delete cascade,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  reason      text,
  created_at  timestamptz not null default now()
);

create index if not exists blocks_resource_idx on resource_blocks(resource_id, starts_at);
alter table resource_blocks enable row level security;

alter table bookings
  add column if not exists resource_id uuid references resources(id) on delete set null;

-- the old constraint held one booking per business per slot
drop index if exists bookings_slot_uniq;

-- one booking per resource per slot; unassigned bookings still can't collide
create unique index if not exists bookings_resource_slot_uniq
  on bookings(resource_id, scheduled_at)
  where status in ('pending','confirmed') and resource_id is not null;

create unique index if not exists bookings_unassigned_slot_uniq
  on bookings(tenant_id, scheduled_at)
  where status in ('pending','confirmed') and resource_id is null;

create or replace function save_resource(p_slug text, p_role text, p_payload json)
returns json language plpgsql security definer set search_path = public as $$
declare v_tenant uuid; v_id uuid := nullif(p_payload->>'id','')::uuid; v_name text;
begin
  if not guard(p_role, 'settings') then
    return json_build_object('ok', false, 'reason', 'not_allowed');
  end if;
  v_name := nullif(trim(p_payload->>'name'), '');
  if v_name is null then return json_build_object('ok',false,'reason','name_required'); end if;

  select id into v_tenant from tenants where slug = p_slug;
  if v_tenant is null then return json_build_object('ok',false,'reason','unknown_tenant'); end if;

  if v_id is null then
    insert into resources (tenant_id, name, title, bio, kind, hours, capacity)
    values (v_tenant, v_name,
            nullif(trim(coalesce(p_payload->>'title','')),''),
            nullif(trim(coalesce(p_payload->>'bio','')),''),
            coalesce(nullif(p_payload->>'kind',''), 'person'),
            nullif(p_payload->>'hours','')::jsonb,
            coalesce(nullif(p_payload->>'capacity','')::int, 1))
    returning id into v_id;
  else
    update resources set
      name = v_name,
      title = nullif(trim(coalesce(p_payload->>'title','')),''),
      bio = nullif(trim(coalesce(p_payload->>'bio','')),''),
      hours = coalesce(nullif(p_payload->>'hours','')::jsonb, hours),
      capacity = coalesce(nullif(p_payload->>'capacity','')::int, capacity),
      is_active = coalesce((p_payload->>'is_active')::boolean, is_active)
    where id = v_id and tenant_id = v_tenant;
    if not found then return json_build_object('ok',false,'reason','unknown_resource'); end if;
  end if;

  -- which services this person does; empty means all of them
  if p_payload ? 'items' then
    delete from resource_items where resource_id = v_id;
    insert into resource_items (resource_id, item_id)
    select v_id, (value::text)::uuid from json_array_elements_text(p_payload->'items')
    on conflict do nothing;
  end if;

  perform rebuild_prompt(p_slug);
  return json_build_object('ok', true, 'id', v_id);
end; $$;

create or replace function remove_resource(p_slug text, p_role text, p_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare v_tenant uuid;
begin
  if not guard(p_role, 'settings') then
    return json_build_object('ok', false, 'reason', 'not_allowed');
  end if;
  select id into v_tenant from tenants where slug = p_slug;
  update resources set is_active = false where id = p_id and tenant_id = v_tenant;
  if not found then return json_build_object('ok',false,'reason','unknown_resource'); end if;
  perform rebuild_prompt(p_slug);
  return json_build_object('ok', true);
end; $$;

-- Who is free at this time, for this service.
create or replace function free_resources(
  p_tenant uuid, p_at timestamptz, p_item uuid, p_minutes int default 30
) returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('id', r.id, 'name', r.name) order by r.sort, r.name),
                  '[]'::json)
  from resources r
  where r.tenant_id = p_tenant and r.is_active
    -- can do this service (no rows listed = does everything)
    and (not exists (select 1 from resource_items ri where ri.resource_id = r.id)
         or exists (select 1 from resource_items ri
                     where ri.resource_id = r.id and ri.item_id = p_item))
    -- not already booked then
    and not exists (select 1 from bookings b
                     where b.resource_id = r.id
                       and b.status in ('pending','confirmed')
                       and b.scheduled_at < p_at + make_interval(mins => p_minutes)
                       and p_at < b.scheduled_at + make_interval(mins => coalesce(b.duration_minutes,30)))
    -- not blocked out
    and not exists (select 1 from resource_blocks rb
                     where rb.resource_id = r.id
                       and rb.starts_at < p_at + make_interval(mins => p_minutes)
                       and p_at < rb.ends_at);
$$;

-- create_booking now assigns a resource
create or replace function create_booking(
  p_tenant_slug text, p_conversation_id uuid, p_service_name text,
  p_scheduled_at text, p_customer_name text
) returns json language plpgsql security definer set search_path = public as $$
declare
  v_tenant_id uuid; v_tz text; v_customer_id uuid; v_agent_id uuid;
  v_item items%rowtype; v_booking_id uuid; v_local timestamp; v_at timestamptz;
  v_dow int; v_hour numeric; v_hours jsonb; v_day jsonb;
  v_free json; v_resource uuid; v_resource_name text; v_has_resources boolean;
begin
  select id, coalesce(timezone,'Asia/Kuala_Lumpur'), opening_hours
    into v_tenant_id, v_tz, v_hours
  from tenants where slug = p_tenant_slug;
  if v_tenant_id is null then return json_build_object('ok',false,'reason','unknown_tenant'); end if;

  begin v_local := p_scheduled_at::timestamp;
  exception when others then return json_build_object('ok',false,'reason','bad_datetime'); end;

  v_dow := extract(dow from v_local);
  v_hour := extract(hour from v_local) + extract(minute from v_local)/60.0;

  -- opening hours from the tenant's own table, not baked into this function
  if v_hours is not null then
    v_day := v_hours -> (array['sun','mon','tue','wed','thu','fri','sat'])[v_dow + 1];
    if v_day is null or v_day = 'null'::jsonb then
      return json_build_object('ok',false,'reason','closed_that_day');
    end if;
    if v_hour < (split_part(v_day->>0,':',1)::numeric + split_part(v_day->>0,':',2)::numeric/60)
       or v_hour >= (split_part(v_day->>1,':',1)::numeric + split_part(v_day->>1,':',2)::numeric/60) then
      return json_build_object('ok',false,'reason','outside_hours');
    end if;
  end if;

  v_at := v_local at time zone v_tz;
  if v_at <= now() then return json_build_object('ok',false,'reason','in_the_past'); end if;

  select * into v_item from items
   where tenant_id = v_tenant_id and is_active and is_bookable
     and lower(name) = lower(trim(p_service_name)) limit 1;
  if v_item.id is null then
    select * into v_item from items
     where tenant_id = v_tenant_id and is_active and is_bookable
       and lower(name) like '%' || lower(trim(p_service_name)) || '%' limit 1;
  end if;
  if v_item.id is null then return json_build_object('ok',false,'reason','unknown_service'); end if;

  select customer_id, ai_employee_id into v_customer_id, v_agent_id
  from conversations where id = p_conversation_id;
  if v_customer_id is null then
    return json_build_object('ok',false,'reason','unknown_conversation');
  end if;

  if p_customer_name is not null and length(trim(p_customer_name)) > 0 then
    update customers set name = trim(p_customer_name)
     where id = v_customer_id and (name is null or name = '');
  end if;

  -- pick someone who's free. If the business hasn't set up resources at all,
  -- book without one and the old single-slot rule still applies.
  select exists (select 1 from resources where tenant_id = v_tenant_id and is_active)
    into v_has_resources;

  if v_has_resources then
    v_free := free_resources(v_tenant_id, v_at, v_item.id,
                             coalesce(v_item.duration_minutes, 30));
    if json_array_length(v_free) = 0 then
      return json_build_object('ok', false, 'reason', 'fully_booked');
    end if;
    v_resource := ((v_free->0)->>'id')::uuid;
    v_resource_name := (v_free->0)->>'name';
  end if;

  begin
    insert into bookings (tenant_id, customer_id, conversation_id, item_id, resource_id,
                          ai_employee_id, status, scheduled_at, duration_minutes, notes)
    values (v_tenant_id, v_customer_id, p_conversation_id, v_item.id, v_resource,
            v_agent_id, 'pending', v_at, v_item.duration_minutes,
            'Booked by AI receptionist')
    returning id into v_booking_id;
  exception when unique_violation then
    return json_build_object('ok', false, 'reason', 'slot_taken');
  end;

  return json_build_object('ok', true, 'booking_id', v_booking_id,
    'service', v_item.name, 'price', v_item.price_local,
    'currency', v_item.currency_code, 'duration_minutes', v_item.duration_minutes,
    'scheduled_at', v_at, 'with', v_resource_name,
    'local_time', to_char(v_local, 'Dy DD Mon, HH24:MI'));
end; $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2 · NOTIFY THE OWNER
-- A booking nobody is told about is a booking that gets missed.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function queue_booking_alert(p_booking_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare v_row record; v_to text; v_n int := 0;
begin
  select b.id, b.tenant_id, b.scheduled_at, b.duration_minutes,
         t.name as business, t.slug, coalesce(t.timezone,'Asia/Kuala_Lumpur') as tz,
         i.name as service, i.price_local as price, i.currency_code as cur,
         coalesce(c.name,'A customer') as customer, c.phone as customer_phone,
         r.name as resource
    into v_row
  from bookings b
  join tenants t on t.id = b.tenant_id
  left join items i on i.id = b.item_id
  left join customers c on c.id = b.customer_id
  left join resources r on r.id = b.resource_id
  where b.id = p_booking_id;

  if not found then return json_build_object('ok',false,'reason','unknown_booking'); end if;

  for v_to in
    select distinct e from (
      select s.email as e from staff s
       where s.tenant_id = v_row.tenant_id and s.role in ('owner','manager')
         and s.status = 'active' and s.email is not null
      union
      select t.email from tenants t
       where t.id = v_row.tenant_id and t.email is not null and t.email not like '%.local'
    ) x where e is not null
  loop
    insert into outbox (tenant_id, booking_id, source, to_address, subject, body, send_after)
    values (v_row.tenant_id, p_booking_id, 'booking_alert', v_to,
      'New booking: ' || v_row.service || ' — ' ||
        to_char(v_row.scheduled_at at time zone v_row.tz, 'Dy DD Mon HH24:MI'),
      v_row.customer || ' booked ' || v_row.service || E'\n' ||
      'When: ' || to_char(v_row.scheduled_at at time zone v_row.tz, 'Day DD Mon, HH24:MI') || E'\n' ||
      case when v_row.resource is not null then 'With: ' || v_row.resource || E'\n' else '' end ||
      case when v_row.price is not null
           then 'Value: ' || v_row.cur || ' ' || v_row.price || E'\n' else '' end ||
      case when v_row.customer_phone is not null
           then 'Phone: ' || v_row.customer_phone || E'\n' else '' end,
      now())
    on conflict do nothing;
    v_n := v_n + 1;
  end loop;

  return json_build_object('ok', true, 'queued', v_n);
end; $$;

-- fire it automatically whenever a booking is written
create or replace function on_booking_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform queue_booking_alert(new.id);
  return new;
exception when others then
  return new;   -- never let alerting break a booking
end; $$;

drop trigger if exists booking_alert_trg on bookings;
create trigger booking_alert_trg
  after insert on bookings
  for each row execute function on_booking_created();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3 · BRING YOUR OWN KEYS
--
-- A business plugs in their own WhatsApp number, Google account or social
-- tokens. Stored per tenant so nothing is shared, and never returned to the
-- browser — the UI only ever sees whether a key is present and its last four.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists tenant_credentials (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  provider    text not null,
  label       text,
  secret      text not null,
  meta        jsonb,
  status      text not null default 'active',
  last_used_at timestamptz,
  created_at  timestamptz not null default now(),
  constraint cred_provider_chk check (provider in
    ('whatsapp','google_calendar','instagram','facebook','tiktok',
     'google_business','stripe','smtp','openai','anthropic','gemini')),
  constraint cred_status_chk check (status in ('active','invalid','revoked')),
  unique (tenant_id, provider)
);

alter table tenant_credentials enable row level security;

create or replace function save_credential(p_slug text, p_role text, p_payload json)
returns json language plpgsql security definer set search_path = public as $$
declare v_tenant uuid; v_secret text := nullif(trim(p_payload->>'secret'), '');
begin
  if not guard(p_role, 'settings') then
    return json_build_object('ok', false, 'reason', 'not_allowed');
  end if;
  if v_secret is null then return json_build_object('ok',false,'reason','secret_required'); end if;

  select id into v_tenant from tenants where slug = p_slug;
  if v_tenant is null then return json_build_object('ok',false,'reason','unknown_tenant'); end if;

  insert into tenant_credentials (tenant_id, provider, label, secret, meta)
  values (v_tenant, p_payload->>'provider',
          nullif(trim(coalesce(p_payload->>'label','')),''), v_secret,
          nullif(p_payload->>'meta','')::jsonb)
  on conflict (tenant_id, provider) do update
    set secret = excluded.secret, label = excluded.label,
        meta = coalesce(excluded.meta, tenant_credentials.meta),
        status = 'active';

  -- never echo the secret back
  return json_build_object('ok', true, 'provider', p_payload->>'provider',
                           'hint', right(v_secret, 4));
end; $$;

create or replace function remove_credential(p_slug text, p_role text, p_provider text)
returns json language plpgsql security definer set search_path = public as $$
declare v_tenant uuid;
begin
  if not guard(p_role, 'settings') then
    return json_build_object('ok', false, 'reason', 'not_allowed');
  end if;
  select id into v_tenant from tenants where slug = p_slug;
  delete from tenant_credentials where tenant_id = v_tenant and provider = p_provider;
  return json_build_object('ok', true);
end; $$;

-- what the dashboard is allowed to see: presence, not the value
create or replace function list_credentials(p_slug text)
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object(
      'provider', c.provider, 'label', c.label, 'status', c.status,
      'hint', right(c.secret, 4), 'last_used_at', c.last_used_at) order by c.provider),
    '[]'::json)
  from tenant_credentials c join tenants t on t.id = c.tenant_id
  where t.slug = p_slug;
$$;

-- the server side reads the real value
create or replace function get_credential(p_tenant uuid, p_provider text)
returns text language sql stable security definer set search_path = public as $$
  select secret from tenant_credentials
  where tenant_id = p_tenant and provider = p_provider and status = 'active';
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4 · Guard + data
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function guarded_action(
  p_slug text, p_role text, p_action text, p_payload json
) returns json language plpgsql security definer set search_path = public as $$
declare v_need text; v_result json;
begin
  v_need := case p_action
    when 'price' then 'edit_prices' when 'save_item' then 'edit_prices'
    when 'remove_item' then 'edit_prices'
    when 'resolve_escalation' then 'handle_chats'
    when 'booking_status' then 'manage_bookings'
    when 'save_post' then 'marketing' when 'set_post_status' then 'marketing'
    when 'set_automation' then 'marketing' when 'save_broadcast' then 'marketing'
    when 'invoice' then 'finance' when 'invoice_status' then 'finance'
    when 'add_staff' then 'manage_team' when 'set_staff' then 'manage_team'
    else 'settings' end;

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
    when 'claim_domain' then claim_domain(p_slug, p_role, p_payload->>'hostname')
    when 'remove_domain' then remove_domain(p_slug, p_role, (p_payload->>'id')::uuid)
    when 'save_resource' then save_resource(p_slug, p_role, p_payload)
    when 'remove_resource' then remove_resource(p_slug, p_role, (p_payload->>'id')::uuid)
    when 'save_credential' then save_credential(p_slug, p_role, p_payload)
    when 'remove_credential' then remove_credential(p_slug, p_role, p_payload->>'provider')
    else json_build_object('ok',false,'reason','unknown_action')
  end;

  perform audit(p_slug, coalesce(p_payload->>'actor', p_role), p_role, p_action,
                nullif(p_payload->>'id',''), p_payload - 'secret');

  return v_result;
end; $$;

create or replace function platform_extras(p_slug text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'domains', (select coalesce(json_agg(json_build_object(
        'id',d.id,'hostname',d.hostname,'status',d.status,'token',d.verify_token)),'[]'::json)
      from domains d join tenants t on t.id = d.tenant_id
      where t.slug = p_slug and d.status <> 'removed'),
    'outbox', (select json_build_object(
        'pending', count(*) filter (where o.status in ('pending','claimed')),
        'sent', count(*) filter (where o.status = 'sent'),
        'failed', count(*) filter (where o.status = 'failed'))
      from outbox o join tenants t on t.id = o.tenant_id where t.slug = p_slug),
    'credentials', list_credentials(p_slug),
    'resources', (select coalesce(json_agg(json_build_object(
        'id',r.id,'name',r.name,'title',r.title,'bio',r.bio,'kind',r.kind,
        'capacity',r.capacity,'hours',r.hours,
        'items',(select coalesce(json_agg(ri.item_id),'[]'::json)
                   from resource_items ri where ri.resource_id = r.id),
        'upcoming',(select count(*) from bookings b where b.resource_id = r.id
                      and b.status in ('pending','confirmed') and b.scheduled_at > now()))
        order by r.sort, r.name), '[]'::json)
      from resources r join tenants t on t.id = r.tenant_id
      where t.slug = p_slug and r.is_active)
  );
$$;

-- the agent should know who works there
create or replace function team_block(p_tenant uuid)
returns text language sql stable security definer set search_path = public as $$
  select string_agg('- ' || name
           || case when title is null then '' else ', ' || title end
           || case when bio is null then '' else '. ' || bio end,
         E'\n' order by sort, name)
  from resources where tenant_id = p_tenant and is_active and kind = 'person';
$$;

revoke execute on function
  save_resource(text,text,json), remove_resource(text,text,uuid),
  free_resources(uuid,timestamptz,uuid,int), queue_booking_alert(uuid),
  save_credential(text,text,json), remove_credential(text,text,text),
  list_credentials(text), get_credential(uuid,text), team_block(uuid)
  from public, anon, authenticated;

grant execute on function
  save_resource(text,text,json), remove_resource(text,text,uuid),
  free_resources(uuid,timestamptz,uuid,int), queue_booking_alert(uuid),
  save_credential(text,text,json), remove_credential(text,text,text),
  list_credentials(text), get_credential(uuid,text), team_block(uuid)
  to service_role;

-- ============================================================================
-- CHECK
--   select save_resource('damai-clinic','owner',
--     '{"name":"Dr Lim","title":"Family physician","bio":"Sees adults and children."}'::json);
--   select save_resource('damai-clinic','owner',
--     '{"name":"Dr Chen","title":"Family physician"}'::json);
--   → now book the SAME 3pm slot twice through the chat. Both should succeed,
--     assigned to different doctors. A third attempt returns fully_booked.
--
--   select free_resources((select id from tenants where slug='damai-clinic'),
--                         now() + interval '2 days',
--                         (select id from items where tenant_id=
--                            (select id from tenants where slug='damai-clinic') limit 1));
--   select list_credentials('damai-clinic');
-- ============================================================================
