-- ============================================================================
-- 0034_booking_flow.sql — make a booking something the business can act on.
-- Run AFTER 0033. Safe to re-run.
--
-- ⚠ THE HOLE THIS CLOSES
-- create_booking took a name and nothing else. So a clinic got "Ahmad, Tuesday
-- 3pm" with no way to reach him — no confirmation, no reminder, and no call if
-- the doctor calls in sick. Most bookings were nearly useless to the business
-- and I should have caught it when I built the tag protocol.
--
-- Four changes:
--   1. contact details are captured and required
--   2. the agent reads the booking back before committing
--   3. a returning customer is recognised
--   4. an abandoned booking attempt is recorded, so it can be followed up
-- ============================================================================

alter table customers
  add column if not exists notes        text,
  add column if not exists visit_count  int not null default 0,
  add column if not exists last_booking_at timestamptz;

alter table bookings
  add column if not exists reason       text,
  add column if not exists contact_phone text,
  add column if not exists contact_email text,
  add column if not exists is_first_visit boolean;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1 · Recognise someone we've met
--
-- Matched on phone or email, not on name — two people called Ahmad is common,
-- two people sharing a mobile number is not.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function find_customer(
  p_tenant uuid, p_phone text, p_email text, p_session text
) returns json language plpgsql stable security definer set search_path = public as $$
declare v record; v_phone text; v_email text;
begin
  -- normalise before comparing: "+60 12-345 6789" and "0123456789" are the
  -- same person, and a clinic will have both spellings in its records
  v_phone := nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), '');
  v_email := nullif(lower(trim(coalesce(p_email, ''))), '');

  if v_phone is not null and length(v_phone) >= 7 then
    -- match on the last 8 digits, which survives country-code differences
    select c.id, c.name, c.visit_count, c.last_booking_at, c.notes into v
    from customers c
    where c.tenant_id = p_tenant
      and right(regexp_replace(coalesce(c.phone, ''), '[^0-9]', '', 'g'), 8)
        = right(v_phone, 8)
      and length(regexp_replace(coalesce(c.phone, ''), '[^0-9]', '', 'g')) >= 7
    order by c.last_seen_at desc limit 1;
    if found then
      return json_build_object('ok', true, 'found', true, 'id', v.id,
        'name', v.name, 'visits', v.visit_count,
        'last_booking', v.last_booking_at, 'notes', v.notes, 'matched_on', 'phone');
    end if;
  end if;

  if v_email is not null then
    select c.id, c.name, c.visit_count, c.last_booking_at, c.notes into v
    from customers c
    where c.tenant_id = p_tenant and lower(c.email) = v_email
    order by c.last_seen_at desc limit 1;
    if found then
      return json_build_object('ok', true, 'found', true, 'id', v.id,
        'name', v.name, 'visits', v.visit_count,
        'last_booking', v.last_booking_at, 'notes', v.notes, 'matched_on', 'email');
    end if;
  end if;

  return json_build_object('ok', true, 'found', false);
end; $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2 · create_booking, with contact details
--
-- Phone is required. A booking nobody can be reached about is worth less to a
-- business than no booking, because they hold the slot and lose it anyway.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function create_booking(
  p_tenant_slug text, p_conversation_id uuid, p_service_name text,
  p_scheduled_at text, p_customer_name text,
  p_phone text default null, p_email text default null, p_reason text default null
) returns json language plpgsql security definer set search_path = public as $$
declare
  v_tenant_id uuid; v_tz text; v_customer_id uuid; v_agent_id uuid;
  v_item items%rowtype; v_booking_id uuid; v_local timestamp; v_at timestamptz;
  v_dow int; v_hour numeric; v_hours jsonb; v_day jsonb;
  v_free json; v_resource uuid; v_resource_name text; v_has_resources boolean;
  v_phone text; v_email text; v_known json; v_first boolean := true;
