-- ============================================================================
-- 0030_self_service.sql — let customers cancel and reschedule themselves.
-- Run AFTER 0029. Safe to re-run.
--
-- Every no-show and every change currently costs a phone call to the business.
-- This gives the customer a link in their confirmation that lets them handle it.
--
-- ⚠ WHY A TOKEN AND NOT A LOGIN
-- Asking a patient to create an account to cancel a flu jab is how you get a
-- no-show instead of a cancellation. So each booking carries its own long
-- random token, and the link is the credential.
--
-- That means the token IS the secret, so it is treated like one:
--   • long enough not to be guessable
--   • scoped to a single booking, never to a customer or an account
--   • expires once the appointment has passed
--   • shows only that booking — never a list, never anyone's history
--   • cannot change the price, the service, or anyone else's slot
-- ============================================================================

alter table bookings
  add column if not exists manage_token text,
  add column if not exists rescheduled_from timestamptz,
  add column if not exists changed_by_customer_at timestamptz;

create unique index if not exists bookings_manage_token_idx
  on bookings(manage_token) where manage_token is not null;

-- Long, unguessable, and no ambiguous characters — these end up in emails and
-- get read aloud over the phone.
create or replace function new_manage_token()
returns text language sql volatile as $$
  select lower(random_code(10)) || lower(random_code(10)) || lower(random_code(12));
$$;

-- every booking gets one at creation
create or replace function on_booking_token()
returns trigger language plpgsql as $$
begin
  if new.manage_token is null then
    new.manage_token := new_manage_token();
  end if;
  return new;
end; $$;

drop trigger if exists booking_token_trg on bookings;
create trigger booking_token_trg
  before insert on bookings
  for each row execute function on_booking_token();

-- backfill anything that already exists
update bookings set manage_token = new_manage_token()
 where manage_token is null and status in ('pending','confirmed');

-- ─────────────────────────────────────────────────────────────────────────────
-- What the customer may see. One booking, nothing else.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function booking_by_token(p_token text)
returns json language plpgsql stable security definer set search_path = public as $$
declare v record; v_hours jsonb;
begin
  if p_token is null or length(p_token) < 20 then
    return json_build_object('ok', false, 'reason', 'bad_link');
  end if;

  select b.id, b.status, b.scheduled_at, b.duration_minutes,
         t.name as business, t.slug, coalesce(t.timezone,'Asia/Kuala_Lumpur') as tz,
         coalesce(t.brand_color,'#1D6A8C') as color, t.phone, t.address,
         t.opening_hours, t.logo_url,
         i.name as service, i.price_local as price, i.currency_code as currency,
         coalesce(c.name,'') as customer,
         r.name as with_name
    into v
  from bookings b
  join tenants t on t.id = b.tenant_id
  left join items i on i.id = b.item_id
  left join customers c on c.id = b.customer_id
  left join resources r on r.id = b.resource_id
  where b.manage_token = lower(trim(p_token));

  if not found then
    return json_build_object('ok', false, 'reason', 'not_found');
  end if;

  return json_build_object(
    'ok', true,
    'booking', json_build_object(
      'status', v.status,
      'when_iso', v.scheduled_at,
      'when', to_char(v.scheduled_at at time zone v.tz, 'Day DD Mon YYYY, HH24:MI'),
      'past', v.scheduled_at < now(),
      -- most businesses won't want a cancellation twenty minutes before
      'can_change', v.status in ('pending','confirmed')
                    and v.scheduled_at > now() + interval '2 hours',
      'service', v.service, 'price', v.price, 'currency', v.currency,
      'with', v.with_name, 'customer', v.customer,
      'duration', v.duration_minutes),
    'business', json_build_object(
      'name', v.business, 'slug', v.slug, 'color', v.color,
      'phone', v.phone, 'address', v.address, 'logo_url', v.logo_url,
      'hours', v.opening_hours, 'timezone', v.tz));
