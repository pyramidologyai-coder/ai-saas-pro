-- ============================================================================
-- 0014_dashboard_actions.sql — make the dashboard do things, not just show them.
-- Run AFTER 0013. Safe to re-run.
--
-- Until now the dashboard was read-only except for prices. An owner could see
-- an escalation but not clear it, see a booking but not confirm or cancel it,
-- and could not read a conversation past its last line. These four functions
-- close that.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- list_businesses() — the index page. Which businesses exist, and how busy.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function list_businesses()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(json_agg(b order by b.name), '[]'::json)
  from (
    select t.name, t.slug, t.vertical, t.status,
           coalesce(t.brand_color, '#1D6A8C') as color,
           t.wallet_balance_usd as wallet,
           (select persona_name from ai_employees e
             where e.tenant_id = t.id and e.status = 'active' limit 1) as agent,
           (select count(*) from conversations c where c.tenant_id = t.id) as conversations,
           (select count(*) from bookings bk where bk.tenant_id = t.id
              and bk.status in ('pending','confirmed')) as bookings,
           (select count(*) from escalations es where es.tenant_id = t.id
              and es.status = 'open') as needs_you
    from tenants t
    order by t.name
  ) b;
$$;

revoke execute on function list_businesses() from public, anon, authenticated;
grant  execute on function list_businesses() to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- conversation_thread(id) — read the whole exchange, plus what it cost.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function conversation_thread(p_conversation_id uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'ok', true,
    'customer', (select coalesce(cu.name, 'Visitor')
                   from conversations cv
                   left join customers cu on cu.id = cv.customer_id
                  where cv.id = p_conversation_id),
    'status', (select status from conversations where id = p_conversation_id),
    'cost', (select ai_cost_usd from conversations where id = p_conversation_id),
    'messages', (
      select coalesce(json_agg(m order by m.created_at), '[]'::json)
      from (
        select sender_type, body, created_at,
               to_char(created_at at time zone
                 coalesce((select t.timezone from conversations c
                            join tenants t on t.id = c.tenant_id
                           where c.id = p_conversation_id), 'Asia/Kuala_Lumpur'),
                 'DD Mon HH24:MI') as at
        from messages
        where conversation_id = p_conversation_id
        order by created_at
        limit 200
      ) m
    )
  );
$$;

revoke execute on function conversation_thread(uuid) from public, anon, authenticated;
grant  execute on function conversation_thread(uuid) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- resolve_escalation(id) — mark it handled, and reopen the conversation so the
-- agent can answer again.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function resolve_escalation(p_id uuid, p_by text default 'owner')
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation_id uuid;
begin
  update escalations
     set status = 'resolved', resolved_at = now(), resolved_by = p_by
   where id = p_id and status = 'open'
  returning conversation_id into v_conversation_id;

  if not found then
    return json_build_object('ok', false, 'reason', 'already_resolved');
  end if;

  -- Let the agent take over again, but only if nothing else is still open.
  update conversations
     set status = 'open', escalated_at = null, escalation_reason = null
   where id = v_conversation_id
     and not exists (
       select 1 from escalations e
        where e.conversation_id = v_conversation_id and e.status = 'open'
     );

  return json_build_object('ok', true);
end;
$$;

revoke execute on function resolve_escalation(uuid, text) from public, anon, authenticated;
grant  execute on function resolve_escalation(uuid, text) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- set_booking_status(id, status) — confirm, cancel, complete, no-show.
-- Cancelling frees the slot: the unique index only covers pending/confirmed.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function set_booking_status(p_id uuid, p_status text)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('pending','confirmed','cancelled','completed','no_show') then
    return json_build_object('ok', false, 'reason', 'bad_status');
  end if;

  update bookings
     set status = p_status,
         cancelled_at = case when p_status = 'cancelled' then now() else null end,
         cancellation_reason = case when p_status = 'cancelled'
                                    then 'Cancelled from dashboard' else null end
   where id = p_id;

  if not found then
    return json_build_object('ok', false, 'reason', 'unknown_booking');
  end if;

  return json_build_object('ok', true, 'status', p_status);
end;
$$;

revoke execute on function set_booking_status(uuid, text) from public, anon, authenticated;
grant  execute on function set_booking_status(uuid, text) to service_role;

-- ============================================================================
-- CHECK
--   select list_businesses();
--   select conversation_thread((select id from conversations limit 1));
--   select set_booking_status((select id from bookings limit 1), 'confirmed');
--   select resolve_escalation((select id from escalations where status='open' limit 1));
-- ============================================================================