begin
  select id, coalesce(timezone,'Asia/Kuala_Lumpur'), opening_hours
    into v_tenant_id, v_tz, v_hours
  from tenants where slug = p_tenant_slug;
  if v_tenant_id is null then return json_build_object('ok',false,'reason','unknown_tenant'); end if;

  v_phone := nullif(trim(coalesce(p_phone, '')), '');
  v_email := nullif(lower(trim(coalesce(p_email, ''))), '');

  -- a booking with no way to reach the customer is not a booking
  if v_phone is null and v_email is null then
    return json_build_object('ok', false, 'reason', 'no_contact',
      'hint', 'Ask for a phone number before confirming.');
  end if;

  if v_phone is not null
     and length(regexp_replace(v_phone, '[^0-9]', '', 'g')) < 7 then
    return json_build_object('ok', false, 'reason', 'bad_phone',
      'hint', 'That phone number looks too short — ask them to repeat it.');
  end if;

  begin v_local := p_scheduled_at::timestamp;
  exception when others then return json_build_object('ok',false,'reason','bad_datetime'); end;

  v_dow := extract(dow from v_local);
  v_hour := extract(hour from v_local) + extract(minute from v_local)/60.0;

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

  -- have we met them before? If so, merge onto that record rather than
  -- creating a second one for the same person.
  v_known := find_customer(v_tenant_id, v_phone, v_email, null);
  if (v_known->>'found')::boolean then
    v_first := false;
    -- keep the conversation pointing at the customer it already has, but carry
    -- the history across
    update customers set
      visit_count = coalesce((v_known->>'visits')::int, 0),
      notes = coalesce(notes, v_known->>'notes')
    where id = v_customer_id;
  end if;

  update customers set
    name  = coalesce(nullif(trim(p_customer_name), ''), name),
    phone = coalesce(v_phone, phone),
    email = coalesce(v_email, email),
    last_seen_at = now()
  where id = v_customer_id;

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
                          ai_employee_id, status, scheduled_at, duration_minutes, notes,
                          reason, contact_phone, contact_email, is_first_visit)
    values (v_tenant_id, v_customer_id, p_conversation_id, v_item.id, v_resource,
            v_agent_id, 'pending', v_at, v_item.duration_minutes,
            'Booked by AI receptionist',
            nullif(trim(coalesce(p_reason, '')), ''), v_phone, v_email, v_first)
    returning id into v_booking_id;
  exception when unique_violation then
    return json_build_object('ok', false, 'reason', 'slot_taken');
  end;

  update customers
     set visit_count = visit_count + 1, last_booking_at = v_at
   where id = v_customer_id;

  return json_build_object('ok', true, 'booking_id', v_booking_id,
    'service', v_item.name, 'price', v_item.price_local,
    'currency', v_item.currency_code, 'duration_minutes', v_item.duration_minutes,
    'scheduled_at', v_at, 'with', v_resource_name,
    'first_visit', v_first,
    'local_time', to_char(v_local, 'Dy DD Mon, HH24:MI'));
end; $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3 · Abandoned bookings
--
-- Someone asks about a time, gives a name, then stops replying. The business
-- never learns they nearly had a customer. This records the attempt.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists booking_attempts (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  conversation_id uuid references conversations(id) on delete cascade,
  service_name    text,
  wanted_at       text,
  customer_name   text,
  contact         text,
  missing         text[],
  resolved        boolean not null default false,
  created_at      timestamptz not null default now(),
  unique (conversation_id)
);

create index if not exists attempts_tenant_idx
  on booking_attempts(tenant_id, created_at desc) where not resolved;
alter table booking_attempts enable row level security;
alter table booking_attempts force row level security;
drop policy if exists tenant_isolation on booking_attempts;
create policy tenant_isolation on booking_attempts for all
  using (tenant_id = current_tenant()) with check (tenant_id = current_tenant());