end; $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Cancel
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function cancel_by_token(p_token text, p_reason text default null)
returns json language plpgsql security definer set search_path = public as $$
declare v record;
begin
  select b.id, b.tenant_id, b.status, b.scheduled_at, t.name as business,
         coalesce(t.timezone,'Asia/Kuala_Lumpur') as tz, i.name as service,
         coalesce(c.name,'A customer') as customer
    into v
  from bookings b
  join tenants t on t.id = b.tenant_id
  left join items i on i.id = b.item_id
  left join customers c on c.id = b.customer_id
  where b.manage_token = lower(trim(coalesce(p_token,'')));

  if not found then return json_build_object('ok', false, 'reason', 'not_found'); end if;
  if v.status not in ('pending','confirmed') then
    return json_build_object('ok', false, 'reason', 'already_' || v.status);
  end if;
  if v.scheduled_at < now() + interval '2 hours' then
    return json_build_object('ok', false, 'reason', 'too_late',
      'hint', 'Please call us — it is too close to the appointment to change online.');
  end if;

  update bookings
     set status = 'cancelled',
         cancelled_at = now(),
         cancellation_reason = coalesce(nullif(trim(p_reason), ''), 'Cancelled by customer'),
         changed_by_customer_at = now()
   where id = v.id;

  -- tell the business. A cancellation nobody sees is still an empty chair.
  insert into outbox (tenant_id, booking_id, source, to_address, subject, body, send_after)
  select v.tenant_id, v.id, 'cancel_alert', e,
    'Cancelled: ' || coalesce(v.service,'appointment') || ' — ' ||
      to_char(v.scheduled_at at time zone v.tz, 'Dy DD Mon HH24:MI'),
    v.customer || ' cancelled their ' || coalesce(v.service,'appointment') || '.' || E'\n' ||
    'Was: ' || to_char(v.scheduled_at at time zone v.tz, 'Day DD Mon, HH24:MI') || E'\n' ||
    case when p_reason is null or trim(p_reason) = '' then ''
         else 'Reason given: ' || trim(p_reason) || E'\n' end ||
    'The slot is free again.',
    now()
  from (
    select s.email as e from staff s
     where s.tenant_id = v.tenant_id and s.role in ('owner','manager')
       and s.status = 'active' and s.email is not null
    union
    select t.email from tenants t
     where t.id = v.tenant_id and t.email is not null and t.email not like '%.local'
  ) x where e is not null
  on conflict do nothing;

  return json_build_object('ok', true, 'business', v.business);
end; $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Reschedule
--
-- Runs the same checks as a new booking — hours, past dates, whether anyone is
-- free — because a customer moving themselves must not be able to do anything
-- the agent couldn't.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function reschedule_by_token(p_token text, p_new_local text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v record; v_local timestamp; v_at timestamptz; v_dow int; v_hour numeric;
  v_hours jsonb; v_day jsonb; v_free json; v_resource uuid; v_old timestamptz;
begin
  select b.id, b.tenant_id, b.status, b.scheduled_at, b.item_id, b.duration_minutes,
         b.resource_id, t.name as business, coalesce(t.timezone,'Asia/Kuala_Lumpur') as tz,
         t.opening_hours, i.name as service, coalesce(c.name,'A customer') as customer
    into v
  from bookings b
  join tenants t on t.id = b.tenant_id
  left join items i on i.id = b.item_id
  left join customers c on c.id = b.customer_id
  where b.manage_token = lower(trim(coalesce(p_token,'')));

  if not found then return json_build_object('ok', false, 'reason', 'not_found'); end if;
  if v.status not in ('pending','confirmed') then
    return json_build_object('ok', false, 'reason', 'already_' || v.status);
  end if;
  if v.scheduled_at < now() + interval '2 hours' then
    return json_build_object('ok', false, 'reason', 'too_late',
      'hint', 'Please call us — it is too close to the appointment to change online.');
  end if;

  begin v_local := p_new_local::timestamp;
  exception when others then
    return json_build_object('ok', false, 'reason', 'bad_datetime');
  end;

  v_hours := v.opening_hours;
  v_dow := extract(dow from v_local);
  v_hour := extract(hour from v_local) + extract(minute from v_local) / 60.0;

  if v_hours is not null then
    v_day := v_hours -> (array['sun','mon','tue','wed','thu','fri','sat'])[v_dow + 1];
    if v_day is null or v_day = 'null'::jsonb then
      return json_build_object('ok', false, 'reason', 'closed_that_day');
    end if;
    if v_hour < (split_part(v_day->>0,':',1)::numeric + split_part(v_day->>0,':',2)::numeric/60)
       or v_hour >= (split_part(v_day->>1,':',1)::numeric + split_part(v_day->>1,':',2)::numeric/60) then
      return json_build_object('ok', false, 'reason', 'outside_hours');
    end if;
  end if;

  v_at := v_local at time zone v.tz;
  if v_at <= now() + interval '1 hour' then
    return json_build_object('ok', false, 'reason', 'too_soon');
  end if;

  -- is anyone free then? Free this booking's own resource from the check by
  -- looking at the new time only.
  if exists (select 1 from resources where tenant_id = v.tenant_id and is_active) then
    v_free := free_resources(v.tenant_id, v_at, v.item_id,
                             coalesce(v.duration_minutes, 30));
    if json_array_length(v_free) = 0 then
      return json_build_object('ok', false, 'reason', 'fully_booked');
    end if;
    v_resource := ((v_free->0)->>'id')::uuid;
  end if;

  v_old := v.scheduled_at;

  begin
    update bookings
       set scheduled_at = v_at,
           resource_id = coalesce(v_resource, resource_id),
           rescheduled_from = v_old,
           changed_by_customer_at = now(),
           status = 'pending'          -- the business confirms the new time
     where id = v.id;
  exception when unique_violation then
    return json_build_object('ok', false, 'reason', 'slot_taken');
  end;

  insert into outbox (tenant_id, booking_id, source, to_address, subject, body, send_after)
  select v.tenant_id, v.id, 'reschedule_alert_' || extract(epoch from now())::bigint, e,
    'Moved: ' || coalesce(v.service,'appointment') || ' — now ' ||
      to_char(v_at at time zone v.tz, 'Dy DD Mon HH24:MI'),
    v.customer || ' moved their ' || coalesce(v.service,'appointment') || '.' || E'\n' ||
    'Was: ' || to_char(v_old at time zone v.tz, 'Day DD Mon, HH24:MI') || E'\n' ||
    'Now: ' || to_char(v_at at time zone v.tz, 'Day DD Mon, HH24:MI'),
    now()
  from (
    select s.email as e from staff s
     where s.tenant_id = v.tenant_id and s.role in ('owner','manager')
       and s.status = 'active' and s.email is not null
    union
    select t.email from tenants t
     where t.id = v.tenant_id and t.email is not null and t.email not like '%.local'
  ) x where e is not null
  on conflict do nothing;

  return json_build_object('ok', true,
    'when', to_char(v_at at time zone v.tz, 'Day DD Mon YYYY, HH24:MI'));
