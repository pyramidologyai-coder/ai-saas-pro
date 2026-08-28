-- ============================================================================
-- 0010_booking_fix.sql — fix the timezone bug in create_booking()
-- Run AFTER 0009. Safe to re-run.
--
-- THE BUG: the agent sends "2026-09-01T15:00" with no timezone. Postgres read
-- that as 15:00 UTC = 23:00 in Malaysia, so every afternoon booking was
-- rejected as "outside hours". The old function also cast through UTC a second
-- time, shifting it again.
--
-- THE FIX: take the time as text, treat it as the CLINIC'S OWN wall-clock time
-- (which is what the patient and the agent both mean), and convert once.
--
--   timestamp AT TIME ZONE 'zone'   →  timestamptz   (local wall time → real instant)
--   timestamptz AT TIME ZONE 'zone' →  timestamp     (real instant → local wall time)
--
-- Getting those two backwards is what caused this.
-- ============================================================================

drop function if exists create_booking(text, uuid, text, timestamptz, text);

create or replace function create_booking(
  p_tenant_slug     text,
  p_conversation_id uuid,
  p_service_name    text,
  p_scheduled_at    text,      -- "2026-09-01T15:00", meant as CLINIC local time
  p_customer_name   text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id   uuid;
  v_tz          text;
  v_customer_id uuid;
  v_agent_id    uuid;
  v_item        items%rowtype;
  v_booking_id  uuid;
  v_local       timestamp;      -- wall clock, no timezone
  v_at          timestamptz;    -- the real instant, for storage
  v_dow         int;
  v_hour        numeric;
begin
  select id, coalesce(timezone, 'Asia/Kuala_Lumpur')
    into v_tenant_id, v_tz
  from tenants where slug = p_tenant_slug;

  if v_tenant_id is null then
    return json_build_object('ok', false, 'reason', 'unknown_tenant');
  end if;

  -- Parse as plain wall time. Never let the server's timezone get involved.
  begin
    v_local := p_scheduled_at::timestamp;
  exception when others then
    return json_build_object('ok', false, 'reason', 'bad_datetime');
  end;

  -- Opening hours, judged on the clinic's own clock.
  v_dow  := extract(dow from v_local);            -- 0 = Sunday
  v_hour := extract(hour from v_local) + extract(minute from v_local) / 60.0;

  if v_dow = 0 then
    return json_build_object('ok', false, 'reason', 'closed_that_day');
  elsif v_dow = 6 then
    if v_hour < 9 or v_hour >= 13 then
      return json_build_object('ok', false, 'reason', 'outside_hours');
    end if;
  else
    if v_hour < 8.5 or v_hour >= 18 then
      return json_build_object('ok', false, 'reason', 'outside_hours');
    end if;
  end if;

  -- Now convert that wall time into a real instant, once.
  v_at := v_local at time zone v_tz;

  if v_at <= now() then
    return json_build_object('ok', false, 'reason', 'in_the_past');
  end if;

  -- The service must exist and be bookable. Never invent one.
  select * into v_item
  from items
  where tenant_id = v_tenant_id and is_active and is_bookable
    and lower(name) = lower(trim(p_service_name))
  limit 1;

  if v_item.id is null then
    select * into v_item
    from items
    where tenant_id = v_tenant_id and is_active and is_bookable
      and lower(name) like '%' || lower(trim(p_service_name)) || '%'
    limit 1;
  end if;

  if v_item.id is null then
    return json_build_object('ok', false, 'reason', 'unknown_service');
  end if;

  select customer_id, ai_employee_id into v_customer_id, v_agent_id
  from conversations where id = p_conversation_id;

  if v_customer_id is null then
    return json_build_object('ok', false, 'reason', 'unknown_conversation');
  end if;

  if p_customer_name is not null and length(trim(p_customer_name)) > 0 then
    update customers set name = trim(p_customer_name)
     where id = v_customer_id and (name is null or name = '');
  end if;

  begin
    insert into bookings (tenant_id, customer_id, conversation_id, item_id,
                          ai_employee_id, status, scheduled_at,
                          duration_minutes, notes)
    values (v_tenant_id, v_customer_id, p_conversation_id, v_item.id,
            v_agent_id, 'pending', v_at,
            v_item.duration_minutes, 'Booked by AI receptionist')
    returning id into v_booking_id;
  exception when unique_violation then
    return json_build_object('ok', false, 'reason', 'slot_taken');
  end;

  return json_build_object(
    'ok', true,
    'booking_id', v_booking_id,
    'service', v_item.name,
    'price', v_item.price_local,
    'currency', v_item.currency_code,
    'duration_minutes', v_item.duration_minutes,
    'scheduled_at', v_at,
    'local_time', to_char(v_local, 'Day DD Mon YYYY, HH24:MI')
  );
end;
$$;

revoke execute on function create_booking(text, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function create_booking(text, uuid, text, text, text)
  to service_role;

-- ============================================================================
-- TEST IT — Tuesday 3pm must now succeed.
--
--   select create_booking('damai-clinic',
--            (select id from conversations
--              where tenant_id = (select id from tenants where slug='damai-clinic')
--              limit 1),
--            'General consultation',
--            to_char(now() + interval '7 days', 'YYYY-MM-DD') || 'T15:00',
--            'Test Patient');
--   → expect ok:true
--
--   -- and these must still be refused:
--   -- ...'T22:00' → outside_hours
--   -- a Sunday    → closed_that_day
--
--   select status, scheduled_at, notes from bookings order by created_at desc limit 5;
-- ============================================================================
