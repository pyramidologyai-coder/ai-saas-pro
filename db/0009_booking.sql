-- ============================================================================
-- 0009_booking.sql — two fixes
--   1. Stops an earlier emergency sticking to every later message
--   2. Adds create_booking(), so the agent can actually save appointments
-- Run AFTER 0001-0008. Safe to re-run.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 1 · Emergency stickiness
--
-- Symptom: ask about chest pain, then ask an ordinary question, and the agent
-- keeps replying with the emergency script. The earlier exchange is in the
-- conversation history, and the model pattern-matches on it.
--
-- Fix: tell the agent explicitly to judge each message on its own.
-- ─────────────────────────────────────────────────────────────────────────────
update ai_employees
   set compiled_prompt = replace(
         compiled_prompt,
         'Do not add anything else. Do not book them. Do not ask questions.',
         'Do not add anything else. Do not book them. Do not ask questions.

JUDGE EACH MESSAGE ON ITS OWN. An earlier emergency in this conversation does
NOT make the next message an emergency. If someone mentioned chest pain before
and now asks about opening hours, answer about opening hours normally. Only use
the emergency reply when THIS message describes an emergency happening now.

A test result, a reading, or a number on its own is NOT an emergency. It is a
clinical question: decline to interpret it and offer an appointment.'),
       config_version = config_version + 1,
       updated_at = now()
 where sector_id = 'clinic'
   and compiled_prompt like '%Do not add anything else. Do not book them.%';

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 2 · create_booking()
--
-- Called by the chat route when the agent has service + day + time + name.
-- Everything happens in one transaction so a half-written booking is impossible.
--
-- The unique index on (tenant_id, scheduled_at) is the lock: if two customers
-- ask for the same slot at the same moment, the second insert fails and we
-- return 'slot_taken' rather than overwriting.
-- ─────────────────────────────────────────────────────────────────────────────
create unique index if not exists bookings_slot_uniq
  on bookings(tenant_id, scheduled_at)
  where status in ('pending','confirmed');

create or replace function create_booking(
  p_tenant_slug     text,
  p_conversation_id uuid,
  p_service_name    text,
  p_scheduled_at    timestamptz,
  p_customer_name   text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id   uuid;
  v_customer_id uuid;
  v_agent_id    uuid;
  v_item        items%rowtype;
  v_booking_id  uuid;
  v_tz          text;
  v_local       timestamptz;
  v_dow         int;
  v_hour        numeric;
begin
  select id, timezone into v_tenant_id, v_tz
  from tenants where slug = p_tenant_slug;

  if v_tenant_id is null then
    return json_build_object('ok', false, 'reason', 'unknown_tenant');
  end if;

  -- the service must exist and be bookable — never invent one
  select * into v_item
  from items
  where tenant_id = v_tenant_id
    and is_active and is_bookable
    and lower(name) = lower(trim(p_service_name))
  limit 1;

  if v_item.id is null then
    -- try a looser match before giving up
    select * into v_item
    from items
    where tenant_id = v_tenant_id
      and is_active and is_bookable
      and lower(name) like '%' || lower(trim(p_service_name)) || '%'
    limit 1;
  end if;

  if v_item.id is null then
    return json_build_object('ok', false, 'reason', 'unknown_service');
  end if;

  -- no bookings in the past
  if p_scheduled_at <= now() then
    return json_build_object('ok', false, 'reason', 'in_the_past');
  end if;

  -- opening hours, in the tenant's own timezone (not the server's)
  v_local := p_scheduled_at at time zone coalesce(v_tz, 'Asia/Kuala_Lumpur');
  v_dow   := extract(dow from v_local);          -- 0 = Sunday
  v_hour  := extract(hour from v_local) + extract(minute from v_local) / 60.0;

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

  -- who is this conversation with
  select customer_id, ai_employee_id into v_customer_id, v_agent_id
  from conversations where id = p_conversation_id;

  if v_customer_id is null then
    return json_build_object('ok', false, 'reason', 'unknown_conversation');
  end if;

  -- remember the name they gave
  if p_customer_name is not null and length(trim(p_customer_name)) > 0 then
    update customers set name = trim(p_customer_name)
     where id = v_customer_id and (name is null or name = '');
  end if;

  begin
    insert into bookings (tenant_id, customer_id, conversation_id, item_id,
                          ai_employee_id, status, scheduled_at,
                          duration_minutes, notes)
    values (v_tenant_id, v_customer_id, p_conversation_id, v_item.id,
            v_agent_id, 'pending', p_scheduled_at,
            v_item.duration_minutes, 'Booked by AI receptionist')
    returning id into v_booking_id;
  exception when unique_violation then
    -- someone took this slot between the check and the insert
    return json_build_object('ok', false, 'reason', 'slot_taken');
  end;

  return json_build_object(
    'ok', true,
    'booking_id', v_booking_id,
    'service', v_item.name,
    'price', v_item.price_local,
    'currency', v_item.currency_code,
    'duration_minutes', v_item.duration_minutes,
    'scheduled_at', p_scheduled_at
  );
end;
$$;

revoke execute on function create_booking(text, uuid, text, timestamptz, text)
  from public, anon, authenticated;
grant execute on function create_booking(text, uuid, text, timestamptz, text)
  to service_role;

-- ============================================================================
-- CHECK
--   select compiled_tokens, config_version from ai_employees where sector_id='clinic';
--   -- token count should have grown, version bumped
--
--   select create_booking('damai-clinic',
--            (select id from conversations limit 1),
--            'General consultation',
--            now() + interval '2 days',
--            'Test Patient');
--   -- expect ok:true, or a clear reason
--
--   select * from bookings order by created_at desc limit 3;
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 3 · Teach the agents to emit the booking tag.
--
-- The chat route watches for [[BOOK ...]], saves the appointment, and strips
-- the tag before the customer sees it. Applies to every tenant.
-- ─────────────────────────────────────────────────────────────────────────────
update ai_employees
   set compiled_prompt = compiled_prompt || '

SAVING A BOOKING
When you have all four details — service, day, time and name — end your reply
with this tag on its own line:

[[BOOK service="exact service name" when="YYYY-MM-DDTHH:MM" name="their name"]]

Rules for the tag:
- Use the service name EXACTLY as written in the services list above.
- "when" must be a full date and time in 24-hour form, e.g. 2026-09-02T15:00.
  Work out the real date from what they said ("tomorrow", "next Tuesday").
- Write the tag ONLY when you have all four. Never guess a missing one.
- Never mention the tag, never explain it, never show it in your sentence.
- Write your normal confirming sentence first, then the tag on a new line.

Today''s date is provided in the conversation. If you are unsure which date
they mean, ask — do not guess.',
       config_version = config_version + 1,
       updated_at = now()
 where compiled_prompt is not null
   and compiled_prompt not like '%[[BOOK service=%';