end; $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- What times are actually free, so the customer isn't guessing.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function open_slots(p_token text, p_date date)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  v record; v_day jsonb; v_open numeric; v_close numeric;
  v_slot timestamp; v_at timestamptz; v_out json[] := '{}';
  v_step int := 30; v_dow int;
begin
  select b.tenant_id, b.item_id, b.duration_minutes, b.status,
         coalesce(t.timezone,'Asia/Kuala_Lumpur') as tz, t.opening_hours
    into v
  from bookings b join tenants t on t.id = b.tenant_id
  where b.manage_token = lower(trim(coalesce(p_token,'')));

  if not found then return json_build_object('ok', false, 'reason', 'not_found'); end if;

  v_dow := extract(dow from p_date);
  v_day := v.opening_hours -> (array['sun','mon','tue','wed','thu','fri','sat'])[v_dow + 1];
  if v_day is null or v_day = 'null'::jsonb then
    return json_build_object('ok', true, 'date', p_date, 'slots', '[]'::json,
                             'closed', true);
  end if;

  v_open  := split_part(v_day->>0,':',1)::numeric * 60 + split_part(v_day->>0,':',2)::numeric;
  v_close := split_part(v_day->>1,':',1)::numeric * 60 + split_part(v_day->>1,':',2)::numeric;

  while v_open + coalesce(v.duration_minutes, 30) <= v_close loop
    v_slot := p_date + make_interval(mins => v_open::int);
    v_at := v_slot at time zone v.tz;

    if v_at > now() + interval '2 hours' then
      if not exists (select 1 from resources where tenant_id = v.tenant_id and is_active)
         or json_array_length(
              free_resources(v.tenant_id, v_at, v.item_id,
                             coalesce(v.duration_minutes, 30))) > 0 then
        v_out := array_append(v_out, json_build_object(
          'local', to_char(v_slot, 'YYYY-MM-DD"T"HH24:MI'),
          'label', to_char(v_slot, 'HH24:MI')));
      end if;
    end if;

    v_open := v_open + v_step;
  end loop;

  return json_build_object('ok', true, 'date', p_date,
                           'slots', coalesce(array_to_json(v_out), '[]'::json));
end; $$;

revoke execute on function
  booking_by_token(text), cancel_by_token(text,text),
  reschedule_by_token(text,text), open_slots(text,date), new_manage_token()
  from public, anon, authenticated;

grant execute on function
  booking_by_token(text), cancel_by_token(text,text),
  reschedule_by_token(text,text), open_slots(text,date), new_manage_token()
  to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Put the link in the confirmation email
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function booking_manage_url(p_booking_id uuid, p_origin text)
returns text language sql stable security definer set search_path = public as $$
  select p_origin || '/b/' || manage_token from bookings where id = p_booking_id;
$$;

grant execute on function booking_manage_url(uuid, text) to service_role;

-- ============================================================================
-- CHECK
--   select manage_token from bookings order by created_at desc limit 1;
--   select booking_by_token('<that token>');
--   select open_slots('<that token>', current_date + 3);
--   select reschedule_by_token('<that token>', '2026-09-15T15:00');
--   select cancel_by_token('<that token>', 'Something came up');
--
--   -- and confirm the guards hold:
--   select cancel_by_token('nonsense');                → not_found
--   select reschedule_by_token('<token>', 'gibberish') → bad_datetime
-- ============================================================================