create or replace function note_booking_attempt(
  p_tenant_slug text, p_conversation_id uuid, p_payload json
) returns json language plpgsql security definer set search_path = public as $$
declare v_tenant uuid; v_missing text[] := '{}';
begin
  select id into v_tenant from tenants where slug = p_tenant_slug;
  if v_tenant is null then return json_build_object('ok',false); end if;

  if nullif(trim(coalesce(p_payload->>'service','')),'') is null then
    v_missing := array_append(v_missing, 'service'); end if;
  if nullif(trim(coalesce(p_payload->>'when','')),'') is null then
    v_missing := array_append(v_missing, 'time'); end if;
  if nullif(trim(coalesce(p_payload->>'name','')),'') is null then
    v_missing := array_append(v_missing, 'name'); end if;
  if nullif(trim(coalesce(p_payload->>'contact','')),'') is null then
    v_missing := array_append(v_missing, 'contact'); end if;

  insert into booking_attempts (tenant_id, conversation_id, service_name,
                                wanted_at, customer_name, contact, missing)
  values (v_tenant, p_conversation_id,
          nullif(trim(coalesce(p_payload->>'service','')),''),
          nullif(trim(coalesce(p_payload->>'when','')),''),
          nullif(trim(coalesce(p_payload->>'name','')),''),
          nullif(trim(coalesce(p_payload->>'contact','')),''),
          v_missing)
  on conflict (conversation_id) do update set
    service_name = coalesce(excluded.service_name, booking_attempts.service_name),
    wanted_at = coalesce(excluded.wanted_at, booking_attempts.wanted_at),
    customer_name = coalesce(excluded.customer_name, booking_attempts.customer_name),
    contact = coalesce(excluded.contact, booking_attempts.contact),
    missing = excluded.missing;

  return json_build_object('ok', true, 'missing', v_missing);
end; $$;

-- mark it resolved once the booking lands
create or replace function on_booking_resolves_attempt()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update booking_attempts set resolved = true
   where conversation_id = new.conversation_id;
  return new;
exception when others then return new;
end; $$;

drop trigger if exists booking_resolves_attempt_trg on bookings;
create trigger booking_resolves_attempt_trg
  after insert on bookings
  for each row execute function on_booking_resolves_attempt();

