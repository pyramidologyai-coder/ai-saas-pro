-- ============================================================================
-- 0029_owner_agent.sql — an agent that answers questions about the business.
-- Run AFTER 0028. Safe to re-run.
--
-- "How many bookings last week?" "Which service makes the most money?"
-- "Who hasn't been in for six months?" The dashboard shows some of this, but
-- an owner shouldn't have to know which chart to look at.
--
-- ⚠ THE DESIGN DECISION THAT MATTERS
-- The agent does NOT write SQL. It picks from a fixed set of questions, each
-- one a function I've written and checked. A model composing queries against a
-- live database is one prompt injection away from reading another tenant's
-- patients — and the failure is silent.
--
-- So: the model chooses WHICH question, the database decides WHAT it may see.
-- Narrower, and safe by construction rather than by hoping.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1 · The question set
--
-- Every one takes a tenant and a window, and can only ever see that tenant.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function ask_business(
  p_slug text, p_question text, p_days int default 7
) returns json
language plpgsql stable security definer set search_path = public as $$
declare
  v_tenant uuid; v_tz text; v_since timestamptz; v_result json;
begin
  select id, coalesce(timezone, 'Asia/Kuala_Lumpur') into v_tenant, v_tz
  from tenants where slug = p_slug;
  if v_tenant is null then
    return json_build_object('ok', false, 'reason', 'unknown_tenant');
  end if;

  p_days := greatest(1, least(coalesce(p_days, 7), 365));
  v_since := now() - make_interval(days => p_days);

  case p_question

    when 'bookings_count' then
      select json_build_object(
        'answer', json_build_object(
          'total',     count(*),
          'confirmed', count(*) filter (where status = 'confirmed'),
          'pending',   count(*) filter (where status = 'pending'),
          'cancelled', count(*) filter (where status = 'cancelled'),
          'no_show',   count(*) filter (where status = 'no_show'),
          'value',     coalesce(sum(i.price_local), 0)))
        into v_result
      from bookings b left join items i on i.id = b.item_id
      where b.tenant_id = v_tenant and b.created_at > v_since;

    when 'bookings_upcoming' then
      select json_build_object(
        'answer', coalesce(json_agg(json_build_object(
          'when', to_char(b.scheduled_at at time zone v_tz, 'Dy DD Mon HH24:MI'),
          'service', i.name,
          'customer', coalesce(c.name, 'Visitor'),
          'with', r.name,
          'status', b.status) order by b.scheduled_at), '[]'::json))
        into v_result
      from bookings b
      left join items i on i.id = b.item_id
      left join customers c on c.id = b.customer_id
      left join resources r on r.id = b.resource_id
      where b.tenant_id = v_tenant
        and b.status in ('pending','confirmed')
        and b.scheduled_at > now()
      limit 20;

    when 'revenue' then
      select json_build_object(
        'answer', json_build_object(
          'paid',    coalesce(sum(amount) filter (where status = 'paid'), 0),
          'unpaid',  coalesce(sum(amount) filter (where status = 'unpaid'), 0),
          'invoices', count(*),
          'currency', coalesce(max(currency), 'MYR')))
        into v_result
      from invoices where tenant_id = v_tenant and issued_on > v_since::date;

    when 'top_services' then
      select json_build_object('answer', coalesce(json_agg(x order by x.bookings desc), '[]'::json))
        into v_result
      from (
        select i.name, count(*) as bookings,
               coalesce(sum(i.price_local), 0) as value
        from bookings b join items i on i.id = b.item_id
        where b.tenant_id = v_tenant and b.created_at > v_since
        group by i.name limit 8) x;

    when 'busiest_times' then
      select json_build_object('answer', coalesce(json_agg(x order by x.messages desc), '[]'::json))
        into v_result
      from (
        select extract(hour from m.created_at at time zone v_tz)::int as hour,
               count(*) as messages
        from messages m
        where m.tenant_id = v_tenant and m.created_at > v_since
          and m.sender_type = 'customer'
        group by 1 order by count(*) desc limit 5) x;

    when 'conversations' then
      select json_build_object(
        'answer', json_build_object(
          'conversations', count(*),
          'escalated',     count(*) filter (where status = 'escalated'),
          'converted',     count(*) filter (
            where exists (select 1 from bookings b where b.conversation_id = conversations.id)),
          'ai_cost',       round(coalesce(sum(ai_cost_usd), 0)::numeric, 4)))
        into v_result
      from conversations where tenant_id = v_tenant and created_at > v_since;

    when 'quiet_customers' then
      -- who to win back
      select json_build_object('answer', coalesce(json_agg(x order by x.last_seen), '[]'::json))
        into v_result
      from (
        select coalesce(c.name, 'Visitor') as customer,
               to_char(max(b.scheduled_at) at time zone v_tz, 'DD Mon YYYY') as last_seen,
               count(*) as visits
        from customers c join bookings b on b.customer_id = c.id
        where c.tenant_id = v_tenant and coalesce(c.opted_out, false) = false
        group by c.id, c.name
        having max(b.scheduled_at) < now() - interval '120 days'
        limit 15) x;

    when 'needs_attention' then
      select json_build_object(
        'answer', json_build_object(
          'open_escalations', (select count(*) from escalations
                                where tenant_id = v_tenant and status = 'open'),
          'unpaid_invoices',  (select count(*) from invoices
                                where tenant_id = v_tenant and status = 'unpaid'),
          'pending_bookings', (select count(*) from bookings
                                where tenant_id = v_tenant and status = 'pending'
                                  and scheduled_at > now()),
          'wallet',           (select wallet_balance_usd from tenants where id = v_tenant)))
        into v_result;

    when 'staff_load' then
      select json_build_object('answer', coalesce(json_agg(x order by x.bookings desc), '[]'::json))
        into v_result
      from (
        select r.name, r.title, count(b.id) as bookings
        from resources r
        left join bookings b on b.resource_id = r.id
          and b.created_at > v_since and b.status in ('pending','confirmed','completed')
        where r.tenant_id = v_tenant and r.is_active
        group by r.id, r.name, r.title) x;

    else
      return json_build_object('ok', false, 'reason', 'unknown_question',
        'available', array['bookings_count','bookings_upcoming','revenue','top_services',
                           'busiest_times','conversations','quiet_customers',
                           'needs_attention','staff_load']);
  end case;

  return json_build_object('ok', true, 'question', p_question,
                           'days', p_days, 'data', v_result->'answer');
