-- ============================================================================
-- 0011_dashboard.sql — what the owner sees, and the demo closer.
-- Run AFTER 0001-0010. Safe to re-run.
--
-- Two things:
--   1. rebuild_prompt()   — regenerates the system prompt from the items table.
--                           Called whenever a price changes. THIS is the demo
--                           closer: edit a price, the agent quotes the new one.
--   2. dashboard_data()   — everything the owner's page needs, in one call.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- rebuild_prompt(slug)
--
-- The prompt has two parts: the fixed instructions (persona, rules, booking,
-- safety) and the generated services list. Only the services list changes when
-- a price is edited, so we swap that block and leave everything else untouched.
--
-- The block is delimited so we can find it reliably.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function rebuild_prompt(p_slug text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_agent_id  uuid;
  v_prompt    text;
  v_services  text;
  v_start     int;
  v_end       int;
  v_head      text;
  v_tail      text;
  v_version   int;
begin
  select id into v_tenant_id from tenants where slug = p_slug;
  if v_tenant_id is null then
    return json_build_object('ok', false, 'reason', 'unknown_tenant');
  end if;

  select id, compiled_prompt into v_agent_id, v_prompt
  from ai_employees
  where tenant_id = v_tenant_id and status = 'active'
  limit 1;

  if v_agent_id is null or v_prompt is null then
    return json_build_object('ok', false, 'reason', 'no_agent');
  end if;

  -- Regenerate the services block from live data
  select string_agg(
           '- ' || name
           || case when price_local is null then ' (price on enquiry)'
                   else ' — ' || currency_code || ' ' ||
                        trim(to_char(price_local, 'FM999999990.00')) end
           || case when duration_minutes is null then ''
                   else ', about ' || duration_minutes || ' minutes' end
           || case when description is null or description = '' then ''
                   else '. ' || description end,
           E'\n' order by price_local nulls last)
    into v_services
  from items
  where tenant_id = v_tenant_id and is_active;

  v_services := coalesce(v_services, '(none listed)');

  -- Find the existing services block and replace just that
  v_start := position('SERVICES AND PRICES' in v_prompt);
  if v_start = 0 then
    return json_build_object('ok', false, 'reason', 'no_services_block');
  end if;

  v_head := substring(v_prompt from 1 for v_start - 1);
  v_tail := substring(v_prompt from v_start);

  -- the block ends at the first blank line followed by a capitalised heading
  v_end := position(E'\n\n' in v_tail);
  if v_end = 0 then
    return json_build_object('ok', false, 'reason', 'malformed_prompt');
  end if;

  v_prompt := v_head
           || 'SERVICES AND PRICES' || E'\n' || v_services
           || substring(v_tail from v_end);

  update ai_employees
     set compiled_prompt = v_prompt,
         compiled_tokens = ceil(length(v_prompt) / 4.0),
         config_version  = config_version + 1,
         updated_at      = now()
   where id = v_agent_id
  returning config_version into v_version;

  return json_build_object('ok', true, 'config_version', v_version,
                           'tokens', ceil(length(v_prompt) / 4.0));
end;
$$;

revoke execute on function rebuild_prompt(text) from public, anon, authenticated;
grant  execute on function rebuild_prompt(text) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- dashboard_data(slug) — one call, everything the owner's page shows.
-- Read-only. Returns no prompt, no keys, no other tenant's rows.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function dashboard_data(p_slug text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_result    json;
begin
  select id into v_tenant_id from tenants where slug = p_slug;
  if v_tenant_id is null then
    return json_build_object('ok', false, 'reason', 'unknown_tenant');
  end if;

  select json_build_object(
    'ok', true,
    'business', (
      select json_build_object(
        'name', name, 'slug', slug, 'timezone', timezone,
        'wallet', wallet_balance_usd, 'color', brand_color,
        'agent', (select persona_name from ai_employees
                   where tenant_id = v_tenant_id and status = 'active' limit 1)
      ) from tenants where id = v_tenant_id
    ),
    'stats', (
      select json_build_object(
        'conversations', (select count(*) from conversations where tenant_id = v_tenant_id),
        'messages',      (select count(*) from messages      where tenant_id = v_tenant_id),
        'bookings',      (select count(*) from bookings      where tenant_id = v_tenant_id
                           and status in ('pending','confirmed')),
        'open_escalations', (select count(*) from escalations where tenant_id = v_tenant_id
                              and status = 'open'),
        'total_cost', (select coalesce(sum(actual_execution_cost), 0)
                         from ai_decision_log where tenant_id = v_tenant_id)
      )
    ),
    'conversations', (
      select coalesce(json_agg(c order by c.last_at desc), '[]'::json) from (
        select conv.id,
               coalesce(cust.name, 'Visitor') as customer,
               conv.status,
               conv.message_count,
               conv.ai_cost_usd as cost,
               greatest(conv.created_at,
                        coalesce((select max(created_at) from messages m
                                   where m.conversation_id = conv.id),
                                 conv.created_at)) as last_at,
               (select body from messages m
                 where m.conversation_id = conv.id
                 order by created_at desc limit 1) as last_message
        from conversations conv
        left join customers cust on cust.id = conv.customer_id
        where conv.tenant_id = v_tenant_id
        order by last_at desc
        limit 25
      ) c
    ),
    'bookings', (
      select coalesce(json_agg(b order by b.scheduled_at), '[]'::json) from (
        select bk.id, bk.status, bk.scheduled_at,
               to_char(bk.scheduled_at at time zone
                       coalesce((select timezone from tenants where id = v_tenant_id),
                                'Asia/Kuala_Lumpur'),
                       'Dy DD Mon, HH24:MI') as local_time,
               it.name as service, it.price_local as price, it.currency_code as currency,
               coalesce(cu.name, 'Visitor') as customer
        from bookings bk
        left join items it on it.id = bk.item_id
        left join customers cu on cu.id = bk.customer_id
        where bk.tenant_id = v_tenant_id
          and bk.status in ('pending','confirmed')
        order by bk.scheduled_at
        limit 25
      ) b
    ),
    'escalations', (
      select coalesce(json_agg(e order by e.created_at desc), '[]'::json) from (
        select es.id, es.reason, es.trigger_source, es.status, es.created_at,
               coalesce(cu.name, 'Visitor') as customer
        from escalations es
        left join conversations cv on cv.id = es.conversation_id
        left join customers cu on cu.id = cv.customer_id
        where es.tenant_id = v_tenant_id
        order by es.created_at desc
        limit 25
      ) e
    ),
    'items', (
      select coalesce(json_agg(i order by i.price_local nulls last), '[]'::json) from (
        select id, name, description, price_local as price, currency_code as currency,
               duration_minutes, is_bookable, is_active
        from items
        where tenant_id = v_tenant_id and is_active
        order by price_local nulls last
      ) i
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke execute on function dashboard_data(text) from public, anon, authenticated;
grant  execute on function dashboard_data(text) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- update_item_price(item_id, price) — edit a price and rebuild the prompt.
-- Returns the new config_version so the UI can prove the change landed.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function update_item_price(p_item_id uuid, p_price numeric)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug text;
begin
  if p_price is null or p_price < 0 then
    return json_build_object('ok', false, 'reason', 'bad_price');
  end if;

  update items set price_local = p_price where id = p_item_id;
  if not found then
    return json_build_object('ok', false, 'reason', 'unknown_item');
  end if;

  select t.slug into v_slug
  from items i join tenants t on t.id = i.tenant_id
  where i.id = p_item_id;

  return rebuild_prompt(v_slug);
end;
$$;

revoke execute on function update_item_price(uuid, numeric) from public, anon, authenticated;
grant  execute on function update_item_price(uuid, numeric) to service_role;

-- ============================================================================
-- CHECK
--   select dashboard_data('damai-clinic');
--   select rebuild_prompt('damai-clinic');       -- expect ok:true, version +1
--
-- THE DEMO CLOSER:
--   1. open /dashboard/damai-clinic, change a price, save
--   2. open /demo/damai-clinic, ask about that service
--   3. the agent quotes the new price
-- ============================================================================