-- what the dashboard shows: people who nearly booked
create or replace function near_misses(p_slug text)
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object(
      'id', a.id, 'service', a.service_name, 'wanted', a.wanted_at,
      'name', a.customer_name, 'contact', a.contact, 'missing', a.missing,
      'conversation_id', a.conversation_id, 'created_at', a.created_at)
      order by a.created_at desc), '[]'::json)
  from booking_attempts a join tenants t on t.id = a.tenant_id
  where t.slug = p_slug and not a.resolved
    and a.created_at > now() - interval '14 days';
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4 · Teach every agent the fuller booking flow
--
-- The old instructions said "confirm the details back" and then emitted the
-- tag in the same breath, so nothing was ever actually confirmed. This makes
-- the readback a separate turn, and adds contact and reason.
-- ─────────────────────────────────────────────────────────────────────────────
update ai_employees
   set prompt_template = replace(
     prompt_template,
     'SAVING A BOOKING',
     'TAKING A BOOKING

You need five things before you can book:
  1. which service
  2. which day
  3. roughly what time
  4. their name
  5. a phone number

Ask for what is missing ONE AT A TIME. Never ask for three things in one
message — people answer the last one and ignore the rest.

The phone number is not optional. Without it nobody can reach them if
something changes, and the appointment is worth little to us. If they resist,
say plainly: "I need a number in case anything changes on the day."

An email is useful too — it means they get a confirmation they can use to
change or cancel without calling. Ask for it, but do not insist.

If it suits the service, ask briefly what it is for. One short question, and
never press if they would rather not say.

READ IT BACK BEFORE YOU BOOK
When you have all five, repeat them in one sentence and wait for a yes:

  "So that is a general consultation, Tuesday at 3pm, for Ahmad on
   012-345 6789 — shall I confirm that?"

Do not write the booking tag in that message. Wait for them to agree. This is
the last moment a mistake is cheap.

SAVING A BOOKING'),
       config_version = config_version + 1
 where prompt_template like '%SAVING A BOOKING%'
   and prompt_template not like '%READ IT BACK BEFORE YOU BOOK%';

-- the tag itself carries the new fields
update ai_employees
   set prompt_template = replace(
     prompt_template,
     '[[BOOK service="exact service name" when="YYYY-MM-DDTHH:MM" name="their name"]]',
     '[[BOOK service="exact service name" when="YYYY-MM-DDTHH:MM" name="their name" phone="their number" email="their email or empty" reason="why, or empty"]]'),
       config_version = config_version + 1
 where prompt_template like '%[[BOOK service=%'
   and prompt_template not like '%phone="their number"%';

update ai_employees
   set prompt_template = replace(
     prompt_template,
     '- Write the tag ONLY when you have all four. Never guess a missing one.',
     '- Write the tag ONLY after they have agreed to the readback.
- Never guess a missing detail. Leave email and reason empty if not given,
  but never leave the phone empty — go back and ask.'),
       config_version = config_version + 1
 where prompt_template like '%Never guess a missing one.%';

update ai_employees
   set prompt_template = replace(
     prompt_template,
     '- To book you need: the service, the day, a rough time, and a name.',
     '- To book you need: the service, the day, a rough time, a name, and a phone number.'),
       config_version = config_version + 1
 where prompt_template like '%a rough time, and a name.%';

-- and the sector templates, so new businesses get it too
update sector_templates
   set prompt_template = replace(
     prompt_template,
     '[[BOOK service="exact service name" when="YYYY-MM-DDTHH:MM" name="their name"]]',
     '[[BOOK service="exact service name" when="YYYY-MM-DDTHH:MM" name="their name" phone="their number" email="their email or empty" reason="why, or empty"]]')
 where prompt_template like '%[[BOOK service=%'
   and prompt_template not like '%phone="their number"%';

update sector_templates
   set prompt_template = replace(prompt_template, 'SAVING A BOOKING',
'TAKING A BOOKING

You need five things before you can book: the service, the day, a rough time,
their name, and a phone number. Ask for what is missing ONE AT A TIME.

The phone number is not optional — without it nobody can reach them if
something changes. Ask for an email too, but do not insist.

READ IT BACK BEFORE YOU BOOK. Repeat all five in one sentence and wait for a
yes before you write the tag. This is the last moment a mistake is cheap.

SAVING A BOOKING')
 where prompt_template like '%SAVING A BOOKING%'
   and prompt_template not like '%READ IT BACK BEFORE YOU BOOK%';

-- render every prompt so the changes take effect
do $$ declare r record; begin
  for r in select slug from tenants loop
    perform rebuild_prompt(r.slug);
  end loop;
end $$;

revoke execute on function
  find_customer(uuid,text,text,text), note_booking_attempt(text,uuid,json), near_misses(text)
  from public, anon, authenticated;
grant execute on function
  find_customer(uuid,text,text,text), note_booking_attempt(text,uuid,json), near_misses(text)
  to service_role;

-- bookings now carry contact details the business can act on
create or replace function dashboard_data(p_slug text)
returns json language plpgsql security definer set search_path = public as $$
declare v_tenant_id uuid; v_result json;
begin
  select id into v_tenant_id from tenants where slug = p_slug;
  if v_tenant_id is null then return json_build_object('ok',false,'reason','unknown_tenant'); end if;

  select json_build_object(
    'ok', true,
    'business', (select json_build_object('name',name,'slug',slug,'timezone',timezone,
        'wallet',wallet_balance_usd,'color',brand_color,
        'agent',(select persona_name from ai_employees
                  where tenant_id = v_tenant_id and status='active'
                  order by is_primary desc limit 1))
      from tenants where id = v_tenant_id),
    'stats', (select json_build_object(
        'conversations',(select count(*) from conversations where tenant_id = v_tenant_id),
        'messages',(select count(*) from messages where tenant_id = v_tenant_id),
        'bookings',(select count(*) from bookings where tenant_id = v_tenant_id
                     and status in ('pending','confirmed')),
        'open_escalations',(select count(*) from escalations where tenant_id = v_tenant_id
                             and status='open'),
        'total_cost',(select coalesce(sum(actual_execution_cost),0)
                        from ai_decision_log where tenant_id = v_tenant_id))),
    'conversations', (select coalesce(json_agg(c order by c.last_at desc),'[]'::json) from (
        select conv.id, coalesce(cust.name,'Visitor') as customer, conv.status,
               conv.message_count, conv.ai_cost_usd as cost,
               greatest(conv.created_at, coalesce((select max(created_at) from messages m
                 where m.conversation_id = conv.id), conv.created_at)) as last_at,
               (select body from messages m where m.conversation_id = conv.id
                 order by created_at desc limit 1) as last_message
        from conversations conv
        left join customers cust on cust.id = conv.customer_id
        where conv.tenant_id = v_tenant_id
        order by last_at desc limit 25) c),
    'bookings', (select coalesce(json_agg(b order by b.scheduled_at),'[]'::json) from (
        select bk.id, bk.status, bk.scheduled_at,
               to_char(bk.scheduled_at at time zone
                 coalesce((select timezone from tenants where id = v_tenant_id),
                          'Asia/Kuala_Lumpur'), 'Dy DD Mon, HH24:MI') as local_time,
               it.name as service, it.price_local as price, it.currency_code as currency,
               coalesce(cu.name,'Visitor') as customer,
               coalesce(bk.contact_phone, cu.phone) as phone,
               bk.reason, bk.is_first_visit as first_visit
        from bookings bk
        left join items it on it.id = bk.item_id
        left join customers cu on cu.id = bk.customer_id
        where bk.tenant_id = v_tenant_id and bk.status in ('pending','confirmed')
        order by bk.scheduled_at limit 25) b),
    'escalations', (select coalesce(json_agg(e order by e.created_at desc),'[]'::json) from (
        select es.id, es.reason, es.trigger_source, es.status, es.created_at,
               coalesce(cu.name,'Visitor') as customer
        from escalations es
        left join conversations cv on cv.id = es.conversation_id
        left join customers cu on cu.id = cv.customer_id
        where es.tenant_id = v_tenant_id
        order by es.created_at desc limit 25) e),
    'items', (select coalesce(json_agg(i order by i.price nulls last),'[]'::json) from (
        select id, name, description, price_local as price, currency_code as currency,
               duration_minutes, is_bookable, is_active
        from items where tenant_id = v_tenant_id and is_active
        order by price_local nulls last) i)
  ) into v_result;

  return v_result;
end; $$;

grant execute on function dashboard_data(text) to service_role;

-- near misses ride along with the rest of the dashboard data
create or replace function platform_documents(p_slug text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'documents', (select coalesce(json_agg(json_build_object(
        'id',d.id,'filename',d.filename,'status',d.status,'pages',d.pages,
        'chunks',d.chunk_count,'words',d.word_count,'bytes',d.bytes,
        'error',d.error,'created_at',d.created_at) order by d.created_at desc), '[]'::json)
      from documents d join tenants t on t.id = d.tenant_id
      where t.slug = p_slug and d.status <> 'removed'),
    'budget', (select knowledge_budget(t.id) from tenants t where t.slug = p_slug),
    'near_misses', near_misses(p_slug)
  );
$$;

grant execute on function platform_documents(text) to service_role;

-- ============================================================================
-- CHECK
--   -- a booking with no phone must now be refused:
--   select create_booking('damai-clinic', (select id from conversations limit 1),
--     'General consultation', '2026-09-20T15:00', 'Test');
--   → ok:false, reason:no_contact
--
--   -- with one, it works and records the contact:
--   select create_booking('damai-clinic', (select id from conversations limit 1),
--     'General consultation', '2026-09-20T15:00', 'Test', '012-345 6789');
--
--   select name, phone, email, visit_count from customers order by last_seen_at desc limit 3;
--   select reason, contact_phone, is_first_visit from bookings order by created_at desc limit 3;
--   select near_misses('damai-clinic');
--
--   -- then in the chat, try to book without giving a number.
--   -- The agent should ask for one and read everything back before confirming.
-- ============================================================================