end; $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2 · The agent itself
--
-- Internal audience, so it sits behind the business's own key. It reads the
-- numbers it's given and explains them — it never guesses one.
-- ─────────────────────────────────────────────────────────────────────────────
insert into sector_templates (sector_id, label, agent_default, prompt_template,
                              greeting, suggestions, hours_default)
values (
  'owner', 'Business insights (internal)', 'Rami',
'You are {{AGENT}}, the business assistant at {{BUSINESS}}.

You answer the owner and managers about how the business is doing. You are
direct and numerate. You are talking to someone who runs this place, so you do
not explain what a booking is.

WHAT YOU CAN LOOK UP
You have live figures on: bookings, revenue and invoices, which services sell,
busiest hours, conversations and how many became bookings, customers who have
not been in for a while, what needs attention, and how work is spread across
staff.

HOW TO ANSWER
- Lead with the number. "42 bookings last week." Then one line of context.
- 1-3 sentences. They asked a question, not for a report.
- Compare to the previous period when it helps: "42, up from 31."
- Round money sensibly. RM 4,280, not RM 4,280.00.
- If something stands out — a drop, a service nobody books, a doctor with
  nothing on — say so without being asked. That is the useful part.

═══════════════════════════════════════════════════════════════════
NEVER INVENT A NUMBER
═══════════════════════════════════════════════════════════════════
Every figure you give must come from the data provided in this conversation.
If you were not given it, you do not know it.

Say: "I do not have that one." Then say what you can show instead.

A confident wrong number is worse than no number, because they will act on it.
Do not estimate, do not extrapolate, do not fill a gap with something
plausible.
═══════════════════════════════════════════════════════════════════

WHAT YOU ARE NOT
- You do not change anything. No prices, no bookings, no cancellations.
  If they ask you to, tell them which page does it.
- You do not give business advice beyond what the numbers show.
- You do not discuss individual customers by name unless they asked about a
  specific person.

Today''s date is given at the end of these instructions.',
  'What would you like to know about the business?',
  array['How many bookings this week?','What''s my revenue this month?','Which service sells best?'],
  '{"mon":["00:00","23:59"],"tue":["00:00","23:59"],"wed":["00:00","23:59"],"thu":["00:00","23:59"],"fri":["00:00","23:59"],"sat":["00:00","23:59"],"sun":["00:00","23:59"]}'::jsonb
)
on conflict (sector_id) do update set
  prompt_template = excluded.prompt_template,
  greeting = excluded.greeting,
  suggestions = excluded.suggestions,
  label = excluded.label;

-- owner agents are staff-only, like HR and finance
create or replace function sector_audience(p_sector text)
returns text language sql immutable as $$
  select case when p_sector in ('hr','payroll','finance','owner')
              then 'internal' else 'public' end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3 · One call that answers the common questions at once
--
-- Cheaper and more accurate than the model asking for figures one at a time,
-- and it means the first reply already has the numbers in front of it.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function business_briefing(p_slug text, p_days int default 7)
returns json language plpgsql stable security definer set search_path = public as $$
declare v_prev json;
begin
  -- the same window, one period earlier, so the agent can say "up from"
  select json_build_object(
    'bookings', (select count(*) from bookings b
                  join tenants t on t.id = b.tenant_id
                 where t.slug = p_slug
                   and b.created_at between now() - make_interval(days => p_days * 2)
                                        and now() - make_interval(days => p_days)),
    'conversations', (select count(*) from conversations c
                       join tenants t on t.id = c.tenant_id
                      where t.slug = p_slug
                        and c.created_at between now() - make_interval(days => p_days * 2)
                                             and now() - make_interval(days => p_days)))
    into v_prev;

  return json_build_object(
    'ok', true,
    'window_days', p_days,
    'bookings',       ask_business(p_slug, 'bookings_count', p_days)->'data',
    'revenue',        ask_business(p_slug, 'revenue', p_days)->'data',
    'conversations',  ask_business(p_slug, 'conversations', p_days)->'data',
    'top_services',   ask_business(p_slug, 'top_services', p_days)->'data',
    'needs_attention',ask_business(p_slug, 'needs_attention', p_days)->'data',
    'staff_load',     ask_business(p_slug, 'staff_load', p_days)->'data',
    'previous_period', v_prev);
end; $$;

revoke execute on function ask_business(text,text,int), business_briefing(text,int)
  from public, anon, authenticated;
grant execute on function ask_business(text,text,int), business_briefing(text,int)
  to service_role;

-- ============================================================================
-- CHECK
--   select ask_business('damai-clinic', 'bookings_count', 7);
--   select ask_business('damai-clinic', 'top_services', 30);
--   select business_briefing('damai-clinic', 7);
--
--   -- give a business its insights agent:
--   select add_agent('damai-clinic', '{"sector":"owner","agent":"Rami"}'::json);
--   -- then open /demo/damai-clinic?agent=rami while signed in as the owner
-- ============================================================================
